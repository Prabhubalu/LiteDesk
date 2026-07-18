'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseScheduleFromQuestion,
  fillMutationFromApp,
  missingMandatoryForCreate,
  inferEventName,
} = require('../aiAstraFieldFillService');

describe('aiAstraFieldFillService', () => {
  it('parses tomorrow 3pm schedule', () => {
    const now = new Date('2026-07-17T08:00:00.000Z');
    const { startDateTime, endDateTime } = parseScheduleFromQuestion(
      'Create a meeting tomorrow at 3pm',
      now,
    );
    assert.ok(startDateTime);
    assert.ok(endDateTime);
    assert.ok(new Date(endDateTime) > new Date(startDateTime));
  });

  it('fills event create from page + question with no staff questions', () => {
    const { action, missing } = fillMutationFromApp({
      kind: 'create_record',
      moduleKey: 'events',
      fields: {},
      executeNow: true,
    }, {
      question: 'Schedule a discovery call tomorrow at 3pm',
      pageModuleKey: 'organizations',
      pageRecordId: '507f1f77bcf86cd799439011',
      contextText: 'Label: Vtiger CRM\nwebsite: https://www.vtiger.com\n',
      userId: '507f1f77bcf86cd799439012',
    });
    assert.equal(missing.length, 0);
    assert.ok(action.fields.eventName);
    assert.ok(action.fields.startDateTime);
    assert.ok(action.fields.endDateTime);
    assert.equal(action.fields.relatedToId, '507f1f77bcf86cd799439011');
    assert.equal(action.fields.assignedTo, '507f1f77bcf86cd799439012');
    assert.equal(action.fields.eventType, 'Meeting');
  });

  it('reports missing start when no schedule in question', () => {
    const missing = missingMandatoryForCreate('events', {
      eventName: 'Meeting',
      assignedTo: 'u1',
    });
    assert.ok(missing.includes('startDateTime'));
    assert.ok(missing.includes('endDateTime'));
  });

  it('infers event name from discovery', () => {
    assert.match(inferEventName('create discovery call', 'Vtiger'), /Discovery call/);
  });

  it('on people page sets linkPeopleId and does not put contact in relatedToId', () => {
    const peopleId = '507f1f77bcf86cd799439033';
    const { action, missing } = fillMutationFromApp({
      kind: 'create_record',
      moduleKey: 'events',
      fields: { relatedToId: peopleId },
      executeNow: true,
    }, {
      question: 'Schedule a meeting with Prabhu tomorrow at 11am',
      pageModuleKey: 'people',
      pageRecordId: peopleId,
      contextText: 'Label: Mr. Prabhu Balu\n',
      userId: '507f1f77bcf86cd799439012',
    });
    assert.equal(missing.length, 0);
    assert.equal(action.fields.linkPeopleId, peopleId);
    assert.equal(action.fields.relatedToId, undefined);
  });
});
