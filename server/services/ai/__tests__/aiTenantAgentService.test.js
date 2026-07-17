'use strict';

const { scoreAgentForQuestion } = require('../aiTenantAgentService');

describe('aiTenantAgentService routing', () => {
  it('scores trigger phrase + module affinity highly', () => {
    const agent = {
      name: 'Deal Analyze',
      description: 'Analyze deal risk and next steps',
      triggerPhrases: ['analyze deal', 'deal risk'],
      moduleKeys: ['deals'],
    };
    const score = scoreAgentForQuestion(agent, 'Please analyze deal win probability', 'deals');
    expect(score).toBeGreaterThanOrEqual(8);
  });

  it('matches agent name exactly even without triggers', () => {
    const agent = {
      name: 'Deal Analyze',
      description: '',
      triggerPhrases: [],
      moduleKeys: [],
    };
    expect(scoreAgentForQuestion(agent, 'Deal Analyze', 'deals')).toBeGreaterThanOrEqual(8);
  });

  it('matches unordered trigger phrase tokens', () => {
    const agent = {
      name: 'Deal Analyze',
      description: '',
      triggerPhrases: ['analyze deal'],
      moduleKeys: ['deals'],
    };
    expect(scoreAgentForQuestion(agent, 'deal analyze please', 'deals')).toBeGreaterThanOrEqual(8);
  });
});
