'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getUserAppKeys,
  getOrganizationPlanTier,
  releaseMatchesApps,
  releaseMatchesPlans,
  userMatchesReleaseTargeting
} = require('../releaseNoteTargetingService');
const {
  computeCombinedImportance,
  computeSurface
} = require('../releaseNoteService');

describe('releaseNoteTargetingService', () => {
  it('collects active app keys from appAccess and allowedApps', () => {
    const keys = getUserAppKeys({
      appAccess: [{ appKey: 'SALES', status: 'ACTIVE' }, { appKey: 'HELPDESK', status: 'DISABLED' }],
      allowedApps: ['AUDIT']
    });
    assert.deepEqual(keys.sort(), ['AUDIT', 'SALES']);
  });

  it('matches when targetApps is empty', () => {
    assert.equal(releaseMatchesApps({ targetApps: [] }, ['SALES']), true);
  });

  it('matches when user has at least one targeted app', () => {
    assert.equal(releaseMatchesApps({ targetApps: ['HELPDESK'] }, ['SALES', 'HELPDESK']), true);
    assert.equal(releaseMatchesApps({ targetApps: ['HELPDESK'] }, ['SALES']), false);
  });

  it('matches plan tier when targetPlans is empty', () => {
    assert.equal(releaseMatchesPlans({ targetPlans: [] }, 'trial'), true);
  });

  it('matches specific plan tiers', () => {
    assert.equal(releaseMatchesPlans({ targetPlans: ['paid'] }, 'paid'), true);
    assert.equal(releaseMatchesPlans({ targetPlans: ['paid'] }, 'trial'), false);
  });

  it('resolves organization plan tier', () => {
    assert.equal(getOrganizationPlanTier({ subscription: { tier: 'paid' } }), 'paid');
    assert.equal(getOrganizationPlanTier({ subscription: { tier: 'trial' } }), 'trial');
    assert.equal(getOrganizationPlanTier(null), 'trial');
  });

  it('falls back to organization enabledApps when user has no app keys', () => {
    const keys = getUserAppKeys(
      {},
      { enabledApps: [{ appKey: 'SALES', status: 'ACTIVE' }, { appKey: 'HELPDESK', status: 'SUSPENDED' }] }
    );
    assert.deepEqual(keys, ['SALES']);
  });

  it('combines app and plan targeting', () => {
    const user = { appAccess: [{ appKey: 'HELPDESK', status: 'ACTIVE' }] };
    const organization = { subscription: { tier: 'trial' } };
    const release = { targetApps: ['HELPDESK'], targetPlans: ['trial'] };
    assert.equal(userMatchesReleaseTargeting({ user, organization, releaseNote: release }), true);

    const paidOrg = { subscription: { tier: 'paid' } };
    assert.equal(userMatchesReleaseTargeting({ user, organization: paidOrg, releaseNote: release }), false);
  });
});

describe('releaseNote surface helpers', () => {
  it('picks the highest importance in a batch', () => {
    assert.equal(
      computeCombinedImportance([
        { importance: 'patch' },
        { importance: 'minor' },
        { importance: 'major' }
      ]),
      'major'
    );
  });

  it('maps importance to surface', () => {
    assert.equal(computeSurface('major'), 'modal');
    assert.equal(computeSurface('minor'), 'drawer');
    assert.equal(computeSurface('patch'), 'drawer');
  });
});
