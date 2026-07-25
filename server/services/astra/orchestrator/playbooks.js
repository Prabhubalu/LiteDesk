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
  'studio-meeting-prep': {
    key: 'studio-meeting-prep',
    title: 'Studio · Meeting Preparation',
    description: 'Generate a Living Canvas meeting prep workspace.',
    seats: [
      { agentKey: 'meeting-intelligence', step: 'prep' },
      { agentKey: 'customer-360', step: 'context' },
      { agentKey: 'summary', step: 'canvas' },
    ],
  },
  'studio-war-room': {
    key: 'studio-war-room',
    title: 'Studio · Opportunity War Room',
    description: 'Generate a Living Canvas opportunity war room.',
    seats: [
      { agentKey: 'deal-intelligence', step: 'deal' },
      { agentKey: 'relationship-intelligence', step: 'stakeholders' },
      { agentKey: 'summary', step: 'canvas' },
    ],
  },
  'studio-customer-360': {
    key: 'studio-customer-360',
    title: 'Studio · Customer 360',
    description: 'Generate a Living Canvas customer 360 workspace.',
    seats: [
      { agentKey: 'customer-360', step: 'profile' },
      { agentKey: 'conversation-intelligence', step: 'comms' },
      { agentKey: 'summary', step: 'canvas' },
    ],
  },
};

const DETECTORS = [
  {
    key: 'studio-meeting-prep',
    re: /\b(meeting\s+prep|prepare\s+(me\s+)?for\s+(the\s+)?meeting|living\s+canvas\s+meeting)\b/i,
  },
  {
    key: 'studio-war-room',
    re: /\b(war\s*room|opportunity\s+workspace|deal\s+war)\b/i,
  },
  {
    key: 'studio-customer-360',
    re: /\b(customer\s*360|analyze\s+this\s+customer|account\s+360\s+canvas)\b/i,
  },
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
