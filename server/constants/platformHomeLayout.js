'use strict';

const mongoose = require('mongoose');

const BUILTIN_PLATFORM_HOME_TYPES = new Set([
  'intent-bar',
  'today-brief',
  'alerts',
  'apps',
  'up-next',
  'recent-work',
  'inbox'
]);

const MAX_PLATFORM_HOME_ITEMS = 40;
const PLATFORM_HOME_WIDTH_MODES = new Set(['compact', 'wide']);

const PlatformHomeLayoutItemSchema = new mongoose.Schema({
  instanceId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  widgetId: {
    type: String,
    default: null
  },
  enabled: {
    type: Boolean,
    default: true
  },
  x: {
    type: Number,
    required: true
  },
  y: {
    type: Number,
    required: true
  },
  w: {
    type: Number,
    required: true
  },
  h: {
    type: Number,
    required: true
  },
  minW: {
    type: Number,
    default: 2
  },
  minH: {
    type: Number,
    default: 2
  }
}, { _id: false });

const PlatformHomeLayoutSchema = new mongoose.Schema({
  items: {
    type: [PlatformHomeLayoutItemSchema],
    default: []
  },
  widthMode: {
    type: String,
    enum: ['compact', 'wide'],
    default: 'wide'
  }
}, { _id: false });

function sanitizePlatformHomeWidthMode(raw) {
  const mode = String(raw || 'wide').trim();
  return PLATFORM_HOME_WIDTH_MODES.has(mode) ? mode : 'wide';
}

function sanitizePlatformHomeLayoutItem(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const type = String(raw.type || '').trim();
  if (!type) return null;

  if (type === 'analytics') {
    const widgetId = String(raw.widgetId || '').trim();
    if (!widgetId) return null;
  } else if (!BUILTIN_PLATFORM_HOME_TYPES.has(type)) {
    return null;
  }

  const instanceId = String(raw.instanceId || '').trim();
  if (!instanceId) return null;

  const x = Number(raw.x);
  const y = Number(raw.y);
  const w = Number(raw.w);
  const h = Number(raw.h);
  if (![x, y, w, h].every((value) => Number.isFinite(value))) return null;

  return {
    instanceId,
    type,
    widgetId: type === 'analytics' ? String(raw.widgetId) : null,
    enabled: raw.enabled !== false,
    x: Math.max(0, Math.min(11, x)),
    y: Math.max(0, y),
    w: Math.max(2, Math.min(12, w)),
    h: Math.max(1, Math.min(20, h)),
    minW: Math.max(2, Number(raw.minW) || 2),
    minH: Math.max(1, Number(raw.minH) || 2)
  };
}

function sanitizePlatformHomeLayoutItems(items) {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  const sanitized = [];

  for (const raw of items) {
    const item = sanitizePlatformHomeLayoutItem(raw);
    if (!item || seen.has(item.instanceId)) continue;
    seen.add(item.instanceId);
    sanitized.push(item);
    if (sanitized.length >= MAX_PLATFORM_HOME_ITEMS) break;
  }

  return sanitized;
}

function sanitizePlatformHomeLayoutPayload(body) {
  return {
    items: sanitizePlatformHomeLayoutItems(body?.items),
    widthMode: sanitizePlatformHomeWidthMode(body?.widthMode)
  };
}

function normalizeStoredPlatformHomeLayout(stored) {
  if (!stored || typeof stored !== 'object') return null;

  const items = sanitizePlatformHomeLayoutItems(stored.items);
  const widthMode = sanitizePlatformHomeWidthMode(stored.widthMode);

  if (!items.length) {
    return { items: [], widthMode };
  }

  return { items, widthMode };
}

module.exports = {
  BUILTIN_PLATFORM_HOME_TYPES,
  MAX_PLATFORM_HOME_ITEMS,
  PLATFORM_HOME_WIDTH_MODES,
  PlatformHomeLayoutItemSchema,
  PlatformHomeLayoutSchema,
  sanitizePlatformHomeLayoutPayload,
  sanitizePlatformHomeLayoutItems,
  sanitizePlatformHomeLayoutItem,
  sanitizePlatformHomeWidthMode,
  normalizeStoredPlatformHomeLayout
};
