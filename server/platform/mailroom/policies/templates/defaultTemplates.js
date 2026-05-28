const { MAILROOM_TEMPLATE_IDS } = require('../../../../constants/mailroomPolicies');

const THREADING_STANDARD = {
  strategies: [
    { id: 'message_id', signal: 'message_id', enabled: true },
    { id: 'in_reply_to', signal: 'in_reply_to', enabled: true },
    { id: 'references', signal: 'references', enabled: true },
    { id: 'provider_thread', signal: 'provider_thread_id', enabled: true },
    { id: 'sender_subject', signal: 'sender_subject', enabled: true, params: { stripReFwd: true } }
  ],
  fallback: { action: 'no_match' }
};

const DEDUP_APPEND_OPEN = {
  signals: [
    { signal: 'external_message_id', weight: 100, enabled: true },
    { signal: 'thread_id', weight: 90, enabled: true },
    { signal: 'attachment_hash', weight: 70, enabled: false },
    { signal: 'sender_subject', weight: 40, enabled: true }
  ],
  onDuplicate: 'append_to_existing_open_case',
  onNoDuplicate: 'continue'
};

const DEDUP_STRICT_NEW = {
  signals: [
    { signal: 'external_message_id', weight: 100, enabled: true }
  ],
  onDuplicate: 'flag_for_review',
  onNoDuplicate: 'continue'
};

const CASE_LINK_HELPDESK_STANDARD = {
  onOpenCaseMatch: { action: 'append' },
  onResolvedWithinDays: { enabled: true, days: 7, action: 'reopen' },
  onNoMatch: { action: 'create_case' },
  defaults: {
    caseType: 'Support Ticket',
    priority: 'Medium',
    channel: 'Email'
  }
};

const CASE_LINK_STRICT_NEW = {
  onOpenCaseMatch: { action: 'append' },
  onResolvedWithinDays: { enabled: false, days: 0, action: 'create_case' },
  onNoMatch: { action: 'create_case' },
  defaults: {
    caseType: 'Support Ticket',
    priority: 'Medium',
    channel: 'Email'
  }
};

const CASE_LINK_APPEND_ONLY = {
  onOpenCaseMatch: { action: 'append' },
  onResolvedWithinDays: { enabled: true, days: 14, action: 'reopen' },
  onNoMatch: { action: 'create_case' },
  defaults: {
    caseType: 'Support Ticket',
    priority: 'Medium',
    channel: 'Email'
  }
};

const INGEST_DEFAULT = {
  rules: [],
  defaultAction: { type: 'route_to_case_flow' }
};

const TEMPLATES = {
  helpdesk_standard_email: {
    id: 'helpdesk_standard_email',
    name: 'Helpdesk standard (email)',
    description: 'Thread by RFC headers; append to open cases; reopen resolved within 7 days; else new case.',
    policies: {
      threading: THREADING_STANDARD,
      ingest: INGEST_DEFAULT,
      dedup: DEDUP_APPEND_OPEN,
      caseLink: CASE_LINK_HELPDESK_STANDARD,
      classification: { rules: [], defaultQueue: null },
      dispatch: {
        publish: [
          'message.received',
          'message.normalized',
          'conversation.updated',
          'case.created',
          'case.reopened'
        ]
      }
    },
    connectors: {
      arivuParser: { enabled: true },
      rawMimeWebhook: { enabled: true },
      publicApi: { enabled: false, ingestKey: null },
      portal: { enabled: false },
      chat: { enabled: false }
    }
  },
  strict_one_email_one_case: {
    id: 'strict_one_email_one_case',
    name: 'Strict 1:1 email → case',
    description: 'Minimal threading; flag duplicates; always prefer new case when no open match.',
    policies: {
      threading: {
        strategies: [
          { id: 'in_reply_to', signal: 'in_reply_to', enabled: true },
          { id: 'references', signal: 'references', enabled: true }
        ],
        fallback: { action: 'no_match' }
      },
      ingest: INGEST_DEFAULT,
      dedup: DEDUP_STRICT_NEW,
      caseLink: CASE_LINK_STRICT_NEW,
      classification: { rules: [], defaultQueue: null },
      dispatch: { publish: ['message.received', 'case.created'] }
    },
    connectors: {
      arivuParser: { enabled: true },
      rawMimeWebhook: { enabled: true },
      publicApi: { enabled: false, ingestKey: null },
      portal: { enabled: false },
      chat: { enabled: false }
    }
  },
  append_only_threading: {
    id: 'append_only_threading',
    name: 'Append-only threading',
    description: 'Aggressive thread matching; append to open cases; reopen within 14 days.',
    policies: {
      threading: THREADING_STANDARD,
      ingest: INGEST_DEFAULT,
      dedup: {
        ...DEDUP_APPEND_OPEN,
        onDuplicate: 'append_to_existing_open_case'
      },
      caseLink: CASE_LINK_APPEND_ONLY,
      classification: { rules: [], defaultQueue: null },
      dispatch: { publish: ['message.received', 'conversation.updated'] }
    },
    connectors: {
      arivuParser: { enabled: true },
      rawMimeWebhook: { enabled: true },
      publicApi: { enabled: false, ingestKey: null },
      portal: { enabled: false },
      chat: { enabled: false }
    }
  }
};

function listTemplates() {
  return MAILROOM_TEMPLATE_IDS.map((id) => {
    const t = TEMPLATES[id];
    return {
      id: t.id,
      name: t.name,
      description: t.description
    };
  });
}

function getTemplate(templateId) {
  const key = String(templateId || '').trim();
  if (!TEMPLATES[key]) return null;
  return JSON.parse(JSON.stringify(TEMPLATES[key]));
}

function getDefaultMailroomConfig() {
  const template = getTemplate('helpdesk_standard_email');
  return {
    enabled: false,
    activeTemplateId: template.id,
    schemaVersion: 1,
    policies: template.policies,
    connectors: template.connectors
  };
}

module.exports = {
  TEMPLATES,
  listTemplates,
  getTemplate,
  getDefaultMailroomConfig
};
