'use strict';

/**
 * Built-in playbooks — multi-seat plans (Phase B+C).
 * Seats share focus + scratchpad; handoff packets recorded between steps.
 */

const PLAYBOOKS = {
  'qualify-research-outreach': {
    key: 'qualify-research-outreach',
    title: 'Qualify → Research → Outreach',
    description: 'Qualify a lead/org, research context, draft outreach email.',
    seats: [
      { agentKey: 'sales-qualification', step: 'qualify' },
      { agentKey: 'research', step: 'research' },
      { agentKey: 'outreach', step: 'outreach' },
      { agentKey: 'reviewer', step: 'review' },
    ],
  },
  'qualify-enrich-propose-task-review': {
    key: 'qualify-enrich-propose-task-review',
    title: 'Qualify → Enrich → Propose → Task → Review',
    description: 'Canonical sales workforce playbook through quote + follow-up + reviewer.',
    seats: [
      { agentKey: 'sales-qualification', step: 'qualify' },
      { agentKey: 'research', step: 'enrich' },
      { agentKey: 'proposal', step: 'propose' },
      { agentKey: 'workflow', step: 'task' },
      { agentKey: 'reviewer', step: 'review' },
    ],
  },
  'case-triage-reply': {
    key: 'case-triage-reply',
    title: 'Case Triage → Reply Draft',
    description: 'Triage a case and draft a customer reply.',
    seats: [
      { agentKey: 'case-triage', step: 'triage' },
      { agentKey: 'outreach', step: 'reply' },
      { agentKey: 'reviewer', step: 'review' },
    ],
  },
};

const DETECTORS = [
  {
    key: 'qualify-enrich-propose-task-review',
    re: /\b(qualify\s*[→\-–]+\s*enrich|full\s+sales\s+playbook|qualify\s+enrich\s+propose|run\s+(the\s+)?canonical\s+playbook)\b/i,
  },
  {
    key: 'case-triage-reply',
    re: /\b(triage\s+(this\s+)?(case|ticket)|case\s+triage\s+playbook)\b/i,
  },
  {
    key: 'qualify-research-outreach',
    re: /\b(qualify\s+(this\s+)?(lead|contact|person)|qualify\s+and\s+research|run\s+(the\s+)?(sales\s+)?playbook|qualify\s*[→\-–]+\s*research)\b/i,
  },
];

function detectPlaybook(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  for (const d of DETECTORS) {
    if (d.re.test(q)) return PLAYBOOKS[d.key];
  }
  return null;
}

function listPlaybooks() {
  return Object.values(PLAYBOOKS);
}

function getPlaybook(key) {
  return PLAYBOOKS[key] || null;
}

module.exports = {
  PLAYBOOKS,
  detectPlaybook,
  listPlaybooks,
  getPlaybook,
  DETECTORS,
};
