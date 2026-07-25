'use strict';

const crypto = require('crypto');
const AstraCanvas = require('../../models/AstraCanvas');
const AstraCanvasRevision = require('../../models/AstraCanvasRevision');
const {
  createEmptyCanvasDoc,
  encodeDoc,
  hashState,
  docFromState,
  summarizeDoc,
  applyCanvasOps,
} = require('./yjsDocument');
const { canViewCanvas, canEditCanvas, canManageCanvas } = require('./canvasAcl');
const { getOrCreateRoom, applyOpsToRoom, getRoom } = require('./yjsRoomManager');
const { CANVAS_TYPES } = require('./constants');

function toOrgObjectId(organizationId) {
  return organizationId;
}

async function persistYjsState(canvasId, organizationId, state) {
  await AstraCanvas.updateOne(
    { _id: canvasId, organizationId, deletedAt: null },
    {
      $set: {
        yjsState: state,
        yjsClock: Date.now(),
      },
      $inc: {},
    }
  );
}

function bindRoomPersistence(organizationId, canvasId, yjsState) {
  return getOrCreateRoom({
    organizationId: String(organizationId),
    canvasId: String(canvasId),
    yjsState,
    onPersist: (cId, orgId, state) => {
      void persistYjsState(cId, orgId, state);
    },
  });
}

async function listCanvases({ organizationId, userId, status, limit = 50, skip = 0 }) {
  const uid = userId;
  const filter = {
    organizationId: toOrgObjectId(organizationId),
    deletedAt: null,
    $or: [
      { 'permissions.ownerId': uid },
      { 'permissions.editorIds': uid },
      { 'permissions.viewerIds': uid },
    ],
  };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    AstraCanvas.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(Math.min(limit, 100))
      .select('-yjsState')
      .lean(),
    AstraCanvas.countDocuments(filter),
  ]);
  return { items, total };
}

async function getCanvas({ organizationId, canvasId, userId, linkToken }) {
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(String(canvasId || ''))) {
    return { error: 'NOT_FOUND' };
  }
  let canvas;
  try {
    canvas = await AstraCanvas.findOne({
      _id: canvasId,
      organizationId,
      deletedAt: null,
    }).lean();
  } catch (err) {
    console.error('[astra-studio] getCanvas query failed:', err.message);
    return { error: 'NOT_FOUND' };
  }
  if (!canvas) return { error: 'NOT_FOUND' };
  if (!canViewCanvas(canvas, userId, { linkToken })) {
    return { error: 'FORBIDDEN' };
  }
  return { canvas };
}

async function createCanvas({
  organizationId,
  userId,
  title,
  canvasType = 'blank',
  focus = [],
  status = 'draft',
}) {
  const type = CANVAS_TYPES.includes(canvasType) ? canvasType : 'blank';
  const doc = createEmptyCanvasDoc();
  const yjsState = encodeDoc(doc);
  const canvas = await AstraCanvas.create({
    organizationId,
    title: title || 'Untitled canvas',
    canvasType: type,
    focus: Array.isArray(focus) ? focus : [],
    permissions: {
      ownerId: userId,
      editorIds: [],
      viewerIds: [],
      linkShare: { enabled: false, role: 'viewer', token: null },
    },
    yjsState,
    yjsClock: Date.now(),
    status,
    createdBy: userId,
    updatedBy: userId,
  });
  bindRoomPersistence(organizationId, canvas._id, yjsState);
  return canvas.toObject ? canvas.toObject() : canvas;
}

async function updateCanvasMeta({ organizationId, canvasId, userId, patch }) {
  const canvas = await AstraCanvas.findOne({
    _id: canvasId,
    organizationId,
    deletedAt: null,
  });
  if (!canvas) return { error: 'NOT_FOUND' };
  if (!canEditCanvas(canvas, userId)) return { error: 'FORBIDDEN' };

  if (typeof patch.title === 'string' && patch.title.trim()) {
    canvas.title = patch.title.trim().slice(0, 240);
  }
  if (patch.status && ['draft', 'active', 'archived'].includes(patch.status)) {
    canvas.status = patch.status;
  }
  if (Array.isArray(patch.focus)) {
    canvas.focus = patch.focus;
  }
  if (patch.layoutMeta && typeof patch.layoutMeta === 'object') {
    canvas.layoutMeta = { ...canvas.layoutMeta?.toObject?.() || canvas.layoutMeta, ...patch.layoutMeta };
  }
  if (patch.canvasType && CANVAS_TYPES.includes(patch.canvasType)) {
    canvas.canvasType = patch.canvasType;
  }
  canvas.updatedBy = userId;
  await canvas.save();
  return { canvas: canvas.toObject() };
}

async function softDeleteCanvas({ organizationId, canvasId, userId }) {
  const canvas = await AstraCanvas.findOne({
    _id: canvasId,
    organizationId,
    deletedAt: null,
  });
  if (!canvas) return { error: 'NOT_FOUND' };
  if (!canManageCanvas(canvas, userId)) return { error: 'FORBIDDEN' };
  canvas.deletedAt = new Date();
  canvas.deletedBy = userId;
  canvas.updatedBy = userId;
  await canvas.save();
  return { ok: true };
}

async function updateSharing({ organizationId, canvasId, userId, sharing }) {
  const canvas = await AstraCanvas.findOne({
    _id: canvasId,
    organizationId,
    deletedAt: null,
  });
  if (!canvas) return { error: 'NOT_FOUND' };
  if (!canManageCanvas(canvas, userId)) return { error: 'FORBIDDEN' };

  if (Array.isArray(sharing.editorIds)) {
    canvas.permissions.editorIds = sharing.editorIds;
  }
  if (Array.isArray(sharing.viewerIds)) {
    canvas.permissions.viewerIds = sharing.viewerIds;
  }
  if (sharing.linkShare && typeof sharing.linkShare === 'object') {
    const ls = canvas.permissions.linkShare || {};
    if (typeof sharing.linkShare.enabled === 'boolean') {
      ls.enabled = sharing.linkShare.enabled;
      if (ls.enabled && !ls.token) {
        ls.token = crypto.randomBytes(24).toString('hex');
      }
      if (!ls.enabled) {
        ls.token = null;
      }
    }
    if (sharing.linkShare.role === 'editor' || sharing.linkShare.role === 'viewer') {
      ls.role = sharing.linkShare.role;
    }
    canvas.permissions.linkShare = ls;
  }
  canvas.updatedBy = userId;
  await canvas.save();
  return { canvas: canvas.toObject() };
}

async function createRevision({ organizationId, canvasId, userId, reason = 'checkpoint' }) {
  const canvas = await AstraCanvas.findOne({
    _id: canvasId,
    organizationId,
    deletedAt: null,
  });
  if (!canvas) return { error: 'NOT_FOUND' };
  if (!canEditCanvas(canvas, userId) && reason !== 'ai') {
    // AI system path may pass null userId with reason ai — allow with org match
    if (!(reason === 'ai' && !userId)) return { error: 'FORBIDDEN' };
  }

  let state = canvas.yjsState;
  const room = getRoom(String(organizationId), String(canvasId));
  if (room) {
    state = encodeDoc(room.doc);
    canvas.yjsState = state;
    canvas.yjsClock = Date.now();
    await canvas.save();
  }
  if (!state || !state.length) {
    state = encodeDoc(createEmptyCanvasDoc());
  }

  const latest = await AstraCanvasRevision.findOne({ canvasId })
    .sort({ versionNumber: -1 })
    .select('versionNumber')
    .lean();
  const versionNumber = (latest?.versionNumber || 0) + 1;
  const revision = await AstraCanvasRevision.create({
    organizationId,
    canvasId,
    versionNumber,
    title: canvas.title,
    yjsState: state,
    yjsStateHash: hashState(state),
    reason,
    createdBy: userId || null,
  });
  return { revision: revision.toObject() };
}

async function listRevisions({ organizationId, canvasId, userId, limit = 30 }) {
  const canvas = await AstraCanvas.findOne({
    _id: canvasId,
    organizationId,
    deletedAt: null,
  })
    .select('permissions')
    .lean();
  if (!canvas) return { error: 'NOT_FOUND' };
  if (!canViewCanvas(canvas, userId)) return { error: 'FORBIDDEN' };

  const items = await AstraCanvasRevision.find({ canvasId, organizationId })
    .sort({ versionNumber: -1 })
    .limit(Math.min(limit, 100))
    .select('-yjsState')
    .lean();
  return { items };
}

async function restoreRevision({ organizationId, canvasId, userId, versionNumber }) {
  const canvas = await AstraCanvas.findOne({
    _id: canvasId,
    organizationId,
    deletedAt: null,
  });
  if (!canvas) return { error: 'NOT_FOUND' };
  if (!canEditCanvas(canvas, userId)) return { error: 'FORBIDDEN' };

  const revision = await AstraCanvasRevision.findOne({
    canvasId,
    organizationId,
    versionNumber,
  });
  if (!revision) return { error: 'REVISION_NOT_FOUND' };

  canvas.yjsState = revision.yjsState;
  canvas.yjsClock = Date.now();
  canvas.updatedBy = userId;
  await canvas.save();

  // Hot-reload room if present
  const room = getRoom(String(organizationId), String(canvasId));
  if (room) {
    const fresh = docFromState(revision.yjsState);
    const update = require('yjs').encodeStateAsUpdate(fresh);
    require('yjs').applyUpdate(room.doc, update, 'restore');
  }

  await createRevision({
    organizationId,
    canvasId,
    userId,
    reason: 'restore',
  });

  return { ok: true };
}

/**
 * Apply canvas ops (AI or server) — updates Yjs room + persists.
 */
async function applyOps({ organizationId, canvasId, ops, actorUserId, reason = 'ai' }) {
  const canvas = await AstraCanvas.findOne({
    _id: canvasId,
    organizationId,
    deletedAt: null,
  });
  if (!canvas) return { error: 'NOT_FOUND' };

  const room = bindRoomPersistence(organizationId, canvas._id, canvas.yjsState);
  applyOpsToRoom(room, ops);
  const state = encodeDoc(room.doc);
  canvas.yjsState = state;
  canvas.yjsClock = Date.now();
  if (actorUserId) canvas.updatedBy = actorUserId;
  if (canvas.status === 'draft') canvas.status = 'active';
  await canvas.save();

  if (reason === 'ai' || reason === 'checkpoint') {
    await createRevision({
      organizationId,
      canvasId,
      userId: actorUserId,
      reason,
    });
  }

  return {
    ok: true,
    summary: summarizeDoc(room.doc),
  };
}

function getCanvasSummary(canvas) {
  try {
    const doc = docFromState(canvas?.yjsState);
    return summarizeDoc(doc);
  } catch (err) {
    console.warn('[astra-studio] getCanvasSummary:', err.message);
    return { sectionCount: 0, widgetCount: 0, sections: [], widgets: [] };
  }
}

module.exports = {
  listCanvases,
  getCanvas,
  createCanvas,
  updateCanvasMeta,
  softDeleteCanvas,
  updateSharing,
  createRevision,
  listRevisions,
  restoreRevision,
  applyOps,
  persistYjsState,
  bindRoomPersistence,
  getCanvasSummary,
  applyCanvasOps,
};
