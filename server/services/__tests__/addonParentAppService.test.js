'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { evaluateRequiredAppsEntitlement } = require('../addonParentAppService');
const { ADDON_KEYS } = require('../../constants/addonKeys');
const { APP_KEYS } = require('../../constants/appKeys');

describe('addonParentAppService', () => {
  it('blocks articles install when Helpdesk is not entitled', () => {
    const organization = {
      enabledApps: [{ appKey: APP_KEYS.SALES, status: 'ACTIVE' }],
    };

    const result = evaluateRequiredAppsEntitlement({
      organization,
      subscription: { apps: [] },
      requiredApps: [APP_KEYS.HELPDESK],
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, 'PARENT_APP_REQUIRED');
    assert.deepEqual(result.missingApps, [APP_KEYS.HELPDESK]);
  });

  it('allows articles install when Helpdesk is enabled', () => {
    const organization = {
      enabledApps: [
        { appKey: APP_KEYS.SALES, status: 'ACTIVE' },
        { appKey: APP_KEYS.HELPDESK, status: 'ACTIVE' },
      ],
    };

    const result = evaluateRequiredAppsEntitlement({
      organization,
      subscription: { apps: [] },
      requiredApps: [APP_KEYS.HELPDESK],
    });

    assert.equal(result.ok, true);
  });

  it('allows blog install when Marketing subscription is TRIAL', () => {
    const organization = {
      enabledApps: [{ appKey: APP_KEYS.SALES, status: 'ACTIVE' }],
    };
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = evaluateRequiredAppsEntitlement({
      organization,
      subscription: {
        apps: [{ appKey: APP_KEYS.MARKETING, status: 'TRIAL', trialEndsAt }],
      },
      requiredApps: [APP_KEYS.MARKETING],
    });

    assert.equal(result.ok, true);
  });

  it('blocks blog install when Marketing is not entitled', () => {
    const organization = {
      enabledApps: [{ appKey: APP_KEYS.SALES, status: 'ACTIVE' }],
    };

    const result = evaluateRequiredAppsEntitlement({
      organization,
      subscription: { apps: [] },
      requiredApps: [APP_KEYS.MARKETING],
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, 'PARENT_APP_REQUIRED');
    assert.deepEqual(result.missingApps, [APP_KEYS.MARKETING]);
  });

  it('maps addon keys for articles and blog parent requirements', () => {
    assert.equal(ADDON_KEYS.ARTICLES, 'articles');
    assert.equal(ADDON_KEYS.BLOG, 'blog');
  });
});
