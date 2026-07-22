'use strict';

/**
 * @typedef {Object} EmbeddingResult
 * @property {number[][]} vectors
 * @property {number} dimensions
 * @property {{ totalTokens: number }} [usage]
 */

/**
 * Port implemented by modelRouter for text → vector embedding.
 *
 * @typedef {Object} EmbeddingPort
 * @property {(organizationId: string, inputs: string[]) => Promise<EmbeddingResult>} embed
 */

module.exports = {};
