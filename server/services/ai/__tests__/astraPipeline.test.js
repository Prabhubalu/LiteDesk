'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { isPipelineV2Enabled, ASTRA_PIPELINE_INTENTS } = require('../astra/orchestrator/pipelineTypes');
const { analyzeIntent, isMvpPipelineIntent, needsLegacyCrmDataAsk, extractAccountHint } = require('../astra/intent/intentAnalyzer');
const { planQuery } = require('../astra/planner/queryPlanner');
const { buildConversationMemory } = require('../astra/memory/conversationMemory');
const { buildContextPack } = require('../astra/retrieval/contextBuilder');
const { generateResponse, sectionBody } = require('../astra/response/responseGenerator');
const { fallbackReasoning } = require('../astra/reasoning/reasoningEngine');
const { applyDealFilters } = require('../astra/tools/searchDeals');
const { ensureToolsLoaded, listTools, isRegisteredTool } = require('../astra/tools/registry');
const { validateToolInput } = require('../astra/retrieval/toolRunner');

describe('Astra pipeline v2 — flag', () => {
  const prev = process.env.ASTRA_PIPELINE_V2;

  after(() => {
    if (prev === undefined) delete process.env.ASTRA_PIPELINE_V2;
    else process.env.ASTRA_PIPELINE_V2 = prev;
  });

  it('defaults off', () => {
    delete process.env.ASTRA_PIPELINE_V2;
    assert.equal(isPipelineV2Enabled(), false);
  });

  it('enables on true/1/yes/on', () => {
    process.env.ASTRA_PIPELINE_V2 = 'true';
    assert.equal(isPipelineV2Enabled(), true);
    process.env.ASTRA_PIPELINE_V2 = '1';
    assert.equal(isPipelineV2Enabled(), true);
  });
});

describe('Astra IntentAnalyzer', () => {
  it('classifies ProductHowTo', () => {
    const intent = analyzeIntent({
      question: 'How do I convert a deal to a quote?',
      memory: {},
    });
    assert.equal(intent.intent, 'ProductHowTo');
    assert.equal(intent.route_hint, 'product_knowledge');
    assert.ok(isMvpPipelineIntent(intent));
    assert.ok(ASTRA_PIPELINE_INTENTS.includes(intent.intent));
  });

  it('classifies CustomerHealthAnalysis and clarifies without account', () => {
    const intent = analyzeIntent({
      question: 'How healthy is this customer?',
      memory: {},
    });
    assert.equal(intent.intent, 'CustomerHealthAnalysis');
    assert.equal(intent.needs_clarification, true);
    assert.ok(intent.clarifying_question);
  });

  it('classifies CustomerHealthAnalysis with account hint', () => {
    const intent = analyzeIntent({
      question: 'How healthy is ACME?',
      memory: {},
    });
    assert.equal(intent.intent, 'CustomerHealthAnalysis');
    assert.equal(intent.needs_clarification, false);
    assert.match(String(intent.accountHint), /ACME/i);
  });

  it('defers show/list deals and amount filters to legacy CRM data ask', () => {
    assert.equal(needsLegacyCrmDataAsk('Show Vtiger CRM deals'), true);
    assert.equal(needsLegacyCrmDataAsk('Give me the list of deals which are having amount 10K$'), true);
    const show = analyzeIntent({ question: 'Show Vtiger CRM deals', memory: {} });
    assert.equal(show.deferToLegacy, true);
    assert.equal(isMvpPipelineIntent(show), false);
    const amt = analyzeIntent({
      question: 'Give me the list of deals which are having amount 10K$',
      memory: {},
    });
    assert.equal(amt.deferToLegacy, true);
  });

  it('extracts account from Show X deals', () => {
    assert.match(extractAccountHint('Show Vtiger CRM deals'), /Vtiger CRM/i);
  });

  it('classifies sticky CrmListFilter follow-up only', () => {
    const intent = analyzeIntent({
      question: 'only open ones',
      memory: {
        sticky: true,
        lastIntent: 'CrmListFilter',
        anchors: ['ACME'],
        accountHint: 'ACME',
        filters: { status: 'open' },
      },
    });
    assert.equal(intent.intent, 'CrmListFilter');
    assert.ok(isMvpPipelineIntent(intent));
  });

  it('defers non-MVP intents', () => {
    const intent = analyzeIntent({
      question: 'Draft an email to Prabhu about the renewal',
      memory: {},
    });
    assert.equal(intent.deferToLegacy, true);
    assert.equal(isMvpPipelineIntent(intent), false);
  });
});

describe('Astra QueryPlanner', () => {
  it('plans SearchProductCatalog + SearchKnowledgeBase for ProductHowTo', () => {
    const intent = analyzeIntent({
      question: 'How do I create a quote from a deal?',
      memory: {},
    });
    assert.equal(intent.intent, 'ProductHowTo');
    const plan = planQuery({
      intentResult: intent,
      memory: { effectiveQuestion: 'How do I create a quote from a deal?' },
    });
    assert.equal(plan.clarifyOnly, false);
    assert.ok(plan.steps.length >= 2);
    assert.equal(plan.steps[0].tool, 'SearchProductCatalog');
    assert.ok(plan.steps.some((s) => s.tool === 'SearchKnowledgeBase'));
  });

  it('ProductHowTo convert deal→quote requests required fields for both modules', () => {
    const intent = analyzeIntent({
      question: 'How do I convert a deal to a quote, and which fields are required on each?',
      memory: {},
    });
    assert.equal(intent.intent, 'ProductHowTo');
    const plan = planQuery({
      intentResult: intent,
      memory: {
        effectiveQuestion: 'How do I convert a deal to a quote, and which fields are required on each?',
      },
    });
    const catalog = plan.steps.find((s) => s.tool === 'SearchProductCatalog');
    assert.ok(catalog);
    assert.equal(catalog.input.preferRequired, true);
    assert.ok(catalog.input.moduleKeys.includes('deals'));
    assert.ok(catalog.input.moduleKeys.includes('quotes'));
    assert.ok(plan.steps.some((s) => s.tool === 'SearchProcessGraphs'));
    assert.ok((plan.success_criteria || []).includes('required_fields_from_catalog'));
  });

  it('plans multi-hop CRM tools for CustomerHealthAnalysis', () => {
    const intent = analyzeIntent({
      question: 'How healthy is ACME?',
      memory: {},
    });
    const plan = planQuery({
      intentResult: intent,
      memory: { effectiveQuestion: 'How healthy is ACME?' },
    });
    const tools = plan.steps.map((s) => s.tool);
    assert.ok(tools.includes('SearchAccounts'));
    assert.ok(tools.includes('SearchTickets'));
    assert.ok(tools.includes('SearchActivities'));
    assert.ok(tools.includes('SearchDeals'));
    assert.ok(tools.includes('SearchKnowledgeBase'));
    const tickets = plan.steps.find((s) => s.tool === 'SearchTickets');
    assert.deepEqual(tickets.dependsOn, ['acct1']);
    assert.equal(tickets.input.filters.status, 'open');
    assert.ok((plan.success_criteria || []).includes('account_resolved'));
  });

  it('classifies ProductExpertise for module/field asks', () => {
    const intent = analyzeIntent({
      question: 'What modules are enabled in Sales?',
      memory: {},
    });
    assert.equal(intent.intent, 'ProductExpertise');
    assert.ok(isMvpPipelineIntent(intent));
    const plan = planQuery({
      intentResult: intent,
      memory: { effectiveQuestion: 'What modules are enabled in Sales?' },
    });
    assert.equal(plan.steps[0].tool, 'SearchProductCatalog');
  });

  it('plans domain tools for permissions / SLA / API / process asks', () => {
    const perm = planQuery({
      intentResult: analyzeIntent({ question: 'What roles and permissions exist?', memory: {} }),
      memory: { effectiveQuestion: 'What roles and permissions exist?' },
    });
    assert.ok(perm.steps.some((s) => s.tool === 'SearchPermissions'));

    const sla = planQuery({
      intentResult: analyzeIntent({ question: 'List SLA policies and assignment rules', memory: {} }),
      memory: { effectiveQuestion: 'List SLA policies and assignment rules' },
    });
    assert.ok(sla.steps.some((s) => s.tool === 'SearchBusinessRules'));

    const api = planQuery({
      intentResult: analyzeIntent({ question: 'What API endpoints does the platform expose?', memory: {} }),
      memory: { effectiveQuestion: 'What API endpoints does the platform expose?' },
    });
    assert.ok(api.steps.some((s) => s.tool === 'SearchApiMap'));

    const proc = planQuery({
      intentResult: analyzeIntent({ question: 'Show process designer graphs', memory: {} }),
      memory: { effectiveQuestion: 'Show process designer graphs' },
    });
    assert.ok(proc.steps.some((s) => s.tool === 'SearchProcessGraphs'));
  });

  it('SearchApiMap parses server mounts', () => {
    const { parseServerMounts, executeSearchApiMap } = require('../astra/tools/searchApiMap');
    const mounts = parseServerMounts();
    assert.ok(mounts.length > 10);
    assert.ok(mounts.some((m) => m.path.startsWith('/api/')));
    return executeSearchApiMap({ query: 'ai' }).then((out) => {
      assert.ok(out.records.some((r) => String(r.title).includes('/api/ai')));
      assert.ok(out.catalogText.includes('API MAP'));
    });
  });

  it('clarifyOnly when health analysis lacks account', () => {
    const intent = analyzeIntent({
      question: 'How healthy is this customer?',
      memory: {},
    });
    const plan = planQuery({ intentResult: intent, memory: {} });
    assert.equal(plan.clarifyOnly, true);
    assert.ok(plan.clarifying_question);
    assert.equal(plan.steps.length, 0);
  });

  it('plans deals for sticky CrmListFilter', () => {
    const intent = analyzeIntent({
      question: 'only open ones',
      memory: {
        sticky: true,
        lastIntent: 'CrmListFilter',
        anchors: ['ACME'],
        accountHint: 'ACME',
        filters: { status: 'open' },
        lastModuleKey: 'deals',
      },
    });
    const plan = planQuery({
      intentResult: intent,
      memory: {
        accountHint: 'ACME',
        filters: { status: 'open' },
        lastModuleKey: 'deals',
        effectiveQuestion: 'only open ones',
      },
    });
    assert.equal(plan.steps[0].tool, 'SearchDeals');
    assert.equal(plan.steps[0].input.filters.status, 'open');
  });

  it('proactive at-risk account scan skips clarify and fans out tools', () => {
    const intent = analyzeIntent({
      question: 'Which accounts are at risk?',
      memory: {},
    });
    assert.equal(intent.intent, 'CustomerHealthAnalysis');
    assert.equal(intent.needs_clarification, false);
    assert.equal(intent.proactiveScan, true);
    const plan = planQuery({
      intentResult: intent,
      memory: { effectiveQuestion: 'Which accounts are at risk?' },
    });
    const tools = plan.steps.map((s) => s.tool);
    assert.ok(tools.includes('SearchTickets'));
    assert.ok(tools.includes('SearchDeals'));
    assert.ok(!plan.steps.some((s) => s.tool === 'SearchAccounts'));
    assert.ok((plan.success_criteria || []).includes('scan_open_tickets_and_deals'));
  });

  it('stalled deals defer to CRM diagnostic path', () => {
    const intent = analyzeIntent({
      question: 'Show stalled deals that are not moving',
      memory: {},
    });
    assert.equal(intent.deferToLegacy, true);
    assert.equal(intent.route_hint, 'crm_data');
  });
});

describe('Astra conversation memory', () => {
  it('applies open filter and sticky account on follow-up', () => {
    const history = [
      { role: 'user', content: 'Show ACME Corp deals' },
      { role: 'assistant', content: 'Here are ACME Corp deals' },
    ];
    const memory = buildConversationMemory({
      question: 'only open ones',
      history,
    });
    assert.equal(memory.filters.status, 'open');
    assert.ok(memory.anchors.length >= 1 || memory.accountHint);
  });

  it('remembers module, amount, and visual type across turns', () => {
    const history = [
      { role: 'user', content: 'List deals over 10K$ as a pie chart' },
      { role: 'assistant', content: 'Here is the pie' },
    ];
    const memory = buildConversationMemory({
      question: 'only open ones',
      history,
    });
    assert.equal(memory.lastModuleKey, 'deals');
    assert.equal(memory.lastVisualType, 'pie');
    assert.equal(memory.filters.amountGte, 10000);
    assert.equal(memory.filters.status, 'open');
    assert.equal(memory.sticky, true);
  });
});

describe('Astra tools registry', () => {
  before(() => {
    ensureToolsLoaded();
  });

  it('registers product config tools', () => {
    for (const name of [
      'SearchAccounts',
      'SearchDeals',
      'SearchTickets',
      'SearchActivities',
      'SearchKnowledgeBase',
      'SearchProductCatalog',
      'SearchAutomations',
      'SearchProcessGraphs',
      'SearchPermissions',
      'SearchBusinessRules',
      'SearchApiMap',
    ]) {
      assert.equal(isRegisteredTool(name), true, name);
    }
    assert.ok(listTools().length >= 11);
  });

  it('validates required tool inputs', () => {
    const bad = validateToolInput(
      { type: 'object', required: ['query'], properties: { query: { type: 'string' } } },
      {},
    );
    assert.equal(bad.ok, false);
    const good = validateToolInput(
      { type: 'object', required: ['query'], properties: { query: { type: 'string' } } },
      { query: 'ACME' },
    );
    assert.equal(good.ok, true);
  });

  it('filters open deals', () => {
    const rows = [
      { title: 'A', subtitle: 'Proposal • $10' },
      { title: 'B', subtitle: 'Closed Won • $20' },
    ];
    const open = applyDealFilters(rows, { status: 'open' });
    assert.equal(open.length, 1);
    assert.equal(open[0].title, 'A');
  });
});

describe('Astra ContextBuilder + Response', () => {
  it('builds context with citations and missing info', () => {
    const pack = buildContextPack({
      question: 'How healthy is ACME?',
      intentResult: {
        intent: 'CustomerHealthAnalysis',
        required_information: ['Account', 'SupportTickets'],
      },
      memory: { anchors: ['ACME'] },
      toolResults: [
        {
          tool: 'SearchAccounts',
          stepId: 'acct1',
          ok: true,
          data: { records: [{ id: '1', type: 'organizations', title: 'ACME' }] },
          citations: [{ sourceType: 'organizations', sourceId: '1', excerpt: 'ACME' }],
        },
        {
          tool: 'SearchTickets',
          stepId: 'ticket1',
          ok: true,
          data: { records: [] },
          citations: [],
        },
      ],
    });
    assert.ok(pack.contextText.includes('ACME'));
    assert.equal(pack.citations.length, 1);
    assert.ok(pack.missingInformation.includes('SupportTickets'));
  });

  it('generates sectioned response from reasoning', () => {
    const reasoning = fallbackReasoning({
      citations: [{ index: 1, sourceType: 'organizations', sourceId: '1', excerpt: 'ACME' }],
      missingInformation: ['SupportTickets'],
    });
    const body = sectionBody(reasoning);
    assert.ok(body.includes('Summary') || body.includes('Key Findings'));
    const out = generateResponse({
      reasoning,
      citations: [{ sourceType: 'organizations', sourceId: '1', excerpt: 'ACME' }],
    });
    assert.ok(out.structured.headline);
    assert.ok(out.structured.sections);
  });

  it('returns clarifying response', () => {
    const out = generateResponse({
      clarifyingQuestion: 'Which account should I analyze?',
      citations: [],
    });
    assert.ok(out.structured.clarifyingQuestions.includes('Which account should I analyze?'));
  });
});

describe('Astra pipeline E2E (mocked tools/LLM)', () => {
  it('ProductHowTo plan → context from catalog + KB', () => {
    const intent = analyzeIntent({
      question: 'How do I convert a deal to a quote?',
      memory: {},
    });
    const plan = planQuery({
      intentResult: intent,
      memory: { effectiveQuestion: 'How do I convert a deal to a quote?' },
    });
    const toolResults = [
      {
        tool: 'SearchProductCatalog',
        stepId: 'catalog1',
        ok: true,
        data: {
          apps: [{ appKey: 'SALES', name: 'Sales' }],
          modules: [{ appKey: 'SALES', moduleKey: 'deals', label: 'Deals' }],
          fields: [{ key: 'amount', label: 'Amount', dataType: 'currency' }],
          catalogText: 'LIVE PRODUCT CATALOG\nModules:\n- [SALES] Deals (moduleKey=deals)',
          citations: [
            { sourceType: 'product_module', sourceId: 'SALES:deals', excerpt: 'Deals' },
          ],
        },
        citations: [
          { sourceType: 'product_module', sourceId: 'SALES:deals', excerpt: 'Deals' },
        ],
      },
      {
        tool: 'SearchKnowledgeBase',
        stepId: 'kb1',
        ok: true,
        data: {
          excerpts: [
            {
              index: 1,
              sourceType: 'document',
              sourceId: 'doc1',
              excerpt: 'Open the deal and click Convert to Quote.',
              score: 0.9,
            },
          ],
          citations: [
            {
              sourceType: 'document',
              sourceId: 'doc1',
              excerpt: 'Open the deal and click Convert to Quote.',
              score: 0.9,
            },
          ],
        },
        citations: [
          {
            sourceType: 'document',
            sourceId: 'doc1',
            excerpt: 'Open the deal and click Convert to Quote.',
            score: 0.9,
          },
        ],
      },
    ];
    const pack = buildContextPack({
      question: 'How do I convert a deal to a quote?',
      intentResult: intent,
      memory: {},
      toolResults,
    });
    assert.ok(pack.contextText.includes('LIVE PRODUCT CATALOG') || pack.contextText.includes('Deals'));
    assert.ok(pack.contextText.includes('Convert to Quote'));
    assert.ok(pack.citations.length >= 1);
    const reasoning = {
      summary: 'Convert from the deal record.',
      keyFindings: ['Use Convert to Quote on the deal.'],
      evidence: ['[1] Open the deal and click Convert to Quote.'],
      recommendations: [],
      nextSteps: ['Open the deal record'],
      risks: [],
      missingInformation: [],
      unsupportedClaims: [],
      actions: [],
    };
    const response = generateResponse({ reasoning, citations: pack.citations });
    assert.match(response.answer || response.structured.detail, /Convert/i);
    assert.equal(plan.steps[0].tool, 'SearchProductCatalog');
    assert.equal(plan.steps[1].tool, 'SearchKnowledgeBase');
  });

  it('CrmListFilter follow-up applies open filter in plan input', () => {
    const history = [
      { role: 'user', content: 'Show ACME deals' },
      { role: 'assistant', content: 'Listed ACME deals' },
    ];
    const memory = buildConversationMemory({ question: 'only open ones', history });
    const intent = analyzeIntent({
      question: 'only open ones',
      memory: { ...memory, lastIntent: 'CrmListFilter' },
    });
    assert.equal(intent.intent, 'CrmListFilter');
    const plan = planQuery({
      intentResult: intent,
      memory: { ...memory, effectiveQuestion: 'only open ones' },
    });
    assert.equal(plan.steps[0].input.filters.status, 'open');
  });
});
