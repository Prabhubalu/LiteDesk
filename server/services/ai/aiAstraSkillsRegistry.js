'use strict';

/**
 * Astra Skills — named CRM workflows (prompt + optional plan hints).
 * Invoking a skill runs its seedQuestion through the normal ask spine.
 */

const ASTRA_SKILLS = Object.freeze([
  {
    id: 'weekly_pipeline_review',
    label: 'Weekly pipeline review',
    description: 'Open deals by stage with amount and at-risk follow-ups',
    moduleKeys: ['deals'],
    seedQuestion: 'Give me a weekly pipeline review: open deals by stage with amounts, then list at-risk open deals that need follow-up.',
    allowedTools: ['crm_data', 'nba'],
  },
  {
    id: 'at_risk_close_loop',
    label: 'Close the loop on at-risk deals',
    description: 'Find at-risk open deals and propose follow-up tasks',
    moduleKeys: ['deals'],
    seedQuestion: 'Which open deals are at risk? Close the loop with follow-up tasks on the top ones.',
    allowedTools: ['crm_data', 'propose_write'],
  },
  {
    id: 'overdue_attention_clear',
    label: 'Clear overdue Attention',
    description: 'List overdue tasks and events assigned to me',
    moduleKeys: ['tasks', 'events'],
    seedQuestion: 'List my overdue tasks and events from Attention and prioritize what to clear first today.',
    allowedTools: ['crm_data', 'nba'],
  },
  {
    id: 'case_sla_triage',
    label: 'Case SLA triage',
    description: 'Open cases with SLA pressure or quiet agent replies',
    moduleKeys: ['cases'],
    seedQuestion: 'Show open cases that are SLA breached or waiting too long for an agent reply.',
    allowedTools: ['crm_data', 'nba'],
  },
  {
    id: 'owner_load_this_week',
    label: 'Who is overloaded this week?',
    description: 'Rank owners by events/tasks this week',
    moduleKeys: ['events', 'tasks'],
    seedQuestion: 'Who is overloaded with events and tasks this week?',
    allowedTools: ['crm_data'],
  },
  {
    id: 'deals_closing_this_month',
    label: 'Deals closing this month',
    description: 'Open deals expected to close this month',
    moduleKeys: ['deals'],
    seedQuestion: 'List open deals expected to close this month with amounts.',
    allowedTools: ['crm_data'],
  },
  {
    id: 'upcoming_events_week',
    label: 'Upcoming events this week',
    description: 'Calendar focus for the next 7 days',
    moduleKeys: ['events'],
    seedQuestion: 'List upcoming events this week as a table.',
    allowedTools: ['crm_data'],
  },
  {
    id: 'unpaid_invoices',
    label: 'Unpaid invoices',
    description: 'Outstanding commercial documents',
    moduleKeys: ['invoices'],
    seedQuestion: 'List unpaid invoices and outstanding amounts.',
    allowedTools: ['crm_data'],
  },
  {
    id: 'record_next_best',
    label: 'Next best action here',
    description: 'NBA for the current record context',
    moduleKeys: [],
    seedQuestion: 'What is the next best action on this record based on related activity?',
    allowedTools: ['nba', 'work_graph'],
  },
  {
    id: 'prepare_meeting',
    label: 'Prepare for next meeting',
    description: 'Summarize context for upcoming events',
    moduleKeys: ['events', 'deals', 'people'],
    seedQuestion: 'Prepare me for my next upcoming meeting: summarize related CRM context and suggest talking points.',
    allowedTools: ['crm_data', 'work_graph'],
  },
  {
    id: 'email_follow_up_draft',
    label: 'Draft follow-up email',
    description: 'Propose a CRM-grounded follow-up email for the current record',
    moduleKeys: ['deals', 'people', 'cases'],
    seedQuestion: 'Draft a concise follow-up email for this record using live CRM context. Propose the email for review — do not send.',
    allowedTools: ['crm_data', 'work_graph', 'propose_write'],
  },
  {
    id: 'daily_crm_digest',
    label: 'Daily CRM digest',
    description: 'Stakeholder brief: Attention, pipeline risk, cases, closing deals',
    moduleKeys: ['deals', 'tasks', 'events', 'cases'],
    seedQuestion: 'Give me a daily CRM digest: overdue Attention, at-risk open deals, SLA-pressure cases, and deals closing this month. End with top Do-next proposals.',
    allowedTools: ['crm_data', 'nba'],
  },
  {
    id: 'lead_intake_triage',
    label: 'Lead / intake triage',
    description: 'Prioritize new people or open deals that need first touch',
    moduleKeys: ['people', 'deals'],
    seedQuestion: 'Triage new or untouched leads and open deals that need a first touch. Rank by urgency and propose next steps.',
    allowedTools: ['crm_data', 'nba', 'propose_write'],
  },
  {
    id: 'quote_commercial_follow_up',
    label: 'Quote / commercial follow-up',
    description: 'Open quotes and commercial docs needing chase',
    moduleKeys: ['quotes', 'invoices', 'deals'],
    seedQuestion: 'List open quotes and commercial follow-ups that need chase. Propose confirmable next steps.',
    allowedTools: ['crm_data', 'nba', 'propose_write'],
  },
]);

function isSkillsEnabled() {
  // Default ON when Autopilot or Pipeline is on; explicit false disables.
  if (String(process.env.ASTRA_SKILLS_V1 || '').toLowerCase() === 'false') return false;
  if (String(process.env.ASTRA_SKILLS_V1 || '').toLowerCase() === 'true') return true;
  return true;
}

function listAstraSkills({ moduleKey = '' } = {}) {
  if (!isSkillsEnabled()) return [];
  const mod = String(moduleKey || '').trim().toLowerCase();
  return ASTRA_SKILLS
    .filter((s) => !mod || !s.moduleKeys.length || s.moduleKeys.includes(mod))
    .map((s) => ({
      id: s.id,
      label: s.label,
      description: s.description,
      moduleKeys: s.moduleKeys,
      seedQuestion: s.seedQuestion,
      allowedTools: s.allowedTools,
    }));
}

function getAstraSkill(skillId) {
  const id = String(skillId || '').trim();
  return ASTRA_SKILLS.find((s) => s.id === id) || null;
}

module.exports = {
  ASTRA_SKILLS,
  isSkillsEnabled,
  listAstraSkills,
  getAstraSkill,
};
