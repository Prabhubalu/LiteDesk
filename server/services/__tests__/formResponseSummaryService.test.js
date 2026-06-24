'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildFormResponseSummary,
  isEngagementFormType
} = require('../../services/formResponseSummaryService');

test('isEngagementFormType recognizes survey and feedback', () => {
  assert.equal(isEngagementFormType('Survey'), true);
  assert.equal(isEngagementFormType('feedback'), true);
  assert.equal(isEngagementFormType('Audit'), false);
});

test('buildFormResponseSummary aggregates choice, rating, and text questions', async () => {
  const form = {
    _id: 'form-1',
    formType: 'Survey',
    name: 'Customer Survey',
    sections: [{
      sectionId: 'SEC-1',
      name: 'Customer Survey',
      subsections: [{
        subsectionId: 'SUB-1',
        name: '',
        questions: [
          {
            questionId: 'Q1',
            questionText: 'How satisfied are you?',
            type: 'Rating',
            mandatory: true
          },
          {
            questionId: 'Q2',
            questionText: 'Would you recommend us?',
            type: 'Yes-No',
            mandatory: true
          },
          {
            questionId: 'Q3',
            questionText: 'Favorite feature',
            type: 'Dropdown',
            options: ['Speed', 'Design', 'Support'],
            mandatory: false
          },
          {
            questionId: 'Q4',
            questionText: 'Any comments?',
            type: 'Textarea',
            mandatory: false
          }
        ]
      }]
    }]
  };

  const mockResponses = [
    {
      submittedAt: new Date('2026-01-01T10:00:00Z'),
      kpis: { rating: 5, satisfactionPercentage: 100 },
      responseDetails: [
        { questionId: 'Q1', answer: 5 },
        { questionId: 'Q2', answer: 'Yes' },
        { questionId: 'Q3', answer: 'Speed' },
        { questionId: 'Q4', answer: 'Great product' }
      ]
    },
    {
      submittedAt: new Date('2026-01-02T10:00:00Z'),
      kpis: { rating: 3, satisfactionPercentage: 60 },
      responseDetails: [
        { questionId: 'Q1', answer: 3 },
        { questionId: 'Q2', answer: 'No' },
        { questionId: 'Q3', answer: 'Design' }
      ]
    }
  ];

  const originalFind = require('../../models/FormResponse').find;
  require('../../models/FormResponse').find = () => ({
    select: () => ({
      lean: async () => mockResponses
    })
  });

  try {
    const summary = await buildFormResponseSummary(form, 'org-1', { textPreviewLimit: 5 });

    assert.equal(summary.supported, true);
    assert.equal(summary.overview.totalResponses, 2);
    assert.equal(summary.overview.totalQuestions, 4);
    assert.equal(summary.overview.avgRating, 4);

    const questions = summary.sections[0].subsections[0].questions;
    assert.equal(questions.length, 4);

    const ratingQuestion = questions.find((q) => q.questionId === 'Q1');
    assert.equal(ratingQuestion.summary.kind, 'rating');
    assert.equal(ratingQuestion.summary.average, 4);
    assert.equal(ratingQuestion.summary.distribution.find((row) => row.star === 5).count, 1);

    const yesNoQuestion = questions.find((q) => q.questionId === 'Q2');
    assert.equal(yesNoQuestion.summary.kind, 'choice');
    assert.equal(yesNoQuestion.summary.options.find((o) => o.label === 'Yes').count, 1);
    assert.equal(yesNoQuestion.summary.options.find((o) => o.label === 'No').count, 1);

    const dropdownQuestion = questions.find((q) => q.questionId === 'Q3');
    assert.equal(dropdownQuestion.summary.options.find((o) => o.label === 'Speed').count, 1);
    assert.equal(dropdownQuestion.summary.options.find((o) => o.label === 'Design').count, 1);

    const textQuestion = questions.find((q) => q.questionId === 'Q4');
    assert.equal(textQuestion.summary.kind, 'text');
    assert.equal(textQuestion.summary.totalTextResponses, 1);
    assert.equal(textQuestion.summary.preview[0].text, 'Great product');
  } finally {
    require('../../models/FormResponse').find = originalFind;
  }
});

test('buildFormResponseSummary returns unsupported for audit forms', async () => {
  const form = {
    _id: 'form-2',
    formType: 'Audit',
    sections: []
  };

  const originalFind = require('../../models/FormResponse').find;
  require('../../models/FormResponse').find = () => ({
    select: () => ({
      lean: async () => []
    })
  });

  try {
    const summary = await buildFormResponseSummary(form, 'org-1');
    assert.equal(summary.supported, false);
    assert.deepEqual(summary.sections, []);
  } finally {
    require('../../models/FormResponse').find = originalFind;
  }
});
