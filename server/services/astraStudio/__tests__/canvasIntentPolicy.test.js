'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  inferCanvasIntentHeuristic,
  normalizeType,
  goalsFromPrompt,
} = require('../canvasIntent');
const { getHydratePolicy, listHydratePolicies } = require('../hydratePolicy');
const { CANVAS_TYPES } = require('../constants');

describe('canvas intent + hydrate policy', () => {
  it('maps executive org-wide prompts to executive_report / org scope', () => {
    const intent = inferCanvasIntentHeuristic({
      prompt: 'Build an executive report for this quarter pipeline and revenue',
    });
    assert.equal(intent.canvasType, 'executive_report');
    assert.equal(intent.scope, 'org');
    assert.equal(intent.entityHint, '');
    assert.ok(intent.goals.includes('pipeline'));
  });

  it('maps war room prompts to deal scope with entity hint', () => {
    const intent = inferCanvasIntentHeuristic({
      prompt: 'Build an opportunity war room for "Sample Deal"',
    });
    assert.equal(intent.canvasType, 'opportunity_war_room');
    assert.equal(intent.scope, 'deal');
    assert.ok(/Sample Deal/i.test(intent.entityHint));
  });

  it('maps customer 360 of a company to account scope with entity hint', () => {
    const intent = inferCanvasIntentHeuristic({
      prompt: "Give me Customer 360 of 'Vtiger CRM'",
    });
    assert.equal(intent.canvasType, 'customer_360');
    assert.equal(intent.scope, 'account');
    assert.ok(/Vtiger/i.test(intent.entityHint));
  });

  it('has a hydrate policy for every canvas type', () => {
    const policies = listHydratePolicies();
    assert.equal(policies.length, CANVAS_TYPES.length);
    for (const type of CANVAS_TYPES) {
      const p = getHydratePolicy(type);
      assert.equal(p.canvasType, type);
      assert.ok(p.brief);
      assert.ok(p.specialistMode);
    }
  });

  it('executive policy fills without party and seeds analytics', () => {
    const p = getHydratePolicy('executive_report');
    assert.equal(p.brief, 'org');
    assert.equal(p.fillWithoutParty, true);
    assert.equal(p.seedAnalytics, true);
    assert.equal(p.allowWebCompetitors, false);
  });

  it('war room policy requires party and allows competitor web', () => {
    const p = getHydratePolicy('opportunity_war_room');
    assert.equal(p.brief, 'party');
    assert.equal(p.fillWithoutParty, false);
    assert.equal(p.allowWebCompetitors, true);
  });

  it('normalizeType accepts known keys', () => {
    assert.equal(normalizeType('executive_report'), 'executive_report');
    assert.equal(normalizeType('type: meeting_preparation'), 'meeting_preparation');
  });

  it('goalsFromPrompt adds defaults per type', () => {
    const goals = goalsFromPrompt('show risks', 'opportunity_war_room');
    assert.ok(goals.includes('risks'));
    assert.ok(goals.includes('summary'));
  });
});
