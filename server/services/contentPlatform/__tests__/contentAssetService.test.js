'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  inferAssetType,
  validateAssetPayload,
  readImageDimensions
} = require('../contentAssetService');

describe('contentAssetService', () => {
  it('infers svg type from mime', () => {
    assert.equal(inferAssetType('image/svg+xml', undefined), 'svg');
  });

  it('prefers explicit asset type when valid', () => {
    assert.equal(inferAssetType('image/png', 'logo'), 'logo');
  });

  it('rejects invalid asset payloads', () => {
    const result = validateAssetPayload({ type: 'invalid' });
    assert.equal(result.valid, false);
  });

  it('reads png dimensions from buffer header', () => {
    const buffer = Buffer.alloc(24);
    buffer.writeUInt32BE(0x89504e47, 0);
    buffer.writeUInt32BE(640, 16);
    buffer.writeUInt32BE(480, 20);
    const dims = readImageDimensions(buffer, 'image/png');
    assert.equal(dims.width, 640);
    assert.equal(dims.height, 480);
  });
});
