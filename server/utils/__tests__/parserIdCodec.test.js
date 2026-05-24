'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  toParserTenantId,
  toParserMailboxId,
  parseParserTenantId,
  parseParserMailboxId
} = require('../parserIdCodec');

describe('parserIdCodec short ids', () => {
  const orgId = new mongoose.Types.ObjectId('6a087af980b15fe2b592e891');
  const mbId = new mongoose.Types.ObjectId('6a12f2846e76f240199b96d6');

  it('uses 4-char hex suffix for plus-address ids', () => {
    assert.equal(toParserTenantId(orgId), 't_6a08');
    assert.equal(toParserMailboxId(mbId), 'm_6a12');
  });

  it('parses legacy full ObjectId parser ids', () => {
    assert.equal(parseParserTenantId('t_6a087af980b15fe2b592e891'), String(orgId));
    assert.equal(parseParserMailboxId('m_6a12f2846e76f240199b96d6'), String(mbId));
  });

  it('does not treat short ids as ObjectIds', () => {
    assert.equal(parseParserTenantId('t_6a08'), null);
    assert.equal(parseParserMailboxId('m_6a12'), null);
  });
});
