'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  inferAssetType,
  validateAssetPayload,
  withAssetUrls
} = require('../marketingAssetService');

test('inferAssetType maps mime and requested type', () => {
  assert.equal(inferAssetType('image/png', 'logo'), 'logo');
  assert.equal(inferAssetType('image/svg+xml'), 'svg');
  assert.equal(inferAssetType('image/jpeg'), 'image');
});

test('validateAssetPayload requires valid type', () => {
  const invalid = validateAssetPayload({ type: 'video' });
  assert.equal(invalid.valid, false);

  const valid = validateAssetPayload({ type: 'image', accessibilityAltText: 'Logo' });
  assert.equal(valid.valid, true);
});

test('withAssetUrls adds downloadUrl for OCI storage keys', () => {
  const asset = withAssetUrls({
    filename: 'hero.png',
    mimeType: 'image/png',
    storageKey: 'oci:uploads/org/marketing-assets/hero.png'
  });

  assert.match(asset.downloadUrl, /^\/api\/files\/download\?/);
  assert.match(asset.downloadUrl, /storagePath=/);
});
