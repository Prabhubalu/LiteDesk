/**
 * Notify users and group members when they are @mentioned in a task comment.
 * Parses content for @[Name](user:id) and @[Name](group:id), creates in-app
 * notifications, and publishes to SSE.
 */

const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Group = require('../models/Group');
// Same format as CommentContent.vue and CommentInput.vue
const MENTION_REGEX = /@\[([^\]]+)\]\((user|group):([^)]+)\)/g;

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
 * @param {string} opts.taskId - Task ID
 * @param {string} opts.taskTitle - Task title for notification body
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
    taskId,
    taskTitle,
    commentId,
    commentContent,
    authorName,
    mentionedUserIds,
    authorId
  } = opts;

  const recipientIds = Array.from(mentionedUserIds).filter((id) => String(id) !== String(authorId));
  if (recipientIds.length === 0) return;

  const snippet = contentToPlainSnippet(commentContent);
  const snippetDisplay = snippet.length > 120 ? `${snippet.slice(0, 117)}...` : snippet;
  const title = `${authorName} mentioned you in a comment`;
  const body = taskTitle
    ? `Task: ${taskTitle}\n"${snippetDisplay}"`
    : `"${snippetDisplay}"`;

  const entity = { type: 'Task', id: new mongoose.Types.ObjectId(taskId) };
  const orgId = new mongoose.Types.ObjectId(organizationId);
  const normalizedAppKey = (appKey || 'SALES').toUpperCase();
  if (!['SALES', 'AUDIT', 'PORTAL'].includes(normalizedAppKey)) return;

  const docs = recipientIds.map((userId) => ({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: orgId,
    appKey: normalizedAppKey,
    sourceAppKey: normalizedAppKey,
    eventType: 'TASK_COMMENT_MENTION',
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
 * @param {string} opts.taskId - Task ID
 * @param {string} opts.taskTitle - Task title
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

    await notifyMentionedUsers({
      organizationId: opts.organizationId,
      appKey: opts.appKey || 'SALES',
      taskId: opts.taskId,
      taskTitle: opts.taskTitle,
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
  notifyMentionedUsers,
  processCommentMentions
};
