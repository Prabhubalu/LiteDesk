'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  rankNextBestActions,
  mergeNbaIntoStructuredActions,
  staleDealToActions,
  attentionToAction,
} = require('../aiAstraNextBestActionService');

const ID1 = '507f1f77bcf86cd799439011';
const ID2 = '507f1f77bcf86cd799439012';
const ID3 = '507f1f77bcf86cd799439013';
const ID4 = '507f1f77bcf86cd799439014';

describe('aiAstraNextBestActionService', () => {
  it('ranks overdue attention above stale deals above resume', () => {
    const yesterday = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    const staleTouch = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const actions = rankNextBestActions({
      attentionItems: [{
        kind: 'task',
        id: ID1,
        title: 'Call Acme',
        isOverdue: true,
        dueAt: yesterday,
      }],
      staleDeals: [{
        _id: ID2,
        name: 'Stale Mega',
        lastActivityDate: staleTouch,
      }],
      resumeItems: [{
        id: ID3,
        title: 'Recent person',
        moduleKey: 'people',
      }],
      limit: 3,
    });
    assert.ok(actions.length >= 2);
    assert.equal(actions[0].kind, 'complete_task');
    assert.equal(actions[0].recordId, ID1);
    assert.equal(actions[0].priority, 'high');
    assert.ok(actions.some((a) => a.moduleKey === 'deals' && a.kind === 'follow_up'));
    const resumeIdx = actions.findIndex((a) => a.recordId === ID3);
    const staleIdx = actions.findIndex((a) => a.recordId === ID2 && a.kind === 'follow_up');
    if (resumeIdx >= 0 && staleIdx >= 0) {
      assert.ok(staleIdx < resumeIdx);
    }
  });

  it('drops navigable actions without valid mongo ids', () => {
    const actions = rankNextBestActions({
      attentionItems: [{
        kind: 'task',
        id: 'not-an-id',
        title: 'Bad',
        isOverdue: true,
        dueAt: new Date().toISOString(),
      }],
      resumeItems: [{ id: 'also-bad', title: 'X', moduleKey: 'deals' }],
      limit: 3,
    });
    assert.equal(actions.length, 0);
  });

  it('propose create_record is always executeNow:false', () => {
    const created = staleDealToActions({
      _id: ID1,
      name: 'Acme',
      lastActivityDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { proposeFollowUpTask: true });
    const create = created.find((a) => a.kind === 'create_record');
    assert.ok(create);
    assert.equal(create.executeNow, false);
    assert.equal(create.moduleKey, 'tasks');
    assert.equal(create.fields.relatedTo.type, 'deal');
    assert.equal(create.fields.relatedTo.id, ID1);
  });

  it('attention task maps to complete_task with overdue rationale', () => {
    const a = attentionToAction({
      kind: 'task',
      id: ID1,
      title: 'Ship quote',
      isOverdue: true,
      dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(a.kind, 'complete_task');
    assert.match(a.rationale, /Overdue/i);
  });

  it('merges NBA after writes and before pin without dropping either', () => {
    const existing = [
      {
        label: 'Confirm stage',
        kind: 'update_record',
        moduleKey: 'deals',
        recordId: ID1,
        executeNow: false,
      },
      {
        label: 'Pin to dashboard',
        kind: 'pin_report_to_dashboard',
        recordId: ID4,
      },
    ];
    const nba = [
      {
        label: 'Complete overdue: Call',
        kind: 'complete_task',
        moduleKey: 'tasks',
        recordId: ID2,
        priority: 'high',
        rationale: 'Overdue by 2 days',
      },
    ];
    const merged = mergeNbaIntoStructuredActions(existing, nba, { max: 8 });
    assert.equal(merged[0].kind, 'update_record');
    assert.equal(merged[1].kind, 'complete_task');
    assert.equal(merged[merged.length - 1].kind, 'pin_report_to_dashboard');
  });

  it('conversation anchor becomes follow_up when module+record provided', () => {
    const actions = rankNextBestActions({
      moduleKey: 'deals',
      recordId: ID1,
      recordTitle: 'Pinned Deal',
      attentionItems: [],
      resumeItems: [],
      staleDeals: [],
      limit: 3,
    });
    assert.equal(actions.length, 1);
    assert.equal(actions[0].kind, 'follow_up');
    assert.equal(actions[0].recordId, ID1);
    assert.match(actions[0].label, /Email to advance Pinned Deal/i);
  });

  it('people conversation anchor prefers email CTA over vague Reach out', () => {
    const actions = rankNextBestActions({
      moduleKey: 'people',
      recordId: ID1,
      recordTitle: 'Darshan',
      attentionItems: [],
      resumeItems: [],
      staleDeals: [],
      limit: 3,
    });
    assert.equal(actions[0].kind, 'follow_up');
    assert.match(actions[0].label, /Email Darshan with one clear ask/i);
    assert.doesNotMatch(actions[0].label, /^Reach out to/i);
  });

  it('open case with slaBreached ranks as review_record high', () => {
    const actions = rankNextBestActions({
      openCases: [{
        _id: ID1,
        title: 'Urgent ticket',
        slaBreached: true,
      }],
      limit: 3,
    });
    assert.equal(actions[0].kind, 'review_record');
    assert.equal(actions[0].moduleKey, 'cases');
    assert.equal(actions[0].priority, 'high');
    assert.match(actions[0].rationale, /SLA/i);
  });

  it('scopes NBA away from global overdue on small named previews', () => {
    const {
      isCrmAnswerScopedToPreview,
      filterActionsToPreviewIds,
    } = require('../aiAstraNextBestActionService');

    assert.equal(
      isCrmAnswerScopedToPreview(
        "Summarize deal 'Sample Deal', risks, and the single best next action",
        { rows: [{ _id: ID1, name: 'Sample Deal' }] },
      ),
      true,
    );
    // Record-page "this deal" with NO preview must NOT wipe NBA.
    assert.equal(
      isCrmAnswerScopedToPreview('What is the next best action I can perform on this deal', null),
      false,
    );
    assert.equal(
      isCrmAnswerScopedToPreview('next best action on this record', {}),
      false,
    );

    const filtered = filterActionsToPreviewIds(
      [
        {
          label: 'Complete overdue: Other',
          kind: 'complete_task',
          moduleKey: 'tasks',
          recordId: ID2,
        },
        {
          label: 'Open Sample Deal',
          kind: 'review_record',
          moduleKey: 'deals',
          recordId: ID1,
        },
      ],
      new Set([ID1]),
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].recordId, ID1);
  });

  it('previewOnly attachNba never injects org-wide overdue tasks', async () => {
    const { attachNbaToStructured } = require('../aiAstraNextBestActionService');
    const structured = {
      headline: 'Open Cases by Assigned To',
      bullets: ['12 open cases'],
      actions: [{
        label: 'Pin to dashboard',
        kind: 'pin_report_to_dashboard',
        recordId: 'rep1',
      }],
    };
    const out = await attachNbaToStructured(structured, {
      organizationId: '507f1f77bcf86cd799439099',
      userId: '507f1f77bcf86cd799439088',
      question: 'Give me in pie chart with group by Assigned to',
      crmPreview: {
        rows: [
          { _id: ID1, title: 'Case A', assignedTo: 'Arivu Admin' },
          { _id: ID2, title: 'Case B', assignedTo: 'Arivu Admin' },
        ],
      },
      crmModuleKey: 'cases',
      moduleKey: 'cases',
      limit: 3,
      previewOnly: true,
    });
    assert.ok(Array.isArray(out.actions));
    assert.equal(out.actions.some((a) => /overdue/i.test(String(a.label || ''))), false);
    assert.equal(out.actions.some((a) => a.kind === 'complete_task'), false);
    assert.ok(out.actions.some((a) => a.kind === 'pin_report_to_dashboard' || a.kind === 'review_record'));
  });
});
