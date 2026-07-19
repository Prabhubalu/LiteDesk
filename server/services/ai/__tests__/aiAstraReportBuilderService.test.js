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
});
