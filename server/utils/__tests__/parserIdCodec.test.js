'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  toParserTenantId,
  toParserMailboxId,
  parseParserTenantId,
  parseParserMailboxId,
  resolveParserIdsForMailbox,
  routingLocalPartFromMailbox
} = require('../parserIdCodec');

describe('parserIdCodec ids', () => {
  const orgId = new mongoose.Types.ObjectId('6a087af980b15fe2b592e891');
  const mbId = new mongoose.Types.ObjectId('6a12f2846e76f240199b96d6');
  const assignedTo = new mongoose.Types.ObjectId('6a087af980b15fe2b592e892');

  it('uses full ObjectId hex for unique parser ids per mailbox', () => {
    assert.equal(toParserTenantId(orgId), 't_6a087af980b15fe2b592e891');
    assert.equal(toParserMailboxId(mbId), 'm_6a12f2846e76f240199b96d6');
    assert.notEqual(
      toParserMailboxId(new mongoose.Types.ObjectId('6a12f2846e76f240199b96d7')),
      toParserMailboxId(mbId)
    );
  });

  it('parses full ObjectId parser ids', () => {
    assert.equal(parseParserTenantId('t_6a087af980b15fe2b592e891'), String(orgId));
    assert.equal(parseParserMailboxId('m_6a12f2846e76f240199b96d6'), String(mbId));
  });

  it('does not treat legacy short ids as ObjectIds', () => {
    assert.equal(parseParserTenantId('t_6a08'), null);
    assert.equal(parseParserMailboxId('m_6a12'), null);
  });

  it('disambiguates personal routing local parts by owner', () => {
    const a = routingLocalPartFromMailbox({
      label: 'My work inbox',
      kind: 'personal',
      ownerUserId: assignedTo
    });
    const b = routingLocalPartFromMailbox({
      label: 'My work inbox',
      kind: 'personal',
      ownerUserId: mbId
    });
    assert.notEqual(a, b);
  });

  it('disambiguates shared routing local parts by mailbox id', () => {
    const groupA = new mongoose.Types.ObjectId('6a12f2846e76f240199b96d6');
    const groupB = new mongoose.Types.ObjectId('6a12f2846e76f240199b96d7');
    const a = routingLocalPartFromMailbox({
      label: 'Support',
      kind: 'group',
      mailboxObjectId: groupA
    });
    const b = routingLocalPartFromMailbox({
      label: 'Support',
      kind: 'group',
      mailboxObjectId: groupB
    });
    assert.notEqual(a, b);
  });

  it('assigns unique parser ids per personal and group mailbox', () => {
    const personalMb = { _id: mbId, parserTenantId: '', parserMailboxId: '' };
    const groupMb = {
      _id: new mongoose.Types.ObjectId('6a12f2846e76f240199b96d7'),
      parserTenantId: '',
      parserMailboxId: ''
    };
    const personalIds = resolveParserIdsForMailbox({ organizationId: orgId, mailbox: personalMb });
    const groupIds = resolveParserIdsForMailbox({ organizationId: orgId, mailbox: groupMb });
    assert.notEqual(personalIds.parserMailboxId, groupIds.parserMailboxId);
    assert.equal(personalIds.parserMailboxId, toParserMailboxId(mbId));
    assert.equal(groupIds.parserMailboxId, toParserMailboxId(groupMb._id));
  });

  it('upgrades legacy short parser ids to full ObjectId hex', () => {
    const ids = resolveParserIdsForMailbox({
      organizationId: orgId,
      mailbox: { _id: mbId, parserTenantId: 't_6a08', parserMailboxId: 'm_6a12' }
    });
    assert.equal(ids.parserTenantId, 't_6a087af980b15fe2b592e891');
    assert.equal(ids.parserMailboxId, 'm_6a12f2846e76f240199b96d6');
  });
});
