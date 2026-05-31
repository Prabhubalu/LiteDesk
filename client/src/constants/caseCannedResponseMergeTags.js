/**
 * Merge tags available in Helpdesk quick reply templates.
 * Keep in sync with buildCaseCannedResponseContext() in caseCannedResponses.js.
 */
export const CASE_CANNED_RESPONSE_MERGE_TAG_GROUPS = [
  {
    id: 'case',
    labelKey: 'settings.helpdeskExecMergeTagGroupCase',
    tags: [
      { token: 'case.caseId', labelKey: 'settings.helpdeskExecMergeTagCaseId', descriptionKey: 'settings.helpdeskExecMergeTagCaseIdDesc' },
      { token: 'case.title', labelKey: 'settings.helpdeskExecMergeTagCaseTitle', descriptionKey: 'settings.helpdeskExecMergeTagCaseTitleDesc' },
      { token: 'case.status', labelKey: 'settings.helpdeskExecMergeTagCaseStatus', descriptionKey: 'settings.helpdeskExecMergeTagCaseStatusDesc' },
      { token: 'case.priority', labelKey: 'settings.helpdeskExecMergeTagCasePriority', descriptionKey: 'settings.helpdeskExecMergeTagCasePriorityDesc' },
      { token: 'case.channel', labelKey: 'settings.helpdeskExecMergeTagCaseChannel', descriptionKey: 'settings.helpdeskExecMergeTagCaseChannelDesc' }
    ]
  },
  {
    id: 'contact',
    labelKey: 'settings.helpdeskExecMergeTagGroupContact',
    tags: [
      { token: 'contact.firstName', labelKey: 'settings.helpdeskExecMergeTagContactFirstName', descriptionKey: 'settings.helpdeskExecMergeTagContactFirstNameDesc' },
      { token: 'contact.name', labelKey: 'settings.helpdeskExecMergeTagContactName', descriptionKey: 'settings.helpdeskExecMergeTagContactNameDesc' },
      { token: 'contact.email', labelKey: 'settings.helpdeskExecMergeTagContactEmail', descriptionKey: 'settings.helpdeskExecMergeTagContactEmailDesc' }
    ]
  },
  {
    id: 'agent',
    labelKey: 'settings.helpdeskExecMergeTagGroupAgent',
    tags: [
      { token: 'agent.name', labelKey: 'settings.helpdeskExecMergeTagAgentName', descriptionKey: 'settings.helpdeskExecMergeTagAgentNameDesc' },
      { token: 'agent.email', labelKey: 'settings.helpdeskExecMergeTagAgentEmail', descriptionKey: 'settings.helpdeskExecMergeTagAgentEmailDesc' }
    ]
  }
];

export function formatCaseCannedResponseMergeTag(token) {
  return `{{${String(token || '').trim()}}}`;
}

export function listCaseCannedResponseMergeTags() {
  return CASE_CANNED_RESPONSE_MERGE_TAG_GROUPS.flatMap((group) =>
    group.tags.map((tag) => ({ ...tag, groupId: group.id, groupLabelKey: group.labelKey }))
  );
}
