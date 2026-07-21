'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  verifyCrmPreviewAgainstAsk,
  repairPlanFromVerifyFailures,
  verifyOrRepairPlan,
} = require('../astra/planner/verifyAndReplan');

describe('verifyCrmPreviewAgainstAsk', () => {
  it('fails when Won ask returns Negotiation rows', () => {
    const result = verifyCrmPreviewAgainstAsk({
      question: 'Won deals',
      plan: { moduleKey: 'deals', headlineHint: 'Won deals', filters: [] },
      preview: {
        result: {
          rows: [
            { name: 'A', stage: 'Negotiation', status: 'Open', amount: 1000 },
            { name: 'B', stage: 'Closed Won', status: 'Won', amount: 5000 },
          ],
        },
      },
    });
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f) => f.code === 'WON_ROWS_MISMATCH'));
  });

  it('passes when all rows are Won', () => {
    const result = verifyCrmPreviewAgainstAsk({
      question: 'Won deals',
      plan: { moduleKey: 'deals', filters: [{ fieldKey: 'status', operator: 'is', value: 'Won' }] },
      preview: {
        result: {
          rows: [{ name: 'A', stage: 'Closed Won', status: 'Won', amount: 9000 }],
        },
      },
    });
    assert.equal(result.ok, true);
  });

  it('fails when amount ask returns under-threshold rows', () => {
    const result = verifyCrmPreviewAgainstAsk({
      question: 'deals amount above 10000',
      plan: {
        moduleKey: 'deals',
        filters: [{ fieldKey: 'amount', operator: 'gte', value: 10000 }],
      },
      preview: {
        result: {
          rows: [
            { name: 'Cheap', amount: 500 },
            { name: 'Big', amount: 50000 },
          ],
        },
      },
    });
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f) => f.code === 'AMOUNT_ROWS_MISMATCH'));
  });

  it('fails when date-window ask returns rows outside startDateTime bounds', () => {
    const result = verifyCrmPreviewAgainstAsk({
      question: 'events within a week from today',
      plan: {
        moduleKey: 'events',
        filters: [
          { fieldKey: 'startDateTime', operator: 'gte', value: '2026-07-20T00:00:00.000Z' },
          { fieldKey: 'startDateTime', operator: 'lt', value: '2026-07-27T00:00:00.000Z' },
        ],
      },
      preview: {
        result: {
          rows: [
            { eventName: 'Old', startDateTime: '2026-07-01T10:00:00.000Z' },
            { eventName: 'Ok', startDateTime: '2026-07-22T10:00:00.000Z' },
          ],
        },
      },
    });
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f) => f.code === 'DATE_ROWS_MISMATCH'));
  });

  it('fails when open deals ask returns Won rows', () => {
    const result = verifyCrmPreviewAgainstAsk({
      question: 'only open deals',
      plan: {
        moduleKey: 'deals',
        filters: [{ fieldKey: 'status', operator: 'is', value: 'Open' }],
      },
      preview: {
        result: {
          rows: [
            { name: 'OpenOne', status: 'Open', stage: 'New', amount: 1000 },
            { name: 'WonOne', status: 'Won', stage: 'Closed Won', amount: 9000 },
          ],
        },
      },
    });
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f) => f.code === 'OPEN_STATUS_MISMATCH'));
  });

  it('passes when all event rows fall inside date window', () => {
    const result = verifyCrmPreviewAgainstAsk({
      question: 'events within a week from today',
      plan: {
        moduleKey: 'events',
        filters: [
          { fieldKey: 'startDateTime', operator: 'gte', value: '2026-07-20T00:00:00.000Z' },
          { fieldKey: 'startDateTime', operator: 'lt', value: '2026-07-27T00:00:00.000Z' },
        ],
      },
      preview: {
        result: {
          rows: [
            { eventName: 'A', startDateTime: '2026-07-21T10:00:00.000Z' },
            { eventName: 'B', startDateTime: '2026-07-25T10:00:00.000Z' },
          ],
        },
      },
    });
    assert.equal(result.ok, true);
  });
});

describe('verifyOrRepairPlan (bounded)', () => {
  it('repairs once then stops', () => {
    const badPreview = {
      result: { rows: [{ name: 'X', stage: 'New', status: 'Open', amount: 1 }] },
    };
    const first = verifyOrRepairPlan({
      question: 'Won deals',
      plan: { moduleKey: 'deals', filters: [], headlineHint: 'Won deals' },
      preview: badPreview,
      alreadyReplanned: false,
    });
    assert.equal(first.didReplan, true);
    assert.equal(first.plan.headlineHint, 'Won deals');
    assert.equal(first.plan.wantList, true);

    const second = verifyOrRepairPlan({
      question: 'Won deals',
      plan: first.plan,
      preview: badPreview,
      alreadyReplanned: true,
    });
    assert.equal(second.didReplan, false);
    assert.equal(second.verified, false);
  });

  it('repairPlanFromVerifyFailures forces Lost tabular', () => {
    const { plan } = repairPlanFromVerifyFailures({
      plan: { moduleKey: 'deals', wantChart: true, groupField: 'stage' },
      question: 'Lost deals',
      failures: [{ code: 'LOST_ROWS_MISMATCH', detail: 'bad' }],
    });
    assert.equal(plan.headlineHint, 'Lost deals');
    assert.equal(plan.wantList, true);
    assert.equal(plan.groupField, '');
  });

  it('repairs DATE_ROWS_MISMATCH by merging detectFilters date bounds', () => {
    const { plan } = repairPlanFromVerifyFailures({
      plan: { moduleKey: 'events', filters: [], wantChart: true },
      question: 'give me the list of events within a week from today',
      failures: [{ code: 'DATE_ROWS_MISMATCH', detail: 'bad dates' }],
    });
    assert.equal(plan.moduleKey, 'events');
    assert.equal(plan.reportType, 'tabular');
    assert.ok(plan.filters?.some((f) => f.fieldKey === 'startDateTime' && f.operator === 'gte'));
    assert.ok(plan.filters?.some((f) => f.fieldKey === 'startDateTime' && f.operator === 'lt'));
  });

  it('repairs OPEN_STATUS_MISMATCH with status=Open', () => {
    const { plan } = repairPlanFromVerifyFailures({
      plan: { moduleKey: 'deals', filters: [], wantChart: true, groupField: 'stage' },
      question: 'only open deals over 10K',
      failures: [{ code: 'OPEN_STATUS_MISMATCH', detail: 'won slipped in' }],
    });
    assert.equal(plan.groupField, '');
    assert.ok(plan.filters?.some((f) => f.fieldKey === 'status' && f.value === 'Open'));
  });

  it('fails and repairs LIST_VS_CHART_MISMATCH', () => {
    const bad = verifyCrmPreviewAgainstAsk({
      question: 'give me the list of upcoming events',
      plan: {
        moduleKey: 'events',
        wantChart: true,
        groupField: 'eventType',
        chartSliceBy: 'field',
      },
      preview: { result: { rows: [{ eventName: 'A' }] } },
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.failures.some((f) => f.code === 'LIST_VS_CHART_MISMATCH'));

    const { plan } = repairPlanFromVerifyFailures({
      plan: {
        moduleKey: 'events',
        wantChart: true,
        groupField: 'eventType',
        chartSliceBy: 'field',
      },
      question: 'give me the list of upcoming events',
      failures: [{ code: 'LIST_VS_CHART_MISMATCH', detail: 'bad' }],
    });
    assert.equal(plan.wantChart, false);
    assert.equal(plan.groupField, '');
    assert.equal(plan.reportType, 'tabular');
  });
});
