/**
 * India GST domain constants (GTM-1 foundations).
 * Pure helpers only — no I/O.
 */

/** GSTIN: 2-digit state + PAN(10) + entity + 'Z' + checksum */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const GST_COMPONENT_TYPES = Object.freeze({
  CGST: 'CGST',
  SGST: 'SGST',
  IGST: 'IGST',
  CESS: 'CESS'
});

const GST_COMPONENT_TYPE_VALUES = Object.freeze(Object.values(GST_COMPONENT_TYPES));

const GST_REGISTRATION_TYPES = Object.freeze({
  REGULAR: 'regular',
  COMPOSITION: 'composition',
  UNREGISTERED: 'unregistered',
  SEZ: 'sez',
  CASUAL: 'casual',
  ISD: 'isd',
  TAX_DEDUCTOR: 'tax_deductor',
  TAX_COLLECTOR: 'tax_collector'
});

const GST_REGISTRATION_TYPE_VALUES = Object.freeze(Object.values(GST_REGISTRATION_TYPES));

const GST_TAXABILITY = Object.freeze({
  TAXABLE: 'taxable',
  EXEMPT: 'exempt',
  NIL_RATED: 'nil_rated',
  NON_GST: 'non_gst',
  ZERO_RATED: 'zero_rated'
});

const GST_TAXABILITY_VALUES = Object.freeze(Object.values(GST_TAXABILITY));

const IRN_STATUSES = Object.freeze({
  NOT_GENERATED: 'not_generated',
  PENDING: 'pending',
  GENERATED: 'generated',
  CANCELLED: 'cancelled',
  FAILED: 'failed'
});

const IRN_STATUS_VALUES = Object.freeze(Object.values(IRN_STATUSES));

/** Common GST state / UT codes (first 2 chars of GSTIN). */
const GST_STATE_CODES = Object.freeze({
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (before bifurcation)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction'
});

/**
 * Stub: resolve place-of-supply from seller/buyer state codes.
 * Full POS rules (SEZ, imports, bill-to/ship-to) land in later GTM slices.
 *
 * @param {{ sellerStateCode?: string|null, buyerStateCode?: string|null }} input
 * @returns {{ placeOfSupplyStateCode: string|null, isInterstate: boolean, reason: string }}
 */
function resolvePlaceOfSupplyStub(input = {}) {
  const seller = normalizeStateCode(input.sellerStateCode);
  const buyer = normalizeStateCode(input.buyerStateCode);
  if (!seller || !buyer) {
    return {
      placeOfSupplyStateCode: buyer || seller || null,
      isInterstate: false,
      reason: 'incomplete_state_codes'
    };
  }
  const isInterstate = seller !== buyer;
  return {
    placeOfSupplyStateCode: buyer,
    isInterstate,
    reason: isInterstate ? 'different_states' : 'same_state'
  };
}

/**
 * @param {string|null|undefined} code
 * @returns {string|null}
 */
function normalizeStateCode(code) {
  if (code == null || code === '') return null;
  const s = String(code).trim().padStart(2, '0');
  return /^\d{2}$/.test(s) ? s : null;
}

/**
 * @param {string|null|undefined} code
 * @returns {boolean}
 */
function isKnownGstStateCode(code) {
  const normalized = normalizeStateCode(code);
  return Boolean(normalized && Object.prototype.hasOwnProperty.call(GST_STATE_CODES, normalized));
}

/** HSN goods: 4 / 6 / 8 digits; SAC services: typically 6 digits. */
const HSN_SAC_REGEX = /^\d{4}(\d{2})?(\d{2})?$/;

/**
 * @param {string|null|undefined} value
 * @param {{ allowSac?: boolean }} [opts]
 * @returns {{ ok: boolean, normalized: string|null, kind: 'hsn'|'sac'|null, error: string|null }}
 */
function validateHsnSac(value, opts = {}) {
  if (value == null || String(value).trim() === '') {
    return { ok: false, normalized: null, kind: null, error: 'HSN/SAC is required' };
  }
  const normalized = String(value).trim().replace(/\s+/g, '');
  if (!/^\d+$/.test(normalized)) {
    return { ok: false, normalized: null, kind: null, error: 'HSN/SAC must be numeric' };
  }
  const len = normalized.length;
  if (len === 4 || len === 8) {
    return { ok: true, normalized, kind: 'hsn', error: null };
  }
  if (len === 6) {
    const kind = opts.allowSac === false ? 'hsn' : 'sac';
    return { ok: true, normalized, kind, error: null };
  }
  return {
    ok: false,
    normalized: null,
    kind: null,
    error: 'HSN/SAC must be 4, 6, or 8 digits'
  };
}

/**
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
function isValidHsnSac(value) {
  return validateHsnSac(value).ok;
}

module.exports = {
  GSTIN_REGEX,
  GST_COMPONENT_TYPES,
  GST_COMPONENT_TYPE_VALUES,
  GST_REGISTRATION_TYPES,
  GST_REGISTRATION_TYPE_VALUES,
  GST_TAXABILITY,
  GST_TAXABILITY_VALUES,
  IRN_STATUSES,
  IRN_STATUS_VALUES,
  GST_STATE_CODES,
  HSN_SAC_REGEX,
  resolvePlaceOfSupplyStub,
  normalizeStateCode,
  isKnownGstStateCode,
  validateHsnSac,
  isValidHsnSac
};
