'use strict';

const SettingsAuditLog = require('../models/SettingsAuditLog');
const {
  buildPresentation,
  SURFACE_LABELS
} = require('../utils/settingsAuditHumanize');
const { parseUserAgent } = require('../utils/liveChatUserAgentUtils');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Human-readable device/browser summary from a stored user-agent.
 * @param {string|null|undefined} userAgent
 * @returns {{ label: string|null, browser: string|null, os: string|null, deviceType: string|null }}
 */
function buildClientDevice(userAgent) {
  if (!userAgent || !String(userAgent).trim()) {
    return { label: null, browser: null, os: null, deviceType: null };
  }
  const parsed = parseUserAgent(userAgent);
  const parts = [];
  if (parsed.browserLabel) parts.push(parsed.browserLabel);
  if (parsed.osLabel) parts.push(parsed.osLabel);
  if (parsed.deviceType && parsed.deviceType !== 'desktop') {
    const typeLabel =
      parsed.deviceType.charAt(0).toUpperCase() + parsed.deviceType.slice(1);
    parts.push(typeLabel);
  }
  return {
    label: parts.length ? parts.join(' · ') : null,
    browser: parsed.browserLabel || null,
    os: parsed.osLabel || null,
    deviceType: parsed.deviceType || null
  };
}

/**
 * List settings audit log entries (Admin-only via route middleware).
 * GET /api/settings/audit-log
 */
exports.listSettingsAuditLogs = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization context required'
      });
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(String(req.query.limit || String(DEFAULT_LIMIT)), 10) || DEFAULT_LIMIT)
    );
    const skip = (page - 1) * limit;

    const filter = { organizationId };

    if (req.query.surface) {
      filter.surface = String(req.query.surface).trim();
    }
    if (req.query.action) {
      filter.action = String(req.query.action).trim();
    }
    if (req.query.actorUserId) {
      filter.actorUserId = req.query.actorUserId;
    }

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) {
        const from = new Date(String(req.query.from));
        if (!Number.isNaN(from.getTime())) filter.createdAt.$gte = from;
      }
      if (req.query.to) {
        const to = new Date(String(req.query.to));
        if (!Number.isNaN(to.getTime())) filter.createdAt.$lte = to;
      }
      if (Object.keys(filter.createdAt).length === 0) {
        delete filter.createdAt;
      }
    }

    const [rows, total] = await Promise.all([
      SettingsAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SettingsAuditLog.countDocuments(filter)
    ]);

    const items = rows.map((row) => {
      // Always recompute diffs from before/after — never trust stored change lists
      // (legacy rows listed every form field with empty "previous" values).
      const presentation = buildPresentation({
        surface: row.surface,
        action: row.action,
        path: row.metadata?.path || '',
        before: row.before,
        after: row.after,
        moduleKey: row.metadata?.moduleKey || row.entityId || null
      });
      const device = buildClientDevice(row.userAgent);

      return {
        _id: row._id,
        createdAt: row.createdAt,
        actorName: row.actorName,
        actorEmail: row.actorEmail,
        surface: row.surface,
        action: row.action,
        ipAddress: row.ipAddress || null,
        userAgent: row.userAgent || null,
        device,
        presentation: {
          title: presentation.title,
          subtitle: presentation.subtitle,
          surfaceLabel: presentation.surfaceLabel,
          actionLabel: presentation.actionLabel,
          changes: presentation.changes
        }
      };
    });

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit))
        },
        surfaces: Object.entries(SURFACE_LABELS).map(([id, label]) => ({ id, label }))
      }
    });
  } catch (error) {
    console.error('[settingsAuditController] listSettingsAuditLogs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch settings audit log',
      error: error.message
    });
  }
};

exports.buildClientDevice = buildClientDevice;
