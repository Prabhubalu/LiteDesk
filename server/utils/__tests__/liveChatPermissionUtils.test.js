'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  canViewLiveChatSessions,
  canReplyLiveChatSessions,
} = require('../liveChatPermissionUtils');

test('canReplyLiveChatSessions allows reply when view is granted', () => {
  const user = {
    permissions: {
      liveChat: { view: true, reply: false, admin: false },
    },
  };

  assert.equal(canViewLiveChatSessions(user), true);
  assert.equal(canReplyLiveChatSessions(user), true);
});

test('canReplyLiveChatSessions denies when live chat view is denied', () => {
  const user = {
    permissions: {
      liveChat: { view: false, reply: false, admin: false },
    },
  };

  assert.equal(canViewLiveChatSessions(user), false);
  assert.equal(canReplyLiveChatSessions(user), false);
});

test('canReplyLiveChatSessions allows owner and admin roles', () => {
  assert.equal(canReplyLiveChatSessions({ isOwner: true }), true);
  assert.equal(canReplyLiveChatSessions({ role: 'admin' }), true);
});
