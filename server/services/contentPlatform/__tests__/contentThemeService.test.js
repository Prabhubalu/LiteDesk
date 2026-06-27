'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDefaultThemePayload,
  validateThemePayload
} = require('../contentThemeService');

describe('contentThemeService', () => {
  it('builds a default theme with branding tokens', () => {
    const theme = buildDefaultThemePayload('Brand Theme');
    assert.equal(theme.name, 'Brand Theme');
    assert.equal(theme.colors.primary, '#4f46e5');
    assert.equal(theme.typography.bodyFont, 'Arial, Helvetica, sans-serif');
    assert.equal(theme.status, 'draft');
  });

  it('rejects invalid theme payloads', () => {
    const result = validateThemePayload({ name: '   ' });
    assert.equal(result.valid, false);
    assert.match(result.errors[0].message, /name/i);
  });

  it('accepts partial updates', () => {
    const result = validateThemePayload({ colors: { primary: '#000000' } }, { partial: true });
    assert.equal(result.valid, true);
  });

  it('rejects non-object colors on update', () => {
    const result = validateThemePayload({ colors: 'red' }, { partial: true });
    assert.equal(result.valid, false);
  });
});
