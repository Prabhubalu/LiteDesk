'use strict';

/**
 * Lightweight eval / fidelity checks for Astra Studio generate & mutate.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildTemplateOps, TEMPLATE_META } = require('../templates');
const { inferCanvasType, instructionToOps } = require('../../astra/tools/canvasTools');
const {
  createEmptyCanvasDoc,
  applyCanvasOps,
  summarizeDoc,
  encodeDoc,
  docFromState,
  listWidgets,
} = require('../yjsDocument');
const { canEditCanvas, canViewCanvas, resolveCanvasRole } = require('../canvasAcl');
const { suggestionForEvent, canvasTouchesEntity } = require('../automationService');

describe('astraStudio templates', () => {
  it('exposes all PRD template meta entries', () => {
    assert.ok(TEMPLATE_META.length >= 13);
  });

  it('builds ops for every canvas type', () => {
    for (const { key } of TEMPLATE_META) {
      const built = buildTemplateOps(key, { title: 'T', focus: [] });
      assert.ok(built.titleHint);
      assert.ok(Array.isArray(built.ops));
      if (key !== 'blank') {
        assert.ok(built.ops.length > 0, `${key} should produce ops`);
      }
    }
  });
});

describe('astraStudio yjsDocument', () => {
  it('round-trips state and applies ops', () => {
    const doc = createEmptyCanvasDoc();
    applyCanvasOps(doc, [
      {
        op: 'addWidget',
        widget: {
          id: 'w1',
          type: 'ai.summary',
          frame: { x: 0, y: 0, w: 100, h: 100, z: 1 },
          config: { title: 'S' },
        },
      },
    ]);
    const summary = summarizeDoc(doc);
    assert.equal(summary.widgetCount, 1);
    const buf = encodeDoc(doc);
    const again = docFromState(buf);
    assert.equal(listWidgets(again).length, 1);
  });
});

describe('astraStudio canvas type classify helpers', () => {
  const { normalizeTypeKey } = require('../classifyCanvasType');

  it('parses raw LLM type keys', () => {
    assert.equal(normalizeTypeKey('meeting_preparation'), 'meeting_preparation');
    assert.equal(normalizeTypeKey('Type: opportunity_war_room'), 'opportunity_war_room');
    assert.equal(normalizeTypeKey('"customer_360"'), 'customer_360');
    assert.equal(normalizeTypeKey('nope'), '');
  });
});

describe('astraStudio canvas tools helpers', () => {
  it('infers canvas types from prompts', () => {
    assert.equal(inferCanvasType('Prepare me for tomorrow meeting'), 'meeting_preparation');
    assert.equal(inferCanvasType("prepare meetng with 'Prabhu Balu'"), 'meeting_preparation');
    assert.equal(inferCanvasType('Build opportunity war room'), 'opportunity_war_room');
    assert.equal(inferCanvasType('Analyze this customer'), 'customer_360');
    assert.equal(
      inferCanvasType('Build a meeting preparation workspace to finish: Advance MR54QYTA-2 to Proposal'),
      'opportunity_war_room',
    );
    assert.equal(inferCanvasType('Something vague about work'), 'blank');
  });

  it('maps instructions to mutate ops', () => {
    const ops = instructionToOps('Add a risk section please');
    assert.ok(ops.some((o) => o.widget?.type === 'ai.risk'));
  });

  it('updates existing widget type instead of duplicating', () => {
    const { resolveWidgetIntent } = require('../../astra/tools/canvasTools');
    const intent = resolveWidgetIntent('Update the risks with contract delays', [
      { id: 'w1', type: 'ai.risk', config: { title: 'Risks' } },
    ]);
    assert.equal(intent.mode, 'update');
    assert.equal(intent.type, 'ai.risk');
    assert.equal(intent.existingId, 'w1');
    assert.deepEqual(instructionToOps('Update the risks', [
      { id: 'w1', type: 'ai.risk' },
    ]), []);
  });

  it('binds intent to explicitly selected widget id', () => {
    const { resolveWidgetIntent } = require('../../astra/tools/canvasTools');
    const intent = resolveWidgetIntent('Make this more actionable', [
      { id: 'w-tasks', type: 'content.checklist', config: { title: 'Open tasks' } },
      { id: 'w-risk', type: 'ai.risk', config: { title: 'Risks' } },
    ], { targetWidgetId: 'w-tasks' });
    assert.equal(intent.mode, 'update');
    assert.equal(intent.existingId, 'w-tasks');
    assert.equal(intent.type, 'content.checklist');
    assert.equal(intent.title, 'Open tasks');
  });
});

describe('astraStudio ACL', () => {
  const canvas = {
    permissions: {
      ownerId: 'owner1',
      editorIds: ['ed1'],
      viewerIds: ['v1'],
      linkShare: { enabled: true, role: 'viewer', token: 'tok' },
    },
  };

  it('resolves roles', () => {
    assert.equal(resolveCanvasRole(canvas, 'owner1'), 'owner');
    assert.equal(resolveCanvasRole(canvas, 'ed1'), 'editor');
    assert.equal(resolveCanvasRole(canvas, 'v1'), 'viewer');
    assert.equal(canEditCanvas(canvas, 'ed1'), true);
    assert.equal(canEditCanvas(canvas, 'v1'), false);
    assert.equal(canViewCanvas(canvas, 'stranger', { linkToken: 'tok' }), true);
  });
});

describe('astraStudio automation', () => {
  it('suggests on case escalation', () => {
    const s = suggestionForEvent({ eventType: 'case.escalated', entityId: '1' });
    assert.ok(s);
    assert.equal(s.actionType, 'add_risk_widget');
  });

  it('matches canvas focus to entity', () => {
    const canvas = {
      focus: [{ moduleKey: 'deals', recordId: 'abc' }],
      yjsState: null,
    };
    assert.equal(
      canvasTouchesEntity(canvas, { entityType: 'deal', entityId: 'abc', eventType: 'deal.updated' }),
      true
    );
  });
});

describe('astraStudio hydrate hints', () => {
  const {
    extractEntityHint,
    bestSearchHit,
    focusMatchesHint,
  } = require('../canvasHydrateService');
  const { buildPeopleNameOrConditions } = require('../../../utils/searchRelevance');

  it('extracts quoted names from meeting prompts', () => {
    assert.equal(
      extractEntityHint("Prepare for a meeting with 'Prabhu Balu'"),
      'Prabhu Balu'
    );
  });

  it('extracts with/for phrases', () => {
    assert.ok(/Acme/i.test(extractEntityHint('Build an opportunity war room for Acme')));
  });

  it('builds first+last AND clauses for multi-token people search', () => {
    const or = buildPeopleNameOrConditions('Prabhu Balu');
    const andClause = or.find((c) => c.$and);
    assert.ok(andClause, 'expected $and first/last pair');
    assert.equal(andClause.$and.length, 2);
    assert.ok(andClause.$and[0].first_name);
    assert.ok(andClause.$and[1].last_name);
  });

  it('picks exact name over first search hit', () => {
    const hit = bestSearchHit(
      [
        { id: '1', title: 'Prabhu Other' },
        { id: '2', title: 'Prabhu Balu' },
      ],
      'Prabhu Balu',
    );
    assert.equal(hit.id, '2');
  });

  it('detects focus/hint mismatch', () => {
    assert.equal(
      focusMatchesHint(
        [{ moduleKey: 'people', recordId: '1', recordName: 'Someone Else' }],
        'Prabhu Balu',
      ),
      false,
    );
    assert.equal(
      focusMatchesHint(
        [{ moduleKey: 'people', recordId: '1', recordName: 'Prabhu Balu' }],
        'Prabhu Balu',
      ),
      true,
    );
  });

  it('does not treat deal titles as person names', () => {
    const { looksLikePersonNameHint, wantsDealFocus } = require('../canvasHydrateService');
    assert.equal(looksLikePersonNameHint('Sample Deal'), false);
    assert.equal(looksLikePersonNameHint('Prabhu Balu'), true);
    assert.equal(looksLikePersonNameHint('Vtiger CRM'), false);
    assert.equal(wantsDealFocus("Build an opportunity war room for 'Sample Deal'"), true);
  });
});

describe('astraStudio specialist widget fill', () => {
  const {
    resolveSpecialistForWidget,
    normalizeAnswerToBody,
    bodyToChecklistItems,
    buildSpecialistQuery,
    STUDIO_FILL_SURFACE,
  } = require('../specialistWidgetFill');

  it('maps widget types to specialist agents', () => {
    assert.equal(resolveSpecialistForWidget({ type: 'ai.risk' }), 'deal-intelligence');
    assert.equal(resolveSpecialistForWidget({ type: 'ai.insights' }), 'relationship-intelligence');
    assert.equal(resolveSpecialistForWidget({ type: 'ai.summary' }), 'meeting-intelligence');
    assert.equal(resolveSpecialistForWidget({ type: 'ai.recommendations' }), 'deal-intelligence');
    assert.equal(resolveSpecialistForWidget({ type: 'ai.nba' }), 'workday-orchestrator');
    assert.equal(resolveSpecialistForWidget({ type: 'content.checklist' }), 'task-activity');
    assert.equal(
      resolveSpecialistForWidget({ type: 'ai.custom', config: { title: 'Stakeholders' } }),
      'relationship-intelligence',
    );
  });

  it('normalizes specialist answers into bullets', () => {
    const body = normalizeAnswerToBody(
      'Here is what I found:\n```\n1. Contract delay: legal hold\n- Budget timing\n```',
    );
    assert.ok(body.includes('• Contract delay: legal hold'));
    assert.ok(body.includes('• Budget timing'));
    assert.ok(!body.toLowerCase().includes('here is'));
  });

  it('strips module objectIds and placeholder tokens from panel bodies', () => {
    const { scrubInternalIds } = require('../specialistWidgetFill');
    const body = normalizeAnswerToBody(
      'FOCUS\n'
      + '• people:6a42bff642aef9242b2b1f21 - Joined Helpdesk as Customer\n'
      + '• [quotes] iPhone 17 Pro Max · QT-0003\n'
      + '• Move: Confirm champion',
      'win_strategy',
    );
    assert.ok(!/6a42bff642aef9242b2b1f21/i.test(body));
    assert.ok(!/people:/i.test(body));
    assert.ok(!/\[quotes\]/i.test(body));
    assert.ok(/Joined Helpdesk as Customer/i.test(body));
    assert.ok(/iPhone 17 Pro Max/i.test(body));
    assert.equal(
      scrubInternalIds('people:6a42bff642aef9242b2b1f21 - updated core information'),
      'updated core information',
    );
  });

  it('parses checklist items from body', () => {
    const items = bodyToChecklistItems('• Confirm attendees\n• Review open deals');
    assert.equal(items.length, 2);
    assert.equal(items[0].label, 'Confirm attendees');
    assert.equal(items[0].done, false);
  });

  it('builds org-scoped executive queries without party focus', () => {
    const q = buildSpecialistQuery(
      { type: 'ai.summary', config: { title: 'Executive summary' } },
      'Build an executive report for this quarter pipeline and revenue',
      [],
      'PIPELINE SNAPSHOT:\n- Open deals: 3',
      'executive_report',
      'Arivu',
    );
    assert.ok(/organization-wide executive|ORGANIZATION pipeline/i.test(q));
    assert.ok(!/opportunity war room/i.test(q));
  });

  it('keeps buying signals distinct from stakeholder map', () => {
    const { panelKind } = require('../specialistWidgetFill');
    assert.equal(
      panelKind({ type: 'ai.insights', config: { title: 'Buying signals' } }),
      'buying_signals',
    );
    assert.equal(
      panelKind({ type: 'viz.relationship_graph', config: { title: 'Stakeholder map' } }),
      'stakeholders',
    );
    const signals = buildSpecialistQuery(
      { type: 'ai.insights', config: { title: 'Buying signals' } },
      "Build an opportunity war room for 'Sample Deal'",
      [{ moduleKey: 'deals', recordId: '1', recordName: 'Sample Deal' }],
      '',
      'opportunity_war_room',
    );
    const stakeholders = buildSpecialistQuery(
      { type: 'viz.relationship_graph', config: { title: 'Stakeholder map' } },
      "Build an opportunity war room for 'Sample Deal'",
      [{ moduleKey: 'deals', recordId: '1', recordName: 'Sample Deal' }],
      '',
      'opportunity_war_room',
    );
    assert.ok(/buying signals|anti-signals/i.test(signals));
    assert.ok(/stakeholders/i.test(stakeholders));
    assert.ok(/war room/i.test(signals));
    assert.ok(/not a meeting-prep/i.test(signals));
    assert.notEqual(signals.split('SITUATION')[0], stakeholders.split('SITUATION')[0]);
  });

  it('prefers named party from prompt when focus is empty', () => {
    const q = buildSpecialistQuery(
      { type: 'ai.summary', config: { title: 'Meeting agenda' } },
      "Prepare a meeting with 'Prabhu Balu'",
      [],
    );
    assert.ok(/Prabhu Balu/i.test(q));
  });

  it('rejects thin-playbook seat dumps as empty bodies', () => {
    const dump = 'Studio · Meeting Preparation — ran 3 seats:\n1. [meeting-intelligence] Seat meeting-intelligence (prep) — no runner yet.\n\nHandoffs: a→b';
    assert.equal(normalizeAnswerToBody(dump), '');
  });

  it('strips meeting dump sections from buying-signal answers', () => {
    const body = normalizeAnswerToBody(
      '• Signal: quote expired\nSituation for Your Meeting: long dump about prep\n• Next move: refresh quote',
      'buying_signals',
    );
    assert.ok(/Signal: quote expired/i.test(body));
    assert.ok(!/Situation for Your Meeting/i.test(body));
  });

  it('rejects meta-reasoning and ReportsE2E noise as empty bodies', () => {
    assert.equal(
      normalizeAnswerToBody(
        'I need the contact name to ground stakeholders. THE SITUATION BRIEF shows ReportsE2E Event MR54T40F-3.',
      ),
      '',
    );
  });
});

describe('astraStudio related expansion', () => {
  const { expandRelatedRecords, normalizeModule } = require('../../astra/context/expandRelatedRecords');

  it('normalizes module keys', () => {
    assert.equal(normalizeModule('contact'), 'people');
    assert.equal(normalizeModule('account'), 'organizations');
    assert.equal(normalizeModule('deal'), 'deals');
  });

  it('keeps seed related when DB expansion finds nothing', async () => {
    const related = await expandRelatedRecords({
      organizationId: '507f1f77bcf86cd799439011',
      moduleKey: 'people',
      recordId: '507f1f77bcf86cd799439012',
      related: [
        { moduleKey: 'organizations', id: 'o1', title: 'Acme' },
        { moduleKey: 'deals', id: 'd1', title: 'Acme Deal' },
      ],
    });
    assert.ok(related.some((r) => r.moduleKey === 'organizations' && r.id === 'o1'));
    assert.ok(related.some((r) => r.moduleKey === 'deals' && r.id === 'd1'));
  });
});

describe('astraStudio canvas situation brief helpers', () => {
  const {
    mergeFocusFromSituation,
    timelineItemsFromSituation,
    commsItemsFromSituation,
    scrubSituationNoise,
  } = require('../canvasSituationBrief');

  it('merges related deals/orgs into focus', () => {
    const merged = mergeFocusFromSituation(
      [{ moduleKey: 'people', recordId: 'p1', recordName: 'Prabhu Balu' }],
      {
        focus: { moduleKey: 'people', id: 'p1', title: 'Prabhu Balu' },
        related: [
          { moduleKey: 'deals', id: 'd1', title: 'Acme Deal' },
          { moduleKey: 'organizations', id: 'o1', title: 'Acme' },
        ],
      },
    );
    assert.ok(merged.some((f) => f.moduleKey === 'deals' && f.recordId === 'd1'));
    assert.ok(merged.some((f) => f.moduleKey === 'organizations' && f.recordId === 'o1'));
    assert.equal(merged[0].moduleKey, 'people');
  });

  it('does not promote unrelated events into party focus', () => {
    const merged = mergeFocusFromSituation(
      [{ moduleKey: 'people', recordId: 'p1', recordName: 'Prabhu Balu' }],
      {
        related: [
          { moduleKey: 'events', id: 'e1', title: 'ReportsE2E Event MR54T40F-3' },
          { moduleKey: 'deals', id: 'd1', title: 'Real deal' },
        ],
      },
    );
    assert.ok(!merged.some((f) => f.moduleKey === 'events'));
    assert.ok(merged.some((f) => f.moduleKey === 'deals'));
  });

  it('seeds org from canvas focus when relationship graph is empty', () => {
    const { seedRelatedFromCanvasFocus } = require('../canvasSituationBrief');
    const situation = { related: [] };
    seedRelatedFromCanvasFocus(situation, [
      { moduleKey: 'people', recordId: 'p1', recordName: 'Prabhu Balu' },
      { moduleKey: 'organizations', recordId: 'o1', recordName: 'Acme' },
    ]);
    assert.equal(situation.related.length, 1);
    assert.equal(situation.related[0].moduleKey, 'organizations');
    assert.equal(situation.related[0].id, 'o1');
  });

  it('scrubs E2E calendar noise from situation related + llmText', () => {
    const situation = {
      related: [
        { moduleKey: 'events', id: 'e1', title: 'ReportsE2E Event MR54T40F-3' },
        { moduleKey: 'events', id: 'e2', title: 'Sync with Prabhu Balu' },
        { moduleKey: 'deals', id: 'd1', title: 'Acme' },
      ],
      llmText: [
        'Open ReportsE2E Event MR54T40F-3',
        'Scheduled standup sync tomorrow',
        'Email: Following up',
        'Sync with Prabhu Balu on Tuesday',
      ].join('\n'),
    };
    scrubSituationNoise(situation, 'Prabhu Balu');
    assert.ok(!situation.related.some((r) => /ReportsE2E/i.test(r.title)));
    assert.ok(situation.related.some((r) => /Prabhu/i.test(r.title)));
    assert.ok(situation.related.some((r) => r.moduleKey === 'deals'));
    assert.ok(!/ReportsE2E/i.test(situation.llmText));
    assert.ok(!/standup sync/i.test(situation.llmText));
    assert.ok(/Following up/i.test(situation.llmText));
  });

  it('builds timeline and comms seeds from situation', () => {
    const situation = {
      focus: { title: 'Prabhu Balu' },
      activities: [{ message: 'Called about renewal', at: '2026-07-01T00:00:00.000Z', source: 'people:p1' }],
      communications: [{ subject: 'Re: Business plan', direction: 'email' }],
      related: [{ moduleKey: 'events', id: 'e1', title: 'Kickoff call' }],
    };
    const timeline = timelineItemsFromSituation(situation);
    assert.ok(timeline.some((t) => /Called about renewal/i.test(t.label)));
    const comms = commsItemsFromSituation(situation);
    assert.equal(comms[0].label, 'Re: Business plan');
  });

  it('does not invent timeline rows when CRM is empty', () => {
    const timeline = timelineItemsFromSituation({ focus: { title: 'Prabhu' }, activities: [], related: [] });
    assert.equal(timeline.length, 0);
  });

  it('seeds open tasks and KPI metrics from CRM related only', () => {
    const {
      openTaskItemsFromSituation,
      kpiMetricsFromSituation,
      signalBulletsFromSituation,
      riskBulletsFromSituation,
    } = require('../canvasSituationBrief');
    const situation = {
      focus: { title: 'Sample Deal', moduleKey: 'deals' },
      related: [
        { moduleKey: 'tasks', id: 't1', title: 'Send revised quote', status: 'open' },
        { moduleKey: 'tasks', id: 't2', title: 'Done already', status: 'completed' },
        { moduleKey: 'quotes', id: 'q1', title: 'QT-100', status: 'expired' },
        { moduleKey: 'deals', id: 'd1', title: 'Sample Deal', status: 'Negotiation' },
        { moduleKey: 'cases', id: 'c1', title: 'Billing dispute', status: 'open' },
      ],
      communications: [{ subject: 'Re: pricing', direction: 'inbound' }],
      activities: [{ message: 'Logged call', at: '2026-06-01T00:00:00.000Z' }],
    };
    const tasks = openTaskItemsFromSituation(situation);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].label, 'Send revised quote');
    const kpi = kpiMetricsFromSituation(situation, [{ moduleKey: 'deals', recordName: 'Sample Deal' }], 'Relationship score');
    assert.ok(kpi.some((m) => m.label === 'Focus'));
    assert.ok(kpi.some((m) => m.label === 'Open tasks' && m.value === '1'));
    assert.ok(!kpi.some((m) => m.value === 'Confirm' || m.value === 'Check'));
    const signals = signalBulletsFromSituation(situation);
    assert.ok(/QT-100/i.test(signals));
    assert.ok(/Inbound email/i.test(signals));
    const risks = riskBulletsFromSituation(situation);
    assert.ok(/QT-100/i.test(risks));
    assert.ok(/Billing dispute/i.test(risks));
  });
});