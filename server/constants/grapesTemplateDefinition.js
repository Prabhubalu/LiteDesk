'use strict';

const GRAPES_ENGINE = 'grapesjs';
const GRAPES_DEFINITION_VERSION = 1;

/**
 * @param {unknown} jsonDefinition
 * @returns {boolean}
 */
function isGrapesTemplateDefinition(jsonDefinition) {
  return (
    jsonDefinition != null
    && typeof jsonDefinition === 'object'
    && !Array.isArray(jsonDefinition)
    && /** @type {{ engine?: string }} */ (jsonDefinition).engine === GRAPES_ENGINE
  );
}

function createBlankGrapesTemplateDefinition() {
  return {
    engine: GRAPES_ENGINE,
    version: GRAPES_DEFINITION_VERSION,
    project: null,
    html: '',
    css: ''
  };
}

/**
 * @param {unknown} project
 * @returns {number}
 */
function countGrapesProjectComponents(project) {
  if (!project || typeof project !== 'object') return 0;
  const pages = /** @type {{ pages?: unknown[] }} */ (project).pages;
  if (!Array.isArray(pages) || pages.length === 0) return 0;

  /**
   * @param {unknown} node
   * @returns {number}
   */
  function countComponents(node) {
    if (!node || typeof node !== 'object') return 0;
    const children = Array.isArray(/** @type {{ components?: unknown[] }} */ (node).components)
      ? /** @type {{ components: unknown[] }} */ (node).components
      : [];
    let count = children.length;
    for (const child of children) {
      count += countComponents(child);
    }
    return count;
  }

  let total = 0;
  for (const page of pages) {
    const frames = /** @type {{ frames?: unknown[] }} */ (page)?.frames;
    if (!Array.isArray(frames)) continue;
    for (const frame of frames) {
      total += countComponents(/** @type {{ component?: unknown }} */ (frame)?.component);
    }
  }
  return total;
}

/**
 * @param {unknown} project
 * @returns {boolean}
 */
function hasGrapesProjectContent(project) {
  return countGrapesProjectComponents(project) > 0;
}

/**
 * @param {unknown} jsonDefinition
 * @returns {boolean}
 */
function hasGrapesTemplateDefinitionContent(jsonDefinition) {
  if (!isGrapesTemplateDefinition(jsonDefinition)) return false;
  const def = /** @type {{ html?: unknown, project?: unknown, importSnapshot?: { html?: unknown } }} */ (
    jsonDefinition
  );
  if (String(def.html || '').trim()) return true;
  if (hasGrapesProjectContent(def.project)) return true;
  if (String(def.importSnapshot?.html || '').trim()) return true;
  return false;
}

/**
 * Renderable canvas content only (ignores importSnapshot recovery payload).
 * @param {unknown} jsonDefinition
 * @returns {boolean}
 */
function hasRenderableGrapesTemplateContent(jsonDefinition) {
  if (!isGrapesTemplateDefinition(jsonDefinition)) return false;
  const def = /** @type {{ html?: unknown, project?: unknown }} */ (jsonDefinition);
  if (String(def.html || '').trim()) return true;
  return hasGrapesProjectContent(def.project);
}

/**
 * HTML body available for email send/render (live html or recovery snapshot).
 * Empty centering shells (tags only, no visible text) do not count.
 * @param {unknown} jsonDefinition
 * @returns {boolean}
 */
function hasEmailHtmlForRender(jsonDefinition) {
  if (!jsonDefinition || typeof jsonDefinition !== 'object') return false;
  const { html } = resolveGrapesEmailSource(jsonDefinition);
  if (!String(html || '').trim()) return false;
  const text = String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0;
}

/**
 * Prefer live html; fall back to importSnapshot when canvas html was wiped.
 * @param {unknown} definition
 * @returns {{ html: string, css: string }}
 */
function resolveGrapesEmailSource(definition) {
  const def = definition && typeof definition === 'object'
    ? /** @type {{ html?: unknown, css?: unknown, importSnapshot?: { html?: unknown, css?: unknown } }} */ (definition)
    : {};
  const liveHtml = String(def.html || '').trim();
  if (liveHtml) {
    return { html: String(def.html || ''), css: String(def.css || '') };
  }
  const snapHtml = String(def.importSnapshot?.html || '').trim();
  if (snapHtml) {
    return {
      html: String(def.importSnapshot?.html || ''),
      css: String(def.importSnapshot?.css || def.css || '')
    };
  }
  return { html: String(def.html || ''), css: String(def.css || '') };
}

/**
 * @param {unknown} html
 * @returns {boolean}
 */
function emailHtmlLooksStructured(html) {
  const source = String(html || '');
  if (/<table\b/i.test(source)) return true;
  if (/<(td|th|tr)\b/i.test(source)) return true;
  const blocks = source.match(/<(div|section|article|header|footer|p|h[1-6]|ul|ol)\b/gi);
  return Boolean(blocks && blocks.length >= 2);
}

/**
 * @param {unknown} html
 * @returns {number}
 */
function emailHtmlWeight(html) {
  const source = String(html || '');
  const tables = (source.match(/<table\b/gi) || []).length;
  return source.trim().length + tables * 500;
}

/**
 * True when incoming email html would wipe a richer existing draft.
 * @param {unknown} incoming
 * @param {unknown} existing
 * @returns {boolean}
 */
function isEmailDefinitionDegraded(incoming, existing) {
  if (!isGrapesTemplateDefinition(existing)) return false;
  const existingDef = /** @type {{ html?: unknown, importSnapshot?: { html?: unknown } }} */ (existing);
  const prevHtml = String(existingDef.html || existingDef.importSnapshot?.html || '').trim();
  if (!prevHtml) return false;

  if (!isGrapesTemplateDefinition(incoming)) return true;
  const incomingDef = /** @type {{ html?: unknown, importSnapshot?: { html?: unknown } }} */ (incoming);
  const nextHtml = String(incomingDef.html || incomingDef.importSnapshot?.html || '').trim();
  if (!nextHtml) return true;

  if (emailHtmlLooksStructured(prevHtml) && !emailHtmlLooksStructured(nextHtml)) {
    return true;
  }

  const prevWeight = emailHtmlWeight(prevHtml);
  const nextWeight = emailHtmlWeight(nextHtml);
  if (prevWeight > 800 && nextWeight < prevWeight * 0.4) {
    return true;
  }
  return false;
}

/**
 * True when incoming would wipe a richer existing draft (empty, flattened tables, severe shrink).
 * PDF source of truth is Grapes `project`; HTML-only quirks are not treated as degradation.
 * @param {unknown} incoming
 * @param {unknown} existing
 * @returns {boolean}
 */
function isGrapesDefinitionDegraded(incoming, existing) {
  if (!isGrapesTemplateDefinition(existing)) return false;
  if (!isGrapesTemplateDefinition(incoming)) return true;

  const prev = /** @type {{ html?: unknown, project?: unknown, importSnapshot?: { html?: unknown } }} */ (existing);
  const next = /** @type {{ html?: unknown, project?: unknown, importSnapshot?: { html?: unknown } }} */ (incoming);

  const prevHtml = String(prev.html || prev.importSnapshot?.html || '').trim();
  const nextHtml = String(next.html || next.importSnapshot?.html || '').trim();
  const prevProjectCount = countGrapesProjectComponents(prev.project);
  const nextProjectCount = countGrapesProjectComponents(next.project);
  const prevHadContent = Boolean(prevHtml) || prevProjectCount > 0;
  const nextHasContent = Boolean(nextHtml) || nextProjectCount > 0;

  if (prevHadContent && !nextHasContent) return true;

  if (prevProjectCount > 15 && nextProjectCount < Math.floor(prevProjectCount * 0.4)) {
    return true;
  }

  if (
    nextProjectCount < 5
    && emailHtmlLooksStructured(prevHtml)
    && !emailHtmlLooksStructured(nextHtml)
  ) {
    return true;
  }

  if (
    nextProjectCount < Math.floor(Math.max(prevProjectCount, 1) * 0.4)
    && prevHtml.length > 800
    && nextHtml.length < Math.floor(prevHtml.length * 0.4)
  ) {
    return true;
  }

  return false;
}

module.exports = {
  GRAPES_ENGINE,
  GRAPES_DEFINITION_VERSION,
  isGrapesTemplateDefinition,
  createBlankGrapesTemplateDefinition,
  hasGrapesTemplateDefinitionContent,
  hasRenderableGrapesTemplateContent,
  hasEmailHtmlForRender,
  resolveGrapesEmailSource,
  isEmailDefinitionDegraded,
  isGrapesDefinitionDegraded
};
