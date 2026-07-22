'use strict';

/**
 * @typedef {Object} VectorMatch
 * @property {string} id
 * @property {number} score
 * @property {Object} metadata
 * @property {string} [text]
 */

/**
 * @typedef {Object} VectorQuery
 * @property {string} organizationId
 * @property {number[]} embedding
 * @property {number} [topK]
 * @property {Object} [filter]
 */

/**
 * Port implemented by the vector store registry (Atlas / Mongo / memory).
 *
 * @typedef {Object} VectorStorePort
 * @property {(query: VectorQuery) => Promise<VectorMatch[]>} query
 * @property {(docs: Object[]) => Promise<number>} upsert
 */

module.exports = {};
