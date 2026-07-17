'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  buildListFilter,
  serializeAuditLogRow,
} = require('../aiAuditLogService');

describe('aiAuditLogService', () => {
  it('buildListFilter scopes by organization and optional fields', () => {
    const orgId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const filter = buildListFilter({
      organizationId: orgId,
      abilityKey: 'ask',
      status: 'success',
      userId,
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.000Z',
    });

    assert.equal(String(filter.organizationId), String(orgId));
    assert.equal(filter.abilityKey, 'ask');
    assert.equal(filter.status, 'success');
    assert.equal(String(filter.userId), String(userId));
    assert.ok(filter.createdAt.$gte instanceof Date);
    assert.ok(filter.createdAt.$lte instanceof Date);
  });

  it('serializeAuditLogRow maps populated user and usage fields', () => {
    const userId = new mongoose.Types.ObjectId();
    const row = serializeAuditLogRow({
      _id: new mongoose.Types.ObjectId(),
      abilityKey: 'summarize',
      provider: 'openai',
      model: 'gpt-4o-mini',
      keyMode: 'platform',
      promptVersion: 'v1',
      status: 'success',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      creditsDebited: 1,
      latencyMs: 420,
      createdAt: new Date('2026-07-17T10:00:00.000Z'),
      userId: {
        _id: userId,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      },
    });

    assert.equal(row.abilityKey, 'summarize');
    assert.equal(row.usage.totalTokens, 150);
    assert.equal(row.user.name, 'Ada Lovelace');
    assert.equal(row.user.email, 'ada@example.com');
  });

  it('serializeAuditLogRow handles system rows without user', () => {
    const row = serializeAuditLogRow({
      _id: new mongoose.Types.ObjectId(),
      abilityKey: 'embed',
      provider: 'openai',
      model: 'text-embedding-3-small',
      keyMode: 'platform',
      status: 'success',
      usage: { totalTokens: 900 },
      creditsDebited: 1,
      createdAt: new Date(),
      userId: null,
    });

    assert.equal(row.user, null);
    assert.equal(row.creditsDebited, 1);
  });
});
