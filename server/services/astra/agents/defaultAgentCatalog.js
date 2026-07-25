'use strict';

/**
 * Platform default Astra agents (Mission Control + specialists).
 * Prompt bodies live in ./defaultAgents/*.md — never use the word CRM in titles/descriptions/prompts.
 */

const fs = require('fs');
const path = require('path');

const PROMPT_DIR = path.join(__dirname, 'defaultAgents');

const READ_CORE = [
  'search.crm',
  'module.search',
  'module.get',
  'crm.record.get',
  'relationships.context',
];

const READ_PEOPLE_ORGS = ['crm.people', 'crm.deals', 'crm.cases', 'crm.tasks', 'crm.events'];

/** @type {ReadonlyArray<{
 *   name: string,
 *   title: string,
 *   description: string,
 *   tools: string[],
 *   autonomy: 'assist'|'confirm',
 *   role: 'orchestrator'|'specialist',
 * }>} */
const CATALOG_META = [
  {
    name: 'mission-control',
    title: 'Astra Mission Control',
    description:
      'Central orchestrator: classifies intent, plans multi-agent work, invokes specialists, merges answers, and enforces confirmation. Does not mutate Platform data directly.',
    tools: ['agent.handoff', 'canvas.generate', 'canvas.mutate', 'canvas.suggest', 'canvas.export'],
    autonomy: 'assist',
    role: 'orchestrator',
  },
  {
    name: 'summary',
    title: 'Summary Agent',
    description:
      'Read-only 360° understanding of any Platform record and related activity — risks, opportunities, and next actions in under a minute.',
    tools: [
      ...READ_CORE,
      ...READ_PEOPLE_ORGS,
      'documents.search',
      'knowledge.search',
      'canvas.generate',
      'canvas.mutate',
    ],
    autonomy: 'assist',
    role: 'specialist',
  },
  {
    name: 'record-creation',
    title: 'Record Creation Agent',
    description:
      'Creates Platform records from natural language after gathering required fields, validating, and confirming.',
    tools: [
      ...READ_CORE,
      'module.create',
      'crm.deals.create',
      'crm.people.create',
      'crm.organizations.create',
      'crm.cases.create',
      'crm.tasks.create',
      'crm.notes.create',
    ],
    autonomy: 'confirm',
    role: 'specialist',
  },
  {
    name: 'record-update',
    title: 'Record Update Agent',
    description:
      'Updates existing Platform records safely: identify record, validate fields, explain impact, confirm before write.',
    tools: [...READ_CORE, ...READ_PEOPLE_ORGS, 'module.update', 'crm.deals.update'],
    autonomy: 'confirm',
    role: 'specialist',
  },
  {
    name: 'search',
    title: 'Search Agent',
    description:
      'Natural-language search across Platform modules with ranking, match explanation, and refinement suggestions.',
    tools: [...READ_CORE, ...READ_PEOPLE_ORGS, 'documents.search', 'campaigns.search', 'audiences.search'],
    autonomy: 'assist',
    role: 'specialist',
  },
  {
    name: 'task-activity',
    title: 'Task & Activity Agent',
    description:
      'Creates and manages tasks, meetings, calls, follow-ups, and calendar items with confirmation on writes.',
    tools: [
      ...READ_CORE,
      'crm.tasks',
      'crm.events',
      'crm.tasks.create',
      'calendar.createEvent',
      'crm.activity.log',
      'crm.notes.create',
    ],
    autonomy: 'confirm',
    role: 'specialist',
  },
  {
    name: 'email',
    title: 'Email Agent',
    description:
      'Drafts, rewrites, and summarizes emails grounded in Platform context. Send always requires confirmation.',
    tools: [...READ_CORE, 'crm.people', 'email.draft', 'email.send', 'mailroom.classify'],
    autonomy: 'confirm',
    role: 'specialist',
  },
  {
    name: 'deal-intelligence',
    title: 'Deal Intelligence Agent',
    description:
      'Read-only deal risk, stage, and opportunity analysis with grounded next-best-action recommendations.',
    tools: [...READ_CORE, 'crm.deals', 'crm.people', 'crm.tasks', 'reports.run'],
    autonomy: 'assist',
    role: 'specialist',
  },
  {
    name: 'meeting-intelligence',
    title: 'Meeting Intelligence Agent',
    description:
      'Meeting prep and post-meeting intelligence from notes, transcripts, and related Platform records.',
    tools: [...READ_CORE, 'crm.events', 'crm.deals', 'crm.people', 'documents.search'],
    autonomy: 'assist',
    role: 'specialist',
  },
  {
    name: 'forecast-pipeline',
    title: 'Forecast & Pipeline Intelligence Agent',
    description:
      'Read-only pipeline and forecast analysis — coverage, slippage, and evidence-backed recommendations.',
    tools: [...READ_CORE, 'crm.deals', 'reports.run', 'analytics.query'],
    autonomy: 'assist',
    role: 'specialist',
  },
  {
    name: 'customer-360',
    title: 'Customer 360 Intelligence Agent',
    description:
      'Account health and customer 360 insights across deals, cases, activity, and relationships.',
    tools: [...READ_CORE, ...READ_PEOPLE_ORGS, 'documents.search'],
    autonomy: 'assist',
    role: 'specialist',
  },
  {
    name: 'conversation-intelligence',
    title: 'Conversation Intelligence Agent',
    description:
      'Analyzes emails, chats, and conversations for sentiment, commitments, and relationship signals.',
    tools: [...READ_CORE, 'crm.people', 'crm.cases', 'liveChat.suggestReply', 'mailroom.classify', 'email.draft'],
    autonomy: 'assist',
    role: 'specialist',
  },
  {
    name: 'case-intelligence',
    title: 'Case Intelligence Agent',
    description:
      'Case triage insight, similar-case patterns, knowledge matches, and resolution recommendations (read-only).',
    tools: [...READ_CORE, 'crm.cases', 'crm.people', 'knowledge.search'],
    autonomy: 'assist',
    role: 'specialist',
  },
  {
    name: 'knowledge-intelligence',
    title: 'Knowledge Intelligence Agent',
    description:
      'Answers from knowledge base and documentation with Platform context — no content publishing.',
    tools: ['knowledge.search', 'documents.search', 'portal.content.search', 'search.crm'],
    autonomy: 'assist',
    role: 'specialist',
  },
  {
    name: 'process-intelligence',
    title: 'Process Intelligence Agent',
    description:
      'Designs and optimizes Platform processes and automations; publish/activate requires confirmation.',
    tools: [...READ_CORE, 'automation.list', 'workflow.run', 'playbook.run'],
    autonomy: 'confirm',
    role: 'specialist',
  },
  {
    name: 'analytics-decision',
    title: 'Analytics & Decision Intelligence Agent',
    description:
      'KPI, trend, anomaly, and decision support from Platform reports and analytics (read-only).',
    tools: [...READ_CORE, 'reports.run', 'analytics.query'],
    autonomy: 'assist',
    role: 'specialist',
  },
  {
    name: 'relationship-intelligence',
    title: 'Relationship Intelligence Agent',
    description:
      'Stakeholder mapping, influence, multi-threading, and relationship-risk analysis (read-only).',
    tools: [...READ_CORE, 'crm.people', 'crm.deals', 'crm.events', 'crm.tasks'],
    autonomy: 'assist',
    role: 'specialist',
  },
  {
    name: 'data-quality',
    title: 'Data Quality Intelligence Agent',
    description:
      'Detects duplicates, incompleteness, and stale data; recommends fixes. Cleanup writes require confirmation.',
    tools: [...READ_CORE, ...READ_PEOPLE_ORGS],
    autonomy: 'confirm',
    role: 'specialist',
  },
  {
    name: 'integration-intelligence',
    title: 'Integration Intelligence Agent',
    description:
      'Analyzes integration health, mapping, and sync issues; configuration changes require confirmation.',
    tools: [...READ_CORE, 'automation.list', 'knowledge.search'],
    autonomy: 'confirm',
    role: 'specialist',
  },
  {
    name: 'workday-orchestrator',
    title: 'Workday Orchestrator Agent',
    description:
      'Personal daily work plan from tasks, calendar, and priorities — recommend-only; no silent reschedules.',
    tools: [...READ_CORE, 'crm.tasks', 'crm.events', 'crm.deals', 'crm.cases'],
    autonomy: 'assist',
    role: 'specialist',
  },
];

const SPECIALIST_KEYS = CATALOG_META.filter((a) => a.role === 'specialist').map((a) => a.name);
const MISSION_CONTROL_KEY = 'mission-control';
/** Soft-alias: legacy coworker seat → Mission Control */
const COWORKER_ALIAS = 'coworker';

const promptCache = new Map();

function loadPrompt(name) {
  if (promptCache.has(name)) return promptCache.get(name);
  const file = path.join(PROMPT_DIR, `${name}.md`);
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    text = `Role: ${name}\nGoal: Platform specialist\nConstraints: Never invent Platform facts. Cite tool results. Confirm writes.`;
  }
  if (/\bCRM\b/i.test(text)) {
    throw new Error(`defaultAgentCatalog: prompt ${name}.md contains forbidden word CRM`);
  }
  promptCache.set(name, text);
  return text;
}

function buildBuiltinAgents() {
  return CATALOG_META.map((meta) => {
    const systemHint = loadPrompt(meta.name);
    if (/\bCRM\b/i.test(meta.title) || /\bCRM\b/i.test(meta.description)) {
      throw new Error(`defaultAgentCatalog: metadata for ${meta.name} contains CRM`);
    }
    return {
      name: meta.name,
      title: meta.title,
      description: meta.description,
      tools: [...meta.tools],
      systemHint,
      autonomy: meta.autonomy,
      role: meta.role,
    };
  });
}

/** Lazy so missing files fail at bootstrap, not import time in unit stubs */
let _builtins = null;
function getBuiltinAgents() {
  if (!_builtins) _builtins = buildBuiltinAgents();
  return _builtins;
}

function getSeedBuiltinAgents() {
  return getBuiltinAgents();
}

function assertNoCrmInCatalog() {
  for (const a of getBuiltinAgents()) {
    if (/\bCRM\b/i.test(`${a.title}\n${a.description}\n${a.systemHint}`)) {
      throw new Error(`CRM leak in agent ${a.name}`);
    }
  }
  return true;
}

module.exports = {
  CATALOG_META,
  SPECIALIST_KEYS,
  MISSION_CONTROL_KEY,
  COWORKER_ALIAS,
  READ_CORE,
  getBuiltinAgents,
  getSeedBuiltinAgents,
  loadPrompt,
  assertNoCrmInCatalog,
  PROMPT_DIR,
};
