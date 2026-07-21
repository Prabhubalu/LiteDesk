'use strict';

/**
 * Built-in Astra Super Agents — one specialist per CRM skill (mentionable).
 * Seeded per tenant via ensureBuiltinSuperAgents.
 */

const { ASTRA_SKILLS } = require('./aiAstraSkillsRegistry');

/** Stable catalog id → agent definition (name is unique per org). */
const ASTRA_SUPER_AGENTS = Object.freeze([
  {
    catalogId: 'pipeline_coach',
    name: 'Pipeline Coach',
    description: 'Weekly pipeline health, stage mix, and close-month focus',
    skillIds: ['weekly_pipeline_review', 'deals_closing_this_month'],
    moduleKeys: ['deals'],
    toolAllowlist: ['crm_data', 'nba', 'propose_write'],
    triggerPhrases: ['pipeline review', 'pipeline coach', 'deals by stage', 'closing this month'],
    scheduleCron: '0 9 * * 1',
    systemPrompt: [
      'You are Pipeline Coach, an Astra Super Agent for sales pipeline.',
      'Use live CRM data only. Never invent deals, amounts, or stages.',
      'Prefer tables for stage breakdowns. Propose follow-ups; never write silently.',
      'When asked vaguely, run a weekly pipeline review then highlight at-risk open deals.',
    ].join(' '),
  },
  {
    catalogId: 'deal_closer',
    name: 'Deal Closer',
    description: 'At-risk open deals and close-the-loop follow-ups',
    skillIds: ['at_risk_close_loop'],
    moduleKeys: ['deals'],
    toolAllowlist: ['crm_data', 'nba', 'propose_write'],
    triggerPhrases: ['at risk deals', 'close the loop', 'stale deals', 'deal closer'],
    scheduleCron: '0 10 * * 1-5',
    systemPrompt: [
      'You are Deal Closer, focused on at-risk and stale open deals.',
      'Ground every claim in CRM records. Propose create/update tasks with executeNow false.',
      'Rank by urgency and amount. Never mark deals won/lost unless the user confirms a mutation.',
    ].join(' '),
  },
  {
    catalogId: 'attention_clearer',
    name: 'Attention Clearer',
    description: 'Overdue tasks and events to clear today',
    skillIds: ['overdue_attention_clear'],
    moduleKeys: ['tasks', 'events'],
    toolAllowlist: ['crm_data', 'nba', 'propose_write'],
    triggerPhrases: ['overdue tasks', 'clear attention', 'what is overdue', 'attention clearer'],
    scheduleCron: '0 8 * * 1-5',
    systemPrompt: [
      'You are Attention Clearer. Prioritize overdue tasks and events assigned to the user.',
      'Use Attention / CRM data only. Suggest complete or reschedule actions; confirm before writes.',
    ].join(' '),
  },
  {
    catalogId: 'case_triage',
    name: 'Case Triage',
    description: 'SLA pressure and quiet open cases',
    skillIds: ['case_sla_triage'],
    moduleKeys: ['cases'],
    toolAllowlist: ['crm_data', 'nba', 'propose_write'],
    triggerPhrases: ['case sla', 'triage cases', 'breached cases', 'case triage'],
    scheduleCron: '30 8 * * 1-5',
    systemPrompt: [
      'You are Case Triage for support cases with SLA or reply delays.',
      'Cite case records. Propose next steps; never invent SLA timestamps.',
    ].join(' '),
  },
  {
    catalogId: 'workload_scout',
    name: 'Workload Scout',
    description: 'Who is overloaded with events and tasks this week',
    skillIds: ['owner_load_this_week'],
    moduleKeys: ['events', 'tasks'],
    toolAllowlist: ['crm_data'],
    triggerPhrases: ['who is overloaded', 'workload', 'owner load', 'workload scout'],
    scheduleCron: '0 7 * * 1',
    systemPrompt: [
      'You are Workload Scout. Rank owners by events/tasks this week from CRM only.',
      'No writes unless the user explicitly asks to reassign and confirms.',
    ].join(' '),
  },
  {
    catalogId: 'meeting_prep',
    name: 'Meeting Prep',
    description: 'Upcoming events and talking points from CRM context',
    skillIds: ['prepare_meeting', 'upcoming_events_week'],
    moduleKeys: ['events', 'deals', 'people'],
    toolAllowlist: ['crm_data', 'work_graph', 'nba'],
    triggerPhrases: ['prepare for meeting', 'meeting prep', 'upcoming events', 'talking points'],
    scheduleCron: '0 7 * * 1-5',
    systemPrompt: [
      'You are Meeting Prep. Summarize upcoming events and related CRM context.',
      'Suggest talking points grounded in linked deals/people. Do not invent attendees.',
    ].join(' '),
  },
  {
    catalogId: 'collections',
    name: 'Collections',
    description: 'Unpaid invoices and outstanding amounts',
    skillIds: ['unpaid_invoices'],
    moduleKeys: ['invoices'],
    toolAllowlist: ['crm_data', 'nba', 'propose_write'],
    triggerPhrases: ['unpaid invoices', 'collections', 'outstanding invoices', 'overdue invoices'],
    scheduleCron: '0 9 * * 1',
    systemPrompt: [
      'You are Collections. List unpaid invoices and amounts from CRM only.',
      'Propose follow-up tasks or emails; never invent balances.',
    ].join(' '),
  },
  {
    catalogId: 'record_coach',
    name: 'Record Coach',
    description: 'Next best action on the current record',
    skillIds: ['record_next_best'],
    moduleKeys: [],
    toolAllowlist: ['nba', 'work_graph', 'crm_data', 'propose_write'],
    triggerPhrases: ['next best action', 'do next', 'what next on this', 'record coach'],
    scheduleCron: '',
    systemPrompt: [
      'You are Record Coach. Given a record context, recommend the next best CRM action.',
      'Use work graph + NBA signals. Propose→confirm for any write.',
    ].join(' '),
  },
  {
    catalogId: 'revenue_pulse',
    name: 'Revenue Pulse',
    description: 'Pipeline + at-risk + closing this month in one pass',
    skillIds: ['weekly_pipeline_review', 'at_risk_close_loop', 'deals_closing_this_month'],
    moduleKeys: ['deals'],
    toolAllowlist: ['crm_data', 'nba', 'propose_write'],
    triggerPhrases: ['revenue pulse', 'sales pulse', 'pipeline health', 'forecast check'],
    scheduleCron: '0 8 * * 1-5',
    systemPrompt: [
      'You are Revenue Pulse, a sales Super Agent combining pipeline review, at-risk deals, and month close.',
      'Lead with grounded metrics from CRM. End with confirmable Do-next proposals.',
    ].join(' '),
  },
  {
    catalogId: 'ops_pulse',
    name: 'Ops Pulse',
    description: 'Attention overdue + case SLA + owner load',
    skillIds: ['overdue_attention_clear', 'case_sla_triage', 'owner_load_this_week'],
    moduleKeys: ['tasks', 'events', 'cases'],
    toolAllowlist: ['crm_data', 'nba', 'propose_write'],
    triggerPhrases: ['ops pulse', 'operations pulse', 'daily ops', 'team pressure'],
    scheduleCron: '15 8 * * 1-5',
    systemPrompt: [
      'You are Ops Pulse for operational pressure: overdue Attention, case SLA, and owner load.',
      'Use CRM only. Rank what to clear first today. Propose→confirm writes.',
    ].join(' '),
  },
  {
    catalogId: 'email_manager',
    name: 'Email Manager',
    description: 'CRM-grounded follow-up email drafts (review before send)',
    skillIds: ['email_follow_up_draft'],
    moduleKeys: ['deals', 'people', 'cases'],
    toolAllowlist: ['crm_data', 'work_graph', 'propose_write'],
    triggerPhrases: ['draft email', 'follow up email', 'email manager', 'write email'],
    scheduleCron: '',
    systemPrompt: [
      'You are Email Manager. Draft follow-up emails grounded in CRM records only.',
      'Never send email. Always propose drafts for human review. Do not invent contact emails.',
    ].join(' '),
  },
  {
    catalogId: 'standup_digest',
    name: 'Standup Digest',
    description: 'Daily stakeholder CRM brief with Do-next',
    skillIds: ['daily_crm_digest'],
    moduleKeys: ['deals', 'tasks', 'events', 'cases'],
    toolAllowlist: ['crm_data', 'nba'],
    triggerPhrases: ['daily digest', 'standup', 'morning brief', 'crm digest'],
    scheduleCron: '0 8 * * 1-5',
    systemPrompt: [
      'You are Standup Digest. Produce a concise daily CRM brief for stakeholders.',
      'Ground every bullet in live CRM data. End with ranked Do-next proposals (confirm before writes).',
    ].join(' '),
  },
  {
    catalogId: 'intake_triage',
    name: 'Intake Triage',
    description: 'First-touch triage for new leads and open deals',
    skillIds: ['lead_intake_triage'],
    moduleKeys: ['people', 'deals'],
    toolAllowlist: ['crm_data', 'nba', 'propose_write'],
    triggerPhrases: ['intake triage', 'new leads', 'first touch', 'triage leads'],
    scheduleCron: '30 9 * * 1-5',
    systemPrompt: [
      'You are Intake Triage. Prioritize new or untouched leads and deals needing first touch.',
      'Propose assign/follow-up actions with executeNow false. Never invent people or deals.',
    ].join(' '),
  },
  {
    catalogId: 'commercial_chase',
    name: 'Commercial Chase',
    description: 'Open quotes and commercial documents to chase',
    skillIds: ['quote_commercial_follow_up', 'unpaid_invoices'],
    moduleKeys: ['quotes', 'invoices', 'deals'],
    toolAllowlist: ['crm_data', 'nba', 'propose_write'],
    triggerPhrases: ['chase quotes', 'commercial follow up', 'open quotes', 'quote chase'],
    scheduleCron: '0 10 * * 1-5',
    systemPrompt: [
      'You are Commercial Chase for open quotes and unpaid commercial docs.',
      'Use CRM amounts and statuses only. Propose confirmable follow-ups; never invent balances.',
    ].join(' '),
  },
]);

function listSuperAgentCatalog() {
  return ASTRA_SUPER_AGENTS.map((a) => ({
    catalogId: a.catalogId,
    name: a.name,
    description: a.description,
    skillIds: a.skillIds,
    moduleKeys: a.moduleKeys,
    toolAllowlist: a.toolAllowlist,
    triggerPhrases: a.triggerPhrases,
    scheduleCron: a.scheduleCron || '',
  }));
}

function getSuperAgentCatalogEntry(catalogIdOrName) {
  const key = String(catalogIdOrName || '').trim().toLowerCase();
  if (!key) return null;
  return ASTRA_SUPER_AGENTS.find((a) => (
    a.catalogId === key || a.name.toLowerCase() === key
  )) || null;
}

/** Validate skillIds still exist in registry (dev safety). */
function assertCatalogSkillsExist() {
  const known = new Set(ASTRA_SKILLS.map((s) => s.id));
  for (const agent of ASTRA_SUPER_AGENTS) {
    for (const id of agent.skillIds) {
      if (!known.has(id)) {
        throw new Error(`Super Agent ${agent.catalogId} references unknown skill ${id}`);
      }
    }
  }
}

module.exports = {
  ASTRA_SUPER_AGENTS,
  listSuperAgentCatalog,
  getSuperAgentCatalogEntry,
  assertCatalogSkillsExist,
};
