'use strict';

/**
 * cutover — decides, per request, whether Astra v2 owns the turn.
 *
 *   ASTRA_V2=false            → always legacy
 *   ASTRA_V2=true + shadow    → run v2 for comparison, surface legacy
 *   ASTRA_V2=true (no shadow) → v2 owns the turn
 */

const { isAstraV2Enabled, isAstraV2Shadow } = require('../flags');

/**
 * @returns {{ engine: 'v2'|'legacy', shadow: boolean, surface: 'v2'|'legacy' }}
 */
function decideEngine() {
  const enabled = isAstraV2Enabled();
  if (!enabled) {
    return { engine: 'legacy', shadow: false, surface: 'legacy' };
  }
  const shadow = isAstraV2Shadow();
  return {
    engine: 'v2',
    shadow,
    // In shadow mode v2 computes but legacy is what the user sees.
    surface: shadow ? 'legacy' : 'v2',
  };
}

/** Convenience: should this process even run the v2 pipeline at all? */
function shouldRunV2() {
  return isAstraV2Enabled();
}

module.exports = {
  decideEngine,
  shouldRunV2,
};
