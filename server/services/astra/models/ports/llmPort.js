'use strict';

/**
 * @typedef {Object} LlmMessage
 * @property {'system'|'user'|'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {Object} LlmUsage
 * @property {number} promptTokens
 * @property {number} completionTokens
 * @property {number} totalTokens
 */

/**
 * @typedef {Object} LlmCompletion
 * @property {string} text
 * @property {LlmUsage} usage
 * @property {*} [raw]
 */

/**
 * @typedef {Object} LlmCompleteParams
 * @property {LlmMessage[]} messages
 * @property {number} [temperature]
 * @property {number} [maxTokens]
 * @property {string} [modelOverride]
 */

/**
 * Port implemented by modelRouter. Abstracts provider selection, key resolution,
 * and circuit-breaking away from the orchestrator.
 *
 * @typedef {Object} LlmPort
 * @property {(organizationId: string, abilityKey: string, params: LlmCompleteParams) => Promise<LlmCompletion>} complete
 */

module.exports = {};
