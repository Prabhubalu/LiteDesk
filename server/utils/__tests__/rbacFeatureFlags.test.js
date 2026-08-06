'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isRbacV2Enabled,
  isSharingV1Enabled,
  projectEffectiveClientSettings
} = require('../rbacFeatureFlags');

const ORIG_RBAC = process.env.RBAC_V2;
const ORIG_SHARING = process.env.SHARING_V1;

function restoreEnv() {
  if (ORIG_RBAC === undefined) delete process.env.RBAC_V2;
  else process.env.RBAC_V2 = ORIG_RBAC;
  if (ORIG_SHARING === undefined) delete process.env.SHARING_V1;
  else process.env.SHARING_V1 = ORIG_SHARING;
}

test('projectEffectiveClientSettings reflects org flags when env unset', () => {
  delete process.env.RBAC_V2;
  delete process.env.SHARING_V1;
  try {
    const org = {
      settings: {
        timeZone: 'UTC',
        rbacV2Enabled: true,
        sharingV1Enabled: false
      }
    };
    const settings = projectEffectiveClientSettings(org);
    assert.equal(settings.timeZone, 'UTC');
    assert.equal(settings.rbacV2Enabled, true);
    assert.equal(settings.sharingV1Enabled, false);
    assert.equal(isRbacV2Enabled(org), true);
  } finally {
    restoreEnv();
  }
});

test('projectEffectiveClientSettings uses env override when org flag is false', () => {
  process.env.RBAC_V2 = 'true';
  process.env.SHARING_V1 = 'true';
  try {
    const org = {
      settings: {
        rbacV2Enabled: false,
        sharingV1Enabled: false
      }
    };
    const settings = projectEffectiveClientSettings(org);
    assert.equal(settings.rbacV2Enabled, true);
    assert.equal(settings.sharingV1Enabled, true);
    assert.equal(isRbacV2Enabled(org), true);
    assert.equal(isSharingV1Enabled(org), true);
  } finally {
    restoreEnv();
  }
});

test('projectEffectiveClientSettings reads mongoose-like toObject settings', () => {
  delete process.env.RBAC_V2;
  delete process.env.SHARING_V1;
  try {
    const org = {
      settings: {
        toObject() {
          return { locale: 'en-US', rbacV2Enabled: true };
        }
      }
    };
    const settings = projectEffectiveClientSettings(org);
    assert.equal(settings.locale, 'en-US');
    assert.equal(settings.rbacV2Enabled, true);
  } finally {
    restoreEnv();
  }
});
