const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolvePortalAudienceFromAppAccess,
  getPortalChannelLabel,
  getMailroomChannelKey,
  emailDomain
} = require('../../platform/mailroom/connectors/portal/portalAudience');
const {
  getPortalRulesForUser,
  assertPortalActionAllowed,
  assertPortalAttachmentAllowed
} = require('../../platform/mailroom/connectors/portal/portalRules');
const { mergePortalConnector } = require('../../platform/mailroom/connectors/portal/portalConnectorDefaults');

test('mailroom portal audience', async (t) => {
  await t.test('resolvePortalAudienceFromAppAccess prefers explicit roleKey', () => {
    const partnerUser = {
      appAccess: [{ appKey: 'PORTAL', status: 'ACTIVE', roleKey: 'partner' }]
    };
    const customerUser = {
      appAccess: [{ appKey: 'PORTAL', status: 'ACTIVE', roleKey: 'customer' }]
    };
    assert.equal(resolvePortalAudienceFromAppAccess(partnerUser), 'partner');
    assert.equal(resolvePortalAudienceFromAppAccess(customerUser), 'customer');
  });

  await t.test('channel labels map audience to case and mailroom channels', () => {
    assert.equal(getPortalChannelLabel('partner'), 'Partner Portal');
    assert.equal(getPortalChannelLabel('customer'), 'Customer Portal');
    assert.equal(getMailroomChannelKey('partner'), 'portal_partner');
    assert.equal(getMailroomChannelKey('customer'), 'portal_customer');
  });

  await t.test('emailDomain extracts domain', () => {
    assert.equal(emailDomain('user@Partner.COM'), 'partner.com');
  });

  await t.test('getPortalRulesForUser applies partner defaults', async () => {
    const user = {
      email: 'rep@partner.com',
      appAccess: [{ appKey: 'PORTAL', status: 'ACTIVE', roleKey: 'partner' }]
    };
    const config = {
      connectors: {
        portal: mergePortalConnector({ enabled: true })
      }
    };
    const caps = await getPortalRulesForUser(user, config);
    assert.equal(caps.audience, 'partner');
    assert.equal(caps.allowCreateCase, false);
    assert.equal(caps.allowReply, true);
    assert.equal(caps.channel, 'Partner Portal');
    assert.ok(Array.isArray(caps.allowedMimeTypes));
  });

  await t.test('assertPortalActionAllowed blocks partner create', async () => {
    const caps = await getPortalRulesForUser(
      { appAccess: [{ appKey: 'PORTAL', status: 'ACTIVE', roleKey: 'partner' }] },
      { connectors: { portal: mergePortalConnector({}) } }
    );
    assert.throws(
      () => assertPortalActionAllowed(caps, 'create_case'),
      (err) => err.statusCode === 403
    );
  });

  await t.test('assertPortalAttachmentAllowed enforces partner mime list', async () => {
    const caps = await getPortalRulesForUser(
      { appAccess: [{ appKey: 'PORTAL', status: 'ACTIVE', roleKey: 'partner' }] },
      { connectors: { portal: mergePortalConnector({}) } }
    );
    assert.doesNotThrow(() => assertPortalAttachmentAllowed(caps, {
      size: 1000,
      mimetype: 'application/pdf'
    }));
    assert.throws(
      () => assertPortalAttachmentAllowed(caps, {
        size: 1000,
        mimetype: 'application/zip'
      }),
      (err) => err.statusCode === 400
    );
  });
});
