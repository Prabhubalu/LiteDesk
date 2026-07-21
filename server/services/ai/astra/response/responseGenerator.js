'use strict';

const { normalizeStructuredAnswer } = require('../../aiWorkGraphService');

function sectionBody(reasoning) {
  const parts = [];
  if (reasoning.summary) {
    parts.push('## Summary', reasoning.summary, '');
  }
  if (reasoning.keyFindings?.length) {
    parts.push('## Key Findings', ...reasoning.keyFindings.map((b) => `• ${b}`), '');
  }
  if (reasoning.evidence?.length) {
    parts.push('## Evidence', ...reasoning.evidence.map((b) => `• ${b}`), '');
  }
  if (reasoning.risks?.length) {
    parts.push('## Risks', ...reasoning.risks.map((b) => `• ${b}`), '');
  }
  if (reasoning.recommendations?.length) {
    parts.push('## Recommendations', ...reasoning.recommendations.map((b) => `• ${b}`), '');
  }
  if (reasoning.nextSteps?.length) {
    parts.push('## Next Steps', ...reasoning.nextSteps.map((b) => `• ${b}`), '');
  }
  if (reasoning.missingInformation?.length) {
    parts.push(
      '## Missing Information',
      ...reasoning.missingInformation.map((b) => `• ${b}`),
      '',
    );
  }
  return parts.join('\n').trim();
}

/**
 * Map reasoning → Astra structured answer (sections + actions + citations).
 */
function generateResponse({
  reasoning,
  citations = [],
  clarifyingQuestion = null,
} = {}) {
  if (clarifyingQuestion) {
    const structured = normalizeStructuredAnswer({
      headline: 'Need one detail',
      bullets: [],
      clarifyingQuestions: [clarifyingQuestion],
      detail: '',
      actions: [],
      talkToAgent: false,
    }, citations, {
      maxActions: 0,
      maxBullets: 4,
      maxDetail: 0,
    });
    return {
      answer: structured.body || structured.headline,
      structured: {
        headline: structured.headline,
        bullets: structured.bullets,
        clarifyingQuestions: structured.clarifyingQuestions || [clarifyingQuestion],
        detail: structured.detail || '',
        actions: [],
        visuals: [],
        talkToAgent: false,
      },
      citations,
    };
  }

  const detail = sectionBody(reasoning || {});
  const bullets = (reasoning?.keyFindings || []).slice(0, 4);
  const structured = normalizeStructuredAnswer({
    headline: String(reasoning?.summary || 'Astra analysis').slice(0, 140),
    bullets,
    clarifyingQuestions: [],
    detail,
    actions: reasoning?.actions || [],
    talkToAgent: false,
  }, citations, {
    maxActions: 3,
    maxBullets: 6,
    maxBulletLen: 280,
    maxDetail: 8000,
    maxHeadline: 140,
  });

  return {
    answer: structured.body || detail || structured.headline,
    structured: {
      headline: structured.headline,
      bullets: structured.bullets,
      clarifyingQuestions: structured.clarifyingQuestions || [],
      detail: structured.detail || detail,
      actions: structured.actions || [],
      visuals: structured.visuals || [],
      talkToAgent: false,
      sections: {
        summary: reasoning?.summary || '',
        keyFindings: reasoning?.keyFindings || [],
        evidence: reasoning?.evidence || [],
        recommendations: reasoning?.recommendations || [],
        nextSteps: reasoning?.nextSteps || [],
        missingInformation: reasoning?.missingInformation || [],
      },
    },
    citations,
  };
}

module.exports = {
  generateResponse,
  sectionBody,
};
