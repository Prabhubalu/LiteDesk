'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  ASTRA_SKILLS,
  listAstraSkills,
  getAstraSkill,
  isSkillsEnabled,
} = require('../aiAstraSkillsRegistry');

describe('aiAstraSkillsRegistry', () => {
  const prev = process.env.ASTRA_SKILLS_V1;

  after(() => {
    if (prev === undefined) delete process.env.ASTRA_SKILLS_V1;
    else process.env.ASTRA_SKILLS_V1 = prev;
  });

  it('exports a non-empty frozen skill catalog with seed questions', () => {
    assert.ok(ASTRA_SKILLS.length >= 5);
    for (const skill of ASTRA_SKILLS) {
      assert.ok(skill.id);
      assert.ok(skill.label);
      assert.ok(String(skill.seedQuestion || '').trim().length > 10);
      assert.ok(Array.isArray(skill.moduleKeys));
      assert.ok(Array.isArray(skill.allowedTools));
    }
  });

  it('listAstraSkills filters by moduleKey when set', () => {
    process.env.ASTRA_SKILLS_V1 = 'true';
    const deals = listAstraSkills({ moduleKey: 'deals' });
    assert.ok(deals.length >= 1);
    assert.ok(deals.every((s) => (
      !s.moduleKeys.length || s.moduleKeys.includes('deals')
    )));
    const all = listAstraSkills({});
    assert.ok(all.length >= deals.length);
  });

  it('getAstraSkill returns by id', () => {
    const first = ASTRA_SKILLS[0];
    const found = getAstraSkill(first.id);
    assert.equal(found?.id, first.id);
    assert.equal(getAstraSkill('nope_missing'), null);
  });

  it('isSkillsEnabled respects ASTRA_SKILLS_V1=false', () => {
    process.env.ASTRA_SKILLS_V1 = 'false';
    assert.equal(isSkillsEnabled(), false);
    assert.deepEqual(listAstraSkills({}), []);
    process.env.ASTRA_SKILLS_V1 = 'true';
    assert.equal(isSkillsEnabled(), true);
  });
});
