'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildParityResult } = require('../contentPlatformShadowParityService');

describe('contentPlatformShadowParityService', () => {
  it('buildParityResult marks matching checksums', () => {
    const buffer = Buffer.from('same-pdf');
    const result = buildParityResult({
      moduleKey: 'quotes',
      recordId: '507f1f77bcf86cd799439011',
      recordLabel: 'QT-100',
      legacyBuffer: buffer,
      platformBuffer: Buffer.from('same-pdf'),
      templateId: 'tpl-1',
      templateVersion: 2
    });

    assert.equal(result.match, true);
    assert.equal(result.legacyChecksum, result.platformChecksum);
    assert.equal(result.recordLabel, 'QT-100');
    assert.equal(result.templateVersion, 2);
  });

  it('buildParityResult marks mismatched checksums', () => {
    const result = buildParityResult({
      moduleKey: 'invoices',
      recordId: '507f1f77bcf86cd799439012',
      legacyBuffer: Buffer.from('legacy'),
      platformBuffer: Buffer.from('platform')
    });

    assert.equal(result.match, false);
    assert.notEqual(result.legacyChecksum, result.platformChecksum);
  });

  it('buildParityResult captures platform errors', () => {
    const result = buildParityResult({
      moduleKey: 'quotes',
      recordId: '507f1f77bcf86cd799439011',
      legacyBuffer: Buffer.from('legacy'),
      platformError: new Error('Template missing')
    });

    assert.equal(result.match, false);
    assert.equal(result.platformChecksum, null);
    assert.match(result.platformError, /Template missing/);
  });
});
