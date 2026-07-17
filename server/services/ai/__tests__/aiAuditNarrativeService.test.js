'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseAuditNarrativeJson,
  buildFailedAllowList,
  buildQuestionLabelMap,
} = require('../aiAuditNarrativeService');
const { getPrompt } = require('../prompts/promptRegistry');

const FAILED = [
  { questionId: 'q1', questionText: 'Fire extinguisher present?', answer: '"No"', score: 0 },
  { questionId: 'q2', questionText: 'Exit signs lit?', answer: '"No"', score: 10 },
];

describe('aiAuditNarrativeService', () => {
  it('buildQuestionLabelMap reads section and subsection questions', () => {
    const map = buildQuestionLabelMap({
      sections: [
        {
          questions: [{ questionId: 'a', questionText: 'A' }],
          subsections: [{ questions: [{ questionId: 'b', questionText: 'B' }] }],
        },
      ],
    });
    assert.equal(map.get('a'), 'A');
    assert.equal(map.get('b'), 'B');
  });

  it('buildFailedAllowList only includes Fail rows', () => {
    const list = buildFailedAllowList(
      {
        responseDetails: [
          { questionId: 'q1', passFail: 'Fail', answer: 'No', score: 0 },
          { questionId: 'q2', passFail: 'Pass', answer: 'Yes', score: 100 },
          { questionId: 'q3', passFail: 'Fail', answer: false, score: 0 },
        ],
      },
      new Map([['q1', 'Fire?'], ['q3', 'Exit?']])
    );
    assert.equal(list.length, 2);
    assert.equal(list[0].questionText, 'Fire?');
    assert.equal(list[1].questionId, 'q3');
  });

  it('constrains remediation actions to failed questionIds (no injection)', () => {
    const { narrative, remediationActions, overallRisk } = parseAuditNarrativeJson(
      JSON.stringify({
        narrative: 'Two critical failures.',
        overallRisk: 'high',
        remediationActions: [
          {
            questionId: 'q1',
            auditorFinding: 'Extinguisher missing',
            suggestedAction: 'Install and verify',
            priority: 'high',
            confidence: 0.9,
          },
          {
            questionId: 'evil-q',
            auditorFinding: 'Injected',
            suggestedAction: 'Hack',
            priority: 'high',
            confidence: 1,
          },
        ],
      }),
      FAILED
    );
    assert.match(narrative, /critical/);
    assert.equal(overallRisk, 'high');
    assert.equal(remediationActions.length, 1);
    assert.equal(remediationActions[0].questionId, 'q1');
    assert.equal(remediationActions[0].confirmRequired, true);
  });

  it('dedupes questionIds and clamps confidence', () => {
    const { remediationActions } = parseAuditNarrativeJson(
      JSON.stringify({
        remediationActions: [
          { questionId: 'q2', auditorFinding: 'a', suggestedAction: 'b', confidence: 9 },
          { questionId: 'q2', auditorFinding: 'c', suggestedAction: 'd', confidence: 0.2 },
        ],
      }),
      FAILED
    );
    assert.equal(remediationActions.length, 1);
    assert.equal(remediationActions[0].confidence, 1);
  });

  it('returns empty on garbage', () => {
    const out = parseAuditNarrativeJson('not json', FAILED);
    assert.equal(out.narrative, '');
    assert.deepEqual(out.remediationActions, []);
  });

  it('registers audit_narrative_system prompt with propose-only guidance', () => {
    const prompt = getPrompt('audit_narrative_system');
    assert.equal(prompt.version, 'v1');
    assert.match(prompt.text, /Only use questionIds from the provided failed list/);
    assert.match(prompt.text, /Propose-only/);
  });
});
