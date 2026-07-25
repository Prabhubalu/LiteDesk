'use strict';

/**
 * In-memory Y.Doc room manager with Redis pub/sub fanout for multi-instance.
 * Persistence is handled by canvasPersistence (debounced).
 */

const Y = require('yjs');
const { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } = require('y-protocols/awareness');
const { docFromState, encodeDoc } = require('./yjsDocument');

/** @type {Map<string, { doc: Y.Doc, awareness: Awareness, sockets: Set, persistTimer: NodeJS.Timeout|null, canvasId: string, organizationId: string }>} */
const rooms = new Map();

let redisPub = null;
let redisSub = null;
let redisReady = false;

function roomKey(organizationId, canvasId) {
  return `${organizationId}:${canvasId}`;
}

async function ensureRedis() {
  if (isPubOpen() && redisSub?.isOpen) return;
  redisReady = false;
  try {
    const { createClient } = require('redis');
    const {
      getRedisClient,
      isRedisConfigured,
      buildRedisUrl,
      defaultReconnectStrategy,
      registerManagedClient,
    } = require('../../lib/redisClient');
    if (!isRedisConfigured()) return;
    redisPub = await getRedisClient({ component: 'astra-studio-pub' });
    const url = buildRedisUrl();
    if (!url || !redisPub || !redisPub.isOpen) return;
    if (!redisSub || !redisSub.isOpen) {
      redisSub = createClient({
        url,
        socket: {
          connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '5000', 10),
          reconnectStrategy: defaultReconnectStrategy,
        },
      });
      registerManagedClient(redisSub);
      await redisSub.connect();
      await redisSub.subscribe('astra-studio:yjs', (message) => {
        try {
          const parsed = JSON.parse(message);
          const { key, origin, updateBase64, awarenessBase64 } = parsed;
          const room = rooms.get(key);
          if (!room || origin === process.pid) return;
          if (updateBase64) {
            const update = Buffer.from(updateBase64, 'base64');
            Y.applyUpdate(room.doc, update, 'redis');
          }
          if (awarenessBase64 && room.awareness) {
            const update = Buffer.from(awarenessBase64, 'base64');
            applyAwarenessUpdate(room.awareness, update, 'redis');
          }
        } catch (_e) {
          // ignore malformed
        }
      });
    }
    redisReady = true;
  } catch (_e) {
    redisReady = false;
  }
}

function isPubOpen() {
  return Boolean(redisPub && redisReady && redisPub.isOpen);
}

function publishRedis(key, payload) {
  if (!isPubOpen()) {
    void ensureRedis();
    return;
  }
  let result;
  try {
    result = redisPub.publish(
      'astra-studio:yjs',
      JSON.stringify({ key, origin: process.pid, ...payload })
    );
  } catch (_e) {
    redisReady = false;
    void ensureRedis();
    return;
  }
  // node-redis v4+ returns a Promise — unhandled rejection crashes the process
  if (result && typeof result.then === 'function') {
    result.catch((err) => {
      if (err?.name === 'ClientClosedError' || /closed/i.test(String(err?.message || ''))) {
        redisReady = false;
        void ensureRedis();
      }
    });
  }
}

/**
 * @param {object} opts
 * @param {string} opts.organizationId
 * @param {string} opts.canvasId
 * @param {Buffer|null} opts.yjsState
 * @param {(canvasId: string, organizationId: string, state: Buffer) => void} [opts.onPersist]
 */
function getOrCreateRoom({ organizationId, canvasId, yjsState, onPersist }) {
  const key = roomKey(organizationId, canvasId);
  let room = rooms.get(key);
  if (room) return room;

  const doc = docFromState(yjsState);
  const awareness = new Awareness(doc);
  room = {
    key,
    doc,
    awareness,
    sockets: new Set(),
    persistTimer: null,
    canvasId,
    organizationId,
    onPersist: onPersist || null,
  };

  doc.on('update', (update, origin) => {
    if (origin === 'redis') return;
    // broadcast to local sockets
    const msg = Buffer.concat([
      Buffer.from([0]), // type 0 = sync update
      Buffer.from(update),
    ]);
    for (const ws of room.sockets) {
      if (ws.readyState === 1 && origin !== ws) {
        try {
          ws.send(msg);
        } catch (_e) {
          // ignore
        }
      }
    }
    publishRedis(key, { updateBase64: Buffer.from(update).toString('base64') });
    schedulePersist(room);
  });

  awareness.on('update', ({ added, updated, removed }, origin) => {
    if (origin === 'redis') return;
    const changed = added.concat(updated, removed);
    const update = encodeAwarenessUpdate(awareness, changed);
    const msg = Buffer.concat([Buffer.from([1]), Buffer.from(update)]);
    for (const ws of room.sockets) {
      if (ws.readyState === 1 && origin !== ws) {
        try {
          ws.send(msg);
        } catch (_e) {
          // ignore
        }
      }
    }
    publishRedis(key, { awarenessBase64: Buffer.from(update).toString('base64') });
  });

  rooms.set(key, room);
  void ensureRedis();
  return room;
}

function schedulePersist(room) {
  if (room.persistTimer) clearTimeout(room.persistTimer);
  room.persistTimer = setTimeout(() => {
    room.persistTimer = null;
    if (typeof room.onPersist !== 'function') return;
    try {
      const state = encodeDoc(room.doc);
      room.onPersist(room.canvasId, room.organizationId, state);
    } catch (_e) {
      // ignore
    }
  }, 1500);
}

function attachSocket(room, ws) {
  room.sockets.add(ws);
  // send full state
  const state = Y.encodeStateAsUpdate(room.doc);
  ws.send(Buffer.concat([Buffer.from([0]), Buffer.from(state)]));
  const awarenessStates = Array.from(room.awareness.getStates().keys());
  if (awarenessStates.length) {
    const aw = encodeAwarenessUpdate(room.awareness, awarenessStates);
    ws.send(Buffer.concat([Buffer.from([1]), Buffer.from(aw)]));
  }
}

function detachSocket(room, ws, clientId) {
  room.sockets.delete(ws);
  if (clientId != null) {
    removeAwarenessStates(room.awareness, [clientId], 'disconnect');
  }
  if (room.sockets.size === 0) {
    // Flush latest doc before the room can go cold (resize/drag must survive refresh)
    if (room.persistTimer) clearTimeout(room.persistTimer);
    room.persistTimer = null;
    if (typeof room.onPersist === 'function') {
      try {
        room.onPersist(room.canvasId, room.organizationId, encodeDoc(room.doc));
      } catch (_e) {
        // ignore
      }
    }
    // keep room warm briefly then drop
    setTimeout(() => {
      if (room.sockets.size === 0) {
        rooms.delete(room.key);
      }
    }, 30000);
  }
}

function applyRemoteUpdate(room, update, originWs) {
  Y.applyUpdate(room.doc, update, originWs);
}

function applyRemoteAwareness(room, update, originWs) {
  applyAwarenessUpdate(room.awareness, update, originWs);
}

/** Apply ops from server-side AI tools and broadcast. */
function applyOpsToRoom(room, ops) {
  const { applyCanvasOps } = require('./yjsDocument');
  applyCanvasOps(room.doc, ops);
}

function getRoom(organizationId, canvasId) {
  return rooms.get(roomKey(organizationId, canvasId)) || null;
}

module.exports = {
  getOrCreateRoom,
  attachSocket,
  detachSocket,
  applyRemoteUpdate,
  applyRemoteAwareness,
  applyOpsToRoom,
  getRoom,
  roomKey,
  /** @internal test helper */
  _rooms: rooms,
};
