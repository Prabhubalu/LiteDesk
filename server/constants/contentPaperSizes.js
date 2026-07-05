'use strict';

/** Standard page dimensions in millimeters (portrait: width × height). */
const PAPER_DIMENSIONS_MM = Object.freeze({
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  A6: { width: 105, height: 148 },
  A7: { width: 74, height: 105 },
  A8: { width: 52, height: 74 },
  B0: { width: 1000, height: 1414 },
  B1: { width: 707, height: 1000 },
  B2: { width: 500, height: 707 },
  B3: { width: 353, height: 500 },
  B4: { width: 250, height: 353 },
  B5: { width: 176, height: 250 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
  Tabloid: { width: 279, height: 432 },
  Ledger: { width: 432, height: 279 },
  Executive: { width: 184, height: 267 },
  Custom: { width: 210, height: 297 }
});

/** Default printable page margins (mm) for new content templates. */
const DEFAULT_PAGE_MARGINS_MM = Object.freeze({
  top: 10,
  right: 10,
  bottom: 10,
  left: 10
});

const CONTENT_PAPER_SIZES = Object.freeze([
  'A0',
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'A6',
  'A7',
  'A8',
  'B0',
  'B1',
  'B2',
  'B3',
  'B4',
  'B5',
  'Letter',
  'Legal',
  'Tabloid',
  'Ledger',
  'Executive',
  'Custom'
]);

const CUSTOM_PAGE_MIN_MM = 50;
const CUSTOM_PAGE_MAX_MM = 2000;
const DEFAULT_CUSTOM_PAGE_WIDTH_MM = 210;
const DEFAULT_CUSTOM_PAGE_HEIGHT_MM = 297;

/**
 * @param {number|null|undefined} value
 * @param {number} fallback
 */
function clampCustomDimension(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(CUSTOM_PAGE_MAX_MM, Math.max(CUSTOM_PAGE_MIN_MM, parsed));
}

/**
 * @param {object} template
 */
function resolveCustomPageDimensions(template) {
  return {
    width: clampCustomDimension(template?.customPageWidth, DEFAULT_CUSTOM_PAGE_WIDTH_MM),
    height: clampCustomDimension(template?.customPageHeight, DEFAULT_CUSTOM_PAGE_HEIGHT_MM)
  };
}

/**
 * @param {string} paperSize
 * @param {string} orientation
 * @param {object} [template]
 */
function resolvePageDimensions(paperSize, orientation, template = null) {
  const normalizedSize = PAPER_DIMENSIONS_MM[paperSize] ? paperSize : 'A4';
  const base = normalizedSize === 'Custom'
    ? resolveCustomPageDimensions(template || {})
    : { ...PAPER_DIMENSIONS_MM[normalizedSize] };

  if (orientation === 'landscape') {
    return { width: base.height, height: base.width };
  }
  return base;
}

/**
 * @param {object} template
 */
function resolvePageConfig(template) {
  const paperSize = template?.paperSize || 'A4';
  const orientation = template?.orientation || 'portrait';

  return {
    paperSize,
    orientation,
    customPageWidth: paperSize === 'Custom'
      ? resolveCustomPageDimensions(template).width
      : null,
    customPageHeight: paperSize === 'Custom'
      ? resolveCustomPageDimensions(template).height
      : null,
    dimensions: resolvePageDimensions(paperSize, orientation, template)
  };
}

/**
 * @param {object} payload
 */
function normalizeTemplatePageSettings(payload = {}) {
  const paperSize = CONTENT_PAPER_SIZES.includes(payload.paperSize)
    ? payload.paperSize
    : 'A4';
  const orientation = payload.orientation === 'landscape' ? 'landscape' : 'portrait';

  const result = { paperSize, orientation };

  if (paperSize === 'Custom') {
    result.customPageWidth = clampCustomDimension(
      payload.customPageWidth,
      DEFAULT_CUSTOM_PAGE_WIDTH_MM
    );
    result.customPageHeight = clampCustomDimension(
      payload.customPageHeight,
      DEFAULT_CUSTOM_PAGE_HEIGHT_MM
    );
  }

  return result;
}

module.exports = {
  PAPER_DIMENSIONS_MM,
  DEFAULT_PAGE_MARGINS_MM,
  CONTENT_PAPER_SIZES,
  CUSTOM_PAGE_MIN_MM,
  CUSTOM_PAGE_MAX_MM,
  DEFAULT_CUSTOM_PAGE_WIDTH_MM,
  DEFAULT_CUSTOM_PAGE_HEIGHT_MM,
  clampCustomDimension,
  resolveCustomPageDimensions,
  resolvePageDimensions,
  resolvePageConfig,
  normalizeTemplatePageSettings
};
