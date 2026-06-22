'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseUserAgent } = require('../liveChatUserAgentUtils');
const { buildSessionVisitorContextFromRequest } = require('../../services/liveChatVisitorJourneyService');

test('parseUserAgent detects Chrome on desktop Windows', () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const parsed = parseUserAgent(ua);
  assert.equal(parsed.browser, 'Chrome');
  assert.equal(parsed.operatingSystem, 'Windows');
  assert.equal(parsed.deviceType, 'desktop');
});

test('parseUserAgent detects mobile Safari on iOS', () => {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const parsed = parseUserAgent(ua);
  assert.equal(parsed.browser, 'Safari');
  assert.equal(parsed.operatingSystem, 'iOS');
  assert.equal(parsed.deviceType, 'mobile');
});

test('buildSessionVisitorContextFromRequest maps page, language, and country headers', () => {
  const req = {
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
      'cf-ipcountry': 'us',
    },
  };

  const context = buildSessionVisitorContextFromRequest(req, {
    pageUrl: 'https://example.com/pricing',
    referrerUrl: 'https://google.com/',
    language: 'en-US',
  });

  assert.equal(context.pageUrl, 'https://example.com/pricing');
  assert.equal(context.entryPage, 'https://example.com/pricing');
  assert.equal(context.referrerUrl, 'https://google.com/');
  assert.equal(context.browser, 'Chrome');
  assert.equal(context.operatingSystem, 'macOS');
  assert.equal(context.deviceType, 'desktop');
  assert.equal(context.country, 'US');
  assert.equal(context.language, 'en-US');
});
