'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeTags,
  normalizeCsatScore,
  buildAgentSessionFieldPatch,
  buildVisitorFeedbackPatch,
} = require('../liveChatSessionFields');

test('normalizeTags deduplicates and trims', () => {
  assert.deepEqual(normalizeTags([' VIP ', 'vip', 'billing', '']), ['VIP', 'billing']);
});

test('buildAgentSessionFieldPatch accepts summary and tags', () => {
  assert.deepEqual(
    buildAgentSessionFieldPatch({
      summary: '  Resolved billing question ',
      tags: ['billing', 'vip'],
    }),
    {
      summary: 'Resolved billing question',
      tags: ['billing', 'vip'],
    },
  );
});

test('buildVisitorFeedbackPatch requires valid csatScore', () => {
  assert.throws(() => buildVisitorFeedbackPatch({ csatScore: 0 }), /csatScore/);
  assert.deepEqual(
    buildVisitorFeedbackPatch({
      csatScore: 4,
      feedbackComment: 'Great help',
      resolutionRating: 'good',
    }),
    {
      csatScore: 4,
      ratedByVisitor: true,
      feedbackComment: 'Great help',
      resolutionRating: 'good',
    },
  );
});

test('normalizeCsatScore rounds valid scores', () => {
  assert.equal(normalizeCsatScore(4.6), 5);
  assert.equal(normalizeCsatScore('3'), 3);
  assert.equal(normalizeCsatScore(6), null);
});
