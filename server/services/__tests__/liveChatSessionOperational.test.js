'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveAgentCount } = require('../../services/liveChatSessionOperationalService');

test('resolveAgentCount uses max of message authors and agentsInvolved', () => {
  assert.equal(resolveAgentCount({ agentCount: 1 }, { agentsInvolved: ['a', 'b'] }), 2);
  assert.equal(resolveAgentCount({ agentCount: 3 }, { agentsInvolved: ['a'] }), 3);
  assert.equal(resolveAgentCount({ agentCount: 0 }, { agentsInvolved: [] }), 0);
});
