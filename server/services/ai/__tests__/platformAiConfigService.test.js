'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  PLATFORM_KEY_PROVIDERS,
  getEnvPlatformApiKey,
} = require('../platformAiConfigService');
const { AI_PROVIDERS } = require('../../../constants/aiProviders');

describe('platformAiConfigService', () => {
  it('lists platform key providers without arivu sentinel', () => {
    assert.ok(PLATFORM_KEY_PROVIDERS.includes(AI_PROVIDERS.ANTHROPIC));
    assert.ok(!PLATFORM_KEY_PROVIDERS.includes(AI_PROVIDERS.ARIVU));
  });

  it('getEnvPlatformApiKey returns null for unknown provider', () => {
    assert.equal(getEnvPlatformApiKey('not-a-provider'), null);
  });
});
