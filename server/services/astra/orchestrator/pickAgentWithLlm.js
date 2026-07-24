'use strict';

/**
 * Default Ask entry is always Astra Mission Control.
 * Explicit request.agent still honored for admin/debug Try-seat.
 */

const { resolveAgentKey } = require('./intentRegistry');
const { MISSION_CONTROL_KEY, isMissionControlKey } = require('./missionControl');

const MIN_CONFIDENCE = 0.45;

function resolveMissionControlKey(agents) {
  if (agents?.hasAgent?.(MISSION_CONTROL_KEY)) return MISSION_CONTROL_KEY;
  if (agents?.hasAgent?.('coworker')) return 'coworker';
  return MISSION_CONTROL_KEY;
}

/**
 * @returns {Promise<{ agentKey: string, source: string, reason?: string|null, confidence?: number }>}
 */
async function pickAgentWithLlm(args = {}) {
  const {
    request = {},
    classification = {},
    agents,
    query,
  } = args;

  const requested = String(request.agent || '').trim();
  if (requested && requested !== 'auto') {
    if (!agents || agents.hasAgent?.(requested)) {
      return { agentKey: requested, source: 'explicit', confidence: 1, reason: 'request.agent' };
    }
  }

  // Production Ask: Mission Control decides specialists (never expose seat picker).
  const mc = resolveMissionControlKey(agents);
  if (agents?.hasAgent?.(mc) || !agents) {
    return {
      agentKey: mc,
      source: 'mission_control',
      confidence: 1,
      reason: 'default_entry',
    };
  }

  const fallbackKey = resolveAgentKey(classification, { ...request, query }, agents);
  return {
    agentKey: isMissionControlKey(fallbackKey) ? mc : fallbackKey,
    source: 'heuristic',
    confidence: 0,
    reason: 'mc_unavailable',
  };
}

module.exports = {
  pickAgentWithLlm,
  parseAgentPickJson: () => null,
  buildAgentCards: () => [],
  MIN_CONFIDENCE,
  resolveMissionControlKey,
};
