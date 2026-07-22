'use strict';

/**
 * Astra v2 feature flags.
 *
 * ASTRA_V2         — master switch for the clean-slate platform. Default: ON.
 *                    Set ASTRA_V2=false to force all traffic back to legacy ai/.
 * ASTRA_V2_SHADOW  — when ON, v2 runs alongside legacy for comparison but its
 *                    answer is NOT surfaced to the user (legacy remains source
 *                    of truth). Default: OFF.
 */

function readBool(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

/** @returns {boolean} whether the Astra v2 platform is enabled. Default true. */
function isAstraV2Enabled() {
  return readBool(process.env.ASTRA_V2, true);
}

/** @returns {boolean} whether v2 runs in shadow mode (compute, do not surface). */
function isAstraV2Shadow() {
  return readBool(process.env.ASTRA_V2_SHADOW, false);
}

module.exports = {
  readBool,
  isAstraV2Enabled,
  isAstraV2Shadow,
};
