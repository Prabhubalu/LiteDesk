'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isReportBuilderQuestion,
  isUnderspecifiedReportQuestion,
  isReportModuleFollowUp,
  mayUsePageModuleHint,
  buildDraftSpec,
  detectModuleKey,
  resolveReportModuleKey,
} = require('../aiAstraReportBuilderService');
const { normalizeStructuredAnswer } = require('../aiWorkGraphService');

describe('aiAstraReportBuilderService', () => {
  it('detects create/build/save report intents', () => {
    assert.equal(isReportBuilderQuestion('Create a tasks by status report I can edit'), true);
    assert.equal(isReportBuilderQuestion('Build me a deals by stage report'), true);
    assert.equal(isReportBuilderQuestion('Save this as a report in Report Builder'), true);
    assert.equal(isReportBuilderQuestion('Open report builder for cases'), true);
    assert.equal(isReportBuilderQuestion('task matrix report'), true);
    assert.equal(isReportBuilderQuestion('Generate task metrix report'), true);
    assert.equal(isReportBuilderQuestion('Create report'), true);
  });

  it('treats vague Create report as underspecified — no silent deals default', () => {
    assert.equal(isUnderspecifiedReportQuestion('Create report'), true);
    assert.equal(isUnderspecifiedReportQuestion('Create a report'), true);
    assert.equal(isUnderspecifiedReportQuestion('new report'), true);
    assert.equal(isUnderspecifiedReportQuestion('Create a tasks by status report'), false);
    assert.equal(isUnderspecifiedReportQuestion('Create a report for this list'), false);
    assert.equal(mayUsePageModuleHint('Create a report for this list'), true);
    assert.equal(mayUsePageModuleHint('Create report'), false);
    assert.equal(resolveReportModuleKey('Create report', 'deals'), '');
    assert.equal(resolveReportModuleKey('Create a report for this page', 'deals'), 'deals');
    assert.equal(buildDraftSpec({ question: 'Create report', moduleKey: 'deals' }), null);
    const followUp = isReportModuleFollowUp('tasks', [
      {
        role: 'assistant',
        content: 'What should this report cover?',
        structured: {
          headline: 'What should this report cover?',
          clarifyingQuestions: ['Which module should the report use (tasks, deals, cases, …)?'],
        },
      },
    ]);
    assert.equal(followUp, true);
    const afterClarify = buildDraftSpec({ question: 'Create report: tasks by status' });
    assert.ok(afterClarify);
    assert.equal(
      isReportModuleFollowUp(
        'give me the list of deals which are having amount more than 10K $',
        [{
          role: 'assistant',
          content: 'What should this report cover? I need a bit more detail before creating a real Analytics report',
        }],
      ),
      false,
    );
    assert.equal(detectModuleKey('Generate a report of Dels group by Revenue'), 'deals');
    const revenueAsk = buildDraftSpec({
      question: 'Generate a report of Deal group by Revenue above 10K dollars',
    });
    assert.ok(revenueAsk);
    assert.equal(revenueAsk.type, 'tabular');
    assert.ok(revenueAsk.filterTree?.children?.some((c) => c.fieldKey === 'amount'));
    assert.equal(afterClarify.primaryModule, 'tasks');
  });

  it('does not treat one-off chart glances as builder', () => {
    assert.equal(isReportBuilderQuestion('Give me a pie chart of tasks by status'), false);
    assert.equal(isReportBuilderQuestion('Which deal has more value?'), false);
    assert.equal(isReportBuilderQuestion('Show pipeline overview'), false);
  });

  it('routes create-widget follow-ups away from report draft', () => {
    const { isCreateWidgetQuestion, extractReportIdFromHistory, detectWidgetChartType } = require('../aiAstraReportBuilderService');
    const q = 'Create a Widget for the above report';
    assert.equal(isCreateWidgetQuestion(q), true);
    assert.equal(isReportBuilderQuestion(q), false);
    assert.equal(detectWidgetChartType('make a pie widget'), 'pie');
    const rid = extractReportIdFromHistory([
      {
        role: 'assistant',
        content: 'Draft ready\nreportId=507f1f77bcf86cd799439011',
        actions: [{ kind: 'open_report_builder', recordId: '507f1f77bcf86cd799439011' }],
      },
    ]);
    assert.equal(rid, '507f1f77bcf86cd799439011');
  });

  it('detectModuleKey and buildDraftSpec', () => {
    assert.equal(detectModuleKey('create a tasks report'), 'tasks');
    const spec = buildDraftSpec({ question: 'Create a deals by stage report' });
    assert.ok(spec);
    assert.equal(spec.primaryModule, 'deals');
    assert.equal(spec.groupField, 'stage');
    assert.equal(spec.type, 'summary');
    assert.ok(Array.isArray(spec.rowGroups) && spec.rowGroups[0].field === 'stage');
    assert.ok(Array.isArray(spec.aggregations) && spec.aggregations.length >= 1);
  });

  it('maps donut chart hint and builds preview visuals', () => {
    const {
      detectReportChartHint,
      buildVisualsFromReportPreview,
    } = require('../aiAstraReportBuilderService');
    assert.equal(detectReportChartHint('Chart type Donut'), 'pie');
    const tasksSpec = buildDraftSpec({
      question: 'For Tasks Module, Group by Status, Chart type Donut.',
    });
    assert.ok(tasksSpec);
    assert.equal(tasksSpec.primaryModule, 'tasks');
    assert.equal(tasksSpec.groupField, 'status');
    assert.equal(tasksSpec.chartHint, 'pie');

    const visuals = buildVisualsFromReportPreview(
      {
        result: {
          rows: [
            { status: 'Open', count: 4 },
            { status: 'Done', count: 2 },
          ],
        },
      },
      tasksSpec
    );
    assert.equal(visuals.length, 1);
    assert.equal(visuals[0].component, 'chart');
    assert.equal(visuals[0].chartType, 'pie');
    assert.equal(visuals[0].points.length, 2);
    assert.equal(visuals[0].points[0].label, 'Open');
    assert.equal(visuals[0].points[0].value, 4);

    assert.equal(
      buildVisualsFromReportPreview({ error: 'Not authorized to read module data for this report' }, tasksSpec).length,
      0
    );

    const { wantsLeanVisualReply, leanVisualStructured } = require('../aiAstraReportBuilderService');
    assert.equal(wantsLeanVisualReply('show me a bar chart of deals'), true);
    assert.equal(wantsLeanVisualReply('Create a tasks report'), false);
    const lean = leanVisualStructured({
      headline: 'Pipeline by Stage',
      visuals,
      actions: [
        { kind: 'open_report_builder', label: 'Open' },
        { kind: 'pin_report_to_dashboard', label: 'Pin' },
        { kind: 'publish_report', label: 'Publish' },
      ],
    });
    assert.equal(lean.bullets.length, 0);
    assert.equal(lean.detail, '');
    assert.equal(lean.actions.length, 1);
    assert.equal(lean.actions[0].kind, 'pin_report_to_dashboard');
  });

  it('detects won/lost deal asks that are not "won deals" phrasing', () => {
    const {
      isWonDealAsk,
      isLostDealAsk,
      detectFilters,
      enforceDealOutcomePreview,
      buildDraftSpec,
    } = require('../aiAstraReportBuilderService');

    assert.equal(isWonDealAsk('Give me the listy of Deals which are Won'), true);
    assert.equal(isWonDealAsk('show won deals'), true);
    assert.equal(isWonDealAsk('list open deals'), false);
    assert.equal(isLostDealAsk('deals which are lost'), true);

    const won = detectFilters('Give me the listy of Deals which are Won', 'deals');
    assert.ok(won.filterNotes.some((n) => /won/i.test(n)));
    assert.ok(won.filterTree?.children?.some((c) => c.logic === 'OR' || c.fieldKey === 'status'));

    const spec = buildDraftSpec({
      question: 'Give me the listy of Deals which are Won',
      moduleKey: 'deals',
    });
    assert.ok(spec?.filterTree?.children?.length);
    assert.match(String(spec.name || ''), /won/i);

    const preview = {
      result: {
        rows: [
          { name: 'A', stage: 'Negotiation', status: 'Open', amount: 1 },
          { name: 'B', stage: 'Closed Won', status: 'Won', amount: 2 },
          { name: 'C', stage: 'Won', status: 'Won', amount: 3 },
        ],
      },
    };
    const enforced = enforceDealOutcomePreview(preview, 'Give me the listy of Deals which are Won');
    assert.equal(enforced.result.rows.length, 2);
    assert.ok(enforced.result.rows.every((r) => /won/i.test(r.status) || /won/i.test(r.stage)));
  });

  it('routes closure/diagnostic deal asks to tabular list, not pipeline chart', () => {
    const {
      isCrmDiagnosticAsk,
      isNearCloseDealAsk,
      wantsDealListNotPipelineChart,
      detectReportType,
      detectFilters,
      buildDraftSpec,
    } = require('../aiAstraReportBuilderService');
    const q = 'Tell me which deals are in closure state, and Why is it still not closed. What can be done to expedite the closure.';
    assert.equal(isCrmDiagnosticAsk(q), true);
    assert.equal(isNearCloseDealAsk(q), true);
    assert.equal(wantsDealListNotPipelineChart(q), true);
    assert.equal(detectReportType(q, 'stage'), 'tabular');
    const { filterTree, filterNotes } = detectFilters(q, 'deals');
    assert.ok(filterTree?.children?.some((c) => c.fieldKey === 'stage' && c.operator === 'is_any_of'));
    assert.ok(filterNotes.some((n) => /closing stages/i.test(n)));
    const spec = buildDraftSpec({ question: q, moduleKey: 'deals' });
    assert.ok(spec);
    assert.equal(spec.type, 'tabular');
    assert.equal(spec.groupField || '', '');
    assert.equal(/pipeline by stage/i.test(spec.name || ''), false);
  });

  it('named deal asks filter by name — curly quotes and move-it-forward do not dump pipeline', () => {
    const {
      extractQuotedRecordName,
      isCrmDiagnosticAsk,
      wantsDealListNotPipelineChart,
      detectFilters,
      queryPlanToDraftInput,
    } = require('../aiAstraReportBuilderService');
    const curly = 'Summarize deal \u2018Sample Deal\u2019, risks, and the single best next action to move it forward.';
    const bare = 'Summarize deal Sample Deal, risks, and the single best next action to move it forward.';
    assert.equal(extractQuotedRecordName(curly), 'Sample Deal');
    assert.equal(extractQuotedRecordName(bare), 'Sample Deal');
    assert.equal(isCrmDiagnosticAsk(curly), false);
    assert.equal(wantsDealListNotPipelineChart(curly), false);
    const { filterNotes } = detectFilters(curly, 'deals');
    assert.ok(filterNotes.some((n) => /name contains "Sample Deal"/i.test(n)));
    assert.equal(filterNotes.some((n) => /closing stages|likely to close/i.test(n)), false);
    const draft = queryPlanToDraftInput({
      moduleKey: 'deals',
      wantList: true,
      chartType: 'none',
      chartSliceBy: 'record',
      reportType: 'tabular',
      metric: 'amount',
      filters: [{ fieldKey: 'name', operator: 'contains', value: 'Sample Deal' }],
    }, 'Summarize this deal');
    assert.match(draft.question, /name contains "Sample Deal"/i);
  });

  it('likely-to-close excludes Won/Lost and requires Open + late stages', () => {
    const {
      isLikelyToCloseAsk,
      wantsDealListNotPipelineChart,
      detectFilters,
      enforceDealOutcomePreview,
    } = require('../aiAstraReportBuilderService');
    const q = 'Which deals are likely to get closed?';
    assert.equal(isLikelyToCloseAsk(q), true);
    assert.equal(wantsDealListNotPipelineChart(q), true);
    const { filterTree, filterNotes } = detectFilters(q, 'deals');
    assert.ok(filterTree.children.some((c) => c.fieldKey === 'status' && c.value === 'Open'));
    assert.ok(filterTree.children.some((c) => c.fieldKey === 'stage' && c.operator === 'is_any_of'));
    assert.ok(filterNotes.some((n) => /likely to close/i.test(n)));
    const enforced = enforceDealOutcomePreview({
      result: {
        rows: [
          { name: 'A', stage: 'Negotiation', status: 'Open' },
          { name: 'B', stage: 'Closed Won', status: 'Won' },
          { name: 'C', stage: 'Closed Lost', status: 'Lost' },
          { name: 'D', stage: 'Contract Sent', status: 'Open' },
        ],
      },
    }, q);
    assert.deepEqual(enforced.result.rows.map((r) => r.name), ['A', 'D']);
  });

  it('applies filters, joins, formulas, visibility, schedule from NL', () => {
    const { detectFilters, detectJoins, detectFormulas, detectVisibility, detectSchedule, detectLayoutOptions } = require('../aiAstraReportBuilderService');

    const filters = detectFilters('open high priority tasks overdue', 'tasks');
    assert.ok(filters.filterTree?.children?.length >= 2);
    assert.ok(filters.filterNotes.some((n) => /overdue|priority|closed/i.test(n)));

    const joins = detectJoins('create a deals report with organizations', 'deals');
    assert.ok(joins.relatedModules.includes('organizations'));

    const formulas = detectFormulas('create a deals report with weighted amount formula', 'deals', 'tabular');
    assert.ok(formulas.calculatedFields.some((f) => f.key === 'weighted_amount'));

    assert.equal(detectVisibility('share report with organization').visibility, 'organization');
    assert.equal(detectVisibility('share with Sales Manager role').visibility, 'role');

    const schedule = detectSchedule('Create a weekly CSV report of tasks and email me at a@b.com');
    assert.ok(schedule);
    assert.equal(schedule.frequency, 'weekly');
    assert.equal(schedule.recipientEmail, 'a@b.com');

    const layout = detectLayoutOptions('matrix deals by stage and by assignedTo sort by amount desc pin to dashboard', 'deals', 'stage');
    assert.equal(layout.type, 'matrix');
    assert.ok(layout.columnGroups.length);
    assert.ok(layout.sorting);
    assert.equal(layout.wantsPin, true);

    const full = buildDraftSpec({
      question: 'Create an open deals by stage report with organizations, amount > 1000, share with organization, formula weighted = amount * probability / 100',
    });
    assert.equal(full.primaryModule, 'deals');
    assert.ok(full.filterTree?.children?.length);
    assert.ok(full.relatedModules.includes('organizations'));
    assert.equal(full.visibility, 'organization');
  });

  it('normalizeStructuredAnswer keeps report builder actions + recordId', () => {
    const out = normalizeStructuredAnswer({
      headline: 'Draft ready',
      bullets: ['Created'],
      actions: [
        {
          label: 'Open in Report Builder',
          kind: 'open_report_builder',
          recordId: 'rep123',
          moduleKey: 'analytics_reports',
          fields: { reportId: 'rep123', step: 'fields', autoOpen: false },
          executeNow: false,
        },
        {
          label: 'Pin to dashboard',
          kind: 'pin_report_to_dashboard',
          recordId: 'rep123',
          moduleKey: 'analytics_reports',
        },
        {
          label: 'Export CSV',
          kind: 'export_report',
          recordId: 'rep123',
          moduleKey: 'analytics_reports',
        },
      ],
    }, [], { maxActions: 4 });
    assert.equal(out.actions.length, 3);
    assert.equal(out.actions[0].kind, 'open_report_builder');
    assert.equal(out.actions[0].recordId, 'rep123');
    assert.equal(out.actions[0].fields.autoOpen, false);
    assert.equal(out.actions[1].kind, 'pin_report_to_dashboard');
    assert.equal(out.actions[2].kind, 'export_report');
  });

  it('fuzzy-resolves group-by phrases to catalog fields across modules', () => {
    const {
      detectExplicitGroupField,
      resolveGroupFieldAgainstModule,
      extractGroupByPhrase,
    } = require('../aiAstraReportBuilderService');

    assert.equal(extractGroupByPhrase('Give me Detail reports of Tasks group by type'), 'type');
    assert.equal(detectExplicitGroupField('Give me Detail reports of Tasks group by type', 'tasks'), 'taskType');
    assert.equal(resolveGroupFieldAgainstModule('type', 'tasks'), 'taskType');
    assert.equal(resolveGroupFieldAgainstModule('type', 'cases'), 'caseType');
    assert.equal(resolveGroupFieldAgainstModule('type', 'events'), 'eventType');
    assert.equal(resolveGroupFieldAgainstModule('type', 'items'), 'item_type');
    assert.equal(resolveGroupFieldAgainstModule('type', 'deals'), 'type');
    assert.equal(resolveGroupFieldAgainstModule('owner', 'tasks'), 'assignedTo');
    assert.equal(resolveGroupFieldAgainstModule('channel', 'cases'), 'channel');
    assert.equal(resolveGroupFieldAgainstModule('industry', 'organizations'), 'industry');
    assert.equal(
      detectExplicitGroupField('Cases analysis group by channel', 'cases'),
      'channel'
    );
  });

  it('detects CRM data asks and rejects non-data asks', () => {
    const {
      isCrmDataAsk,
      isThinDataFollowUp,
    } = require('../aiAstraReportBuilderService');

    assert.equal(isCrmDataAsk('give me the list of deals which are having amount more than 10K $'), true);
    assert.equal(isCrmDataAsk('show deals by stage as a pie chart'), true);
    assert.equal(isCrmDataAsk('Give me the same in bar chart'), true);
    assert.equal(isThinDataFollowUp('same in bar chart'), true);
    assert.equal(isCrmDataAsk('draft an email to Prabhu'), false);
    assert.equal(isCrmDataAsk('summarize yesterday meeting notes'), false);
  });

  it('blends sticky prior ask so amount > 10K survives bar-chart follow-up', () => {
    const {
      blendDataAskWithHistory,
      detectReportType,
      detectReportChartHint,
      detectFilters,
      buildDraftSpec,
      validateQueryPlan,
      queryPlanToDraftInput,
    } = require('../aiAstraReportBuilderService');

    const prior = 'give me the list of deals which are having amount more than 10K $';
    const followUp = 'Give me the same in bar chart';
    const blended = blendDataAskWithHistory(followUp, [{ role: 'user', content: prior }]);
    assert.match(blended, /amount more than 10K/i);
    assert.match(blended, /bar chart/i);
    assert.equal(detectReportType(blended), 'summary');
    assert.equal(detectReportChartHint(blended), 'bar');
    const { filterTree } = detectFilters(blended, 'deals');
    assert.ok(filterTree?.children?.some((c) => c.fieldKey === 'amount' && c.operator === 'gte' && Number(c.value) === 10000));
    const spec = buildDraftSpec({ question: blended });
    assert.ok(spec);
    assert.equal(spec.primaryModule, 'deals');
    assert.equal(spec.chartHint, 'bar');
    assert.ok(spec.filterTree?.children?.some((c) => c.fieldKey === 'amount'));

    const plan = validateQueryPlan({
      moduleKey: 'deals',
      reportType: 'summary',
      groupField: 'stage',
      chartType: 'bar',
      metric: 'count',
      filters: [{ fieldKey: 'amount', operator: 'gte', value: 10000 }],
      headlineHint: 'Deals over $10K by stage',
    });
    assert.ok(plan);
    assert.equal(plan.chartType, 'bar');
    const draftInput = queryPlanToDraftInput(plan, blended);
    assert.equal(draftInput.pinSource.moduleKey, 'deals');
    assert.match(draftInput.question, /amount above 10000/i);
  });

  it('sticky only-open follow-up keeps amount + pie (not invented by-stage)', () => {
    const {
      isThinDataFollowUp,
      blendDataAskWithHistory,
      wantsCompoundListAndChart,
      isChartAskWithoutGroup,
      hasExplicitGroupBy,
      detectFilters,
      buildDraftSpec,
      detectReportChartHint,
    } = require('../aiAstraReportBuilderService');

    assert.equal(isThinDataFollowUp('only open ones'), true);
    const prior = 'List deals over 10K$ as a pie';
    const blended = blendDataAskWithHistory('only open ones', [{ role: 'user', content: prior }]);
    assert.match(blended, /10K/i);
    assert.match(blended, /pie/i);
    assert.match(blended, /only open ones/i);
    assert.equal(wantsCompoundListAndChart(prior), true);
    assert.equal(wantsCompoundListAndChart(blended), true);
    assert.equal(hasExplicitGroupBy(blended, 'deals'), false);
    assert.equal(isChartAskWithoutGroup(blended, 'deals'), true);
    assert.equal(detectReportChartHint(blended), 'pie');

    const { filterTree, filterNotes } = detectFilters(blended, 'deals');
    assert.ok(filterTree?.children?.some((c) => c.fieldKey === 'amount' && Number(c.value) === 10000));
    assert.ok(filterTree?.children?.some((c) => c.fieldKey === 'status' && c.value === 'Open'));
    assert.ok((filterNotes || []).some((n) => /open/i.test(n)));

    const spec = buildDraftSpec({ question: blended });
    assert.ok(spec);
    assert.equal(spec.type, 'tabular');
    assert.equal(spec.groupField || '', '');
    assert.equal(spec.chartHint, 'pie');
    assert.doesNotMatch(String(spec.name || ''), /by stage/i);

    const arrowAsk = 'List deals over 10K$ as a pie -> only open ones';
    const arrowBlended = blendDataAskWithHistory(arrowAsk, []);
    assert.match(arrowBlended, /10K/i);
    assert.match(arrowBlended, /only open ones/i);
    assert.equal(isChartAskWithoutGroup(arrowBlended, 'deals'), true);
    const arrowSpec = buildDraftSpec({ question: arrowBlended });
    assert.equal(arrowSpec?.type, 'tabular');
    assert.equal(arrowSpec?.groupField || '', '');

    // Plan rewrite must not invent status="open amount above 10000" (empty AND).
    const { queryPlanToDraftInput, validateQueryPlan } = require('../aiAstraReportBuilderService');
    const plan = validateQueryPlan({
      moduleKey: 'deals',
      reportType: 'tabular',
      chartType: 'pie',
      chartSliceBy: 'record',
      wantList: true,
      wantChart: true,
      filters: [
        { fieldKey: 'status', operator: 'is', value: 'Open' },
        { fieldKey: 'amount', operator: 'gte', value: 10000 },
      ],
    });
    const draftIn = queryPlanToDraftInput(plan, arrowBlended);
    const fromRewrite = buildDraftSpec({
      question: draftIn.question,
      pinSource: draftIn.pinSource,
      forceType: 'tabular',
    });
    const statusRules = (fromRewrite?.filterTree?.children || []).filter((c) => c.fieldKey === 'status');
    assert.equal(statusRules.length, 1);
    assert.equal(statusRules[0].value, 'Open');
    assert.ok(fromRewrite?.filterTree?.children?.some((c) => c.fieldKey === 'amount' && Number(c.value) === 10000));
  });

  it('rejects invalid QueryPlan and falls back via buildDraftSpec', () => {
    const { validateQueryPlan, buildDraftSpec } = require('../aiAstraReportBuilderService');
    assert.equal(validateQueryPlan(null), null);
    assert.equal(validateQueryPlan({ moduleKey: 'not_a_module', chartType: 'bar' }), null);
    const dropped = validateQueryPlan({
      moduleKey: 'deals',
      filters: [{ fieldKey: 'nope', operator: 'gte', value: 1 }],
    });
    assert.ok(dropped);
    assert.equal(dropped.filters.length, 0);
    const fallback = buildDraftSpec({
      question: 'give me the list of deals which are having amount more than 10K $\nGive me the same in bar chart',
    });
    assert.ok(fallback);
    assert.equal(fallback.primaryModule, 'deals');
    assert.ok(fallback.filterTree?.children?.some((c) => c.fieldKey === 'amount'));
  });

  it('detects compound list+chart asks and charts records when no group-by', () => {
    const {
      wantsCompoundListAndChart,
      buildDraftSpec,
      isThinDataFollowUp,
      hasExplicitGroupBy,
      buildRecordLevelChartVisual,
    } = require('../aiAstraReportBuilderService');

    const q = 'Give me the list of deal which are above 50K $ and give me a Pie chart as well';
    assert.equal(wantsCompoundListAndChart(q), true);
    assert.equal(hasExplicitGroupBy(q, 'deals'), false);
    assert.equal(hasExplicitGroupBy('deals above 50K by stage as pie', 'deals'), true);
    assert.equal(
      hasExplicitGroupBy(
        'List deals over 10K$ and show them as a pie chart (not by stage — by record)',
        'deals',
      ),
      false,
    );
    const {
      wantsRecordLevelChart,
      isProductHowToAsk,
      isAmbiguousCrmAsk,
      isCrmDataAsk,
      wantsDealListNotPipelineChart,
    } = require('../aiAstraReportBuilderService');
    assert.equal(
      wantsRecordLevelChart('List deals over 10K$ and show them as a pie chart (not by stage — by record)'),
      true,
    );
    const howto = 'How do I convert a deal to a quote, and which fields are required on each?';
    assert.equal(isProductHowToAsk(howto), true);
    assert.equal(isCrmDataAsk(howto), false);
    assert.equal(wantsDealListNotPipelineChart(howto), false);
    assert.equal(isAmbiguousCrmAsk('Show me the important ones'), true);
    assert.equal(isCrmDataAsk('Show me the important ones'), false);
    assert.equal(wantsCompoundListAndChart('Give me the same in bar chart'), false);
    assert.equal(isThinDataFollowUp('Give me the same in bar chart'), true);

    const listSpec = buildDraftSpec({ question: q, forceType: 'tabular' });
    assert.ok(listSpec);
    assert.equal(listSpec.type, 'tabular');
    assert.ok(listSpec.filterTree?.children?.some((c) => c.fieldKey === 'amount' && Number(c.value) === 50000));

    const recordPie = buildRecordLevelChartVisual(
      {
        result: {
          rows: [
            { name: 'Acme', amount: 60000, stage: 'Proposal' },
            { name: 'Beta', amount: 80000, stage: 'New' },
          ],
        },
      },
      { primaryModule: 'deals', chartHint: 'pie', name: 'Deals ≥ $50K · pie', metric: 'amount' },
    );
    assert.equal(recordPie.length, 1);
    assert.equal(recordPie[0].component, 'chart');
    assert.equal(recordPie[0].chartType, 'pie');
    assert.deepEqual(
      recordPie[0].points.map((p) => p.label),
      ['Acme', 'Beta'],
    );
    assert.equal(recordPie[0].points[0].value, 60000);
  });

  it('IntentSpec never invents stage; list+pie uses record slices', () => {
    const { validateQueryPlan, verifyComposeMatchesIntent } = require('../aiAstraReportBuilderService');
    const plan = validateQueryPlan({
      understanding: 'List deals over 50K and pie of those deals',
      moduleKey: 'deals',
      wantList: true,
      wantChart: true,
      chartType: 'pie',
      chartSliceBy: 'record',
      groupField: null,
      metric: 'amount',
      filters: [{ fieldKey: 'amount', operator: 'gte', value: 50000 }],
      headlineHint: 'Deals ≥ $50K',
    });
    assert.ok(plan);
    assert.equal(plan.groupField, '');
    assert.equal(plan.chartSliceBy, 'record');
    assert.equal(plan.wantList, true);
    assert.equal(plan.wantChart, true);

    const invented = validateQueryPlan({
      moduleKey: 'deals',
      chartType: 'pie',
      wantChart: true,
      groupField: null,
    });
    assert.equal(invented.groupField, '');
    assert.equal(invented.chartSliceBy, 'record');

    const preview = {
      result: {
        rows: [
          { name: 'Acme', amount: 60000, stage: 'Proposal' },
          { name: 'Beta', amount: 90000, stage: 'New' },
        ],
      },
    };
    const bad = [{
      component: 'chart',
      chartType: 'pie',
      points: [
        { label: 'New', value: 1 },
        { label: 'Proposal', value: 1 },
      ],
    }];
    const fixed = verifyComposeMatchesIntent(plan, bad, preview);
    assert.equal(fixed[0].points[0].label, 'Acme');
    assert.equal(fixed[0].pinSource.recordLevel, true);
  });

  it('upcoming events uses startDateTime and stays tabular (not pin-invent group)', () => {
    const {
      detectModuleKey,
      isCrmDataAsk,
      detectFilters,
      buildDraftSpec,
      buildVisualsFromReportPreview,
      wantsListOnlyAsk,
      wantsExplicitChartAsk,
      leanVisualStructured,
    } = require('../aiAstraReportBuilderService');

    const q = 'give me the list of upcoming events';
    assert.equal(detectModuleKey(q), 'events');
    assert.equal(isCrmDataAsk(q), true);
    assert.equal(wantsListOnlyAsk(q), true);
    assert.equal(wantsExplicitChartAsk(q), false);
    const { filterTree, filterNotes } = detectFilters(q, 'events');
    assert.ok(filterTree?.children?.some((c) => c.fieldKey === 'startDateTime' && c.operator === 'gte'));
    assert.ok((filterNotes || []).some((n) => /upcoming/i.test(n)));
    assert.ok(!filterTree?.children?.some((c) => c.fieldKey === 'start'));

    const spec = buildDraftSpec({ question: q });
    assert.ok(spec);
    assert.equal(spec.primaryModule, 'events');
    assert.equal(spec.type, 'tabular');
    assert.equal(spec.groupField || '', '');
    assert.doesNotMatch(String(spec.name || ''), /by eventType/i);

    const table = buildVisualsFromReportPreview(
      {
        result: {
          rows: [
            { eventName: 'Kickoff', startDateTime: '2026-08-01T10:00:00.000Z', status: 'Planned' },
            { eventName: 'Review', startDateTime: '2026-08-15T14:00:00.000Z', status: 'Planned' },
          ],
        },
      },
      { ...spec, name: 'Upcoming events' },
      q,
      { forceTable: true },
    );
    assert.equal(table.length, 1);
    assert.equal(table[0].component, 'data_table');

    // "list of" without chart keywords → data_table even without forceTable
    const listDefault = buildVisualsFromReportPreview(
      {
        result: {
          rows: [
            { eventName: 'Kickoff', startDateTime: '2026-08-01T10:00:00.000Z' },
          ],
        },
      },
      { ...spec, name: 'Upcoming events' },
      q,
      {},
    );
    assert.equal(listDefault[0]?.component, 'data_table');

    const withViz = leanVisualStructured({
      headline: 'Upcoming events',
      visuals: table,
      actions: [{ label: 'Pin to dashboard', kind: 'pin_report_to_dashboard' }],
    });
    assert.ok(withViz.visuals.length);
    const pinOnly = leanVisualStructured({
      headline: 'Upcoming events',
      visuals: [],
      actions: [{ label: 'Pin to dashboard', kind: 'pin_report_to_dashboard' }],
    });
    assert.equal(pinOnly.visuals.length, 0);
  });

  it('detects all analytics modules and open/unpaid shortcuts', () => {
    const { detectModuleKey, buildDraftSpec, detectFilters } = require('../aiAstraReportBuilderService');

    const cases = [
      ['list of deals', 'deals'],
      ['list of tasks', 'tasks'],
      ['list of cases', 'cases'],
      ['list of tickets', 'cases'],
      ['list of events', 'events'],
      ['list of meetings', 'events'],
      ['list of quotes', 'quotes'],
      ['list of people', 'people'],
      ['list of accounts', 'organizations'],
      ['list of products', 'items'],
      ['list of invoices', 'invoices'],
      ['list of sales orders', 'sales_orders'],
      ['list of payments', 'payments'],
      ['list of documents', 'documents'],
      ['list of form responses', 'forms'],
    ];
    for (const [ask, mod] of cases) {
      assert.equal(detectModuleKey(ask), mod, ask);
      const spec = buildDraftSpec({ question: ask, forceType: 'tabular' });
      assert.ok(spec, ask);
      assert.equal(spec.primaryModule, mod, ask);
      assert.equal(spec.type, 'tabular', ask);
    }

    const inv = detectFilters('list of open invoices', 'invoices');
    assert.ok(inv.filterTree?.children?.some((c) => c.fieldKey === 'status' && c.operator === 'is_not' && c.value === 'paid'));

    const so = detectFilters('unpaid sales orders', 'sales_orders');
    assert.ok(so.filterTree?.children?.some((c) => c.fieldKey === 'status' && c.operator === 'is_not'));

    const tasksOpen = detectFilters('only open ones', 'tasks');
    assert.ok(tasksOpen.filterTree?.children?.some((c) => c.fieldKey === 'status' && c.operator === 'is_not'));
  });

  it('events within a week from today applies startDateTime window', () => {
    const { detectFilters, buildDraftSpec, wantsListOnlyAsk } = require('../aiAstraReportBuilderService');
    const q = 'give me the list of events within a week from today';
    assert.equal(wantsListOnlyAsk(q), true);
    const { filterTree, filterNotes } = detectFilters(q, 'events');
    const gte = filterTree?.children?.find((c) => c.fieldKey === 'startDateTime' && c.operator === 'gte');
    const lt = filterTree?.children?.find((c) => c.fieldKey === 'startDateTime' && c.operator === 'lt');
    assert.ok(gte, 'expected startDateTime >= today');
    assert.ok(lt, 'expected startDateTime < today+7');
    const start = new Date(gte.value).getTime();
    const end = new Date(lt.value).getTime();
    assert.ok(Number.isFinite(start) && Number.isFinite(end));
    assert.ok(end - start === 7 * 24 * 60 * 60 * 1000, 'window should be 7 days');
    assert.ok((filterNotes || []).some((n) => /within next 7/i.test(n)));

    const spec = buildDraftSpec({ question: q });
    assert.equal(spec?.primaryModule, 'events');
    assert.equal(spec?.type, 'tabular');
    assert.ok(spec?.filterTree?.children?.some((c) => c.fieldKey === 'startDateTime'));
    // July 1 must fall outside a Jul 20+ window when "today" is mid/late month in tests —
    // assert structurally that both bounds exist (runtime uses Date.now()).
    assert.equal(
      (spec.filterTree.children || []).filter((c) => c.fieldKey === 'startDateTime').length,
      2,
    );

    const next7 = detectFilters('events in the next 7 days', 'events');
    assert.ok(next7.filterTree?.children?.some((c) => c.operator === 'gte'));
    assert.ok(next7.filterTree?.children?.some((c) => c.operator === 'lt'));
  });

  it('owner-load multi-hop aggregates assignedTo from event rows', () => {
    const {
      wantsOwnerLoadAsk,
      composeOwnerLoadVisuals,
      isCrmDataAsk,
      detectFilters,
      detectModuleKey,
    } = require('../aiAstraReportBuilderService');

    const q = 'who is overloaded with events this week?';
    assert.equal(wantsOwnerLoadAsk(q), true);
    assert.equal(detectModuleKey(q), 'events');
    assert.equal(isCrmDataAsk(q), true);
    const { filterTree } = detectFilters(q, 'events');
    assert.ok(filterTree?.children?.some((c) => c.fieldKey === 'startDateTime'));

    const visuals = composeOwnerLoadVisuals({
      result: {
        rows: [
          { eventName: 'A', assignedTo: 'Ada', startDateTime: '2026-07-21T10:00:00.000Z' },
          { eventName: 'B', assignedTo: 'Ada', startDateTime: '2026-07-22T10:00:00.000Z' },
          { eventName: 'C', assignedTo: 'Bob', startDateTime: '2026-07-23T10:00:00.000Z' },
        ],
      },
    }, { title: 'Owners by load' });
    assert.ok(visuals.length >= 1);
    const table = visuals.find((v) => v.component === 'data_table');
    assert.ok(table);
    assert.deepEqual(table.rows[0], ['Ada', '2']);
    assert.deepEqual(table.rows[1], ['Bob', '1']);
  });

  it('stale/at-risk deals filter Open + inactivity/past close and compose owner $', () => {
    const {
      wantsStaleAtRiskDealAsk,
      parseStaleInactivityDays,
      detectFilters,
      buildDraftSpec,
      composeAtRiskDealVisuals,
      isCrmDataAsk,
    } = require('../aiAstraReportBuilderService');

    const q = 'which open deals are at risk with no activity in 14 days?';
    assert.equal(wantsStaleAtRiskDealAsk(q), true);
    assert.equal(parseStaleInactivityDays(q), 14);
    assert.equal(isCrmDataAsk(q), true);
    assert.equal(wantsStaleAtRiskDealAsk('Which accounts are at risk?'), false);

    const { filterTree, filterNotes } = detectFilters(q, 'deals');
    assert.ok(filterTree?.children?.some((c) => c.fieldKey === 'status' && c.value === 'Open'));
    const orNode = filterTree?.children?.find((c) => c.logic === 'OR');
    assert.ok(orNode);
    assert.ok(orNode.children.some((c) => c.fieldKey === 'lastActivityDate' && c.operator === 'lt'));
    assert.ok(orNode.children.some((c) => c.fieldKey === 'expectedCloseDate' && c.operator === 'lt'));
    assert.ok((filterNotes || []).some((n) => /at-risk/i.test(n)));

    const spec = buildDraftSpec({ question: q, forceType: 'tabular' });
    assert.equal(spec?.primaryModule, 'deals');
    assert.equal(spec?.type, 'tabular');
    assert.ok(spec?.selectedFields?.some((f) => f.field === 'lastActivityDate'));

    const viz = composeAtRiskDealVisuals({
      result: {
        rows: [
          {
            name: 'Acme', amount: 50000, stage: 'Proposal', assignedTo: 'Ada',
            lastActivityDate: '2026-06-01T00:00:00.000Z', expectedCloseDate: '2026-06-15T00:00:00.000Z',
          },
          {
            name: 'Beta', amount: 20000, stage: 'New', assignedTo: 'Ada',
            lastActivityDate: '2026-06-02T00:00:00.000Z', expectedCloseDate: '2026-08-01T00:00:00.000Z',
          },
          {
            name: 'Gamma', amount: 10000, stage: 'Qualification', assignedTo: 'Bob',
            lastActivityDate: '2026-05-01T00:00:00.000Z', expectedCloseDate: '2026-05-20T00:00:00.000Z',
          },
        ],
      },
    });
    assert.ok(viz.some((v) => v.id === 'astra_at_risk_deals_table'));
    const ownerTable = viz.find((v) => v.id === 'astra_at_risk_owner_table');
    assert.ok(ownerTable);
    assert.deepEqual(ownerTable.rows[0], ['Ada', '2', '70000']);
  });

  it('last N days applies backward date window', () => {
    const { detectFilters, buildDraftSpec } = require('../aiAstraReportBuilderService');
    const q = 'list of events in the last 30 days';
    const { filterTree, filterNotes } = detectFilters(q, 'events');
    const gte = filterTree?.children?.find((c) => c.fieldKey === 'startDateTime' && c.operator === 'gte');
    const lt = filterTree?.children?.find((c) => c.fieldKey === 'startDateTime' && c.operator === 'lt');
    assert.ok(gte && lt);
    const span = new Date(lt.value).getTime() - new Date(gte.value).getTime();
    assert.equal(span, 31 * 24 * 60 * 60 * 1000); // 30 days back + through end of today
    assert.ok((filterNotes || []).some((n) => /last 30/i.test(n)));
    const spec = buildDraftSpec({ question: q });
    assert.equal(spec?.primaryModule, 'events');
    assert.ok(spec?.filterTree?.children?.some((c) => c.fieldKey === 'startDateTime'));

    const pastWeek = detectFilters('deals closed last week', 'deals');
    // "last week" on deals uses expectedCloseDate
    assert.ok(pastWeek.filterTree?.children?.some((c) => c.fieldKey === 'expectedCloseDate'));
  });

  it('propose→confirm write actions are executeNow:false update_record', async () => {
    const {
      detectCrmWriteProposal,
      buildProposeConfirmWriteActions,
      buildAtRiskReviewActions,
      wantsCloseTheLoopAsk,
      buildFollowUpTaskActions,
      buildCloseTheLoopActions,
      wantsStaleAtRiskDealAsk,
      detectFilters,
    } = require('../aiAstraReportBuilderService');

    const proposal = detectCrmWriteProposal(
      'move at-risk open deals to Negotiation and reassign to Ada',
    );
    assert.equal(proposal?.stage, 'Negotiation');
    assert.equal(proposal?.assignee, 'ada');

    const actions = await buildProposeConfirmWriteActions({
      question: 'set stage to Proposal on these stale deals',
      moduleKey: 'deals',
      preview: {
        result: {
          rows: [
            { _id: '507f1f77bcf86cd799439011', name: 'Acme Mega', amount: 50000, stage: 'New' },
            { _id: '507f1f77bcf86cd799439012', name: 'Beta Co', amount: 20000, stage: 'Qualification' },
          ],
        },
      },
      limit: 2,
    });
    assert.equal(actions.length, 2);
    assert.equal(actions[0].kind, 'update_record');
    assert.equal(actions[0].executeNow, false);
    assert.equal(actions[0].fields.stage, 'Proposal');
    assert.equal(actions[0].recordId, '507f1f77bcf86cd799439011');
    assert.match(actions[0].rationale, /confirm/i);

    const reviews = buildAtRiskReviewActions({
      result: { rows: [{ _id: '507f1f77bcf86cd799439011', name: 'Acme' }] },
    });
    assert.equal(reviews[0].kind, 'review_record');
    assert.equal(reviews[0].executeNow, false);

    const closeQ = 'at-risk open deals over 10K$ — close the loop with follow-up';
    assert.equal(wantsStaleAtRiskDealAsk(closeQ), true);
    assert.equal(wantsCloseTheLoopAsk(closeQ), true);
    const { filterTree } = detectFilters(closeQ, 'deals');
    assert.ok(filterTree?.children?.some((c) => c.fieldKey === 'amount'));
    assert.ok(filterTree?.children?.some((c) => c.fieldKey === 'status' && c.value === 'Open'));

    const tasks = buildFollowUpTaskActions({
      preview: {
        result: { rows: [{ _id: '507f1f77bcf86cd799439011', name: 'Acme Mega', amount: 50000 }] },
      },
      assigneeUserId: '507f1f77bcf86cd799439099',
    });
    assert.equal(tasks[0].kind, 'create_record');
    assert.equal(tasks[0].moduleKey, 'tasks');
    assert.equal(tasks[0].executeNow, false);
    assert.equal(tasks[0].fields.relatedTo.type, 'deal');
    assert.equal(tasks[0].fields.assignedTo, '507f1f77bcf86cd799439099');

    const loop = await buildCloseTheLoopActions({
      question: closeQ,
      preview: {
        result: {
          rows: [
            { _id: '507f1f77bcf86cd799439011', name: 'Acme Mega', amount: 50000 },
            { _id: '507f1f77bcf86cd799439012', name: 'Beta', amount: 20000 },
          ],
        },
      },
      actorUserId: '507f1f77bcf86cd799439099',
      limit: 2,
    });
    assert.ok(loop.some((a) => a.kind === 'update_record' && a.fields?.stage === 'Negotiation'));
    assert.ok(loop.some((a) => a.kind === 'create_record' && a.moduleKey === 'tasks'));
    assert.ok(loop.every((a) => a.executeNow === false));
  });

  it('builds contextual CRM suggestion packs after answers', () => {
    const {
      buildCrmSuggestionPack,
      applyCrmSuggestions,
    } = require('../aiAstraReportBuilderService');

    const empty = buildCrmSuggestionPack({
      question: 'list of won deals',
      moduleKey: 'deals',
      rowCount: 0,
    });
    assert.ok(empty.clarifyingQuestions.length >= 2);
    assert.ok(empty.clarifyingQuestions.some((q) => /open deals/i.test(q)));

    const list = buildCrmSuggestionPack({
      question: 'give me the list of open deals',
      moduleKey: 'deals',
      rowCount: 12,
      hasTable: true,
      hasChart: false,
    });
    assert.ok(list.clarifyingQuestions.some((q) => /pie chart|by stage|at risk|10,?000|owner/i.test(q)));
    assert.ok(!list.clarifyingQuestions.some((q) => /give me the list of open deals/i.test(q)));

    const events = buildCrmSuggestionPack({
      question: 'list of upcoming events',
      moduleKey: 'events',
      rowCount: 5,
      hasTable: true,
    });
    assert.ok(events.clarifyingQuestions.some((q) => /overloaded|pie|this week|next week/i.test(q)));

    const atRisk = buildCrmSuggestionPack({
      question: 'which open deals are at risk?',
      moduleKey: 'deals',
      rowCount: 3,
      hasTable: true,
    });
    assert.ok(atRisk.clarifyingQuestions.some((q) => /close the loop|follow-up/i.test(q)));

    const structured = applyCrmSuggestions({
      headline: 'Results',
      bullets: [],
      clarifyingQuestions: [],
      actions: [],
      visuals: [],
    }, {
      question: 'list of open deals above 10000',
      moduleKey: 'deals',
      rowCount: 4,
      hasTable: true,
    });
    assert.equal(structured.suggestionMode, true);
    assert.ok(structured.clarifyingQuestions.length > 0);
  });
});
