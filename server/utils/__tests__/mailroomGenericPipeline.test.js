const test = require('node:test');
const assert = require('node:assert/strict');

const { processNormalizedInboundThroughMailroom } = require('../../platform/mailroom/pipeline/genericInboundPipeline');
const mailroomConfigService = require('../../services/mailroomConfigService');

test('mailroom generic pipeline', async (t) => {
  await t.test('rejects when orgId missing', async () => {
    await assert.rejects(
      () => processNormalizedInboundThroughMailroom({ organizationId: null, message: { channel: 'api' } }),
      /organizationId is required/
    );
  });

  await t.test('rejects when mailroom disabled', async () => {
    const orgId = '000000000000000000000001';
    const original = mailroomConfigService.getOrCreateConfig;
    mailroomConfigService.getOrCreateConfig = async () => ({
      organizationId: orgId,
      enabled: false,
      policies: {},
      connectors: { publicApi: { enabled: true, ingestKey: 'x' } }
    });
    try {
      await assert.rejects(
        () => processNormalizedInboundThroughMailroom({ organizationId: orgId, message: { channel: 'api' } }),
        /Mailroom is disabled/
      );
    } finally {
      mailroomConfigService.getOrCreateConfig = original;
    }
  });

  // Ensure the test runner can exit cleanly even if mongoose created timers/handles.
  t.after(async () => {
    try {
      // eslint-disable-next-line global-require
      const mongoose = require('mongoose');
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
});

