const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  canManageGmailInboxSync,
  canRunGmailInboxSync,
  assertGmailSyncManageAccess,
  assertGmailSyncRunAccess,
  canUserAccessMailboxThreads,
  getAccessibleMailboxIds
} = require('../mailboxAccessService');

const admin = { _id: 'u1', role: 'admin', isOwner: false };
const member = { _id: 'u2', role: 'user', isOwner: false };
const owner = { _id: 'u3', role: 'user', isOwner: false };

const personalMb = {
  kind: 'personal',
  ownerUserId: 'u3',
  memberUserIds: []
};

const groupMb = {
  kind: 'group',
  ownerUserId: null,
  memberUserIds: ['u2']
};

describe('mailboxAccessService (R1)', () => {
  it('allows personal owner to manage Gmail sync', () => {
    assert.equal(canManageGmailInboxSync(owner, personalMb), true);
    assert.equal(assertGmailSyncManageAccess(personalMb, owner), null);
  });

  it('denies non-owner from managing personal Gmail sync', () => {
    assert.equal(canManageGmailInboxSync(member, personalMb), false);
    assert.match(assertGmailSyncManageAccess(personalMb, member), /owner/i);
  });

  it('allows admin to manage group Gmail sync', () => {
    assert.equal(canManageGmailInboxSync(admin, groupMb), true);
    assert.equal(assertGmailSyncManageAccess(groupMb, admin), null);
  });

  it('denies member from managing group Gmail sync', () => {
    assert.equal(canManageGmailInboxSync(member, groupMb), false);
    assert.match(assertGmailSyncManageAccess(groupMb, member), /admin/i);
  });

  it('allows group member to run sync but not connect', () => {
    assert.equal(canRunGmailInboxSync(member, groupMb), true);
    assert.equal(assertGmailSyncRunAccess(groupMb, member), null);
    assert.notEqual(assertGmailSyncManageAccess(groupMb, member), null);
  });

  it('restricts personal mailbox threads to owner only', () => {
    assert.equal(canUserAccessMailboxThreads(owner, personalMb), true);
    assert.equal(canUserAccessMailboxThreads(admin, personalMb), false);
    assert.equal(canUserAccessMailboxThreads(member, personalMb), false);
  });

  it('returns only accessible mailbox ids for a member', async () => {
    const groupMbWithId = { _id: 'mb-group', kind: 'group', ownerUserId: null, memberUserIds: ['u2'] };
    const otherPersonal = { _id: 'mb-other', kind: 'personal', ownerUserId: 'u9', memberUserIds: [] };
    const personalMbWithId = { _id: 'mb-personal', kind: 'personal', ownerUserId: 'u3', memberUserIds: [] };
    const ids = await getAccessibleMailboxIds(member, 'org1', [
      personalMbWithId,
      groupMbWithId,
      otherPersonal
    ]);
    assert.deepEqual(ids.map(String), ['mb-group']);
  });

  it('excludes other users personal mailboxes for admins', async () => {
    const groupMbWithId = { _id: 'mb-group', kind: 'group', ownerUserId: null, memberUserIds: [] };
    const otherPersonal = { _id: 'mb-other', kind: 'personal', ownerUserId: 'u9', memberUserIds: [] };
    const ids = await getAccessibleMailboxIds(admin, 'org1', [groupMbWithId, otherPersonal]);
    assert.deepEqual(ids.map(String), ['mb-group']);
  });

  it('allows smtp_sender owner to manage SMTP and excludes from thread access ids', async () => {
    const smtpMb = { _id: 'mb-smtp', kind: 'smtp_sender', ownerUserId: 'u3', memberUserIds: [] };
    assert.equal(canUserAccessMailboxThreads(owner, smtpMb), true);
    assert.equal(canUserAccessMailboxThreads(member, smtpMb), false);
    assert.equal(canManageGmailInboxSync(owner, smtpMb), true);
    assert.equal(assertGmailSyncManageAccess(smtpMb, owner), null);
    assert.match(assertGmailSyncManageAccess(smtpMb, member), /owner/i);
    const personalMbWithId = { _id: 'mb-personal', kind: 'personal', ownerUserId: 'u3', memberUserIds: [] };
    const groupMbWithId = { _id: 'mb-group', kind: 'group', ownerUserId: null, memberUserIds: [] };
    const ids = await getAccessibleMailboxIds(owner, 'org1', [personalMbWithId, smtpMb, groupMbWithId]);
    assert.deepEqual(ids.map(String).sort(), ['mb-group', 'mb-personal']);
  });
});
