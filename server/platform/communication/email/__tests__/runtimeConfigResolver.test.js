const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveSystemRuntimeConfig,
  resolveCrmRuntimeConfig
} = require('../runtimeConfigResolver');

describe('runtimeConfigResolver (R0)', () => {
  const saved = {};

  beforeEach(() => {
    for (const key of [
      'SYSTEM_EMAIL_PROVIDER',
      'EMAIL_PROVIDER',
      'SYSTEM_EMAIL_FROM',
      'EMAIL_FROM',
      'OCI_EMAIL_REGION',
      'SMTP_HOST',
      'AMDS_BASE_URL',
      'AMDS_API_KEY'
    ]) {
      saved[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(saved)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it('defaults system channel to oci-email-delivery when AMDS unset', () => {
    delete process.env.SYSTEM_EMAIL_PROVIDER;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.AMDS_BASE_URL;
    delete process.env.AMDS_API_KEY;
    process.env.SYSTEM_EMAIL_FROM = 'system@example.com';
    process.env.OCI_EMAIL_REGION = 'us-phoenix-1';
    process.env.SYSTEM_SMTP_USER = 'oci-user';
    process.env.SYSTEM_SMTP_PASS = 'oci-pass';

    const cfg = resolveSystemRuntimeConfig();
    assert.equal(cfg.provider, 'oci-email-delivery');
    assert.equal(cfg.fromEmail, 'system@example.com');
    assert.match(cfg.smtpHost, /oci\.oraclecloud\.com/);
  });

  it('defaults system channel to amds when AMDS env is configured', () => {
    delete process.env.SYSTEM_EMAIL_PROVIDER;
    process.env.AMDS_BASE_URL = 'http://localhost:8080';
    process.env.AMDS_API_KEY = 'test-key';
    process.env.SYSTEM_EMAIL_FROM = 'system@example.com';

    const cfg = resolveSystemRuntimeConfig();
    assert.equal(cfg.provider, 'amds');
    assert.equal(cfg.fromEmail, 'system@example.com');
  });

  it('CRM channel defaults to resend when AMDS unset', () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.AMDS_BASE_URL;
    delete process.env.AMDS_API_KEY;
    process.env.EMAIL_FROM = 'crm@example.com';
    process.env.RESEND_API_KEY = 're_test_key';
    const cfg = resolveCrmRuntimeConfig(null);
    assert.equal(cfg.provider, 'resend');
    assert.equal(cfg.smtpHost, 'smtp.resend.com');
    assert.equal(cfg.smtpUser, 'resend');
    assert.equal(cfg.smtpPass, 're_test_key');
    assert.equal(cfg.fromEmail, 'crm@example.com');
  });

  it('CRM channel defaults to amds when AMDS env is configured', () => {
    delete process.env.EMAIL_PROVIDER;
    process.env.AMDS_BASE_URL = 'http://localhost:8080';
    process.env.AMDS_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'crm@example.com';

    const cfg = resolveCrmRuntimeConfig(null);
    assert.equal(cfg.provider, 'amds');
    assert.equal(cfg.fromEmail, 'crm@example.com');
  });

  it('CRM channel uses tenant provider override', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.EMAIL_FROM = 'crm@example.com';
    const cfg = resolveCrmRuntimeConfig({ provider: 'aws-ses', fromEmail: 'tenant@example.com' });
    assert.equal(cfg.fromEmail, 'tenant@example.com');
    assert.equal(cfg.provider, 'aws-ses');
  });
});
