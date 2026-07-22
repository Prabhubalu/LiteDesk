'use strict';

/**
 * Risk classification for Astra actions/tools.
 * Governs whether an action can auto-run (read) or requires confirmation
 * (write/destructive). Every tool declares a risk level; the orchestrator
 * enforces confirmation for anything above READ.
 */

const RISK = Object.freeze({
  READ: 'read',
  WRITE: 'write',
  DESTRUCTIVE: 'destructive',
});

const RISK_RANK = Object.freeze({
  [RISK.READ]: 0,
  [RISK.WRITE]: 1,
  [RISK.DESTRUCTIVE]: 2,
});

/** Normalize an arbitrary risk label to a canonical value (defaults READ). */
function normalizeRisk(value) {
  const key = String(value || '').trim().toLowerCase();
  if (key === RISK.WRITE) return RISK.WRITE;
  if (key === RISK.DESTRUCTIVE || key === 'delete') return RISK.DESTRUCTIVE;
  return RISK.READ;
}

/** Whether an action at this risk level requires explicit user confirmation. */
function requiresConfirmation(risk) {
  return RISK_RANK[normalizeRisk(risk)] >= RISK_RANK[RISK.WRITE];
}

/** Whether a read-only action may execute without confirmation. */
function canAutoRun(risk) {
  return normalizeRisk(risk) === RISK.READ;
}

module.exports = {
  RISK,
  RISK_RANK,
  normalizeRisk,
  requiresConfirmation,
  canAutoRun,
};
