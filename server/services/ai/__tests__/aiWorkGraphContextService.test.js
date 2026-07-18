'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  flattenRecordContext,
  normalizeStructuredAnswer,
  enrichEmailActionsFromCrm,
} = require('../aiWorkGraphService');

describe('aiWorkGraphContext richness', () => {
  it('flattenRecordContext still supports legacy relatedGroups', () => {
    const { text, citations } = flattenRecordContext({
      moduleKey: 'deals',
      recordId: 'd1',
      primary: { name: 'Acme Deal' },
      relatedGroups: [
        {
          moduleKey: 'people',
          records: [{ _id: 'p1', name: 'Ada' }],
        },
      ],
    }, { _id: 'd1', name: 'Acme Deal' });
    assert.match(text, /Acme Deal/);
    assert.ok(citations.length >= 1);
    assert.match(text, /Ada/);
  });

  it('normalizeStructuredAnswer keeps verb actions and drops Open-only', () => {
    const out = normalizeStructuredAnswer({
      headline: 'Next steps',
      bullets: ['Quote expired'],
      actions: [
        {
          kind: 'send_email',
          moduleKey: 'people',
          recordId: 'p1',
          label: 'Email Prabhu about the expired quote',
          rationale: 'Quote expired while deal is Won',
          email: {
            to: 'prabhu@example.com',
            subject: 'Quote expired',
            body: 'Hi Prabhu,\n\nYour quote has expired...',
          },
        },
        { kind: 'open_record', moduleKey: 'tasks', recordId: 't1', label: 'Open Research Task' },
        { kind: 'complete_task', moduleKey: 'tasks', recordId: 't1', label: 'Complete task: Research account background' },
        { kind: 'talk_to_agent', label: 'Talk to Agent' },
      ],
    }, [
      { sourceType: 'people', sourceId: 'p1', excerpt: 'Prabhu' },
      { sourceType: 'tasks', sourceId: 't1', excerpt: 'Research' },
    ]);
    assert.equal(out.actions.length, 3);
    assert.equal(out.actions[0].kind, 'send_email');
    assert.equal(out.actions[0].email.to, 'prabhu@example.com');
    assert.equal(out.actions[1].kind, 'complete_task');
    assert.equal(out.actions[2].kind, 'talk_to_agent');
  });

  it('enrichEmailActionsFromCrm replaces invalid To with CRM email', async () => {
    const out = await enrichEmailActionsFromCrm(
      'org1',
      [{
        kind: 'send_email',
        moduleKey: 'people',
        recordId: 'p1',
        label: 'Email Prabhu',
        email: { to: '[EMAIL]', subject: 'Hi', body: 'Hello' },
      }],
      [{ sourceType: 'people', sourceId: 'p1', email: 'im.prabhub@gmail.com', excerpt: 'Prabhu' }],
    );
    assert.equal(out[0].email.to, 'im.prabhub@gmail.com');
  });
});

const {
  resolveAstraContextMode,
  buildAstraVisualsFromSeries,
  resolveAstraChartType,
} = require('../aiWorkGraphContextService');

describe('resolveAstraContextMode', () => {
  it('uses sample by default', () => {
    assert.equal(resolveAstraContextMode('who owns this deal?'), 'sample');
  });
  it('detects report intent', () => {
    assert.equal(resolveAstraContextMode('generate a pipeline report'), 'report');
  });
  it('detects complete data intent', () => {
    assert.equal(resolveAstraContextMode('sum of all deal amounts across all stages'), 'complete');
  });
  it('detects pie chart as report mode', () => {
    assert.equal(resolveAstraContextMode('Give me in a Pie Chart'), 'report');
  });
});

describe('buildAstraVisualsFromSeries', () => {
  it('builds pie points from stage series', () => {
    const visuals = buildAstraVisualsFromSeries({
      question: 'pie chart of deals by stage',
      moduleKey: 'deals',
      groupField: 'stage',
      series: [
        { label: 'New', value: 5, amount: 100 },
        { label: 'Qualification', value: 3, amount: 200 },
      ],
    });
    assert.equal(visuals.length, 1);
    assert.equal(visuals[0].chartType, 'pie');
    assert.equal(visuals[0].points.length, 2);
    assert.equal(resolveAstraChartType('bar chart please'), 'bar');
  });
});
