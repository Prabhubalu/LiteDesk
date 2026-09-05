'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');
const InternalChatSpace = require('../models/InternalChatSpace');
const InternalChatMembership = require('../models/InternalChatMembership');
const InternalChatMessage = require('../models/InternalChatMessage');
const User = require('../models/User');
const internalChatSSEHub = require('./internalChatSSEHub');
const { getModelForModuleKey } = require('../utils/assignmentRecordLoader');
const { resolveRuntimePermission } = require('./runtimePermissionResolver');

function canViewInternalChat(user) {
  if (!user) return false;
  if (String(user.userType || 'INTERNAL').toUpperCase() === 'EXTERNAL') return false;
  if (user.isOwner === true) return true;
  const role = String(user.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;
  return user.permissions?.internalChat?.view === true;
}

function canManageInternalChat(user) {
  if (!user) return false;
  if (String(user.userType || 'INTERNAL').toUpperCase() === 'EXTERNAL') return false;
  if (user.isOwner === true) return true;
  const role = String(user.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;
  return user.permissions?.internalChat?.manage === true
    || user.permissions?.internalChat?.admin === true;
}

function isInternalTeamUserDoc(user) {
  return String(user?.userType || 'INTERNAL').toUpperCase() !== 'EXTERNAL';
}

/** Mongo filter: active org teammates only (exclude portal/external users). */
function internalTeammateFilter(organizationId) {
  return {
    organizationId,
    userType: { $nin: ['EXTERNAL', 'external'] },
    $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }],
  };
}

function ServiceError(message, status = 400, code = 'INTERNAL_CHAT_ERROR') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeModuleKey(moduleKey) {
  return String(moduleKey || '').trim().toLowerCase();
}

function buildDmKey(userIds) {
  const sorted = [...new Set(userIds.map((id) => String(id)))].sort();
  return crypto.createHash('sha256').update(sorted.join(':')).digest('hex');
}

function parseMentionsFromBody(body, explicitIds = []) {
  const fromBody = [];
  const re = /<@([a-f0-9]{24})>/gi;
  let match;
  while ((match = re.exec(String(body || ''))) !== null) {
    fromBody.push(match[1]);
  }
  const combined = [...explicitIds.map(String), ...fromBody];
  return [...new Set(combined)].filter((id) => mongoose.Types.ObjectId.isValid(id));
}

async function listMemberUserIds(organizationId, spaceId) {
  const rows = await InternalChatMembership.find({ organizationId, spaceId })
    .select('userId')
    .lean();
  return rows.map((r) => r.userId);
}

async function publishToSpaceMembers(organizationId, spaceId, payload) {
  const userIds = await listMemberUserIds(organizationId, spaceId);
  return internalChatSSEHub.publishToUsers(organizationId, userIds, payload);
}

async function ensureMembership(organizationId, spaceId, userId, role = 'member') {
  const existing = await InternalChatMembership.findOne({ organizationId, spaceId, userId }).lean();
  if (existing) return existing;
  const doc = await InternalChatMembership.create({
    organizationId,
    spaceId,
    userId,
    role,
  });
  return doc.toObject();
}

async function assertMembership(organizationId, userId, spaceId) {
  const membership = await InternalChatMembership.findOne({
    organizationId,
    spaceId,
    userId,
  }).lean();
  if (!membership) {
    throw ServiceError('Not a member of this space', 403, 'INTERNAL_CHAT_NOT_MEMBER');
  }
  return membership;
}

async function getSpaceOrThrow(organizationId, spaceId) {
  const space = await InternalChatSpace.findOne({
    organizationId,
    _id: spaceId,
    archivedAt: null,
  }).lean();
  if (!space) {
    throw ServiceError('Space not found', 404, 'INTERNAL_CHAT_SPACE_NOT_FOUND');
  }
  return space;
}

function userCanViewModule(user, moduleKey) {
  if (user?.isOwner === true) return true;
  const role = String(user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;
  return resolveRuntimePermission(user, moduleKey, 'view', {}) === true;
}

function recordDisplayLabel(record) {
  if (!record) return '';
  const first = String(record.first_name || record.firstName || '').trim();
  const last = String(record.last_name || record.lastName || '').trim();
  const personName = [first, last].filter(Boolean).join(' ');
  return (
    personName
    || String(record.name || '').trim()
    || String(record.title || '').trim()
    || String(record.subject || '').trim()
    || String(record.displayName || '').trim()
    || String(record.caseNumber || '').trim()
    || String(record.dealName || '').trim()
    || String(record.personNumber || '').trim()
    || String(record.email || '').trim()
    || String(record._id)
  );
}

/**
 * Module view permission + record exists in tenant.
 * Sharing-scope filtering deferred; owners/admins + module.view gate P1.
 */
async function assertCanViewRecord(user, moduleKey, recordId) {
  const key = normalizeModuleKey(moduleKey);
  if (!key || !mongoose.Types.ObjectId.isValid(recordId)) {
    throw ServiceError('Invalid module or record', 400, 'INTERNAL_CHAT_INVALID_RECORD');
  }
  if (!userCanViewModule(user, key)) {
    throw ServiceError('No permission to view this record', 403, 'INTERNAL_CHAT_RECORD_FORBIDDEN');
  }
  const Model = getModelForModuleKey(key);
  if (!Model) {
    throw ServiceError('Unsupported module for chat', 400, 'INTERNAL_CHAT_UNSUPPORTED_MODULE');
  }
  const record = await Model.findOne({
    _id: recordId,
    organizationId: user.organizationId,
  })
    .select('_id name title subject displayName caseNumber dealName first_name last_name firstName lastName email personNumber')
    .lean();
  if (!record) {
    throw ServiceError('Record not found', 404, 'INTERNAL_CHAT_RECORD_NOT_FOUND');
  }
  return { moduleKey: key, record, label: recordDisplayLabel(record) };
}

async function assertCanAccessSpace(user, space) {
  if (space.type === 'record' && space.moduleKey && space.recordId) {
    await assertCanViewRecord(user, space.moduleKey, space.recordId);
  }
}

async function createChannel({ organizationId, user, name, topic = '', isPrivate = false, memberIds = [] }) {
  if (!canManageInternalChat(user) && !canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw ServiceError('Channel name is required', 400, 'INTERNAL_CHAT_NAME_REQUIRED');
  }

  const space = await InternalChatSpace.create({
    organizationId,
    type: 'channel',
    name: trimmed,
    topic: String(topic || '').trim(),
    isPrivate: Boolean(isPrivate),
    createdBy: user._id,
  });

  const members = new Set([String(user._id), ...memberIds.map(String)]);
  const validIds = [...members].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const teammateRows = await User.find({
    _id: { $in: validIds },
    ...internalTeammateFilter(organizationId),
  })
    .select('_id')
    .lean();
  const allowed = new Set(teammateRows.map((r) => String(r._id)));
  // Creator is always allowed even if filter edge-cases (they already passed canView).
  allowed.add(String(user._id));

  for (const mid of validIds) {
    if (!allowed.has(mid)) continue;
    // eslint-disable-next-line no-await-in-loop
    await ensureMembership(
      organizationId,
      space._id,
      mid,
      mid === String(user._id) ? 'admin' : 'member'
    );
  }

  const payload = { type: 'space.updated', spaceId: String(space._id), action: 'created' };
  await publishToSpaceMembers(organizationId, space._id, payload);
  return {
    ...space.toObject(),
    isMember: true,
    canJoin: false,
  };
}

function formatUserDisplayName(user) {
  if (!user) return '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || String(user._id || '');
}

async function enrichSpaceDisplayNames(organizationId, viewerUserId, spaces) {
  const dmSpaceIds = spaces
    .filter((s) => s.type === 'dm' || s.type === 'group_dm')
    .map((s) => s._id);

  const recordSpaces = spaces.filter((s) => s.type === 'record' && s.moduleKey && s.recordId);

  const allMemberships = dmSpaceIds.length
    ? await InternalChatMembership.find({
        organizationId,
        spaceId: { $in: dmSpaceIds },
      })
        .select('spaceId userId')
        .lean()
    : [];

  const peerIds = new Set();
  const peersBySpace = new Map();
  for (const row of allMemberships) {
    const sid = String(row.spaceId);
    if (!peersBySpace.has(sid)) peersBySpace.set(sid, []);
    if (String(row.userId) !== String(viewerUserId)) {
      peersBySpace.get(sid).push(row.userId);
      peerIds.add(String(row.userId));
    }
  }

  const users = peerIds.size
    ? await User.find({ _id: { $in: [...peerIds] } })
      .select('_id firstName lastName email avatar')
      .lean()
    : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));

  // Batch-load record labels by module
  const recordLabelBySpaceId = new Map();
  const byModule = new Map();
  for (const space of recordSpaces) {
    const key = normalizeModuleKey(space.moduleKey);
    if (!byModule.has(key)) byModule.set(key, []);
    byModule.get(key).push(space);
  }
  await Promise.all([...byModule.entries()].map(async ([moduleKey, moduleSpaces]) => {
    const Model = getModelForModuleKey(moduleKey);
    if (!Model) return;
    const ids = moduleSpaces.map((s) => s.recordId).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!ids.length) return;
    const records = await Model.find({
      _id: { $in: ids },
      organizationId,
    })
      .select('_id name title subject displayName caseNumber dealName first_name last_name firstName lastName email personNumber')
      .lean();
    const byId = new Map(records.map((r) => [String(r._id), r]));
    for (const space of moduleSpaces) {
      const record = byId.get(String(space.recordId));
      const label = recordDisplayLabel(record);
      if (label) recordLabelBySpaceId.set(String(space._id), label);
    }
  }));

  // Persist corrected names when space was saved with a raw ObjectId fallback
  const nameFixes = [];
  for (const space of recordSpaces) {
    const label = recordLabelBySpaceId.get(String(space._id));
    if (!label) continue;
    const current = String(space.name || '').trim();
    const looksLikeId = current === String(space.recordId) || /^[a-f0-9]{24}$/i.test(current);
    if (looksLikeId && label !== current) {
      nameFixes.push(
        InternalChatSpace.updateOne(
          { _id: space._id, organizationId },
          { $set: { name: label } }
        )
      );
    }
  }
  if (nameFixes.length) {
    await Promise.all(nameFixes);
  }

  return spaces.map((space) => {
    if (space.type === 'record') {
      const label = recordLabelBySpaceId.get(String(space._id));
      if (label) {
        return {
          ...space,
          name: label,
          displayName: label,
        };
      }
      return space;
    }
    if (space.type !== 'dm' && space.type !== 'group_dm') {
      return space;
    }
    const peers = peersBySpace.get(String(space._id)) || [];
    const peerUsers = peers
      .map((id) => userById.get(String(id)))
      .filter(Boolean)
      .map((u) => ({
        _id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        avatar: u.avatar || '',
      }));
    const labels = peerUsers.map((u) => formatUserDisplayName(u)).filter(Boolean);
    const displayName = labels.length
      ? labels.join(', ')
      : space.name || '';
    return {
      ...space,
      displayName,
      peerUserIds: peers.map(String),
      peerUsers,
      peer: peerUsers[0] || null,
    };
  });
}

async function createOrGetDm({ organizationId, user, otherUserId }) {
  if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
    throw ServiceError('Invalid user', 400, 'INTERNAL_CHAT_INVALID_USER');
  }
  if (String(otherUserId) === String(user._id)) {
    throw ServiceError('Cannot DM yourself', 400, 'INTERNAL_CHAT_INVALID_DM');
  }

  const other = await User.findOne({
    _id: otherUserId,
    ...internalTeammateFilter(organizationId),
  })
    .select('_id firstName lastName email avatar userType')
    .lean();
  if (!other || !isInternalTeamUserDoc(other)) {
    throw ServiceError('User not found', 404, 'INTERNAL_CHAT_USER_NOT_FOUND');
  }

  const dmKey = buildDmKey([user._id, otherUserId]);
  let space = await InternalChatSpace.findOne({
    organizationId,
    type: 'dm',
    dmKey,
    archivedAt: null,
  }).lean();

  if (!space) {
    const created = await InternalChatSpace.create({
      organizationId,
      type: 'dm',
      name: '',
      dmKey,
      isPrivate: true,
      createdBy: user._id,
    });
    await ensureMembership(organizationId, created._id, user._id, 'admin');
    await ensureMembership(organizationId, created._id, otherUserId, 'member');
    space = created.toObject();
    await publishToSpaceMembers(organizationId, space._id, {
      type: 'space.updated',
      spaceId: String(space._id),
      action: 'created',
    });
  } else {
    await ensureMembership(organizationId, space._id, user._id);
    await ensureMembership(organizationId, space._id, otherUserId);
  }

  return space;
}

async function discussRecord({ organizationId, user, moduleKey, recordId }) {
  const { moduleKey: key, record, label } = await assertCanViewRecord(user, moduleKey, recordId);

  let space = await InternalChatSpace.findOne({
    organizationId,
    type: 'record',
    moduleKey: key,
    recordId: record._id,
    archivedAt: null,
  }).lean();

  if (!space) {
    const created = await InternalChatSpace.create({
      organizationId,
      type: 'record',
      name: label,
      moduleKey: key,
      recordId: record._id,
      isPrivate: true,
      createdBy: user._id,
    });
    space = created.toObject();
  } else {
    const current = String(space.name || '').trim();
    const looksLikeId = current === String(space.recordId) || /^[a-f0-9]{24}$/i.test(current);
    if (label && (looksLikeId || !current)) {
      await InternalChatSpace.updateOne(
        { _id: space._id, organizationId },
        { $set: { name: label } }
      );
      space = { ...space, name: label };
    }
  }

  await ensureMembership(organizationId, space._id, user._id, 'admin');
  await publishToSpaceMembers(organizationId, space._id, {
    type: 'space.updated',
    spaceId: String(space._id),
    action: 'discussed',
  });

  return { space, recordLabel: label, moduleKey: key };
}

async function listSpacesForUser(organizationId, userId) {
  const memberships = await InternalChatMembership.find({ organizationId, userId })
    .select('spaceId role muted lastReadAt lastReadMessageId joinedAt')
    .lean();

  const membershipBySpace = new Map(memberships.map((m) => [String(m.spaceId), m]));
  const memberSpaceIds = memberships.map((m) => m.spaceId);

  const [memberSpaces, publicChannels] = await Promise.all([
    memberSpaceIds.length
      ? InternalChatSpace.find({
          organizationId,
          _id: { $in: memberSpaceIds },
          archivedAt: null,
        }).lean()
      : Promise.resolve([]),
    InternalChatSpace.find({
      organizationId,
      type: 'channel',
      isPrivate: false,
      archivedAt: null,
      ...(memberSpaceIds.length ? { _id: { $nin: memberSpaceIds } } : {}),
    }).lean(),
  ]);

  const withUnread = await Promise.all(
    memberSpaces.map(async (space) => {
      const membership = membershipBySpace.get(String(space._id));
      let unreadCount = 0;
      if (membership?.lastReadAt) {
        unreadCount = await InternalChatMessage.countDocuments({
          organizationId,
          spaceId: space._id,
          deletedAt: null,
          createdAt: { $gt: membership.lastReadAt },
          authorId: { $ne: userId },
        });
      } else if (membership) {
        unreadCount = await InternalChatMessage.countDocuments({
          organizationId,
          spaceId: space._id,
          deletedAt: null,
          authorId: { $ne: userId },
        });
      }
      return {
        ...space,
        unreadCount,
        isMember: true,
        canJoin: false,
        membership: membership
          ? {
              role: membership.role,
              muted: membership.muted,
              lastReadAt: membership.lastReadAt,
              lastReadMessageId: membership.lastReadMessageId,
              joinedAt: membership.joinedAt,
            }
          : null,
      };
    })
  );

  const joinablePublic = publicChannels.map((space) => ({
    ...space,
    unreadCount: 0,
    isMember: false,
    canJoin: true,
    membership: null,
  }));

  const combined = [...withUnread, ...joinablePublic].sort((a, b) => {
    const aAt = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
    const bAt = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
    return bAt - aAt;
  });

  return enrichSpaceDisplayNames(organizationId, userId, combined);
}

async function joinPublicChannel({ organizationId, user, spaceId }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const space = await getSpaceOrThrow(organizationId, spaceId);
  if (space.type !== 'channel') {
    throw ServiceError('Only channels can be joined', 400, 'INTERNAL_CHAT_NOT_CHANNEL');
  }
  if (space.isPrivate) {
    throw ServiceError('This channel is private — ask a member to invite you', 403, 'INTERNAL_CHAT_PRIVATE');
  }

  await ensureMembership(organizationId, space._id, user._id, 'member');
  const [enriched] = await enrichSpaceDisplayNames(organizationId, user._id, [{
    ...space,
    unreadCount: 0,
    isMember: true,
    canJoin: false,
  }]);

  await publishToSpaceMembers(organizationId, space._id, {
    type: 'space.updated',
    spaceId: String(space._id),
    action: 'member_joined',
    userId: String(user._id),
  });

  return enriched;
}

async function inviteMembersToChannel({ organizationId, user, spaceId, memberIds = [] }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const space = await getSpaceOrThrow(organizationId, spaceId);
  if (space.type !== 'channel') {
    throw ServiceError('Only channels support invites', 400, 'INTERNAL_CHAT_NOT_CHANNEL');
  }
  await assertMembership(organizationId, user._id, spaceId);

  const ids = [...new Set(memberIds.map(String))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id) && id !== String(user._id));
  if (!ids.length) {
    throw ServiceError('Select at least one teammate', 400, 'INTERNAL_CHAT_NO_INVITEES');
  }

  const teammates = await User.find({
    _id: { $in: ids },
    ...internalTeammateFilter(organizationId),
  })
    .select('_id')
    .lean();
  if (teammates.length !== ids.length) {
    throw ServiceError('One or more users not found', 404, 'INTERNAL_CHAT_USER_NOT_FOUND');
  }

  for (const row of teammates) {
    // eslint-disable-next-line no-await-in-loop
    await ensureMembership(organizationId, space._id, row._id, 'member');
  }

  await publishToSpaceMembers(organizationId, space._id, {
    type: 'space.updated',
    spaceId: String(space._id),
    action: 'members_invited',
    invitedUserIds: teammates.map((t) => String(t._id)),
  });

  return {
    spaceId: String(space._id),
    invitedCount: teammates.length,
  };
}

async function listMessages({
  organizationId,
  user,
  spaceId,
  threadRootId = null,
  before = null,
  limit = 50,
}) {
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertMembership(organizationId, user._id, spaceId);
  await assertCanAccessSpace(user, space);

  const [enrichedSpace] = await enrichSpaceDisplayNames(organizationId, user._id, [space]);

  const query = {
    organizationId,
    spaceId,
    deletedAt: null,
  };

  if (threadRootId) {
    query.threadRootId = threadRootId;
  } else {
    query.threadRootId = null;
  }

  if (before && mongoose.Types.ObjectId.isValid(before)) {
    query._id = { $lt: before };
  }

  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const messages = await InternalChatMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(take)
    .lean();

  const authorIds = [...new Set(messages.map((m) => String(m.authorId)))];
  const authors = await User.find({ _id: { $in: authorIds } })
    .select('_id firstName lastName email avatar')
    .lean();
  const authorById = new Map(authors.map((a) => [String(a._id), a]));

  const enriched = messages.reverse().map((m) => ({
    ...m,
    author: authorById.get(String(m.authorId)) || null,
    reactions: summarizeReactions(m.reactions, user._id),
  }));

  return { space: enrichedSpace, messages: enriched };
}

async function postMessage({
  organizationId,
  user,
  spaceId,
  body,
  threadRootId = null,
  mentionUserIds = [],
  recordRefs = [],
  attachments = [],
}) {
  const text = String(body || '').trim();
  const safeAttachments = normalizeAttachments(attachments);
  if (!text && !safeAttachments.length) {
    throw ServiceError('Message body or attachment is required', 400, 'INTERNAL_CHAT_EMPTY_BODY');
  }
  if (text.length > 16000) {
    throw ServiceError('Message too long', 400, 'INTERNAL_CHAT_BODY_TOO_LONG');
  }

  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertMembership(organizationId, user._id, spaceId);
  await assertCanAccessSpace(user, space);

  let rootId = null;
  if (threadRootId) {
    if (!mongoose.Types.ObjectId.isValid(threadRootId)) {
      throw ServiceError('Invalid thread', 400, 'INTERNAL_CHAT_INVALID_THREAD');
    }
    const root = await InternalChatMessage.findOne({
      organizationId,
      spaceId,
      _id: threadRootId,
      threadRootId: null,
      deletedAt: null,
    }).lean();
    if (!root) {
      throw ServiceError('Thread root not found', 404, 'INTERNAL_CHAT_THREAD_NOT_FOUND');
    }
    rootId = root._id;
  }

  let mentions = parseMentionsFromBody(text, mentionUserIds);
  if (mentions.length) {
    const mentionUsers = await User.find({
      _id: { $in: mentions },
      ...internalTeammateFilter(organizationId),
    })
      .select('_id')
      .lean();
    const allowed = new Set(mentionUsers.map((u) => String(u._id)));
    mentions = mentions.filter((id) => allowed.has(String(id)));
  }
  const safeRefs = Array.isArray(recordRefs)
    ? recordRefs
      .filter((r) => r?.moduleKey && mongoose.Types.ObjectId.isValid(r.recordId))
      .slice(0, 10)
      .map((r) => ({
        moduleKey: normalizeModuleKey(r.moduleKey),
        recordId: r.recordId,
        label: String(r.label || '').slice(0, 200),
      }))
    : [];

  const message = await InternalChatMessage.create({
    organizationId,
    spaceId,
    threadRootId: rootId,
    authorId: user._id,
    body: text,
    attachments: safeAttachments,
    mentionUserIds: mentions,
    recordRefs: safeRefs,
  });

  await InternalChatSpace.updateOne(
    { _id: spaceId, organizationId },
    { $set: { lastMessageAt: message.createdAt } }
  );

  await InternalChatMembership.updateOne(
    { organizationId, spaceId, userId: user._id },
    {
      $set: {
        lastReadAt: message.createdAt,
        lastReadMessageId: message._id,
      },
    }
  );

  const author = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatar: user.avatar || '',
  };

  const payload = {
    type: 'message.created',
    spaceId: String(spaceId),
    threadRootId: rootId ? String(rootId) : null,
    message: {
      ...message.toObject(),
      author,
    },
  };
  await publishToSpaceMembers(organizationId, spaceId, payload);

  const authorName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    || user.email
    || 'Someone';
  const preview = text.slice(0, 140);
  const spaceName = space.name || space.type || 'chat';
  const memberIds = await listMemberUserIds(organizationId, spaceId);

  try {
    const { emitNotification } = require('./notificationEngine');
    const domainEvents = require('../constants/domainEvents');
    const mentionTargets = mentions.filter((id) => String(id) !== String(user._id));
    if (mentionTargets.length) {
      await emitNotification({
        eventType: domainEvents.INTERNAL_CHAT_MENTIONED,
        entity: {
          type: 'InternalChatMessage',
          id: String(message._id),
          title: spaceName,
          spaceName,
          spaceId: String(spaceId),
          authorName,
          preview,
          alertRecipientUserIds: mentionTargets,
        },
        organizationId,
        triggeredBy: user._id,
        sourceAppKey: 'PLATFORM',
      });
    }

    // DMs/group DMs: notify other members (channels use unread + SSE to avoid noise)
    const mentionSet = new Set(mentionTargets.map(String));
    const otherMembers = memberIds.filter(
      (id) => String(id) !== String(user._id) && !mentionSet.has(String(id))
    );
    if (otherMembers.length && (space.type === 'dm' || space.type === 'group_dm')) {
      await emitNotification({
        eventType: domainEvents.INTERNAL_CHAT_MESSAGE_POSTED,
        entity: {
          type: 'InternalChatMessage',
          id: String(message._id),
          title: spaceName,
          spaceName,
          spaceId: String(spaceId),
          authorName,
          preview,
          memberUserIds: otherMembers,
        },
        organizationId,
        triggeredBy: user._id,
        sourceAppKey: 'PLATFORM',
      });
    }
  } catch (notifyErr) {
    console.error('[internalChatService] notification emit failed', notifyErr.message);
  }

  try {
    const { emit } = require('./domainEvents');
    emit({
      entityType: 'internal_chat_message',
      entityId: message._id,
      eventType: 'internal_chat_message.created',
      previousState: null,
      currentState: {
        spaceId: String(spaceId),
        threadRootId: rootId ? String(rootId) : null,
        bodyPreview: preview,
      },
      appKey: 'PLATFORM',
      triggeredBy: user._id,
      organizationId,
    });
  } catch (emitErr) {
    console.error('[internalChatService] domain event emit failed', emitErr.message);
  }

  for (const mentionId of mentions) {
    if (String(mentionId) === String(user._id)) continue;
    internalChatSSEHub.publishToUser(organizationId, mentionId, {
      type: 'mention',
      spaceId: String(spaceId),
      messageId: String(message._id),
    });
  }

  return payload.message;
}

function normalizeAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && (row.url || row.storagePath) && row.fileName)
    .slice(0, 5)
    .map((row) => ({
      fileName: String(row.fileName).slice(0, 255),
      mimeType: String(row.mimeType || '').slice(0, 120),
      size: Number(row.size) || 0,
      url: String(row.url || '').slice(0, 2000),
      storagePath: String(row.storagePath || '').slice(0, 2000),
    }));
}

function normalizeReactionEmoji(value) {
  const emoji = String(value || '').trim();
  if (!emoji || emoji.length > 16) return null;
  return emoji;
}

function summarizeReactions(reactions, currentUserId) {
  const currentUserIdString = String(currentUserId || '');
  return (Array.isArray(reactions) ? reactions : [])
    .map((reaction) => {
      const emoji = normalizeReactionEmoji(reaction?.emoji);
      if (!emoji) return null;
      const users = Array.isArray(reaction.users) ? reaction.users : [];
      const userIds = users.map((u) => String(u?._id || u));
      return {
        emoji,
        count: userIds.length,
        reacted: userIds.includes(currentUserIdString),
        userIds,
      };
    })
    .filter((r) => r && r.count > 0);
}

async function toggleReaction({ organizationId, user, spaceId, messageId, emoji: rawEmoji }) {
  const emoji = normalizeReactionEmoji(rawEmoji);
  if (!emoji) {
    throw ServiceError('Invalid emoji', 400, 'INTERNAL_CHAT_INVALID_EMOJI');
  }

  await assertMembership(organizationId, user._id, spaceId);
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertCanAccessSpace(user, space);

  const message = await InternalChatMessage.findOne({
    organizationId,
    spaceId,
    _id: messageId,
    deletedAt: null,
  });
  if (!message) {
    throw ServiceError('Message not found', 404, 'INTERNAL_CHAT_MESSAGE_NOT_FOUND');
  }

  if (!Array.isArray(message.reactions)) message.reactions = [];
  let reaction = message.reactions.find((entry) => normalizeReactionEmoji(entry?.emoji) === emoji);
  const currentUserId = String(user._id);

  if (!reaction) {
    message.reactions.push({ emoji, users: [user._id] });
  } else {
    const userIndex = reaction.users.findIndex((uid) => String(uid) === currentUserId);
    if (userIndex >= 0) {
      reaction.users.splice(userIndex, 1);
    } else {
      reaction.users.push(user._id);
    }
    if (!reaction.users.length) {
      message.reactions = message.reactions.filter(
        (entry) => normalizeReactionEmoji(entry?.emoji) !== emoji
      );
    }
  }

  message.markModified('reactions');
  await message.save();

  const summarized = summarizeReactions(message.reactions, user._id);
  const payload = {
    type: 'message.updated',
    spaceId: String(spaceId),
    messageId: String(message._id),
    reactions: summarized,
  };
  await publishToSpaceMembers(organizationId, spaceId, payload);
  return { messageId: message._id, reactions: summarized };
}

async function searchMessages({ organizationId, user, q, spaceId = null, limit = 30 }) {
  const queryText = String(q || '').trim();
  if (queryText.length < 2) {
    throw ServiceError('Search query too short', 400, 'INTERNAL_CHAT_SEARCH_SHORT');
  }

  const memberships = await InternalChatMembership.find({
    organizationId,
    userId: user._id,
  })
    .select('spaceId')
    .lean();
  let spaceIds = memberships.map((m) => m.spaceId);
  if (spaceId) {
    if (!spaceIds.some((id) => String(id) === String(spaceId))) {
      throw ServiceError('Not a member of this space', 403, 'INTERNAL_CHAT_NOT_MEMBER');
    }
    spaceIds = [spaceId];
  }
  if (!spaceIds.length) return { results: [] };

  const take = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const escaped = queryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexFilter = {
    organizationId,
    spaceId: { $in: spaceIds },
    deletedAt: null,
    body: { $regex: escaped, $options: 'i' },
  };

  let messages;
  try {
    messages = await InternalChatMessage.find({
      organizationId,
      spaceId: { $in: spaceIds },
      deletedAt: null,
      $text: { $search: queryText },
    })
      .select({ score: { $meta: 'textScore' }, body: 1, spaceId: 1, authorId: 1, createdAt: 1, threadRootId: 1 })
      .sort({ score: { $meta: 'textScore' } })
      .limit(take)
      .lean();
  } catch {
    messages = [];
  }

  // Text index stop-words (e.g. "about") return empty without error — fall back to regex
  if (!messages.length) {
    messages = await InternalChatMessage.find(regexFilter)
      .select('body spaceId authorId createdAt threadRootId')
      .sort({ createdAt: -1 })
      .limit(take)
      .lean();
  }

  const authorIds = [...new Set(messages.map((m) => String(m.authorId)))];
  const authors = await User.find({ _id: { $in: authorIds } })
    .select('_id firstName lastName email avatar')
    .lean();
  const authorById = new Map(authors.map((a) => [String(a._id), a]));

  const spaceDocs = await InternalChatSpace.find({ _id: { $in: spaceIds } })
    .select('_id name type moduleKey')
    .lean();
  const spaceById = new Map(spaceDocs.map((s) => [String(s._id), s]));

  return {
    results: messages.map((m) => ({
      ...m,
      author: authorById.get(String(m.authorId)) || null,
      space: spaceById.get(String(m.spaceId)) || null,
    })),
  };
}

async function publishTyping({ organizationId, user, spaceId }) {
  await assertMembership(organizationId, user._id, spaceId);
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Someone';
  await publishToSpaceMembers(organizationId, spaceId, {
    type: 'typing',
    spaceId: String(spaceId),
    userId: String(user._id),
    name,
    at: Date.now(),
  });
  return { ok: true };
}

async function setSpacePresence({ organizationId, user, spaceId }) {
  if (spaceId) {
    await assertMembership(organizationId, user._id, spaceId);
    const space = await getSpaceOrThrow(organizationId, spaceId);
    await assertCanAccessSpace(user, space);
  }
  internalChatSSEHub.setPresence(organizationId, user._id, spaceId || null, user);
  if (spaceId) {
    const viewers = internalChatSSEHub.getPresenceForSpace(organizationId, spaceId);
    await publishToSpaceMembers(organizationId, spaceId, {
      type: 'presence',
      spaceId: String(spaceId),
      viewers,
    });
    return { viewers };
  }
  return { viewers: [] };
}

async function markRead({ organizationId, user, spaceId, messageId = null }) {
  await assertMembership(organizationId, user._id, spaceId);
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertCanAccessSpace(user, space);

  let lastReadAt = new Date();
  let lastReadMessageId = null;

  if (messageId && mongoose.Types.ObjectId.isValid(messageId)) {
    const msg = await InternalChatMessage.findOne({
      organizationId,
      spaceId,
      _id: messageId,
      deletedAt: null,
    })
      .select('_id createdAt')
      .lean();
    if (msg) {
      lastReadAt = msg.createdAt;
      lastReadMessageId = msg._id;
    }
  } else {
    const latest = await InternalChatMessage.findOne({
      organizationId,
      spaceId,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .select('_id createdAt')
      .lean();
    if (latest) {
      lastReadAt = latest.createdAt;
      lastReadMessageId = latest._id;
    }
  }

  await InternalChatMembership.updateOne(
    { organizationId, spaceId, userId: user._id },
    { $set: { lastReadAt, lastReadMessageId } }
  );

  return { lastReadAt, lastReadMessageId };
}

async function createOrGetGroupDm({ organizationId, user, memberIds = [] }) {
  const ids = [...new Set([String(user._id), ...memberIds.map(String)])]
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (ids.length < 3) {
    throw ServiceError('Group DM needs at least 2 other members', 400, 'INTERNAL_CHAT_GROUP_TOO_SMALL');
  }

  const users = await User.find({
    _id: { $in: ids },
    ...internalTeammateFilter(organizationId),
  })
    .select('_id firstName lastName email avatar userType')
    .lean();
  if (users.length !== ids.length || users.some((u) => !isInternalTeamUserDoc(u))) {
    throw ServiceError('One or more users not found', 404, 'INTERNAL_CHAT_USER_NOT_FOUND');
  }

  const dmKey = buildDmKey(ids);
  let space = await InternalChatSpace.findOne({
    organizationId,
    type: 'group_dm',
    dmKey,
    archivedAt: null,
  }).lean();

  if (!space) {
    const label = users
      .map((u) => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'User')
      .slice(0, 4)
      .join(', ');
    const created = await InternalChatSpace.create({
      organizationId,
      type: 'group_dm',
      name: label,
      dmKey,
      isPrivate: true,
      createdBy: user._id,
    });
    for (const mid of ids) {
      // eslint-disable-next-line no-await-in-loop
      await ensureMembership(
        organizationId,
        created._id,
        mid,
        mid === String(user._id) ? 'admin' : 'member'
      );
    }
    space = created.toObject();
    await publishToSpaceMembers(organizationId, space._id, {
      type: 'space.updated',
      spaceId: String(space._id),
      action: 'created',
    });
  } else {
    for (const mid of ids) {
      // eslint-disable-next-line no-await-in-loop
      await ensureMembership(organizationId, space._id, mid);
    }
  }

  return space;
}

async function pinMessage({ organizationId, user, spaceId, messageId, pin = true }) {
  await assertMembership(organizationId, user._id, spaceId);
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertCanAccessSpace(user, space);

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw ServiceError('Invalid message', 400, 'INTERNAL_CHAT_INVALID_MESSAGE');
  }
  const msg = await InternalChatMessage.findOne({
    organizationId,
    spaceId,
    _id: messageId,
    deletedAt: null,
  })
    .select('_id')
    .lean();
  if (!msg) {
    throw ServiceError('Message not found', 404, 'INTERNAL_CHAT_MESSAGE_NOT_FOUND');
  }

  const pinned = Array.isArray(space.pinnedMessageIds)
    ? space.pinnedMessageIds.map(String)
    : [];
  let next;
  if (pin) {
    next = [...new Set([String(messageId), ...pinned])].slice(0, 20);
  } else {
    next = pinned.filter((id) => id !== String(messageId));
  }

  await InternalChatSpace.updateOne(
    { _id: spaceId, organizationId },
    { $set: { pinnedMessageIds: next } }
  );

  await publishToSpaceMembers(organizationId, spaceId, {
    type: 'space.updated',
    spaceId: String(spaceId),
    action: pin ? 'pinned' : 'unpinned',
    pinnedMessageIds: next,
  });

  return { pinnedMessageIds: next };
}

async function softDeleteMessage({ organizationId, user, spaceId, messageId }) {
  await assertMembership(organizationId, user._id, spaceId);
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertCanAccessSpace(user, space);

  const message = await InternalChatMessage.findOne({
    organizationId,
    spaceId,
    _id: messageId,
    deletedAt: null,
  });
  if (!message) {
    throw ServiceError('Message not found', 404, 'INTERNAL_CHAT_MESSAGE_NOT_FOUND');
  }

  const isAuthor = String(message.authorId) === String(user._id);
  if (!isAuthor && !canManageInternalChat(user)) {
    throw ServiceError('Cannot delete this message', 403, 'INTERNAL_CHAT_DELETE_FORBIDDEN');
  }

  message.deletedAt = new Date();
  message.body = '';
  message.attachments = [];
  await message.save();

  await publishToSpaceMembers(organizationId, spaceId, {
    type: 'message.deleted',
    spaceId: String(spaceId),
    messageId: String(messageId),
  });

  return { ok: true };
}

async function exportSpaceTranscript({ organizationId, user, spaceId }) {
  await assertMembership(organizationId, user._id, spaceId);
  const space = await getSpaceOrThrow(organizationId, spaceId);
  await assertCanAccessSpace(user, space);

  const messages = await InternalChatMessage.find({
    organizationId,
    spaceId,
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .lean();

  const authorIds = [...new Set(messages.map((m) => String(m.authorId)))];
  const authors = await User.find({ _id: { $in: authorIds } })
    .select('_id firstName lastName email avatar')
    .lean();
  const authorById = new Map(authors.map((a) => [String(a._id), a]));

  return {
    exportedAt: new Date().toISOString(),
    space: {
      _id: space._id,
      type: space.type,
      name: space.name,
      moduleKey: space.moduleKey,
      recordId: space.recordId,
    },
    messages: messages.map((m) => {
      const a = authorById.get(String(m.authorId));
      return {
        id: m._id,
        createdAt: m.createdAt,
        threadRootId: m.threadRootId,
        body: m.body,
        author: a
          ? {
              id: a._id,
              name: [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || a.email,
              email: a.email,
            }
          : null,
        attachments: m.attachments || [],
        reactions: summarizeReactions(m.reactions, user._id),
      };
    }),
  };
}

async function getAddonSettings(organizationId) {
  const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
  const { ADDON_KEYS } = require('../constants/addonKeys');
  const config = await TenantAddonConfiguration.findOne({
    organizationId,
    addonKey: ADDON_KEYS.INTERNAL_CHAT,
  }).lean();
  const settings = config?.settings && typeof config.settings === 'object' ? config.settings : {};
  return {
    retentionDays: Number.isFinite(Number(settings.retentionDays))
      ? Number(settings.retentionDays)
      : 0,
    notifyChannelMessages: settings.notifyChannelMessages === true,
  };
}

async function listTeammatesForChat({ organizationId, user, limit = 200 }) {
  if (!canViewInternalChat(user)) {
    throw ServiceError('Permission denied', 403, 'INTERNAL_CHAT_FORBIDDEN');
  }
  const take = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const me = String(user._id);
  const rows = await User.find({
    ...internalTeammateFilter(organizationId),
    _id: { $ne: user._id },
  })
    .select('_id firstName lastName email username avatar userType')
    .sort({ firstName: 1, lastName: 1 })
    .limit(take)
    .lean();

  // Hard deny: never return portal/external users even if filter regresses.
  return rows
    .filter((u) => isInternalTeamUserDoc(u) && String(u._id) !== me)
    .map((u) => ({
      _id: u._id,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      username: u.username || '',
      avatar: u.avatar || '',
      userType: 'INTERNAL',
    }));
}

async function updateAddonSettings(organizationId, patch = {}) {
  const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
  const { ADDON_KEYS } = require('../constants/addonKeys');
  let retentionDays = Number(patch.retentionDays);
  if (!Number.isFinite(retentionDays) || retentionDays < 0) retentionDays = 0;
  if (retentionDays > 3650) retentionDays = 3650;

  const next = {
    retentionDays,
    notifyChannelMessages: patch.notifyChannelMessages === true,
  };

  await TenantAddonConfiguration.findOneAndUpdate(
    { organizationId, addonKey: ADDON_KEYS.INTERNAL_CHAT },
    { $set: { settings: next, enabled: true } },
    { upsert: true, new: true }
  );
  return next;
}

module.exports = {
  canViewInternalChat,
  canManageInternalChat,
  ServiceError,
  createChannel,
  createOrGetDm,
  createOrGetGroupDm,
  discussRecord,
  listSpacesForUser,
  joinPublicChannel,
  inviteMembersToChannel,
  listMessages,
  postMessage,
  markRead,
  toggleReaction,
  searchMessages,
  publishTyping,
  setSpacePresence,
  pinMessage,
  softDeleteMessage,
  exportSpaceTranscript,
  getAddonSettings,
  updateAddonSettings,
  listTeammatesForChat,
  assertCanViewRecord,
  publishToSpaceMembers,
  normalizeAttachments,
};
