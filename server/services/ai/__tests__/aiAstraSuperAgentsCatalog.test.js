'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ASTRA_SUPER_AGENTS,
  listSuperAgentCatalog,
  assertCatalogSkillsExist,
} = require('../aiAstraSuperAgentsCatalog');

describe('aiAstraSuperAgentsCatalog', () => {
  it('ships all built-in Super Agents with skills', () => {
    assert.ok(ASTRA_SUPER_AGENTS.length >= 14);
    assertCatalogSkillsExist();
    const catalog = listSuperAgentCatalog();
    assert.equal(catalog.length, ASTRA_SUPER_AGENTS.length);
    const ids = new Set(catalog.map((a) => a.catalogId));
    assert.equal(ids.size, catalog.length);
    for (const agent of ASTRA_SUPER_AGENTS) {
      assert.ok(agent.name);
      assert.ok(agent.systemPrompt.length > 40);
      assert.ok(agent.skillIds.length >= 1);
      assert.ok(Array.isArray(agent.triggerPhrases));
    }
    const required = [
      'email_manager',
      'standup_digest',
      'intake_triage',
      'commercial_chase',
    ];
    for (const id of required) {
      assert.ok(ids.has(id), `missing ${id}`);
    }
  });
});
