const {
  GSTIN_REGEX,
  GST_STATE_CODES,
  normalizeStateCode
} = require('../constants/indiaGstConstants');

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * GSTIN check-digit (MOD-36 weighted sum over first 14 chars).
 * @param {string} gstin14 — uppercase, length 14
 * @returns {string}
 */
function computeGstinChecksum(gstin14) {
  let factor = 1;
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const codePoint = GSTIN_CHARSET.indexOf(gstin14[i]);
    if (codePoint < 0) return '';
    let product = factor * codePoint;
    factor = factor === 1 ? 2 : 1;
    product = Math.floor(product / 36) + (product % 36);
    sum += product;
  }
  const checkCodePoint = (36 - (sum % 36)) % 36;
  return GSTIN_CHARSET[checkCodePoint];
}

/**
 * Validate an Indian GSTIN.
 *
 * @param {string|null|undefined} gstin
 * @returns {{ ok: boolean, normalized: string|null, stateCode: string|null, error: string|null }}
 */
function validateGstin(gstin) {
  if (gstin == null || String(gstin).trim() === '') {
    return { ok: false, normalized: null, stateCode: null, error: 'GSTIN is required' };
  }

  const normalized = String(gstin).trim().toUpperCase().replace(/\s+/g, '');

  if (normalized.length !== 15) {
    return {
      ok: false,
      normalized: null,
      stateCode: null,
      error: 'GSTIN must be 15 characters'
    };
  }

  if (!GSTIN_REGEX.test(normalized)) {
    return {
      ok: false,
      normalized: null,
      stateCode: null,
      error: 'GSTIN format is invalid'
    };
  }

  const expected = computeGstinChecksum(normalized.slice(0, 14));
  if (!expected || expected !== normalized[14]) {
    return {
      ok: false,
      normalized: null,
      stateCode: null,
      error: 'GSTIN checksum is invalid'
    };
  }

  const stateCode = normalizeStateCode(normalized.slice(0, 2));
  if (!stateCode || !Object.prototype.hasOwnProperty.call(GST_STATE_CODES, stateCode)) {
    return {
      ok: false,
      normalized: null,
      stateCode: null,
      error: 'GSTIN state code is unrecognized'
    };
  }

  return { ok: true, normalized, stateCode, error: null };
}

module.exports = {
  validateGstin,
  computeGstinChecksum
};
