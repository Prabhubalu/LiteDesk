'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bootstrap = require('../../bootstrap');
const toolRegistry = require('../toolRegistry');

describe('email.send guard', () => {
  it('refuses confirmed send without recipient', async () => {
    bootstrap.resetForTests();
    bootstrap.ensureBootstrapped();
    const tool = toolRegistry.getTool('email.send');
    const result = await tool.run(
      { to: '', subject: 'Hi', body: 'Hello', confirmed: true },
      { organizationId: '507f1f77bcf86cd799439011' },
    );
    assert.equal(result.sent, false);
    assert.equal(result.ok, false);
    assert.match(result.guidance, /recipient/i);
  });
});
