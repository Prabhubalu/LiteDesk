'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isConsumerDomain,
  detectSmtpProvider,
  resolveSmtpPreset,
  extractEmailDomain
} = require('../../constants/smtpProviderPresets');

describe('smtpProviderPresets', () => {
  it('classifies consumer domains', () => {
    assert.equal(isConsumerDomain('user@gmail.com'), true);
    assert.equal(isConsumerDomain('user@outlook.com'), true);
    assert.equal(isConsumerDomain('user@company.com'), false);
  });

  it('detects providers from email', () => {
    assert.equal(detectSmtpProvider('a@gmail.com'), 'gmail');
    assert.equal(detectSmtpProvider('a@hotmail.com'), 'outlook');
    assert.equal(detectSmtpProvider('a@acme.io'), 'custom');
  });

  it('resolves Gmail preset', () => {
    const p = resolveSmtpPreset('gmail');
    assert.equal(p.host, 'smtp.gmail.com');
    assert.equal(p.port, 587);
    assert.equal(p.secure, false);
  });

  it('extracts domain', () => {
    assert.equal(extractEmailDomain('x@Yahoo.com'), 'yahoo.com');
    assert.equal(extractEmailDomain(''), '');
  });
});
