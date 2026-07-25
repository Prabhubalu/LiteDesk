'use strict';

/**
 * WebSocket gateway for Astra Studio multiplayer (Yjs + Awareness + data channel).
 * Protocol (binary):
 *   byte0 = 0 → Yjs update
 *   byte0 = 1 → Awareness update
 *   byte0 = 2 → JSON data channel (server→client)
 *
 * Auth: ?token=JWT&canvasId=[&linkToken=]
 */

const { WebSocketServer } = require('ws');
const url = require('url');
const { isAstraStudioEnabled } = require('../services/astraStudio/flags');
const { isAstraV2Enabled } = require('../services/astra/flags');
const AstraCanvas = require('../models/AstraCanvas');
const { canViewCanvas, canEditCanvas, linkShareRole } = require('../services/astraStudio/canvasAcl');
const { bindRoomPersistence } = require('../services/astraStudio/canvasService');
const {
  attachSocket,
  detachSocket,
  applyRemoteUpdate,
  applyRemoteAwareness,
} = require('../services/astraStudio/yjsRoomManager');
const { resolveUserFromToken } = require('../utils/resolveUserFromToken');

function attachStudioWebSocket(httpServer) {
  if (!isAstraV2Enabled() || !isAstraStudioEnabled()) {
    console.log('⏭️  Astra Studio WebSocket gateway disabled');
    return null;
  }

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/api/astra/studio/ws',
  });

  wss.on('connection', async (ws, req) => {
    let room = null;
    let clientId = null;
    let canEdit = false;
    let user = null;

    try {
      const parsed = url.parse(req.url, true);
      const token = parsed.query.token;
      const canvasId = parsed.query.canvasId;
      const linkToken = parsed.query.linkToken || null;

      if (!token || !canvasId) {
        ws.close(4401, 'token and canvasId required');
        return;
      }

      user = await resolveUserFromToken(String(token), { lean: true });
      if (!user) {
        ws.close(4401, 'invalid user');
        return;
      }

      const organizationId = user.organizationId;
      const canvas = await AstraCanvas.findOne({
        _id: canvasId,
        organizationId,
        deletedAt: null,
      }).lean();

      if (!canvas) {
        ws.close(4404, 'canvas not found');
        return;
      }

      const linkRole = linkShareRole(canvas, linkToken);
      if (!canViewCanvas(canvas, user._id, { linkToken }) && !linkRole) {
        ws.close(4403, 'forbidden');
        return;
      }

      canEdit = canEditCanvas(canvas, user._id) || linkRole === 'editor';

      room = bindRoomPersistence(organizationId, canvas._id, canvas.yjsState);
      attachSocket(room, ws);

      clientId = room.doc.clientID;
      room.awareness.setLocalStateField('user', {
        id: String(user._id),
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
        color: colorFromId(String(user._id)),
        canEdit,
      });

      ws.send(
        Buffer.concat([
          Buffer.from([2]),
          Buffer.from(
            JSON.stringify({
              type: 'ready',
              canvasId: String(canvas._id),
              canEdit,
              userId: String(user._id),
            })
          ),
        ])
      );
    } catch (err) {
      try {
        ws.close(4401, err.message || 'auth failed');
      } catch (_e) {
        // ignore
      }
      return;
    }

    ws.on('message', (data) => {
      if (!room) return;
      try {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (buf.length < 2) return;
        const type = buf[0];
        const payload = buf.subarray(1);
        if (type === 0) {
          if (!canEdit) return;
          applyRemoteUpdate(room, new Uint8Array(payload), ws);
        } else if (type === 1) {
          applyRemoteAwareness(room, new Uint8Array(payload), ws);
        }
      } catch (_e) {
        // ignore bad frames
      }
    });

    ws.on('close', () => {
      if (room) {
        detachSocket(room, ws, clientId);
      }
    });
  });

  console.log('✅ Astra Studio WebSocket gateway at /api/astra/studio/ws');
  return wss;
}

function colorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 70% 45%)`;
}

module.exports = {
  attachStudioWebSocket,
};
