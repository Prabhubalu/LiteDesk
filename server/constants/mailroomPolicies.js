/**
 * Mailroom policy constants — shared enums (no business rules).
 */

const MAILROOM_POLICY_TYPES = ['ingest', 'threading', 'dedup', 'case_link', 'classification', 'dispatch'];

const MAILROOM_THREADING_SIGNALS = [
  'message_id',
  'in_reply_to',
  'references',
  'provider_thread_id',
  'sender_subject'
];

const MAILROOM_DEDUP_BEHAVIORS = [
  'append_to_existing_open_case',
  'create_child_case',
  'flag_for_review',
  'ignore'
];

const MAILROOM_CASE_LINK_ACTIONS = [
  'create_case',
  'append',
  'reopen',
  'flag_for_review',
  'manual_review',
  'no_op'
];

const MAILROOM_INGEST_OPERATORS = ['contains', 'equals', 'ends_with', 'in'];
const MAILROOM_INGEST_FIELDS = ['to', 'cc', 'bcc', 'from', 'from_domain', 'subject', 'mailbox_kind'];
const MAILROOM_INGEST_ACTIONS = ['route_to_case_flow', 'workspace_only', 'manual_review', 'ignore'];

const MAILROOM_TEMPLATE_IDS = [
  'helpdesk_standard_email',
  'strict_one_email_one_case',
  'append_only_threading'
];

const MAILROOM_CHANNELS = ['email', 'chat', 'portal_customer', 'portal_partner', 'api', 'manual'];

const MAILROOM_SCHEMA_VERSION = 1;

module.exports = {
  MAILROOM_POLICY_TYPES,
  MAILROOM_THREADING_SIGNALS,
  MAILROOM_DEDUP_BEHAVIORS,
  MAILROOM_CASE_LINK_ACTIONS,
  MAILROOM_INGEST_OPERATORS,
  MAILROOM_INGEST_FIELDS,
  MAILROOM_INGEST_ACTIONS,
  MAILROOM_TEMPLATE_IDS,
  MAILROOM_CHANNELS,
  MAILROOM_SCHEMA_VERSION
};
