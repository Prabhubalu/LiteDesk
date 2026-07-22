'use strict';

/**
 * Confirm-action contract builder.
 *
 * Any tool above READ risk must produce a confirmation contract instead of
 * executing. The client renders it, the user approves, and the approved
 * payload is replayed with `confirmed: true`.
 */

const { normalizeRisk, requiresConfirmation } = require('./risk');

/**
 * @param {Object} params
 * @param {string} params.toolName
 * @param {string} params.risk
 * @param {string} params.summary        Human-readable description of the effect.
 * @param {object} params.payload        Exact input that will be replayed on confirm.
 * @param {object[]} [params.effects]    Structured before/after diff for review.
 * @returns {{ type: 'confirm_action', toolName, risk, summary, payload, effects, requiresConfirmation: boolean }}
 */
function buildConfirmation({ toolName, risk, summary, payload, effects = [] }) {
  const normalized = normalizeRisk(risk);
  return {
    type: 'confirm_action',
    toolName,
    risk: normalized,
    requiresConfirmation: requiresConfirmation(normalized),
    summary: String(summary || `Confirm ${toolName}`),
    payload: payload || {},
    effects,
  };
}

/**
 * Decide whether a tool invocation should be gated behind confirmation.
 * @param {{ risk: string }} tool
 * @param {{ confirmed?: boolean }} input
 */
function needsConfirmation(tool, input = {}) {
  if (input.confirmed === true) return false;
  return requiresConfirmation(tool?.risk);
}

module.exports = {
  buildConfirmation,
  needsConfirmation,
};
