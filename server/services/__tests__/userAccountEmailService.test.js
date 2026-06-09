'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('sendAccountEmail returns email_not_configured when no providers available', async () => {
  const originalEnv = { ...process.env };
  try {
    process.env.ENABLE_EMAIL_NOTIFICATIONS = 'false';
    delete process.env.EMAIL_FROM;
    delete process.env.SYSTEM_EMAIL_FROM;
    delete process.env.SMTP_HOST;

    const emailService = require('../../services/emailService');
    assert.equal(emailService.isConfigured(), false);
    assert.equal(emailService.isSystemEmailConfigured(), false);

    const { sendAccountEmail } = require('../../services/userAccountEmailService');
    const result = await sendAccountEmail({
      organizationId: null,
      to: 'user@example.com',
      subject: 'Test',
      text: 'Test body'
    });

    assert.equal(result.success, false);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'email_not_configured');
  } finally {
    process.env = originalEnv;
  }
});
