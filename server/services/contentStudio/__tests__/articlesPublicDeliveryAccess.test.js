'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { resolveArticlesPublicDeliveryAccessFromState } = require('../articlesAddonSettingsService');

describe('resolveArticlesPublicDeliveryAccessFromState', () => {
  it('enables headless delivery when addon is enabled', () => {
    const access = resolveArticlesPublicDeliveryAccessFromState({
      addonEnabled: true,
      headlessApiEnabled: true,
    });

    assert.equal(access.headlessEnabled, true);
    assert.equal(access.publicEnabled, true);
  });

  it('disables all delivery when addon is not enabled', () => {
    const access = resolveArticlesPublicDeliveryAccessFromState({
      addonEnabled: false,
      headlessApiEnabled: true,
    });

    assert.equal(access.publicEnabled, false);
    assert.equal(access.headlessEnabled, false);
  });

  it('disables headless when headless API is turned off', () => {
    const access = resolveArticlesPublicDeliveryAccessFromState({
      addonEnabled: true,
      headlessApiEnabled: false,
    });

    assert.equal(access.headlessEnabled, false);
    assert.equal(access.publicEnabled, false);
  });
});
