/**
 * Module-agnostic Activity Event model.
 *
 * This is the canonical event shape consumed by record activity timelines.
 * Module-specific adapters should normalize raw API data to this shape.
 */

/**
 * @typedef {'compact'|'card'|'timeline'} ActivityRenderHint
 */

/**
 * @typedef {'system'|'user'|'integration'} ActivityEventSource
 */

/**
 * @typedef {{ module: string, id: string }} ActivityRecordRef
 */

/**
 * @typedef {{ action: string|null, message: string, details: Record<string, any> }} SystemPayload
 */

/**
 * @typedef {{ body: string, mentions: Array<any>, parentCommentId: string|null, attachments: Array<any>, reactions: Array<any>, myReactions: Array<any> }} CommentPayload
 */

/**
 * @typedef {{ thread: Record<string, any> }} EmailThreadPayload
 */

export const ActivityEventType = Object.freeze({
  SYSTEM: 'system',
  COMMENT: 'comment',
  EMAIL_THREAD: 'email_thread'
});

export const ActivityCapability = Object.freeze({
  REACTIONS: 'reactions',
  ATTACHMENTS: 'attachments',
  THREADS: 'threads',
  MENTIONS: 'mentions',
  DIFF: 'diff'
});

const toIso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const dedupeCapabilities = (capabilities = []) => {
  const seen = new Set();
  return capabilities.filter((capability) => {
    const key = String(capability || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeRecordRef = (recordRef) => {
  if (!recordRef) return null;
  const module = String(recordRef?.module || '').trim();
  const id = String(recordRef?.id || '').trim();
  if (!module || !id) return null;
  return { module, id };
};

const inferRenderHint = (type) => {
  if (type === ActivityEventType.SYSTEM) return 'compact';
  if (type === ActivityEventType.COMMENT) return 'card';
  if (type === ActivityEventType.EMAIL_THREAD) return 'card';
  return 'timeline';
};

export const createActivityEvent = ({
  id,
  type,
  actor = null,
  createdAt = null,
  payload = {},
  capabilities = [],
  meta = {},
  legacy = {}
}) => {
  const normalizedMeta = {
    recordRef: normalizeRecordRef(meta?.recordRef),
    renderHint: meta?.renderHint || inferRenderHint(type),
    source: meta?.source || 'system',
    ...meta
  };

  if (!normalizedMeta.recordRef) {
    delete normalizedMeta.recordRef;
  }

  return {
    id: id ? String(id) : '',
    type,
    actor,
    createdAt: toIso(createdAt),
    payload: payload || {},
    capabilities: dedupeCapabilities(capabilities),
    meta: normalizedMeta,
    ...legacy
  };
};

export const normalizeSystemActivityEvent = (log, options = {}) => {
  const details = log?.details || {};
  const message = options.message || log?.message || '';

  const capabilities = [];
  if (
    options?.descriptionDiffHtml
    || details?.descriptionDiffHtml
    || (Array.isArray(options?.descriptionImageChanges) && options.descriptionImageChanges.length > 0)
  ) {
    capabilities.push(ActivityCapability.DIFF);
  }

  return createActivityEvent({
    id: log?._id || `${log?.action || 'system'}-${log?.timestamp || ''}`,
    type: ActivityEventType.SYSTEM,
    actor: log?.user || log?.userId || null,
    createdAt: log?.timestamp || log?.createdAt,
    /** @type {SystemPayload} */
    payload: {
      action: log?.action || null,
      message,
      details
    },
    capabilities,
    meta: {
      recordRef: normalizeRecordRef(options?.recordRef),
      renderHint: options?.renderHint || 'compact',
      source: options?.source || 'system'
    },
    legacy: {
      action: log?.action,
      author: log?.user || log?.userId,
      message,
      details,
      descriptionDiffHtml: options?.descriptionDiffHtml || details?.descriptionDiffHtml || null,
      descriptionImageChanges: Array.isArray(options?.descriptionImageChanges)
        ? options.descriptionImageChanges
        : []
    }
  });
};

const normalizeCommentAttachments = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
};

export const normalizeCommentActivityEvent = (comment) => {
  const attachments = normalizeCommentAttachments(
    comment?.attachments
      ?? comment?.payload?.attachments
      ?? comment?.files
  );
  const reactions = Array.isArray(comment?.reactions)
    ? comment.reactions
    : (comment?.reactionSummary || comment?.emojiReactions || []);
  const myReactions = Array.isArray(comment?.myReactions)
    ? comment.myReactions
    : (comment?.currentUserReactions || []);

  const capabilities = [ActivityCapability.THREADS, ActivityCapability.MENTIONS];
  if (attachments.length > 0) capabilities.push(ActivityCapability.ATTACHMENTS);
  if ((Array.isArray(reactions) && reactions.length > 0) || myReactions.length > 0) {
    capabilities.push(ActivityCapability.REACTIONS);
  }

  return createActivityEvent({
    id: comment?._id || comment?.id || `${comment?.createdAt || Date.now()}`,
    type: ActivityEventType.COMMENT,
    actor: comment?.author || comment?.user || comment?.userId || null,
    createdAt: comment?.createdAt || comment?.timestamp,
    /** @type {CommentPayload} */
    payload: {
      body: comment?.content || comment?.text || '',
      mentions: comment?.mentions || [],
      parentCommentId: comment?.parentCommentId || null,
      attachments,
      reactions,
      myReactions
    },
    capabilities,
    meta: {
      recordRef: normalizeRecordRef(comment?.recordRef),
      renderHint: 'card',
      source: 'user'
    },
    legacy: {
      _id: comment?._id,
      author: comment?.author || comment?.user || comment?.userId,
      content: comment?.content || comment?.text || '',
      editedAt: comment?.editedAt || null,
      parentCommentId: comment?.parentCommentId || null,
      attachments,
      reactions,
      myReactions,
      likes: comment?.likes || comment?.likedBy,
      likesCount: comment?.likesCount ?? comment?.likeCount ?? 0
    }
  });
};

export const normalizeEmailThreadActivityEvent = (thread) => {
  const createdAt = thread?.lastActivityAt || thread?.firstActivityAt || new Date().toISOString();

  return createActivityEvent({
    id: thread?.threadId || thread?._id || `email-thread-${createdAt}`,
    type: ActivityEventType.EMAIL_THREAD,
    actor: null,
    createdAt,
    /** @type {EmailThreadPayload} */
    payload: {
      thread
    },
    meta: {
      recordRef: normalizeRecordRef(thread?.recordRef),
      renderHint: 'card',
      source: thread?.source || 'integration'
    },
    legacy: {
      _threadEntry: true,
      thread
    }
  });
};

export const sortActivityEventsByDate = (events = []) => {
  return [...events].sort((left, right) => {
    const leftTs = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTs = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
    return leftTs - rightTs;
  });
};
