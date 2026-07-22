'use strict';

const { registerTool } = require('./registry');
const { retrieveKnowledgeHits } = require('../../aiKnowledgeService');

async function executeSearchKnowledgeBase({
  organizationId,
  query = '',
  topK = 5,
  sourceType = null,
  config = null,
} = {}) {
  const result = await retrieveKnowledgeHits({
    organizationId,
    question: query,
    topK,
    sourceType,
    config,
  });
  return {
    question: result.question,
    citations: result.citations || [],
    excerpts: (result.citations || []).map((c) => ({
      index: c.index,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      excerpt: c.excerpt,
      score: c.score,
    })),
  };
}

registerTool({
  name: 'SearchKnowledgeBase',
  description: 'Semantic search over tenant product/knowledge vectors (retrieve-only, no LLM).',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      topK: { type: 'number' },
      sourceType: { type: 'string' },
    },
    required: ['query'],
  },
  execute: executeSearchKnowledgeBase,
});

module.exports = { executeSearchKnowledgeBase };
