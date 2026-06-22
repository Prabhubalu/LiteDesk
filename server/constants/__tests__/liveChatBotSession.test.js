'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeBotResolution,
  buildBotClosePatch,
} = require('../liveChatBotSession');

test('normalizeBotResolution accepts known values', () => {
  assert.equal(normalizeBotResolution('escalated'), 'escalated');
  assert.equal(normalizeBotResolution('invalid'), null);
});

test('buildBotClosePatch sets unresolved when bot involved without escalation', () => {
  const patch = buildBotClosePatch({
    botInvolved: true,
    botEscalated: false,
    botResolution: null,
  });
  assert.deepEqual(patch, { botResolution: 'unresolved' });
});

test('buildBotClosePatch is empty when resolution already set', () => {
  const patch = buildBotClosePatch({
    botInvolved: true,
    botEscalated: true,
    botResolution: 'escalated',
  });
  assert.deepEqual(patch, {});
});
