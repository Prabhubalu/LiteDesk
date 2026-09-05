/**
 * Seenzone: derive who has seen a message from membership read cursors.
 */

export const SEEN_ZONE_SMALL_MAX = 12;

export function memberDisplayName(member) {
  if (!member) return '';
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return name || member.email || 'Someone';
}

function messageTime(msg) {
  if (!msg?.createdAt) return 0;
  const t = new Date(msg.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * True if member's read cursor is at or past this message.
 */
export function hasMemberSeenMessage(member, message, orderedMessages = []) {
  if (!member || !message) return false;
  const mid = String(message._id || '');
  const readId = member.lastReadMessageId ? String(member.lastReadMessageId) : '';
  if (readId && mid && readId === mid) return true;

  if (orderedMessages.length && readId) {
    const readIdx = orderedMessages.findIndex((m) => String(m._id) === readId);
    const msgIdx = orderedMessages.findIndex((m) => String(m._id) === mid);
    if (readIdx >= 0 && msgIdx >= 0) return readIdx >= msgIdx;
  }

  if (member.lastReadAt && message.createdAt) {
    return new Date(member.lastReadAt).getTime() >= messageTime(message);
  }
  return false;
}

/**
 * Last own root-level message id in the loaded list (seenzone anchor).
 */
export function findSeenZoneAnchorId(messages, myUserId) {
  const me = String(myUserId || '');
  if (!me) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (String(msg?.authorId || msg?.author?._id || '') !== me) continue;
    return String(msg._id);
  }
  return null;
}

function messageHasBroadcastMention(message) {
  const body = String(message?.body || '');
  if (/<@all>/i.test(body) || /(^|[\s])@all\b/i.test(body)) return true;
  return Array.isArray(message?.mentionUserIds) && message.mentionUserIds.length > 0;
}

/**
 * @returns {{
 *   visible: boolean,
 *   variant: 'hidden'|'dm'|'stack'|'aggregate',
 *   seenBy: object[],
 *   unseenCount: number,
 *   memberCount: number,
 *   allSeen: boolean,
 *   mentionFocused: boolean,
 * }}
 */
export function computeSeenZone({
  mode = 'private',
  spaceType = 'channel',
  message,
  messages = [],
  members = [],
  myUserId,
  isAnchor = false,
}) {
  const empty = {
    visible: false,
    variant: 'hidden',
    seenBy: [],
    unseenCount: 0,
    memberCount: 0,
    allSeen: false,
    mentionFocused: false,
  };

  if (!message || mode === 'off' || !isAnchor) return empty;
  const me = String(myUserId || '');
  if (!me) return empty;
  if (String(message.authorId || message.author?._id || '') !== me) return empty;

  const others = (members || []).filter((m) => String(m.userId) !== me);
  if (!others.length) return empty;

  const seenBy = others.filter((m) => hasMemberSeenMessage(m, message, messages));
  const memberCount = others.length;
  const unseenCount = Math.max(0, memberCount - seenBy.length);
  const allSeen = unseenCount === 0;

  if (spaceType === 'dm') {
    return {
      visible: true,
      variant: 'dm',
      seenBy,
      unseenCount,
      memberCount,
      allSeen,
      mentionFocused: false,
    };
  }

  if (memberCount <= SEEN_ZONE_SMALL_MAX) {
    return {
      visible: true,
      variant: 'stack',
      seenBy,
      unseenCount,
      memberCount,
      allSeen,
      mentionFocused: false,
    };
  }

  // Large channels / records
  if (mode === 'on') {
    return {
      visible: true,
      variant: 'aggregate',
      seenBy,
      unseenCount,
      memberCount,
      allSeen,
      mentionFocused: false,
    };
  }

  // private: only high-signal @mentions / @all
  if (mode === 'private' && messageHasBroadcastMention(message)) {
    const mentionIds = new Set(
      (message.mentionUserIds || []).map((id) => String(id)).filter((id) => id !== me)
    );
    const bodyAll = /<@all>/i.test(String(message.body || ''));
    const relevant = bodyAll
      ? others
      : others.filter((m) => mentionIds.has(String(m.userId)));
    const relevantSeen = relevant.filter((m) => hasMemberSeenMessage(m, message, messages));
    return {
      visible: relevant.length > 0,
      variant: 'aggregate',
      seenBy: relevantSeen,
      unseenCount: Math.max(0, relevant.length - relevantSeen.length),
      memberCount: relevant.length,
      allSeen: relevant.length > 0 && relevantSeen.length === relevant.length,
      mentionFocused: true,
    };
  }

  return empty;
}

export function applyReadUpdated(members, payload) {
  const list = Array.isArray(members) ? [...members] : [];
  const userId = String(payload?.userId || '');
  if (!userId) return list;
  const idx = list.findIndex((m) => String(m.userId) === userId);
  const next = {
    userId,
    lastReadAt: payload.lastReadAt || null,
    lastReadMessageId: payload.lastReadMessageId ? String(payload.lastReadMessageId) : null,
    muted: list[idx]?.muted === true,
    firstName: list[idx]?.firstName || '',
    lastName: list[idx]?.lastName || '',
    email: list[idx]?.email || '',
    avatar: list[idx]?.avatar || '',
  };
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...next };
  } else {
    list.push(next);
  }
  return list;
}
