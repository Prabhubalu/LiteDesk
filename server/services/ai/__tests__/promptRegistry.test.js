'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getPrompt, listPromptKeys } = require('../prompts/promptRegistry');

describe('promptRegistry', () => {
  it('returns versioned artifacts for known keys', () => {
    const prompt = getPrompt('echo_system');
    assert.equal(prompt.version, 'v1');
    assert.ok(prompt.text.includes('Arivu AI'));
  });

  it('lists registered prompt keys', () => {
    const keys = listPromptKeys();
    assert.ok(keys.includes('summarize_people_system'));
    assert.ok(keys.includes('ask_knowledge_system'));
  });
});
