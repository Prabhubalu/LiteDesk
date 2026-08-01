/**
 * Helpers for My Profile employee + displayPreferences fields.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_FORMATS = new Set(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMM DD, YYYY']);
const TIME_FORMATS = new Set(['12h', '24h']);

const DIGIT_GROUPING_PATTERNS = new Set(['international', 'indian']);
const DECIMAL_SEPARATORS = new Set(['.', ',']);
const DIGIT_GROUPING_SEPARATORS = new Set([',', '.', ' ', "'"]);
const AGGREGATED_NUMBER_FORMATS = new Set(['none', 'thousands', 'millions', 'billions']);

/**
 * Apply status transition timestamps for suspend / reactivate.
 * @param {object} user
 * @param {string} nextStatus
 * @param {string} [previousStatus]
 */
function applyStatusTimestamps(user, nextStatus, previousStatus) {
  const prev = previousStatus != null ? String(previousStatus) : String(user.status || '');
  const next = String(nextStatus);
  if (next === 'suspended' && prev !== 'suspended') {
    user.suspendedAt = new Date();
  }
  if (next === 'active' && prev === 'suspended') {
    user.reactivatedAt = new Date();
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeOptionalString(value) {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * Validate and normalize displayPreferences patch.
 * @param {object|null|undefined} raw
 * @param {{ settings?: { currency?: string, currencies?: unknown } }|null|undefined} [organization]
 * @returns {{ ok: true, value: object } | { ok: false, message: string }}
 */
function normalizeDisplayPreferences(raw, organization = null) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'displayPreferences must be an object' };
  }

  const out = {};

  if (Object.prototype.hasOwnProperty.call(raw, 'preferredCurrency')) {
    const code = raw.preferredCurrency == null || raw.preferredCurrency === ''
      ? null
      : String(raw.preferredCurrency).trim().toUpperCase();
    if (code != null && !/^[A-Z]{3}$/.test(code)) {
      return { ok: false, message: 'preferredCurrency must be a 3-letter ISO 4217 code' };
    }
    if (code != null && organization) {
      const { isCurrencyEnabledForOrg } = require('./orgCurrencies');
      if (!isCurrencyEnabledForOrg(organization, code)) {
        return {
          ok: false,
          message: 'preferredCurrency must be the organization base currency or an enabled currency',
        };
      }
    }
    out.preferredCurrency = code;
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'showAmountsInPreferredCurrency')) {
    out.showAmountsInPreferredCurrency = Boolean(raw.showAmountsInPreferredCurrency);
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'digitGroupingPattern')) {
    const v = String(raw.digitGroupingPattern || '');
    if (!DIGIT_GROUPING_PATTERNS.has(v)) {
      return { ok: false, message: 'digitGroupingPattern must be international or indian' };
    }
    out.digitGroupingPattern = v;
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'decimalSeparator')) {
    const v = String(raw.decimalSeparator);
    if (!DECIMAL_SEPARATORS.has(v)) {
      return { ok: false, message: 'decimalSeparator must be . or ,' };
    }
    out.decimalSeparator = v;
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'digitGroupingSeparator')) {
    const v = String(raw.digitGroupingSeparator);
    if (!DIGIT_GROUPING_SEPARATORS.has(v)) {
      return { ok: false, message: 'digitGroupingSeparator is invalid' };
    }
    out.digitGroupingSeparator = v;
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'currencyDecimalPlaces')) {
    const n = Number(raw.currencyDecimalPlaces);
    if (!Number.isInteger(n) || n < 0 || n > 6) {
      return { ok: false, message: 'currencyDecimalPlaces must be an integer 0–6' };
    }
    out.currencyDecimalPlaces = n;
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'truncateTrailingZeros')) {
    out.truncateTrailingZeros = Boolean(raw.truncateTrailingZeros);
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'aggregatedNumberFormat')) {
    const v = String(raw.aggregatedNumberFormat || '');
    if (!AGGREGATED_NUMBER_FORMATS.has(v)) {
      return { ok: false, message: 'aggregatedNumberFormat is invalid' };
    }
    out.aggregatedNumberFormat = v;
  }

  return { ok: true, value: out };
}

/**
 * Apply displayPreferences onto a user document (partial merge).
 * @param {object} user
 * @param {object} patch
 */
function applyDisplayPreferences(user, patch) {
  if (!user.displayPreferences) {
    user.displayPreferences = {};
  }
  Object.assign(user.displayPreferences, patch);
  if (typeof user.markModified === 'function') {
    user.markModified('displayPreferences');
  }
}

/**
 * Seed missing preferredCurrency from org settings.
 * @param {object} user
 * @param {object|null|undefined} organization
 */
function seedDisplayPreferencesFromOrg(user, organization) {
  if (!user.displayPreferences) {
    user.displayPreferences = {};
  }
  if (!user.displayPreferences.preferredCurrency && organization?.settings?.currency) {
    user.displayPreferences.preferredCurrency = String(organization.settings.currency).toUpperCase();
  }
}

/**
 * Sync mobilePhone ↔ phoneNumber legacy alias.
 * @param {object} user
 * @param {{ mobilePhone?: string, phoneNumber?: string }} fields
 */
function applyMobilePhoneAlias(user, fields) {
  if (Object.prototype.hasOwnProperty.call(fields, 'mobilePhone')) {
    const mobile = normalizeOptionalString(fields.mobilePhone);
    user.mobilePhone = mobile;
    user.phoneNumber = mobile;
  } else if (Object.prototype.hasOwnProperty.call(fields, 'phoneNumber')) {
    const phone = normalizeOptionalString(fields.phoneNumber);
    user.phoneNumber = phone;
    if (!user.mobilePhone) {
      user.mobilePhone = phone;
    }
  }
}

/**
 * Apply self-service / admin employee contact fields (not reportsTo).
 * @param {object} user
 * @param {object} body
 * @param {{ settings?: { currency?: string, currencies?: unknown } }|null|undefined} [organization]
 * @returns {{ ok: true } | { ok: false, message: string, code?: string }}
 */
function applyEmployeeContactFields(user, body, organization = null) {
  if (!body || typeof body !== 'object') {
    return { ok: true };
  }

  if (Object.prototype.hasOwnProperty.call(body, 'firstName')) {
    user.firstName = normalizeOptionalString(body.firstName);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'lastName')) {
    user.lastName = normalizeOptionalString(body.lastName);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'department')) {
    user.department = normalizeOptionalString(body.department);
  }
  // primaryGroupId is applied by the controller after org validation
  if (Object.prototype.hasOwnProperty.call(body, 'secondaryEmail')) {
    const secondary = normalizeOptionalString(body.secondaryEmail).toLowerCase();
    if (secondary && !EMAIL_RE.test(secondary)) {
      return { ok: false, message: 'Invalid secondary email', code: 'INVALID_SECONDARY_EMAIL' };
    }
    user.secondaryEmail = secondary;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'officePhone')) {
    user.officePhone = normalizeOptionalString(body.officePhone);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'homePhone')) {
    user.homePhone = normalizeOptionalString(body.homePhone);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'fax')) {
    user.fax = normalizeOptionalString(body.fax);
  }

  applyMobilePhoneAlias(user, body);

  if (Object.prototype.hasOwnProperty.call(body, 'language')) {
    const lang = body.language == null || body.language === ''
      ? null
      : String(body.language).trim().toLowerCase();
    user.language = lang;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'timeZone')) {
    const tz = body.timeZone == null || body.timeZone === ''
      ? null
      : String(body.timeZone).trim();
    user.timeZone = tz === 'Asia/Calcutta' ? 'Asia/Kolkata' : tz;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'dateFormat')) {
    const fmt = body.dateFormat == null || body.dateFormat === ''
      ? null
      : String(body.dateFormat).trim();
    if (fmt && !DATE_FORMATS.has(fmt)) {
      return { ok: false, message: 'Invalid date format', code: 'INVALID_DATE_FORMAT' };
    }
    user.dateFormat = fmt;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'timeFormat')) {
    const fmt = body.timeFormat == null || body.timeFormat === ''
      ? null
      : String(body.timeFormat).trim();
    if (fmt && !TIME_FORMATS.has(fmt)) {
      return { ok: false, message: 'Invalid time format', code: 'INVALID_TIME_FORMAT' };
    }
    user.timeFormat = fmt;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'displayPreferences')) {
    const normalized = normalizeDisplayPreferences(body.displayPreferences, organization);
    if (!normalized.ok) {
      return { ok: false, message: normalized.message, code: 'INVALID_DISPLAY_PREFERENCES' };
    }
    applyDisplayPreferences(user, normalized.value);
  }

  return { ok: true };
}

/**
 * Resolve effective mobile for API responses.
 * @param {object} user
 * @returns {string}
 */
function effectiveMobilePhone(user) {
  return normalizeOptionalString(user.mobilePhone) || normalizeOptionalString(user.phoneNumber);
}

module.exports = {
  applyStatusTimestamps,
  normalizeDisplayPreferences,
  applyDisplayPreferences,
  seedDisplayPreferencesFromOrg,
  applyMobilePhoneAlias,
  applyEmployeeContactFields,
  effectiveMobilePhone,
  EMAIL_RE
};
