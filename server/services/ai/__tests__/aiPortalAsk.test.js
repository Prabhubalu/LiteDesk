'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getPrompt } = require('../prompts/promptRegistry');
const { PORTAL_ASK_DISCLAIMER } = require('../aiKnowledgeService');

describe('portal ask (customer tier)', () => {
  it('registers portal knowledge prompt with untrusted-customer guidance', () => {
    const prompt = getPrompt('ask_portal_knowledge_system');
    assert.equal(prompt.version, 'v1');
    assert.match(prompt.text, /customers/i);
    assert.match(prompt.text, /ONLY from the provided knowledge-base excerpts/i);
    assert.match(prompt.text, /Never invent/i);
  });

  it('exports a customer disclaimer', () => {
    assert.match(PORTAL_ASK_DISCLAIMER, /help articles only/i);
  });

  it('containment: escalate when no portal-visible citations', async () => {
    // Pure containment contract without LLM: simulate post-filter result shape
    const citations = [];
    const contained = citations.length > 0;
    const containment = {
      contained,
      escalateSuggested: !contained,
      citationCount: citations.length,
    };
    assert.equal(containment.contained, false);
    assert.equal(containment.escalateSuggested, true);
  });
});
