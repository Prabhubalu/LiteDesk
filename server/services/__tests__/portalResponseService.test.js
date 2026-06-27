'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  shapePortalResponseSummary,
  shapePortalFormFillResponse
} = require('../portalResponseService');

describe('portalResponseService', () => {
  it('shapePortalResponseSummary returns customer-safe fields', () => {
    const shaped = shapePortalResponseSummary(
      {
        _id: '507f1f77bcf86cd799439011',
        responseId: 'R-001',
        formId: '507f1f77bcf86cd799439012',
        executionStatus: 'Submitted',
        reviewStatus: 'Approved',
        submittedAt: new Date('2026-01-01'),
        kpis: { finalScore: 92, compliancePercentage: 88 }
      },
      { _id: '507f1f77bcf86cd799439012', name: 'Safety Checklist', formType: 'Audit' }
    );

    assert.equal(shaped.responseId, 'R-001');
    assert.equal(shaped.formName, 'Safety Checklist');
    assert.equal(shaped.finalScore, 92);
    assert.equal(shaped.correctiveActions, undefined);
  });

  it('shapePortalFormFillResponse includes responseDetails for resume', () => {
    const shaped = shapePortalFormFillResponse({
      _id: '507f1f77bcf86cd799439011',
      responseId: 'R-002',
      formId: '507f1f77bcf86cd799439012',
      executionStatus: 'In Progress',
      responseDetails: [{ questionId: 'q1', answer: 'yes' }]
    });

    assert.equal(shaped.executionStatus, 'In Progress');
    assert.equal(shaped.responseDetails.length, 1);
    assert.equal(shaped.responseDetails[0].answer, 'yes');
  });
});
