/** Mirrors server/constants/mailroomPolicies.js for Settings UI. */

export const MAILROOM_DEDUP_BEHAVIORS = [
  'append_to_existing_open_case',
  'create_child_case',
  'flag_for_review',
  'ignore'
];

export const MAILROOM_CASE_LINK_ACTIONS = [
  'create_case',
  'append',
  'reopen',
  'flag_for_review',
  'manual_review',
  'no_op'
];

export const MAILROOM_INGEST_ACTIONS = [
  'route_to_case_flow',
  'workspace_only',
  'manual_review',
  'ignore'
];

export const MAILROOM_INGEST_FIELDS = ['to', 'cc', 'bcc', 'from', 'from_domain', 'subject', 'mailbox_kind', 'channel'];
export const MAILROOM_INGEST_OPERATORS = ['contains', 'equals', 'ends_with', 'in'];

export const MAILROOM_DEDUP_BEHAVIOR_LABEL_KEYS = {
  append_to_existing_open_case: 'settings.mailroomDedupAppendOpen',
  create_child_case: 'settings.mailroomDedupCreateChild',
  flag_for_review: 'settings.mailroomDedupFlagReview',
  ignore: 'settings.mailroomDedupIgnore'
};

export const MAILROOM_CASE_LINK_ACTION_LABEL_KEYS = {
  create_case: 'settings.mailroomCaseLinkCreateCase',
  append: 'settings.mailroomCaseLinkAppend',
  reopen: 'settings.mailroomCaseLinkReopen',
  flag_for_review: 'settings.mailroomCaseLinkFlagReview',
  manual_review: 'settings.mailroomCaseLinkManualReview',
  no_op: 'settings.mailroomCaseLinkNoOp'
};

export const MAILROOM_INGEST_ACTION_LABEL_KEYS = {
  route_to_case_flow: 'settings.mailroomIngestActionRouteCase',
  workspace_only: 'settings.mailroomIngestActionWorkspaceOnly',
  manual_review: 'settings.mailroomIngestActionManualReview',
  ignore: 'settings.mailroomIngestActionIgnore'
};

export const MAILROOM_INGEST_FIELD_LABEL_KEYS = {
  to: 'settings.mailroomIngestFieldTo',
  cc: 'settings.mailroomIngestFieldCc',
  bcc: 'settings.mailroomIngestFieldBcc',
  from: 'settings.mailroomIngestFieldFrom',
  from_domain: 'settings.mailroomIngestFieldFromDomain',
  subject: 'settings.mailroomIngestFieldSubject',
  mailbox_kind: 'settings.mailroomIngestFieldMailboxKind',
  channel: 'settings.mailroomIngestFieldChannel'
};

export const MAILROOM_INGEST_OPERATOR_LABEL_KEYS = {
  contains: 'settings.mailroomIngestOperatorContains',
  equals: 'settings.mailroomIngestOperatorEquals',
  ends_with: 'settings.mailroomIngestOperatorEndsWith',
  in: 'settings.mailroomIngestOperatorIn'
};
