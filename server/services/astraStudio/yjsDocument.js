'use strict';

const Y = require('yjs');
const { encodeStateAsUpdate, applyUpdate } = Y;
const crypto = require('crypto');

function ensureRootStructure(doc) {
  const root = doc.getMap('root');
  if (!root.has('widgets')) root.set('widgets', new Y.Map());
  if (!root.has('sections')) root.set('sections', new Y.Array());
  if (!root.has('meta')) {
    const meta = new Y.Map();
    meta.set('version', 1);
    root.set('meta', meta);
  }
  return root;
}

/**
 * Create an empty Living Canvas Y.Doc with root maps.
 * Structure: root Y.Map → widgets (Y.Map), sections (Y.Array), meta (Y.Map)
 */
function createEmptyCanvasDoc() {
  const doc = new Y.Doc();
  ensureRootStructure(doc);
  return doc;
}

/**
 * Normalize Mongo Buffer / BSON Binary / Uint8Array for Y.applyUpdate.
 * @param {unknown} state
 * @returns {Uint8Array|null}
 */
function toUint8Array(state) {
  if (!state) return null;
  if (state instanceof Uint8Array) {
    return state.length ? state : null;
  }
  if (Buffer.isBuffer(state)) {
    return state.length ? new Uint8Array(state) : null;
  }
  // mongoose / bson Binary
  if (typeof state === 'object') {
    if (typeof state.value === 'function') {
      try {
        const v = state.value(true);
        if (Buffer.isBuffer(v) && v.length) return new Uint8Array(v);
        if (v instanceof Uint8Array && v.length) return v;
      } catch (_e) {
        // fall through
      }
    }
    if (state.buffer instanceof ArrayBuffer && state.buffer.byteLength) {
      return new Uint8Array(state.buffer);
    }
    if (Buffer.isBuffer(state.buffer) && state.buffer.length) {
      return new Uint8Array(state.buffer);
    }
  }
  try {
    const arr = new Uint8Array(state);
    return arr.length ? arr : null;
  } catch (_e) {
    return null;
  }
}

/** @param {Buffer|Uint8Array|null} state */
function docFromState(state) {
  const doc = new Y.Doc();
  const bytes = toUint8Array(state);
  if (bytes) {
    try {
      applyUpdate(doc, bytes);
    } catch (err) {
      console.warn('[astra-studio] yjsState apply failed, using empty doc:', err.message);
    }
  }
  ensureRootStructure(doc);
  return doc;
}

/** @param {Y.Doc} doc */
function encodeDoc(doc) {
  return Buffer.from(encodeStateAsUpdate(doc));
}

function hashState(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Apply structured widget ops to a Y.Doc.
 * @param {Y.Doc} doc
 * @param {Array<{op:string, widget?:object, widgetId?:string, frame?:object, config?:object, section?:object}>} ops
 */
function applyCanvasOps(doc, ops) {
  if (!Array.isArray(ops) || !ops.length) return;
  const root = doc.getMap('root');
  let widgets = root.get('widgets');
  if (!(widgets instanceof Y.Map)) {
    widgets = new Y.Map();
    root.set('widgets', widgets);
  }
  let sections = root.get('sections');
  if (!(sections instanceof Y.Array)) {
    sections = new Y.Array();
    root.set('sections', sections);
  }

  doc.transact(() => {
    for (const op of ops) {
      if (!op || !op.op) continue;
      switch (op.op) {
        case 'addSection': {
          if (op.section && op.section.id) {
            sections.push([op.section]);
          }
          break;
        }
        case 'addWidget': {
          if (op.widget && op.widget.id) {
            const type = String(op.widget.type || '');
            // One widget per type — skip duplicate adds (update existing instead at tool layer).
            let duplicateId = null;
            if (type) {
              widgets.forEach((w, id) => {
                if (duplicateId || id === op.widget.id) return;
                if (String(w?.type || '') === type) duplicateId = id;
              });
            }
            if (duplicateId) {
              const existing = widgets.get(duplicateId);
              if (existing) {
                widgets.set(duplicateId, {
                  ...existing,
                  ...(op.widget.config
                    ? { config: { ...existing.config, ...op.widget.config } }
                    : {}),
                  ...(op.widget.bindings ? { bindings: op.widget.bindings } : {}),
                  ...(op.widget.ai ? { ai: op.widget.ai } : {}),
                });
              }
              break;
            }
            widgets.set(op.widget.id, op.widget);
          }
          break;
        }
        case 'updateWidget': {
          if (!op.widgetId) break;
          const existing = widgets.get(op.widgetId);
          if (!existing) break;
          const next = {
            ...existing,
            ...(op.frame ? { frame: { ...existing.frame, ...op.frame } } : {}),
            ...(op.config ? { config: { ...existing.config, ...op.config } } : {}),
            ...(op.bindings ? { bindings: op.bindings } : {}),
            ...(op.ai ? { ai: op.ai } : {}),
            ...(typeof op.collapsed === 'boolean' ? { collapsed: op.collapsed } : {}),
          };
          widgets.set(op.widgetId, next);
          break;
        }
        case 'moveWidget': {
          if (!op.widgetId || !op.frame) break;
          const existing = widgets.get(op.widgetId);
          if (!existing) break;
          widgets.set(op.widgetId, {
            ...existing,
            frame: { ...existing.frame, ...op.frame },
          });
          break;
        }
        case 'removeWidget': {
          if (op.widgetId) widgets.delete(op.widgetId);
          break;
        }
        case 'replaceSection': {
          // Replace all widgets in a sectionId with new set
          if (!op.sectionId || !Array.isArray(op.widgets)) break;
          const toDelete = [];
          widgets.forEach((w, id) => {
            if (w && w.sectionId === op.sectionId) toDelete.push(id);
          });
          toDelete.forEach((id) => widgets.delete(id));
          for (const w of op.widgets) {
            if (w?.id) widgets.set(w.id, { ...w, sectionId: op.sectionId });
          }
          break;
        }
        default:
          break;
      }
    }
  });
}

/** Serialize widget inventory for AI context (compact). */
function summarizeDoc(doc, { maxWidgets = 40 } = {}) {
  const root = doc.getMap('root');
  const widgets = root.get('widgets');
  const sections = root.get('sections');
  const sectionList = [];
  if (sections instanceof Y.Array) {
    sections.forEach((s) => sectionList.push(s));
  }
  const widgetList = [];
  if (widgets instanceof Y.Map) {
    widgets.forEach((w, id) => {
      if (widgetList.length >= maxWidgets) return;
      widgetList.push({
        id,
        type: w?.type,
        sectionId: w?.sectionId,
        title: w?.config?.title || null,
        bindings: w?.bindings || null,
      });
    });
  }
  return {
    sectionCount: sectionList.length,
    widgetCount: widgets instanceof Y.Map ? widgets.size : 0,
    sections: sectionList,
    widgets: widgetList,
  };
}

function listWidgets(doc) {
  const root = doc.getMap('root');
  const widgets = root.get('widgets');
  const out = [];
  if (widgets instanceof Y.Map) {
    widgets.forEach((w, id) => out.push({ id, ...w }));
  }
  return out;
}

module.exports = {
  createEmptyCanvasDoc,
  docFromState,
  toUint8Array,
  encodeDoc,
  hashState,
  applyCanvasOps,
  summarizeDoc,
  listWidgets,
};
