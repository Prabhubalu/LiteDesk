'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseIntentSuggestions,
  buildReportCandidates,
} = require('../aiAnalyticsIntentService');
const { getPrompt } = require('../prompts/promptRegistry');

const CANDIDATES = [
  { reportId: 'r1', name: 'Deals by Owner', type: 'summary', primaryModule: 'deals' },
  { reportId: 'r2', name: 'Open Cases by Queue', type: 'matrix', primaryModule: 'cases' },
];

describe('aiAnalyticsIntentService', () => {
  it('buildReportCandidates trims and drops nameless reports', () => {
    const out = buildReportCandidates([
      { _id: 'a', name: 'Pipeline', type: 'tabular', primaryModule: 'deals', description: 'x'.repeat(500) },
      { _id: 'b', name: '' },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].reportId, 'a');
    assert.ok(out[0].description.length <= 200);
  });

  it('constrains matches to the candidate allow-list (no invented reportIds)', () => {
    const { matches } = parseIntentSuggestions(
      JSON.stringify({
        interpretation: 'won deals by owner',
        matches: [
          { reportId: 'r1', confidence: 0.9, rationale: 'direct match' },
          { reportId: 'evil-injected-id', confidence: 1, rationale: 'nope' },
        ],
      }),
      CANDIDATES
    );
    assert.equal(matches.length, 1);
    assert.equal(matches[0].reportId, 'r1');
    assert.equal(matches[0].name, 'Deals by Owner');
  });

  it('dedupes repeated reportIds and clamps confidence', () => {
    const { matches } = parseIntentSuggestions(
      JSON.stringify({
        matches: [
          { reportId: 'r2', confidence: 7 },
          { reportId: 'r2', confidence: 0.5 },
        ],
      }),
      CANDIDATES
    );
    assert.equal(matches.length, 1);
    assert.equal(matches[0].confidence, 1);
  });

  it('returns empty result on garbage output', () => {
    const out = parseIntentSuggestions('not json at all', CANDIDATES);
    assert.equal(out.interpretation, '');
    assert.deepEqual(out.matches, []);
  });

  it('registers the analytics intent prompt with suggest-only guidance', () => {
    const prompt = getPrompt('analytics_intent_system');
    assert.equal(prompt.version, 'v1');
    assert.match(prompt.text, /Only use reportIds from the provided list/);
    assert.match(prompt.text, /Never write queries/);
  });
});
