'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  getModuleRenderMode,
  getModuleTemplateOverride,
  VALID_MODES
} = require('../contentPlatformIntegration');

describe('contentPlatformIntegration', () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    delete process.env.CONTENT_PLATFORM_QUOTES_MODE;
    delete process.env.CONTENT_PLATFORM_INVOICES_MODE;
    delete process.env.CONTENT_PLATFORM_QUOTE_TEMPLATE_ID;
    delete process.env.CONTENT_PLATFORM_INVOICE_TEMPLATE_ID;
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(envSnapshot)) {
      process.env[key] = value;
    }
  });

  it('defaults to legacy mode for quotes and invoices', () => {
    assert.equal(getModuleRenderMode('quotes'), 'legacy');
    assert.equal(getModuleRenderMode('invoices'), 'legacy');
  });

  it('reads mode from env for supported modules', () => {
    process.env.CONTENT_PLATFORM_QUOTES_MODE = 'shadow';
    process.env.CONTENT_PLATFORM_INVOICES_MODE = 'platform';
    assert.equal(getModuleRenderMode('quotes'), 'shadow');
    assert.equal(getModuleRenderMode('invoices'), 'platform');
  });

  it('falls back to legacy for unknown mode values', () => {
    process.env.CONTENT_PLATFORM_QUOTES_MODE = 'invalid';
    assert.equal(getModuleRenderMode('quotes'), 'legacy');
  });

  it('returns legacy for unsupported module keys', () => {
    assert.equal(getModuleRenderMode('deals'), 'legacy');
  });

  it('exposes valid mode set', () => {
    assert.deepEqual([...VALID_MODES].sort(), ['legacy', 'platform', 'shadow']);
  });

  it('reads optional template override env vars', () => {
    process.env.CONTENT_PLATFORM_QUOTE_TEMPLATE_ID = '  tpl-quote  ';
    process.env.CONTENT_PLATFORM_INVOICE_TEMPLATE_ID = 'tpl-invoice';
    assert.equal(getModuleTemplateOverride('quotes'), 'tpl-quote');
    assert.equal(getModuleTemplateOverride('invoices'), 'tpl-invoice');
  });
});
