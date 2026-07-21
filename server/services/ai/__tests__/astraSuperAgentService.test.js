'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveAgentMention,
  filterActionsForAgent,
  isSuperAgentsEnabled,
} = require('../astraSuperAgentService');

describe('astraSuperAgentService', () => {
  const prev = process.env.ASTRA_SUPER_AGENTS_V1;
  const prevAuto = process.env.ASTRA_AUTOPILOT_V1;

  after(() => {
    if (prev === undefined) delete process.env.ASTRA_SUPER_AGENTS_V1;
    else process.env.ASTRA_SUPER_AGENTS_V1 = prev;
    if (prevAuto === undefined) delete process.env.ASTRA_AUTOPILOT_V1;
    else process.env.ASTRA_AUTOPILOT_V1 = prevAuto;
  });

  it('resolves @mention to mentionable agent and strips prefix', () => {
    process.env.ASTRA_SUPER_AGENTS_V1 = 'true';
    const agents = [
      {
        _id: 'a1',
        name: 'Pipeline Coach',
        mentionable: true,
        enabled: true,
        skillIds: ['weekly_pipeline_review'],
      },
    ];
    const hit = resolveAgentMention('@Pipeline Coach which deals are stuck?', agents);
    assert.equal(hit?.agent?._id, 'a1');
    assert.match(hit.question, /deals are stuck/i);
    assert.equal(resolveAgentMention('no mention here', agents), null);
  });

  it('uses skill seed when mention has no rest question', () => {
    process.env.ASTRA_SUPER_AGENTS_V1 = 'true';
    const agents = [{
      _id: 'a1',
      name: 'Coach',
      mentionable: true,
      enabled: true,
      skillIds: ['weekly_pipeline_review'],
    }];
    const hit = resolveAgentMention('@Coach', agents);
    assert.ok(hit?.question?.length > 10);
    assert.equal(hit.skill?.id, 'weekly_pipeline_review');
  });

  it('filterActionsForAgent keeps writes confirm-gated', () => {
    const filtered = filterActionsForAgent(
      [
        { label: 'Create task', kind: 'create_record', moduleKey: 'deals', executeNow: true },
        { label: 'Open deal', kind: 'review_record', moduleKey: 'deals' },
      ],
      { name: 'Coach', moduleKeys: ['deals'] },
    );
    assert.ok(filtered.length >= 1);
    const write = filtered.find((a) => a.kind === 'create_record');
    if (write) assert.equal(write.executeNow, false);
  });

  it('isSuperAgentsEnabled respects explicit false', () => {
    process.env.ASTRA_SUPER_AGENTS_V1 = 'false';
    process.env.ASTRA_AUTOPILOT_V1 = 'true';
    assert.equal(isSuperAgentsEnabled(), false);
  });
});
