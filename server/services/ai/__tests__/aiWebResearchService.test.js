'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeHttpUrl,
  extractWebsiteFromContext,
  htmlToText,
  isPrivateIp,
  looksLikeWebResearchQuestion,
  agentAllowsWebResearch,
} = require('../aiWebResearchService');

describe('aiWebResearchService', () => {
  it('normalizes website hosts to https', () => {
    assert.equal(normalizeHttpUrl('www.vtiger.com').hostname, 'www.vtiger.com');
    assert.equal(normalizeHttpUrl('vtiger.com').protocol, 'https:');
  });

  it('blocks private and local hosts', () => {
    assert.equal(normalizeHttpUrl('http://127.0.0.1/admin'), null);
    assert.equal(normalizeHttpUrl('http://localhost/x'), null);
    assert.equal(isPrivateIp('10.0.0.1'), true);
    assert.equal(isPrivateIp('8.8.8.8'), false);
  });

  it('extracts website from CRM context lines', () => {
    const u = extractWebsiteFromContext('name: Vtiger\nwebsite: https://www.vtiger.com\n');
    assert.equal(u.hostname, 'www.vtiger.com');
  });

  it('strips html scripts to text', () => {
    const out = htmlToText('<html><head><title>Hi</title><script>evil()</script></head><body><p>Hello world content here</p></body></html>');
    assert.equal(out.title, 'Hi');
    assert.match(out.text, /Hello world/);
    assert.doesNotMatch(out.text, /evil/);
  });

  it('detects research questions and research agents', () => {
    assert.equal(looksLikeWebResearchQuestion('Review case studies'), true);
    assert.equal(looksLikeWebResearchQuestion('what is my deal stage'), false);
    assert.equal(agentAllowsWebResearch({
      name: 'Research Agent',
      capabilities: [],
      triggerPhrases: ['research company'],
    }), true);
    assert.equal(agentAllowsWebResearch({
      name: 'Deal Analyze',
      capabilities: [],
      triggerPhrases: ['analyze deal'],
    }), false);
    assert.equal(agentAllowsWebResearch({
      name: 'Deal Analyze',
      capabilities: ['web_research'],
    }), true);
  });
});
