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

  it('matches research intent on organizations via name token', () => {
    const agent = {
      name: 'Research Agent',
      description: 'Company and organization research',
      triggerPhrases: ['research company', 'company overview'],
      moduleKeys: ['organizations'],
    };
    const score = scoreAgentForQuestion(
      agent,
      'research about this organization',
      'organizations',
    );
    expect(score).toBeGreaterThanOrEqual(5);
  });

  it('matches research synonym via intent aliases', () => {
    const agent = {
      name: 'Company Intel',
      description: '',
      triggerPhrases: ['research organization'],
      moduleKeys: ['organizations'],
    };
    const score = scoreAgentForQuestion(
      agent,
      'investigate this organization',
      'organizations',
    );
    expect(score).toBeGreaterThanOrEqual(5);
  });

  it('hard-excludes deal specialists on organization pages', () => {
    const dealAgent = {
      name: 'Deal Analyze',
      description: 'Analyze deals',
      triggerPhrases: ['research', 'review', 'customer'],
      moduleKeys: ['deals'],
    };
    expect(scoreAgentForQuestion(
      dealAgent,
      'Review Vtiger Customer Case Studies & Success Stories',
      'organizations',
    )).toBeLessThan(0);
  });

  it('hard-excludes deal-named agents with empty moduleKeys on org pages', () => {
    const dealAgent = {
      name: 'Deal Analyze',
      description: 'Coaching',
      triggerPhrases: ['review customer'],
      moduleKeys: [],
    };
    expect(scoreAgentForQuestion(
      dealAgent,
      'Review Vtiger Customer Case Studies',
      'organizations',
    )).toBeLessThan(0);
  });
});
