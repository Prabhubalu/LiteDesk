'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  assertAgentNotBlockedByAssignment,
} = require('../liveChatSessionAssignmentService');
const {
  LIVE_CHAT_ASSIGNED_BY,
  applySessionAgentAssignment,
} = require('../liveChatSessionAssignmentTrackingService');
const ChatSession = require('../../models/ChatSession');

test('assertAgentNotBlockedByAssignment allows unassigned session', () => {
  assert.doesNotThrow(() => {
    assertAgentNotBlockedByAssignment({ assignedAgentId: null }, 'agent-1');
  });
});

test('assertAgentNotBlockedByAssignment allows owning agent', () => {
  assert.doesNotThrow(() => {
    assertAgentNotBlockedByAssignment({ assignedAgentId: 'agent-1' }, 'agent-1');
  });
});

test('assertAgentNotBlockedByAssignment blocks other agent', () => {
  assert.throws(
    () => assertAgentNotBlockedByAssignment({ assignedAgentId: 'agent-1' }, 'agent-2'),
    (err) => err.statusCode === 403 && /assigned to another agent/i.test(err.message),
  );
});

test('queue routing does not steal from agent who already claimed', async () => {
  const sessionId = new mongoose.Types.ObjectId();
  const orgId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const routedId = new mongoose.Types.ObjectId();

  const originalFindById = ChatSession.findById;
  ChatSession.findById = () => ({
    select() {
      return {
        lean: async () => ({
          assignedAgentId: ownerId,
          agentsInvolved: [ownerId],
          transferCount: 0,
          queueId: null,
          lifecycleStatus: 'active',
          status: 'open',
        }),
      };
    },
  });

  try {
    const result = await applySessionAgentAssignment({
      organizationId: orgId,
      sessionId,
      agentId: routedId,
      assignedBy: LIVE_CHAT_ASSIGNED_BY.QUEUE_ROUTING,
      previousAgentId: null,
      metadata: { claimOnly: true },
    });
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'assignment_conflict');
    assert.equal(result.agentId, String(ownerId));
  } finally {
    ChatSession.findById = originalFindById;
  }
});
