'use strict';

/**
 * Regression lock: empty Customer 360 / FOCUS=General when company names
 * were misclassified as people (e.g. "Vtiger CRM").
 *
 * If these fail, hydrate will again skip org search and leave boards empty.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractEntityHint,
  looksLikePersonNameHint,
  looksLikeCompanyHint,
  resolveFocusFromPrompt,
} = require('../canvasHydrateService');
const { inferCanvasIntentHeuristic } = require('../canvasIntent');
const { getHydratePolicy } = require('../hydratePolicy');

const CUSTOMER_360_PROMPT = "Give me Customer 360 of 'Vtiger CRM'";

describe('regression: customer 360 company focus', () => {
  it('extracts quoted company from Customer 360 of …', () => {
    assert.equal(extractEntityHint(CUSTOMER_360_PROMPT), 'Vtiger CRM');
    assert.equal(
      extractEntityHint('Customer 360 of Acme Software'),
      'Acme Software',
    );
  });

  it('does not treat company/product names as people', () => {
    assert.equal(looksLikeCompanyHint('Vtiger CRM'), true);
    assert.equal(looksLikePersonNameHint('Vtiger CRM'), false);
    assert.equal(looksLikePersonNameHint('Acme Inc'), false);
    assert.equal(looksLikePersonNameHint('Prabhu Balu'), true);
  });

  it('intent is customer_360 + account scope + Vtiger entity', () => {
    const intent = inferCanvasIntentHeuristic({ prompt: CUSTOMER_360_PROMPT });
    assert.equal(intent.canvasType, 'customer_360');
    assert.equal(intent.scope, 'account');
    assert.equal(intent.entityHint, 'Vtiger CRM');
  });

  it('customer_360 policy prefers organizations first', () => {
    const policy = getHydratePolicy('customer_360');
    assert.equal(policy.preferredFocusModules[0], 'organizations');
    assert.equal(policy.fillWithoutParty, false);
  });

  it('resolveFocusFromPrompt binds organization for Vtiger CRM (not General)', async () => {
    const searchService = require('../../searchService');
    const prev = searchService.searchAll;
    searchService.searchAll = async () => ({
      results: {
        people: [],
        organizations: [{ id: 'org-vtiger', title: 'Vtiger CRM', name: 'Vtiger CRM' }],
        deals: [{ id: 'deal-1', title: 'Sample Deal' }],
        cases: [],
        quotes: [],
        tasks: [],
        events: [],
      },
    });
    try {
      const focus = await resolveFocusFromPrompt({
        organizationId: 'tenant-1',
        prompt: CUSTOMER_360_PROMPT,
        entityHint: 'Vtiger CRM',
        preferredModules: ['organizations', 'people', 'deals'],
      });
      assert.ok(focus.length, 'expected CRM focus rows');
      assert.equal(focus[0].moduleKey, 'organizations');
      assert.equal(focus[0].recordId, 'org-vtiger');
      assert.ok(/Vtiger/i.test(String(focus[0].recordName || '')));
    } finally {
      searchService.searchAll = prev;
    }
  });

  it('skips focus for org-scoped executive (by design)', async () => {
    const focus = await resolveFocusFromPrompt({
      organizationId: 'tenant-1',
      prompt: 'Build an executive report for this quarter pipeline',
      skipFocus: true,
    });
    assert.deepEqual(focus, []);
  });
});
