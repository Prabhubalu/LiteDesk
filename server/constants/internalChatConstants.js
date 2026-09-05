'use strict';

const INTERNAL_CHAT_SPACE_TYPES = Object.freeze(['channel', 'dm', 'group_dm', 'record']);

const INTERNAL_CHAT_MEMBERSHIP_ROLES = Object.freeze(['member', 'admin']);

const INTERNAL_CHAT_SSE_EVENT = 'internal_chat';

module.exports = {
  INTERNAL_CHAT_SPACE_TYPES,
  INTERNAL_CHAT_MEMBERSHIP_ROLES,
  INTERNAL_CHAT_SSE_EVENT,
};
