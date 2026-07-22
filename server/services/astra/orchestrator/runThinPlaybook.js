'use strict';

/**
 * runThinPlaybook — multi-seat runner with handoff packets (Phase B+C).
 */

const crypto = require('crypto');
const { getPlaybook } = require('./playbooks');
const { extractSearchTerm } = require('../tools/families');
const { buildEmailDraftTurn } = require('../experience/buildEmailDraftTurn');
const { extractTaskTitle, extractCaseTitle } = require('./intentRegistry');

function handoff(from, to, packet) {
  return {
    type: 'agent.handoff',
    from,
    to,
    at: Date.now(),
    packet: packet || {},
  };
}

/**
 * @param {object} params
 */
async function runThinPlaybook({
  playbookKey,
  query,
  ctx,
  memory,
  conversationId,
  llm = null,
  history = [],
}) {
  const playbook = getPlaybook(playbookKey);
  if (!playbook) {
    return {
      ok: false,
      answer: `Unknown playbook "${playbookKey}".`,
      seats: [],
      proposals: [],
      suggestions: ['Qualify this lead', 'List my open deals'],
      scratchpad: {},
      handoffs: [],
    };
  }

  const orgId = ctx.organizationId;
  const scratch = orgId ? { ...(memory.getScratchpad(orgId, conversationId) || {}) } : {};
  const seats = [];
  const proposals = [];
  const handoffs = [];
  let focus = ctx.focus || (orgId ? memory.getFocus(orgId, conversationId) : null);
  const registry = ctx.toolRegistry;

  async function runSeatQualify() {
    const searchTool = registry.getTool('search.crm');
    const searchTerm = extractSearchTerm(query) || focus?.name || null;
    const qualifyQuery = searchTerm
      ? `show me people called ${searchTerm}`
      : 'show me people';
    let qualifyResult = null;
    if (searchTool) {
      qualifyResult = await searchTool.run({ query: qualifyQuery, entity: 'people', limit: 5 }, ctx);
    }
    const qualifyHit = qualifyResult?.hits?.[0] || null;
    if (qualifyHit && orgId) {
      focus = {
        kind: 'people',
        id: qualifyHit.id,
        name: qualifyHit.title,
        moduleKey: 'people',
      };
      memory.setFocus(orgId, conversationId, focus);
    }
    scratch.qualify = {
      agentKey: 'sales-qualification',
      hit: qualifyHit
        ? { id: qualifyHit.id, title: qualifyHit.title, subtitle: qualifyHit.subtitle }
        : null,
      guidance: qualifyHit
        ? `Qualified focus: ${qualifyHit.title}`
        : 'No matching person found — continuing with conversation focus if any.',
    };
    seats.push({
      agentKey: 'sales-qualification',
      step: 'qualify',
      summary: scratch.qualify.guidance,
      hit: scratch.qualify.hit,
    });
  }

  async function runSeatResearch(step = 'research') {
    let researchSummary = 'No related context yet.';
    if (focus?.id) {
      const relTool = registry.getTool('relationships.context');
      if (relTool) {
        const rel = await relTool.run({
          moduleKey: focus.moduleKey || focus.kind,
          recordId: focus.id,
        }, ctx);
        scratch.research = {
          agentKey: 'research',
          relatedCount: rel?.related?.length || 0,
          related: (rel?.related || []).slice(0, 5),
          record: rel?.record || null,
        };
        researchSummary = rel?.related?.length
          ? `Found ${rel.related.length} related link(s) for ${focus.name}.`
          : `Loaded ${focus.name}; limited related context.`;
      } else {
        researchSummary = `Focus set to ${focus.name}; relationship tool unavailable.`;
      }
    } else {
      researchSummary = 'Skipped deep research — no focus yet.';
      scratch.research = { agentKey: 'research', skipped: true };
    }
    seats.push({ agentKey: 'research', step, summary: researchSummary });
  }

  async function runSeatOutreach() {
    const emailTurn = await buildEmailDraftTurn({
      query: `draft an email saying let's catch up about next steps`,
      history,
      llm,
      organizationId: orgId,
      focus,
    });
    scratch.outreach = {
      agentKey: 'outreach',
      subject: emailTurn.draft?.subject,
      to: emailTurn.draft?.to || '',
    };
    seats.push({
      agentKey: 'outreach',
      step: 'outreach',
      summary: `Drafted outreach${focus?.name ? ` for ${focus.name}` : ''}.`,
    });
    for (const p of emailTurn.proposals || []) proposals.push(p);
    return emailTurn;
  }

  async function runSeatPropose() {
    const tool = registry.getTool('quotes.draft');
    const toolResult = tool
      ? await tool.run({
        dealId: focus?.kind === 'deals' ? focus.id : null,
        dealName: focus?.name || 'this opportunity',
      }, ctx)
      : null;
    if (toolResult?.type === 'confirm_action') {
      proposals.push({
        id: crypto.randomUUID(),
        kind: 'quotes.draft',
        label: toolResult.summary,
        summary: toolResult.summary,
        toolName: toolResult.toolName,
        payload: toolResult.payload,
        confirmation: toolResult,
      });
    }
    scratch.propose = { agentKey: 'proposal', dealName: focus?.name || null };
    seats.push({
      agentKey: 'proposal',
      step: 'propose',
      summary: `Drafted quote proposal${focus?.name ? ` for ${focus.name}` : ''}.`,
    });
  }

  async function runSeatTask() {
    const tool = registry.getTool('crm.tasks.create');
    const title = focus?.name
      ? `Follow up on ${focus.name}`
      : extractTaskTitle(query) || 'Follow up after proposal';
    const toolResult = tool
      ? await tool.run({
        title,
        relatedTo: focus?.id
          ? { moduleKey: focus.moduleKey || focus.kind, id: focus.id, name: focus.name }
          : null,
      }, ctx)
      : null;
    if (toolResult?.type === 'confirm_action') {
      proposals.push({
        id: crypto.randomUUID(),
        kind: 'crm.tasks.create',
        label: toolResult.summary,
        summary: toolResult.summary,
        toolName: toolResult.toolName,
        payload: toolResult.payload,
        confirmation: toolResult,
      });
    }
    scratch.task = { agentKey: 'workflow', title };
    seats.push({
      agentKey: 'workflow',
      step: 'task',
      summary: `Prepared follow-up task "${title}".`,
    });
  }

  async function runSeatTriage() {
    const tool = registry.getTool('crm.cases.create');
    const title = extractCaseTitle(query);
    const toolResult = tool ? await tool.run({ title, relatedTo: focus?.id ? {
      moduleKey: focus.moduleKey || focus.kind, id: focus.id, name: focus.name,
    } : null }, ctx) : null;
    if (toolResult?.type === 'confirm_action') {
      proposals.push({
        id: crypto.randomUUID(),
        kind: 'crm.cases.create',
        label: toolResult.summary,
        summary: toolResult.summary,
        toolName: toolResult.toolName,
        payload: toolResult.payload,
        confirmation: toolResult,
      });
    }
    scratch.triage = { agentKey: 'case-triage', title };
    seats.push({
      agentKey: 'case-triage',
      step: 'triage',
      summary: `Prepared case "${title}" for confirm.`,
    });
  }

  async function runSeatReview() {
    const critiqueTool = registry.getTool('reviewer.critique_write');
    if (critiqueTool && proposals[0]) {
      const critique = await critiqueTool.run({
        toolName: proposals[0].toolName || 'write',
        payload: proposals[0].payload || {},
        summary: proposals[0].summary || proposals[0].label,
      }, ctx);
      scratch.review = critique;
      seats.push({
        agentKey: 'reviewer',
        step: 'review',
        summary: critique?.verdict || 'Reviewer checked payloads.',
      });
    } else {
      seats.push({
        agentKey: 'reviewer',
        step: 'review',
        summary: 'Reviewer: nothing to critique yet.',
      });
    }
  }

  const stepFns = {
    qualify: runSeatQualify,
    research: () => runSeatResearch('research'),
    enrich: () => runSeatResearch('enrich'),
    outreach: runSeatOutreach,
    reply: runSeatOutreach,
    propose: runSeatPropose,
    task: runSeatTask,
    triage: runSeatTriage,
    review: runSeatReview,
  };

  let lastAgent = null;
  let emailTurn = null;

  for (const seat of playbook.seats) {
    if (lastAgent) {
      const packet = {
        focus,
        scratchpadKeys: Object.keys(scratch),
        findings: scratch[lastAgent] || scratch[Object.keys(scratch).pop()] || {},
      };
      const hop = handoff(lastAgent, seat.agentKey, packet);
      handoffs.push(hop);
      const handoffTool = registry.getTool('agent.handoff');
      if (handoffTool) {
        await handoffTool.run({
          fromAgent: lastAgent,
          toAgent: seat.agentKey,
          focus,
          findings: packet.findings,
        }, ctx);
      }
    }
    const fn = stepFns[seat.step];
    if (fn) {
      const out = await fn();
      if (seat.step === 'outreach' || seat.step === 'reply') emailTurn = out;
    } else {
      seats.push({
        agentKey: seat.agentKey,
        step: seat.step,
        summary: `Seat ${seat.agentKey} (${seat.step}) — no runner yet.`,
      });
    }
    lastAgent = seat.agentKey;
  }

  if (orgId) {
    memory.setScratchpad(orgId, conversationId, { ...scratch, handoffs });
  }

  const lines = [
    `${playbook.title} — ran ${seats.length} seats:`,
    ...seats.map((s, i) => `${i + 1}. [${s.agentKey}] ${s.summary}`),
  ];
  if (handoffs.length) {
    lines.push('', `Handoffs: ${handoffs.map((h) => `${h.from}→${h.to}`).join(', ')}`);
  }
  if (emailTurn?.answer) {
    lines.push('', emailTurn.answer);
  } else if (proposals.length) {
    lines.push('', `${proposals.length} confirm action(s) ready — review before applying.`);
  }

  return {
    ok: true,
    playbookKey: playbook.key,
    answer: lines.join('\n'),
    seats,
    proposals,
    handoffs,
    suggestions: [
      focus?.name ? `Tell me more about ${focus.name}` : 'List my open deals',
      'Create a follow-up task',
      'Book a meeting',
    ],
    scratchpad: scratch,
    focus,
    blocks: emailTurn?.blocks || [],
    agentKey: 'workflow',
  };
}

module.exports = {
  runThinPlaybook,
  handoff,
};
