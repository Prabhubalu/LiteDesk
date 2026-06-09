/**
 * Notify users and group members when they are @mentioned in a task comment.
 * Parses content for @[Name](user:id) and @[Name](group:id), creates in-app
 * notifications, and publishes to SSE.
 */

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Group = require('../models/Group');
const Deal = require('../models/Deal');
const Task = require('../models/Task');
const Event = require('../models/Event');
const People = require('../models/People');
const Organization = require('../models/Organization');
// Same format as CommentContent.vue and CommentInput.vue
const MENTION_REGEX = /@\[([^\]]+)\]\((user|group):([^)]+)\)/g;

const MODULE_KEY_TO_ENTITY_TYPE = {
  deals: 'Deal',
  tasks: 'Task',
  events: 'Event',
  people: 'People',
  organizations: 'Organization',
  items: 'Item',
  quotes: 'Quote',
  sales_orders: 'SalesOrder',
  cases: 'Case'
};

const ENTITY_BODY_LABEL = {
  Task: 'Task',
  Deal: 'Deal',
  Event: 'Event',
  People: 'Contact',
  Organization: 'Organization',
  Item: 'Item',
  Quote: 'Quote',
  SalesOrder: 'Sales order',
  Case: 'Case'
};

function moduleKeyToEntityType(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  if (MODULE_KEY_TO_ENTITY_TYPE[key]) return MODULE_KEY_TO_ENTITY_TYPE[key];
  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

async function resolveRecordTitle(organizationId, moduleKey, recordId) {
  if (!organizationId || !moduleKey || !recordId || !mongoose.Types.ObjectId.isValid(recordId)) {
    return null;
  }
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const id = new mongoose.Types.ObjectId(recordId);
  const key = String(moduleKey || '').toLowerCase();

  try {
    if (key === 'deals') {
      const doc = await Deal.findOne({ _id: id, organizationId: orgId }).select('name').lean();
      return doc?.name || null;
    }
    if (key === 'tasks') {
      const doc = await Task.findOne({ _id: id, organizationId: orgId }).select('title').lean();
      return doc?.title || null;
    }
    if (key === 'events') {
      const doc = await Event.findOne({ _id: id, organizationId: orgId }).select('eventName').lean();
      return doc?.eventName || null;
    }
    if (key === 'people') {
      const doc = await People.findOne({ _id: id, organizationId: orgId }).select('first_name last_name email').lean();
      if (!doc) return null;
      const name = [doc.first_name, doc.last_name].filter(Boolean).join(' ').trim();
      return name || doc.email || null;
    }
    if (key === 'organizations') {
      const doc = await Organization.findOne({ _id: id, organizationId: orgId }).select('name').lean();
      return doc?.name || null;
    }
    return null;
  } catch (err) {
    console.error('[commentMentionNotifications] resolveRecordTitle error:', err.message);
    return null;
  }
}

/**
 * Parse comment content for @[Name](type:id) mentions.
 * @param {string} content - Raw comment content
 * @returns {{ userIds: Set<string>, groupIds: Set<string> }}
 */
function parseMentionedIds(content) {
  const userIds = new Set();
  const groupIds = new Set();
  if (!content || typeof content !== 'string') return { userIds, groupIds };
  let match;
  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const type = match[2];
    const id = match[3].trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) continue;
    if (type === 'user') userIds.add(id);
    else if (type === 'group') groupIds.add(id);
  }
  return { userIds, groupIds };
}

/**
 * Resolve mentioned user IDs and group member IDs (same org) into a single set of recipient user IDs.
 * @param {string} organizationId - Organization ID
 * @param {Set<string>} userIds - Mentioned user IDs
 * @param {Set<string>} groupIds - Mentioned group IDs
 * @returns {Promise<Set<string>>} All recipient user IDs
 */
async function resolveRecipientUserIds(organizationId, userIds, groupIds) {
  const recipientIds = new Set(userIds);

  if (groupIds.size > 0) {
    const groups = await Group.find({
      _id: { $in: Array.from(groupIds) },
      organizationId: new mongoose.Types.ObjectId(organizationId)
    })
      .select('members')
      .lean();
    for (const g of groups) {
      if (g.members && Array.isArray(g.members)) {
        g.members.forEach((id) => recipientIds.add(String(id)));
      }
    }
  }

  return recipientIds;
}

/**
 * Strip mention syntax to plain text for notification body (e.g. "@John" instead of @[John](user:id)).
 * @param {string} content - Comment content with mentions
 * @returns {string} Plain text, mentions as @Name
 */
function contentToPlainSnippet(content) {
  if (!content || typeof content !== 'string') return '';
  MENTION_REGEX.lastIndex = 0;
  return content
    .replace(MENTION_REGEX, '@$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create in-app notifications for each mentioned user and publish to SSE.
 * Excludes the comment author. Fire-and-forget; errors are logged and not thrown.
 *
 * @param {Object} opts
 * @param {string} opts.organizationId - Organization ID
 * @param {string} opts.appKey - App key (e.g. SALES)
 * @param {string} [opts.entityId] - Record ID (alias: taskId)
 * @param {string} [opts.entityType] - Entity type for deep-linking (e.g. Deal, Event)
 * @param {string} [opts.moduleKey] - Module key used to resolve entity type/title
 * @param {string} [opts.recordTitle] - Record title for notification body (alias: taskTitle)
 * @param {string} [opts.taskId] - Legacy alias for entityId
 * @param {string} [opts.taskTitle] - Legacy alias for recordTitle
 * @param {string} opts.commentId - Comment ID (for reference)
 * @param {string} opts.commentContent - Raw comment content (with mentions)
 * @param {string} opts.authorName - Display name of comment author
 * @param {Set<string>} opts.mentionedUserIds - Resolved recipient user IDs
 * @param {string} opts.authorId - Comment author user ID (excluded from recipients)
 */
async function notifyMentionedUsers(opts) {
  const {
    organizationId,
    appKey,
    entityId,
    entityType,
    recordTitle,
    taskId,
    taskTitle,
    commentId,
    commentContent,
    authorName,
    mentionedUserIds,
    authorId
  } = opts;

  const resolvedEntityId = entityId || taskId;
  const resolvedEntityType = entityType || 'Task';
  const resolvedRecordTitle = recordTitle || taskTitle || null;

  const recipientIds = Array.from(mentionedUserIds).filter((id) => String(id) !== String(authorId));
  if (recipientIds.length === 0 || !resolvedEntityId) return;

  const snippet = contentToPlainSnippet(commentContent);
  const snippetDisplay = snippet.length > 120 ? `${snippet.slice(0, 117)}...` : snippet;
  const title = `${authorName} mentioned you in a comment`;
  const entityLabel = ENTITY_BODY_LABEL[resolvedEntityType] || resolvedEntityType;
  const body = resolvedRecordTitle
    ? `${entityLabel}: ${resolvedRecordTitle}\n"${snippetDisplay}"`
    : `"${snippetDisplay}"`;

  const entity = {
    type: resolvedEntityType,
    id: new mongoose.Types.ObjectId(resolvedEntityId),
    ...(resolvedRecordTitle ? { title: resolvedRecordTitle } : {})
  };
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const normalizedAppKey = (appKey || 'SALES').toUpperCase();
  if (!['SALES', 'AUDIT', 'PORTAL'].includes(normalizedAppKey)) return;

  const docs = recipientIds.map((userId) => ({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: orgId,
    appKey: normalizedAppKey,
    sourceAppKey: normalizedAppKey,
    eventType: 'RECORD_COMMENT_MENTION',
    title,
    body,
    entity,
    channel: 'IN_APP',
    priority: 'NORMAL',
    source: 'SYSTEM'
  }));

  try {
    const saved = await Notification.insertMany(docs, { ordered: false });
    const { deliverNotificationSSE } = require('./notificationSSEDeliver');
    for (const n of saved) {
      try {
        await deliverNotificationSSE({
          userId: n.userId,
          organizationId: n.organizationId,
          appKey: n.appKey,
          payload: {
            id: String(n._id),
            appKey: n.appKey,
            eventType: n.eventType,
            title: n.title,
            body: n.body,
            priority: n.priority,
            entity: n.entity,
            createdAt: n.createdAt
          }
        });
      } catch (err) {
        console.error('[commentMentionNotifications] SSE publish failed for', n._id, err.message);
      }
    }
    console.log(`[commentMentionNotifications] Created ${saved.length} mention notification(s) for comment ${commentId}`);
  } catch (err) {
    console.error('[commentMentionNotifications] Failed to create mention notifications:', err);
  }
}

/**
 * Process a new or updated comment: parse mentions, resolve recipients, and send notifications.
 * Call this after saving a comment (fire-and-forget).
 *
 * @param {Object} opts
 * @param {string} opts.organizationId - Organization ID
 * @param {string} [opts.appKey] - App key (default SALES)
 * @param {string} [opts.entityId] - Record ID (alias: taskId)
 * @param {string} [opts.entityType] - Entity type for deep-linking
 * @param {string} [opts.moduleKey] - Module key used to resolve entity type/title
 * @param {string} [opts.recordTitle] - Record title (alias: taskTitle)
 * @param {string} [opts.taskId] - Legacy alias for entityId
 * @param {string} [opts.taskTitle] - Legacy alias for recordTitle
 * @param {string} opts.commentId - Comment ID
 * @param {string} opts.commentContent - Comment content with @[Name](type:id)
 * @param {string} opts.authorId - Comment author user ID
 * @param {string} opts.authorName - Comment author display name
 */
async function processCommentMentions(opts) {
  try {
    const { userIds, groupIds } = parseMentionedIds(opts.commentContent);
    if (userIds.size === 0 && groupIds.size === 0) return;

    const mentionedUserIds = await resolveRecipientUserIds(
      opts.organizationId,
      userIds,
      groupIds
    );
    if (mentionedUserIds.size === 0) return;

    const entityId = opts.entityId || opts.taskId;
    const entityType = opts.entityType || (opts.moduleKey ? moduleKeyToEntityType(opts.moduleKey) : 'Task');
    let recordTitle = opts.recordTitle || opts.taskTitle || null;
    if (!recordTitle && opts.moduleKey && entityId) {
      recordTitle = await resolveRecordTitle(opts.organizationId, opts.moduleKey, entityId);
    }

    await notifyMentionedUsers({
      organizationId: opts.organizationId,
      appKey: opts.appKey || 'SALES',
      entityId,
      entityType,
      recordTitle,
      commentId: opts.commentId,
      commentContent: opts.commentContent,
      authorName: opts.authorName,
      mentionedUserIds,
      authorId: opts.authorId
    });
  } catch (err) {
    console.error('[commentMentionNotifications] processCommentMentions error:', err);
  }
}

module.exports = {
  parseMentionedIds,
  resolveRecipientUserIds,
  contentToPlainSnippet,
  moduleKeyToEntityType,
  resolveRecordTitle,
  notifyMentionedUsers,
  processCommentMentions
};
