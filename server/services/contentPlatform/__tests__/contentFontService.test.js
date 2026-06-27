'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  validateFontPayload,
  assertAllowedCatalogFont,
  listCatalogFonts
} = require('../contentFontService');
const { ContentPlatformError } = require('../../../utils/contentPlatformErrors');

describe('contentFontService', () => {
  it('lists catalog fonts', () => {
    const catalog = listCatalogFonts();
    assert.ok(Array.isArray(catalog.google));
    assert.ok(catalog.google.includes('Roboto'));
    assert.ok(catalog.system.includes('Arial'));
  });

  it('validates font payloads', () => {
    const result = validateFontPayload({ fontName: 'Roboto', source: 'google' });
    assert.equal(result.valid, true);
  });

  it('rejects missing font name', () => {
    const result = validateFontPayload({ source: 'google' });
    assert.equal(result.valid, false);
  });

  it('allows allowlisted google fonts', () => {
    assert.doesNotThrow(() => assertAllowedCatalogFont('google', 'Roboto'));
  });

  it('rejects unknown google fonts', () => {
    assert.throws(
      () => assertAllowedCatalogFont('google', 'Comic Sans MS'),
      (error) => error instanceof ContentPlatformError
    );
  });
});
