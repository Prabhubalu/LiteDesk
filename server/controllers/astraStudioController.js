'use strict';

const canvasService = require('../services/astraStudio/canvasService');
const { buildTemplateOps, TEMPLATE_META } = require('../services/astraStudio/templates');
const { isAstraStudioEnabled } = require('../services/astraStudio/flags');
const AstraCanvasSuggestion = require('../models/AstraCanvasSuggestion');
const AstraCanvasComment = require('../models/AstraCanvasComment');
const { canViewCanvas, canEditCanvas } = require('../services/astraStudio/canvasAcl');
const { queueExport } = require('../services/astraStudio/exportService');

function orgId(req) {
  return req.user.organizationId;
}

function userId(req) {
  return req.user._id;
}

async function getStatus(req, res) {
  return res.json({
    success: true,
    data: {
      enabled: isAstraStudioEnabled(),
      templates: TEMPLATE_META,
    },
  });
}

async function listCanvases(req, res) {
  try {
    const { status, limit, skip } = req.query;
    const result = await canvasService.listCanvases({
      organizationId: orgId(req),
      userId: userId(req),
      status,
      limit: limit ? Number(limit) : 50,
      skip: skip ? Number(skip) : 0,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getCanvas(req, res) {
  try {
    const result = await canvasService.getCanvas({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
      linkToken: req.query.token,
    });
    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Canvas not found' });
    }
    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    let summary = { sectionCount: 0, widgetCount: 0, sections: [], widgets: [] };
    try {
      summary = canvasService.getCanvasSummary(result.canvas);
    } catch (summaryErr) {
      console.warn('[astra-studio] getCanvasSummary failed:', summaryErr.message);
    }
    // Explicit DTO — never serialize yjsState / BSON Binary into JSON
    const src = result.canvas;
    const canvas = {
      _id: String(src._id),
      organizationId: src.organizationId ? String(src.organizationId) : null,
      title: src.title,
      canvasType: src.canvasType,
      focus: Array.isArray(src.focus)
        ? src.focus.map((f) => ({
            moduleKey: f.moduleKey,
            recordId: f.recordId ? String(f.recordId) : null,
          }))
        : [],
      permissions: {
        ownerId: src.permissions?.ownerId ? String(src.permissions.ownerId) : null,
        editorIds: (src.permissions?.editorIds || []).map(String),
        viewerIds: (src.permissions?.viewerIds || []).map(String),
        linkShare: {
          enabled: Boolean(src.permissions?.linkShare?.enabled),
          role: src.permissions?.linkShare?.role || 'viewer',
          token: src.permissions?.linkShare?.token || null,
        },
      },
      layoutMeta: src.layoutMeta || { cameraX: 0, cameraY: 0, zoom: 1 },
      status: src.status,
      createdBy: src.createdBy ? String(src.createdBy) : null,
      updatedBy: src.updatedBy ? String(src.updatedBy) : null,
      createdAt: src.createdAt,
      updatedAt: src.updatedAt,
    };
    return res.json({
      success: true,
      data: {
        canvas,
        summary,
        hasYjsState: Boolean(toUint8Len(src.yjsState)),
      },
    });
  } catch (err) {
    console.error('[astra-studio] getCanvas error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

function toUint8Len(state) {
  if (!state) return 0;
  if (typeof state.length === 'number') return state.length;
  if (state.buffer && typeof state.buffer.byteLength === 'number') return state.buffer.byteLength;
  if (state.buffer && typeof state.buffer.length === 'number') return state.buffer.length;
  return 0;
}

async function createCanvas(req, res) {
  try {
    const { title, canvasType, focus, generate, prompt } = req.body || {};
    const promptText = String(prompt || title || '').trim();
    let resolvedType = canvasType;
    let intent = null;
    if (generate && promptText) {
      try {
        const { classifyCanvasIntent } = require('../services/astraStudio/classifyCanvasType');
        const classified = await classifyCanvasIntent({
          organizationId: orgId(req),
          prompt: promptText,
          hintType: canvasType,
        });
        resolvedType = classified.canvasType || canvasType;
        intent = classified.intent || null;
      } catch (classifyErr) {
        console.warn('[astraStudio] canvas type classify failed:', classifyErr?.message || classifyErr);
      }
    }

    const canvas = await canvasService.createCanvas({
      organizationId: orgId(req),
      userId: userId(req),
      title,
      canvasType: resolvedType,
      focus,
      status: generate ? 'active' : 'draft',
    });

    if (generate || (resolvedType && resolvedType !== 'blank')) {
      const built = buildTemplateOps(canvas.canvasType, {
        title: canvas.title,
        focus: canvas.focus,
      });
      if (built.ops.length) {
        await canvasService.applyOps({
          organizationId: orgId(req),
          canvasId: canvas._id,
          ops: built.ops,
          actorUserId: userId(req),
          reason: 'ai',
        });
        if (built.titleHint && (!title || title === 'Untitled canvas')) {
          await canvasService.updateCanvasMeta({
            organizationId: orgId(req),
            canvasId: canvas._id,
            userId: userId(req),
            patch: { title: built.titleHint },
          });
        }
      }

      // Resolve CRM focus + fill AI widgets (agents/LLM path)
      try {
        const { hydrateCanvas } = require('../services/astraStudio/canvasHydrateService');
        await hydrateCanvas({
          organizationId: orgId(req),
          userId: userId(req),
          canvasId: canvas._id,
          prompt: prompt || title || '',
          canvasType: canvas.canvasType,
          focus: Array.isArray(focus) ? focus : canvas.focus || [],
          force: true,
          intent,
        });
      } catch (hydrateErr) {
        console.warn('[astraStudio] hydrate failed:', hydrateErr?.message || hydrateErr);
      }
    }

    const refreshed = await canvasService.getCanvas({
      organizationId: orgId(req),
      canvasId: canvas._id,
      userId: userId(req),
    });
    const out = { ...refreshed.canvas };
    delete out.yjsState;
    return res.status(201).json({ success: true, data: { canvas: out } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateCanvas(req, res) {
  try {
    const result = await canvasService.updateCanvasMeta({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
      patch: req.body || {},
    });
    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Canvas not found' });
    }
    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const canvas = { ...result.canvas };
    delete canvas.yjsState;
    return res.json({ success: true, data: { canvas } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteCanvas(req, res) {
  try {
    const result = await canvasService.softDeleteCanvas({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
    });
    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Canvas not found' });
    }
    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateSharing(req, res) {
  try {
    const result = await canvasService.updateSharing({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
      sharing: req.body || {},
    });
    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Canvas not found' });
    }
    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const canvas = { ...result.canvas };
    delete canvas.yjsState;
    return res.json({ success: true, data: { canvas } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function listRevisions(req, res) {
  try {
    const result = await canvasService.listRevisions({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
    });
    if (result.error) {
      const code = result.error === 'NOT_FOUND' ? 404 : 403;
      return res.status(code).json({ success: false, message: result.error });
    }
    return res.json({ success: true, data: { items: result.items } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createRevision(req, res) {
  try {
    const result = await canvasService.createRevision({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
      reason: req.body?.reason || 'manual',
    });
    if (result.error) {
      const code = result.error === 'NOT_FOUND' ? 404 : 403;
      return res.status(code).json({ success: false, message: result.error });
    }
    const revision = { ...result.revision };
    delete revision.yjsState;
    return res.status(201).json({ success: true, data: { revision } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function restoreRevision(req, res) {
  try {
    const result = await canvasService.restoreRevision({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
      versionNumber: Number(req.params.versionNumber),
    });
    if (result.error === 'NOT_FOUND' || result.error === 'REVISION_NOT_FOUND') {
      return res.status(404).json({ success: false, message: result.error });
    }
    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function applyOps(req, res) {
  try {
    const ops = req.body?.ops;
    if (!Array.isArray(ops)) {
      return res.status(400).json({ success: false, message: 'ops array required' });
    }
    const access = await canvasService.getCanvas({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
    });
    if (access.error) {
      const code = access.error === 'NOT_FOUND' ? 404 : 403;
      return res.status(code).json({ success: false, message: access.error });
    }
    if (!canEditCanvas(access.canvas, userId(req))) {
      return res.status(403).json({ success: false, message: 'Edit access required' });
    }
    const result = await canvasService.applyOps({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      ops,
      actorUserId: userId(req),
      reason: req.body?.reason || 'manual',
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function listSuggestions(req, res) {
  try {
    const access = await canvasService.getCanvas({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
    });
    if (access.error) {
      const code = access.error === 'NOT_FOUND' ? 404 : 403;
      return res.status(code).json({ success: false, message: access.error });
    }
    const items = await AstraCanvasSuggestion.find({
      canvasId: req.params.canvasId,
      organizationId: orgId(req),
      status: req.query.status || 'pending',
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.json({ success: true, data: { items } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function resolveSuggestion(req, res) {
  try {
    const status = req.body?.status;
    if (!['accepted', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be accepted|dismissed' });
    }
    const access = await canvasService.getCanvas({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
    });
    if (access.error || !canEditCanvas(access.canvas, userId(req))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const suggestion = await AstraCanvasSuggestion.findOneAndUpdate(
      {
        _id: req.params.suggestionId,
        canvasId: req.params.canvasId,
        organizationId: orgId(req),
      },
      {
        $set: {
          status,
          resolvedBy: userId(req),
          resolvedAt: new Date(),
        },
      },
      { new: true }
    ).lean();
    if (!suggestion) {
      return res.status(404).json({ success: false, message: 'Suggestion not found' });
    }

    if (status === 'accepted' && suggestion.actionPayload?.ops) {
      await canvasService.applyOps({
        organizationId: orgId(req),
        canvasId: req.params.canvasId,
        ops: suggestion.actionPayload.ops,
        actorUserId: userId(req),
        reason: 'ai',
      });
    }

    return res.json({ success: true, data: { suggestion } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function listComments(req, res) {
  try {
    const access = await canvasService.getCanvas({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
    });
    if (access.error) {
      const code = access.error === 'NOT_FOUND' ? 404 : 403;
      return res.status(code).json({ success: false, message: access.error });
    }
    const items = await AstraCanvasComment.find({
      canvasId: req.params.canvasId,
      organizationId: orgId(req),
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return res.json({ success: true, data: { items } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createComment(req, res) {
  try {
    const access = await canvasService.getCanvas({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
    });
    if (access.error || !canViewCanvas(access.canvas, userId(req))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const body = String(req.body?.body || '').trim();
    if (!body) {
      return res.status(400).json({ success: false, message: 'body required' });
    }
    const comment = await AstraCanvasComment.create({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      widgetId: req.body?.widgetId || null,
      anchorX: req.body?.anchorX ?? null,
      anchorY: req.body?.anchorY ?? null,
      body,
      mentionUserIds: Array.isArray(req.body?.mentionUserIds) ? req.body.mentionUserIds : [],
      isAi: Boolean(req.body?.isAi),
      approvalStatus: req.body?.approvalStatus || 'none',
      createdBy: userId(req),
    });
    return res.status(201).json({ success: true, data: { comment: comment.toObject() } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function exportCanvas(req, res) {
  try {
    const format = String(req.body?.format || req.query.format || 'pdf').toLowerCase();
    const access = await canvasService.getCanvas({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
    });
    if (access.error) {
      const code = access.error === 'NOT_FOUND' ? 404 : 403;
      return res.status(code).json({ success: false, message: access.error });
    }
    const job = await queueExport({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
      format,
      canvas: access.canvas,
    });
    return res.status(202).json({ success: true, data: job });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function hydrateCanvasEndpoint(req, res) {
  try {
    const access = await canvasService.getCanvas({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
    });
    if (access.error === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Canvas not found' });
    }
    if (access.error === 'FORBIDDEN') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const canvas = access.canvas || {};
    const { hydrateCanvas } = require('../services/astraStudio/canvasHydrateService');
    const prompt =
      String(req.body?.prompt || canvas.title || '').trim()
      || '';
    const result = await hydrateCanvas({
      organizationId: orgId(req),
      userId: userId(req),
      canvasId: req.params.canvasId,
      prompt,
      canvasType: canvas.canvasType || 'meeting_preparation',
      focus: Array.isArray(req.body?.focus) ? req.body.focus : (canvas.focus || []),
      force: Boolean(req.body?.force),
    });
    const refreshed = await canvasService.getCanvas({
      organizationId: orgId(req),
      canvasId: req.params.canvasId,
      userId: userId(req),
    });
    const out = { ...(refreshed.canvas || {}) };
    delete out.yjsState;
    return res.json({
      success: true,
      data: {
        canvas: out,
        hydrate: {
          ok: result?.ok !== false,
          updated: result?.updated || 0,
          focus: result?.focus || [],
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getStatus,
  listCanvases,
  getCanvas,
  createCanvas,
  updateCanvas,
  deleteCanvas,
  updateSharing,
  listRevisions,
  createRevision,
  restoreRevision,
  applyOps,
  listSuggestions,
  resolveSuggestion,
  listComments,
  createComment,
  exportCanvas,
  hydrateCanvasEndpoint,
};
