const test = require('node:test');
const assert = require('node:assert/strict');
const { isPortalChannelCase } = require('../portalCaseAccessService');
const { isCustomerVisibleActivity } = require('../portalCaseNotificationService');

test('isPortalChannelCase matches customer and partner portal channels', () => {
  assert.equal(isPortalChannelCase({ channel: 'Customer Portal' }), true);
  assert.equal(isPortalChannelCase({ channel: 'Partner Portal' }), true);
  assert.equal(isPortalChannelCase({ channel: 'Email' }), false);
});

test('isCustomerVisibleActivity ignores internal activities', () => {
  assert.equal(isCustomerVisibleActivity({
    activityType: 'agent_message',
    internal: false,
    message: 'Hello'
  }), true);
  assert.equal(isCustomerVisibleActivity({
    activityType: 'agent_message',
    internal: true,
    message: 'Secret'
  }), false);
});
