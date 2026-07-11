'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  ONBOARDING_ORIGINS,
  ONBOARDING_PERSONAS,
  resolvePersona,
  initializeOnboardingForUser,
  isFounderWizardComplete,
  shouldRedirectToOnboarding,
  resolveAvailableApps,
  syncAutomaticCompletions,
  markStep,
  createStepState,
  STEP_STATUS,
  FOUNDER_WIZARD_STEP_KEYS,
  getPendingCoachmarks,
  hasModuleVisit,
  recordModuleVisit
} = require('../onboardingService');

describe('onboardingService', () => {
  it('resolves founder persona for self-serve origin', () => {
    const user = { isOwner: true, onboarding: { origin: ONBOARDING_ORIGINS.SELF_SERVE } };
    assert.equal(resolvePersona(user), ONBOARDING_PERSONAS.FOUNDER);
  });

  it('resolves member persona for invited origin', () => {
    const user = { onboarding: { origin: ONBOARDING_ORIGINS.INVITED } };
    assert.equal(resolvePersona(user), ONBOARDING_PERSONAS.MEMBER);
  });

  it('initializes founder wizard steps with structured state', async () => {
    const user = {};
    await initializeOnboardingForUser(user, { origin: ONBOARDING_ORIGINS.SELF_SERVE });
    assert.equal(user.onboarding.persona, ONBOARDING_PERSONAS.FOUNDER);
    assert.equal(user.onboarding.steps.length, FOUNDER_WIZARD_STEP_KEYS.length);
  });

  it('lists org-enabled internal apps for founders', () => {
    const organization = {
      enabledApps: [
        { appKey: 'SALES', status: 'ACTIVE' },
        { appKey: 'HELPDESK', status: 'ACTIVE' },
        { appKey: 'MARKETING', status: 'ACTIVE' },
        { appKey: 'PORTAL', status: 'ACTIVE' }
      ]
    };
    const founder = {
      isOwner: true,
      appAccess: [{ appKey: 'SALES', status: 'ACTIVE' }],
      onboarding: { origin: ONBOARDING_ORIGINS.SELF_SERVE }
    };

    assert.deepEqual(resolveAvailableApps(organization, founder), [
      'SALES',
      'HELPDESK',
      'MARKETING'
    ]);
  });

  it('preserves founder primary app selection during sync', async () => {
    const user = {
      isOwner: true,
      onboarding: {
        origin: ONBOARDING_ORIGINS.SELF_SERVE,
        persona: ONBOARDING_PERSONAS.FOUNDER,
        context: { primaryAppKey: 'HELPDESK' },
        steps: FOUNDER_WIZARD_STEP_KEYS.map((key) => createStepState(key)),
        goalKey: 'support'
      },
      appAccess: [
        { appKey: 'SALES', status: 'ACTIVE' },
        { appKey: 'HELPDESK', status: 'ACTIVE' }
      ]
    };
    const organization = {
      enabledApps: [
        { appKey: 'SALES', status: 'ACTIVE' },
        { appKey: 'HELPDESK', status: 'ACTIVE' }
      ]
    };

    await syncAutomaticCompletions(user, organization);
    assert.equal(user.onboarding.context.primaryAppKey, 'HELPDESK');
  });

  it('lists only entitled apps for invited members', () => {
    const organization = {
      enabledApps: [
        { appKey: 'SALES', status: 'ACTIVE' },
        { appKey: 'HELPDESK', status: 'ACTIVE' }
      ]
    };
    const member = {
      appAccess: [{ appKey: 'HELPDESK', status: 'ACTIVE' }],
      onboarding: { origin: ONBOARDING_ORIGINS.INVITED }
    };

    assert.deepEqual(resolveAvailableApps(organization, member), ['HELPDESK']);
  });

  it('redirects founder until wizard steps are done or skipped', () => {
    const user = {
      isOwner: true,
      onboarding: {
        origin: ONBOARDING_ORIGINS.SELF_SERVE,
        persona: ONBOARDING_PERSONAS.FOUNDER,
        steps: FOUNDER_WIZARD_STEP_KEYS.map((key) => createStepState(key))
      }
    };
    assert.equal(shouldRedirectToOnboarding(user), true);

    user.onboarding.steps = markStep(user.onboarding.steps, 'founder_goal', STEP_STATUS.COMPLETED);
    user.onboarding.steps = markStep(user.onboarding.steps, 'founder_workspace', STEP_STATUS.SKIPPED);
    user.onboarding.steps = markStep(user.onboarding.steps, 'founder_first_app', STEP_STATUS.SKIPPED);
    user.onboarding.steps = markStep(user.onboarding.steps, 'founder_first_record', STEP_STATUS.SKIPPED);
    user.onboarding.steps = markStep(user.onboarding.steps, 'founder_invite_teammate', STEP_STATUS.SKIPPED);
    assert.equal(isFounderWizardComplete(user), true);
    assert.equal(shouldRedirectToOnboarding(user), false);
  });

  it('returns pending coachmarks until marked seen', () => {
    const user = {
      onboarding: {
        origin: ONBOARDING_ORIGINS.INVITED,
        coachmarks: [{ key: 'sidebar', seenAt: new Date() }]
      }
    };
    assert.deepEqual(getPendingCoachmarks(user), ['command_palette', 'tabs']);
  });

  it('records module visits once per module and app', () => {
    const user = {
      onboarding: {
        origin: ONBOARDING_ORIGINS.INVITED,
        persona: ONBOARDING_PERSONAS.MEMBER,
        steps: [],
        moduleVisits: []
      }
    };
    assert.equal(hasModuleVisit(user, 'people', 'SALES'), false);
    recordModuleVisit(user, 'people', 'SALES');
    assert.equal(hasModuleVisit(user, 'people', 'SALES'), true);
    recordModuleVisit(user, 'people', 'SALES');
    assert.equal(user.onboarding.moduleVisits.length, 1);
  });
});
