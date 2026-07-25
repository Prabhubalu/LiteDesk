'use strict';

/**
 * Choose Living Canvas template type from structured intent.
 * resolveCanvasIntent (LLM + heuristic) is the source of truth; this module
 * remains the public classify API used by generate/create.
 */

const { resolveCanvasIntent, inferCanvasIntentHeuristic, normalizeType } = require('./canvasIntent');
const { CANVAS_TYPES } = require('./constants');

const TYPE_SET = new Set(CANVAS_TYPES);

const CLASSIFY_SYSTEM = [
  'You classify CRM workspace requests into exactly one Astra Studio canvas type.',
  'Return ONLY the type key, no punctuation or explanation.',
  'Types:',
  CANVAS_TYPES.filter((t) => t !== 'blank').join(', '),
  'Use blank only if none fit.',
].join('\n');

function normalizeTypeKey(raw = '') {
  return normalizeType(raw);
}

/**
 * @param {{ organizationId: string, prompt?: string, hintType?: string }} input
 * @returns {Promise<string>}
 */
async function classifyCanvasType(input = {}) {
  const intent = await resolveCanvasIntent({
    organizationId: input.organizationId,
    prompt: input.prompt,
    hintType: input.hintType,
  });
  const type = intent?.canvasType && TYPE_SET.has(intent.canvasType)
    ? intent.canvasType
    : inferCanvasIntentHeuristic({
      prompt: input.prompt,
      hintType: input.hintType,
    }).canvasType;
  return type || 'blank';
}

/**
 * Full classify + intent (preferred for generate/hydrate).
 * @returns {Promise<{ canvasType: string, intent: object }>}
 */
async function classifyCanvasIntent(input = {}) {
  const intent = await resolveCanvasIntent(input);
  return {
    canvasType: intent.canvasType || 'blank',
    intent,
  };
}

module.exports = {
  classifyCanvasType,
  classifyCanvasIntent,
  normalizeTypeKey,
  CLASSIFY_SYSTEM,
};
