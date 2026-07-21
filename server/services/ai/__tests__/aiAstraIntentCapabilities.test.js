'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateAstraRouteIntent,
  formatRouteIntentPromptRules,
  resolveDeterministicRouteIntent,
  mergeRouteIntentWithDeterministic,
  ASTRA_ROUTES,
} = require('../aiAstraIntentCapabilities');

describe('aiAstraIntentCapabilities route intent', () => {
  it('validates routes for any customer ask type', () => {
    const crm = validateAstraRouteIntent({
      understanding: 'List deals over 50K and show a pie of those deals',
      goal: 'table + record-level pie',
      route: 'crm_data',
      needsCrmData: true,
      outputs: ['table', 'chart'],
      constraints: ['no stage group-by'],
    });
    assert.equal(crm.route, 'crm_data');
    assert.equal(crm.needsCrmData, true);
    assert.ok(crm.understanding.includes('50K'));

    const email = validateAstraRouteIntent({
      understanding: 'Draft an email to Prabhu',
      route: 'email',
      outputs: ['email_draft'],
    });
    assert.equal(email.route, 'email');
    assert.equal(email.needsCrmData, false);

    const web = validateAstraRouteIntent({
      understanding: 'Research Acme Corp website',
      route: 'research',
      needsWeb: true,
    });
    assert.equal(web.route, 'web_research');
    assert.equal(web.needsWeb, true);

    const general = validateAstraRouteIntent({
      understanding: 'How do I invite a teammate?',
      route: 'help',
    });
    assert.equal(general.route, 'general');

    const unknown = validateAstraRouteIntent({ route: 'not_a_real_route' });
    assert.equal(unknown.route, 'general');
  });

  it('deterministic overrides: howto, ambiguous, record-chart, won', () => {
    const howto = resolveDeterministicRouteIntent(
      'How do I convert a deal to a quote, and which fields are required on each?',
    );
    assert.equal(howto.route, 'general');
    assert.equal(howto.skipLlm, true);
    assert.equal(howto.needsCrmData, false);

    const amb = resolveDeterministicRouteIntent('Show me the important ones');
    assert.equal(amb.route, 'clarify');
    assert.equal(amb.skipLlm, true);
    assert.ok(amb.clarifyingQuestion);

    const pie = resolveDeterministicRouteIntent(
      'List deals over 10K$ and show them as a pie chart (not by stage — by record)',
    );
    assert.equal(pie.route, 'crm_data');
    assert.ok(pie.constraints.includes('chart_by_record'));
    assert.equal(pie.skipLlm, false);

    const won = resolveDeterministicRouteIntent('Give me the listy of Won deals');
    assert.equal(won.route, 'crm_data');
    assert.ok(won.constraints.includes('won_outcome_filter'));

    const summarize = resolveDeterministicRouteIntent('Summarize this record', { pageKind: 'record' });
    assert.equal(summarize.skipLlm, true);
    assert.equal(summarize.needsCrmData, false);
    assert.equal(summarize.source, 'record_summarize');

    const nba = resolveDeterministicRouteIntent('What should I do next?', { pageKind: 'record' });
    assert.equal(nba.skipLlm, true);
    assert.equal(nba.source, 'record_nba');
  });

  it('merge: deterministic wins over sticky LLM crm_data for howto', () => {
    const det = resolveDeterministicRouteIntent('How do I convert a deal to a quote?');
    const merged = mergeRouteIntentWithDeterministic({
      route: 'crm_data',
      needsCrmData: true,
      understanding: 'wrong sticky list',
    }, det);
    assert.equal(merged.route, 'general');
    assert.equal(merged.needsCrmData, false);
  });

  it('merge: LLM understanding kept when CRM override enriches', () => {
    const det = resolveDeterministicRouteIntent('Show won deals');
    const merged = mergeRouteIntentWithDeterministic({
      route: 'email',
      understanding: 'User wants Won deals listed',
      needsCrmData: false,
    }, det);
    assert.equal(merged.route, 'crm_data');
    assert.equal(merged.needsCrmData, true);
    assert.match(merged.understanding, /Won deals/i);
  });

  it('exposes known routes', () => {
    assert.ok(ASTRA_ROUTES.includes('crm_data'));
    assert.ok(ASTRA_ROUTES.includes('clarify'));
  });
});

describe('formatRouteIntentPromptRules', () => {
  it('adds record-chart constraint rules', () => {
    const rules = formatRouteIntentPromptRules({
      route: 'crm_data',
      understanding: 'pie by record',
      constraints: ['chart_by_record'],
    });
    assert.ok(rules.some((r) => /individually|stage/i.test(r)));
  });
});
