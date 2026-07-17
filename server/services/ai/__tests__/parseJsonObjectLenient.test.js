'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseJsonObject, parseJsonObjectLenient } = require('../aiMarketingService');

describe('parseJsonObjectLenient', () => {
  it('parses complete JSON', () => {
    const parsed = parseJsonObject('{"headline":"Hi","bullets":["a","b"],"actions":[]}');
    assert.equal(parsed.headline, 'Hi');
    assert.deepEqual(parsed.bullets, ['a', 'b']);
  });

  it('repairs truncated JSON mid-action', () => {
    const truncated = `{
  "headline": "Deal stuck in Negotiation",
  "bullets": [
    "Status Won vs Negotiation conflict",
    "Quote expired"
  ],
  "actions": [
    {
      "label": "Clarify deal status",
      "kind": "send_email",
      "moduleKey": "deals",
      "recordId": "abc",
      "priority": "high",
      "rationale": "Status conflict",
      "email": {
        "to": "a@b.com",
        "subject": "Confirm",
        "body": "Hello"
      }
    },
    {
      "label`;
    const parsed = parseJsonObjectLenient(truncated);
    assert.ok(parsed);
    assert.equal(parsed.headline, 'Deal stuck in Negotiation');
    assert.equal(parsed.bullets.length, 2);
    assert.ok(Array.isArray(parsed.actions));
    assert.ok(parsed.actions.length >= 1);
    assert.equal(parsed.actions[0].label, 'Clarify deal status');
  });

  it('extracts headline and bullets when actions are unsalvageable', () => {
    const truncated = `{"headline":"Only headline","bullets":["one","two"],"actions":[{"label"`;
    const parsed = parseJsonObject(truncated);
    assert.ok(parsed);
    assert.equal(parsed.headline, 'Only headline');
    assert.deepEqual(parsed.bullets, ['one', 'two']);
  });
});
