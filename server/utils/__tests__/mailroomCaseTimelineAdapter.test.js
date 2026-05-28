const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mapMailroomMessageToActivity
} = require('../../platform/mailroom/services/caseTimelineAdapter');

test('mailroom case timeline adapter', async (t) => {
  await t.test('mapMailroomMessageToActivity uses body and channel', () => {
    const act = mapMailroomMessageToActivity({
      _id: '507f1f77bcf86cd799439011',
      direction: 'inbound',
      channel: 'portal',
      body: 'Hello from portal',
      subject: 'Help',
      participants: { from: 'user@example.com' },
      receivedAt: new Date('2026-01-01T12:00:00Z')
    }, [{ id: 'a1', originalFileName: 'file.png' }]);

    assert.equal(act.activityType, 'channel_message_received');
    assert.equal(act.message, 'Hello from portal');
    assert.equal(act.channel, 'portal');
    assert.equal(act.internal, false);
    assert.equal(act.metadata.mailroomMessageId, '507f1f77bcf86cd799439011');
    assert.equal(act.metadata.mailroomAttachments.length, 1);
  });

  await t.test('mapMailroomMessageToActivity marks outbound as agent_message', () => {
    const act = mapMailroomMessageToActivity({
      _id: '507f1f77bcf86cd799439012',
      direction: 'outbound',
      body: 'We are looking into it',
      metadata: { internal: false }
    }, []);
    assert.equal(act.activityType, 'agent_message');
    assert.equal(act.message, 'We are looking into it');
  });
});
