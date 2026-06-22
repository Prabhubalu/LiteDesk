/** Picklist values for closed-session column filters (mirror server enums). */
export const LIVE_CHAT_CLOSED_PICKLIST_VALUES = Object.freeze({
  channel: Object.freeze(['web']),
  lifecycleStatus: Object.freeze(['waiting', 'assigned', 'active', 'ended', 'bot_handling']),
  outcome: Object.freeze([
    'resolved',
    'missed',
    'follow_up_required',
    'escalated',
    'abandoned',
    'spam',
    'informational',
  ]),
  visitorType: Object.freeze(['anonymous', 'known_visitor', 'customer', 'partner']),
  priority: Object.freeze(['low', 'normal', 'high', 'urgent']),
  sentiment: Object.freeze(['positive', 'neutral', 'negative']),
  intent: Object.freeze(['support', 'sales', 'billing', 'general']),
});

export const LIVE_CHAT_CLOSED_BOOLEAN_FILTER_KEYS = Object.freeze([
  'botInvolved',
  'consentGiven',
  'sessionArchived',
  'exported',
]);
