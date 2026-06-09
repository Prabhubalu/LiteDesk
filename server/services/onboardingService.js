'use strict';

const Role = require('../models/Role');
const User = require('../models/User');
const Organization = require('../models/Organization');
const People = require('../models/People');
const Mailbox = require('../models/Mailbox');
const ImportHistory = require('../models/ImportHistory');

const ONBOARDING_VERSION = 1;

const ONBOARDING_ORIGINS = Object.freeze({
  INVITED: 'invited',
  SELF_SERVE: 'self_serve',
  DEMO_CONVERTED: 'demo_converted'
});

const ONBOARDING_PERSONAS = Object.freeze({
  FOUNDER: 'founder',
  MEMBER: 'member'
});

const STEP_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
  SKIPPED: 'skipped'
});

/** Founder wizard steps (sequential setup). */
const FOUNDER_WIZARD_STEP_KEYS = Object.freeze([
  'founder_goal',
  'founder_workspace',
  'founder_first_app',
  'founder_first_record',
  'founder_invite_teammate'
]);

/** Member checklist on Platform Home. */
const MEMBER_STEP_KEYS = Object.freeze([
  'member_complete_profile',
  'member_visit_module',
  'member_first_action',
  'member_notification_prefs'
]);

/** Org-level setup progress (founders). */
const ORG_STEP_KEYS = Object.freeze([
  'org_workspace_profile',
  'org_first_record',
  'org_email_connected',
  'org_invite_sent',
  'org_import_done',
  'org_settings_visited'
]);

const GOAL_KEYS = Object.freeze(['sales', 'support', 'audit', 'explore']);

const COACHMARK_KEYS = Object.freeze(['sidebar', 'command_palette', 'tabs']);

const FIRST_TIME_MODULE_COPY = Object.freeze({
  people: {
    titleKey: 'onboarding.firstTimePeopleTitle',
    descriptionKey: 'onboarding.firstTimePeopleDescription',
    actionLabelKey: 'onboarding.firstTimePeopleAction'
  },
  deals: {
    titleKey: 'onboarding.firstTimeDealsTitle',
    descriptionKey: 'onboarding.firstTimeDealsDescription',
    actionLabelKey: 'onboarding.firstTimeDealsAction'
  },
  tasks: {
    titleKey: 'onboarding.firstTimeTasksTitle',
    descriptionKey: 'onboarding.firstTimeTasksDescription',
    actionLabelKey: 'onboarding.firstTimeTasksAction'
  },
  cases: {
    titleKey: 'onboarding.firstTimeCasesTitle',
    descriptionKey: 'onboarding.firstTimeCasesDescription',
    actionLabelKey: 'onboarding.firstTimeCasesAction'
  },
  organizations: {
    titleKey: 'onboarding.firstTimeOrganizationsTitle',
    descriptionKey: 'onboarding.firstTimeOrganizationsDescription',
    actionLabelKey: 'onboarding.firstTimeOrganizationsAction'
  }
});

const PRIMARY_ROUTE_BY_APP = Object.freeze({
  SALES: '/people',
  HELPDESK: '/helpdesk/cases',
  AUDIT: '/audit/assignments',
  PROJECTS: '/projects',
  PORTAL: '/portal',
  INBOX: '/inbox'
});

function createStepState(key, status = STEP_STATUS.PENDING) {
  const now = new Date();
  return {
    key,
    status,
    completedAt: status === STEP_STATUS.COMPLETED ? now : null,
    skippedAt: status === STEP_STATUS.SKIPPED ? now : null
  };
}

function stepMap(steps) {
  const map = new Map();
  for (const step of steps || []) {
    if (step?.key) map.set(step.key, step);
  }
  return map;
}

function ensureSteps(existingSteps, keys) {
  const map = stepMap(existingSteps);
  return keys.map((key) => map.get(key) || createStepState(key));
}

function markStep(steps, key, status) {
  const now = new Date();
  const map = stepMap(steps);
  const current = map.get(key) || createStepState(key);
  current.status = status;
  if (status === STEP_STATUS.COMPLETED) {
    current.completedAt = now;
    current.skippedAt = null;
  } else if (status === STEP_STATUS.SKIPPED) {
    current.skippedAt = now;
    current.completedAt = null;
  } else {
    current.completedAt = null;
    current.skippedAt = null;
  }
  map.set(key, current);
  return Array.from(map.values());
}

function isStepDone(step) {
  return step?.status === STEP_STATUS.COMPLETED || step?.status === STEP_STATUS.SKIPPED;
}

function countProgress(steps, keys) {
  const map = stepMap(steps);
  let completed = 0;
  for (const key of keys) {
    if (isStepDone(map.get(key))) completed += 1;
  }
  return { completed, total: keys.length };
}

function resolvePersona(user) {
  const origin = user?.onboarding?.origin;
  if (origin === ONBOARDING_ORIGINS.INVITED) {
    return ONBOARDING_PERSONAS.MEMBER;
  }
  if (
    origin === ONBOARDING_ORIGINS.SELF_SERVE
    || origin === ONBOARDING_ORIGINS.DEMO_CONVERTED
    || user?.isOwner === true
  ) {
    return ONBOARDING_PERSONAS.FOUNDER;
  }
  return ONBOARDING_PERSONAS.MEMBER;
}

function getEntitledAppKeys(user) {
  if (Array.isArray(user?.appAccess) && user.appAccess.length > 0) {
    return user.appAccess
      .filter((a) => a && a.status === 'ACTIVE' && a.appKey)
      .map((a) => String(a.appKey).toUpperCase());
  }
  if (Array.isArray(user?.allowedApps) && user.allowedApps.length > 0) {
    return user.allowedApps.map((a) => String(a).toUpperCase());
  }
  return ['SALES'];
}

async function resolveContext(user, organization) {
  const entitledAppKeys = getEntitledAppKeys(user);
  const primaryAppKey = entitledAppKeys[0] || 'SALES';

  let roleKey = user?.role || null;
  let roleName = user?.role || null;

  if (user?.roleId) {
    const role = await Role.findById(user.roleId).select('name key').lean();
    if (role) {
      roleKey = role.key || role.name || roleKey;
      roleName = role.name || roleName;
    }
  }

  const activeAccess = (user?.appAccess || []).find((a) => a?.status === 'ACTIVE');
  if (activeAccess?.roleKey) {
    roleKey = activeAccess.roleKey;
  }

  return {
    primaryAppKey,
    roleKey: roleKey || 'USER',
    roleName: roleName || 'User',
    entitledAppKeys
  };
}

function getOrgEnabledAppKeys(organization) {
  if (!Array.isArray(organization?.enabledApps)) return ['SALES'];
  return organization.enabledApps
    .map((app) => {
      if (typeof app === 'string') return app.toUpperCase();
      if (app && typeof app === 'object') {
        const status = String(app.status || 'ACTIVE').toUpperCase();
        if (status !== 'ACTIVE') return null;
        return typeof app.appKey === 'string' ? app.appKey.toUpperCase() : null;
      }
      return null;
    })
    .filter(Boolean);
}

function resolveAvailableApps(organization, user) {
  const orgApps = getOrgEnabledAppKeys(organization);
  const userApps = getEntitledAppKeys(user);
  if (!orgApps.length) return userApps;
  return userApps.filter((key) => orgApps.includes(key));
}

function getPendingCoachmarks(user) {
  if (!user?.onboarding?.origin) return [];
  const seen = new Set((user.onboarding.coachmarks || []).map((c) => c.key));
  return COACHMARK_KEYS.filter((key) => !seen.has(key));
}

function hasModuleVisit(user, moduleKey, appKey) {
  const visits = user?.onboarding?.moduleVisits || [];
  return visits.some(
    (v) => v.moduleKey === moduleKey && v.appKey === appKey
  );
}

function recordModuleVisit(user, moduleKey, appKey) {
  if (!user.onboarding) return user;
  const visits = user.onboarding.moduleVisits || [];
  if (!hasModuleVisit(user, moduleKey, appKey)) {
    visits.push({
      moduleKey,
      appKey,
      visitedAt: new Date()
    });
  }
  user.onboarding.moduleVisits = visits;

  if (resolvePersona(user) === ONBOARDING_PERSONAS.MEMBER) {
    user.onboarding.steps = markStep(
      user.onboarding.steps || [],
      'member_visit_module',
      STEP_STATUS.COMPLETED
    );
  }

  return user;
}

function buildFirstTimeEmptyStateCopy(moduleKey, appKey, hasPrimaryActions) {
  const copy = FIRST_TIME_MODULE_COPY[moduleKey];
  if (!copy) return null;
  return {
    type: 'FIRST_TIME',
    titleKey: copy.titleKey,
    descriptionKey: copy.descriptionKey,
    primaryAction: hasPrimaryActions
      ? {
          labelKey: copy.actionLabelKey,
          route: PRIMARY_ROUTE_BY_APP[appKey] || `/${moduleKey}`
        }
      : undefined
  };
}

function resolvePrimaryRoute(context) {
  return PRIMARY_ROUTE_BY_APP[context.primaryAppKey] || '/platform/home';
}

async function countOrgConnectedMailboxes(organization) {
  if (!organization?._id) return 0;
  try {
    return await Mailbox.countDocuments({
      organizationId: organization._id,
      $or: [
        { syncStatus: 'connected' },
        { inboxSyncEncryptedRefreshToken: { $exists: true, $nin: [null, ''] } },
        { outboundChannel: { $in: ['gmail_api', 'gmail_smtp'] } }
      ]
    });
  } catch (_err) {
    return 0;
  }
}

async function countOrgCompletedImports(organizationId) {
  if (!organizationId) return 0;
  try {
    return await ImportHistory.countDocuments({
      organizationId,
      status: { $in: ['completed', 'partial'] }
    });
  } catch (_err) {
    return 0;
  }
}

function hasOrgWorkspaceProfile(organization) {
  return Boolean(
    organization?.name
    && organization?.settings?.timeZone
    && organization?.settings?.currency
  );
}

async function syncOrgAutomaticCompletions(organization) {
  if (!organization?._id) return organization;

  if (!organization.onboarding) {
    organization.onboarding = { steps: ensureSteps([], ORG_STEP_KEYS) };
  }

  let steps = ensureSteps(organization.onboarding.steps || [], ORG_STEP_KEYS);

  if (hasOrgWorkspaceProfile(organization)) {
    steps = markStep(steps, 'org_workspace_profile', STEP_STATUS.COMPLETED);
  }

  const peopleCount = await countOrgPeople(organization._id);
  if (peopleCount > 0) {
    steps = markStep(steps, 'org_first_record', STEP_STATUS.COMPLETED);
  }

  const activeUsers = await countOrgActiveUsers(organization);
  if (activeUsers > 1) {
    steps = markStep(steps, 'org_invite_sent', STEP_STATUS.COMPLETED);
  }

  const connectedMailboxes = await countOrgConnectedMailboxes(organization);
  if (connectedMailboxes > 0) {
    steps = markStep(steps, 'org_email_connected', STEP_STATUS.COMPLETED);
  }

  const completedImports = await countOrgCompletedImports(organization._id);
  if (completedImports > 0) {
    steps = markStep(steps, 'org_import_done', STEP_STATUS.COMPLETED);
  }

  if (organization.onboarding.settingsVisitedAt) {
    steps = markStep(steps, 'org_settings_visited', STEP_STATUS.COMPLETED);
  }

  organization.onboarding.steps = steps;
  return organization;
}

async function countOrgPeople(organizationId) {
  try {
    return await People.countDocuments({ organizationId, deletedAt: null });
  } catch (_err) {
    return 0;
  }
}

async function countOrgActiveUsers(organization) {
  if (!organization?._id) return 0;
  try {
    if (organization.database?.name && organization.database.initialized) {
      const dbConnectionManager = require('../utils/databaseConnectionManager');
      const conn = await dbConnectionManager.getOrganizationConnection(organization.database.name);
      const ScopedUser = conn.models.User || User;
      return await ScopedUser.countDocuments({
        organizationId: organization._id,
        status: 'active'
      });
    }
    return await User.countDocuments({
      organizationId: organization._id,
      status: 'active'
    });
  } catch (_err) {
    return 0;
  }
}

async function markOrgInviteSent(organization) {
  if (!organization?.save) return organization;
  if (!organization.onboarding) {
    organization.onboarding = { steps: ensureSteps([], ORG_STEP_KEYS) };
  }
  organization.onboarding.steps = markStep(
    organization.onboarding.steps || [],
    'org_invite_sent',
    STEP_STATUS.COMPLETED
  );
  await organization.save();
  return organization;
}

async function createFirstContactForUser(user, organization, contact = {}) {
  const firstName = String(contact.firstName || contact.first_name || '').trim();
  const lastName = String(contact.lastName || contact.last_name || '').trim();
  if (!firstName) {
    const err = new Error('First name is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const payload = {
    organizationId: organization._id,
    createdBy: user._id,
    assignedTo: user._id,
    first_name: firstName,
    last_name: lastName
  };
  const email = String(contact.email || '').trim();
  if (email) payload.email = email.toLowerCase();

  return People.create(payload);
}

function buildMemberStepDefinitions(context) {
  const moduleRoute = resolvePrimaryRoute(context);
  return [
    {
      key: 'member_complete_profile',
      labelKey: 'onboarding.stepCompleteProfile',
      route: '/settings?tab=profile',
      optional: false
    },
    {
      key: 'member_visit_module',
      labelKey: 'onboarding.stepVisitModule',
      route: moduleRoute,
      optional: false
    },
    {
      key: 'member_first_action',
      labelKey: 'onboarding.stepFirstAction',
      route: moduleRoute,
      optional: false
    },
    {
      key: 'member_notification_prefs',
      labelKey: 'onboarding.stepNotificationPrefs',
      route: '/settings?tab=notifications',
      optional: true
    }
  ];
}

function buildFounderWizardDefinitions(context, availableApps = []) {
  const apps = availableApps.length ? availableApps : (context?.entitledAppKeys || ['SALES']);
  return [
    { key: 'founder_goal', labelKey: 'onboarding.stepFounderGoal', optional: false },
    { key: 'founder_workspace', labelKey: 'onboarding.stepFounderWorkspace', optional: false },
    {
      key: 'founder_first_app',
      labelKey: 'onboarding.stepFounderFirstApp',
      optional: apps.length <= 1
    },
    {
      key: 'founder_first_record',
      labelKey: 'onboarding.stepFounderFirstRecord',
      route: PRIMARY_ROUTE_BY_APP[context?.primaryAppKey] || '/people',
      optional: false
    },
    {
      key: 'founder_invite_teammate',
      labelKey: 'onboarding.stepFounderInviteTeammate',
      route: '/settings?tab=users',
      optional: true
    }
  ];
}

function buildOrgStepDefinitions() {
  return [
    { key: 'org_workspace_profile', labelKey: 'onboarding.stepOrgWorkspace', route: '/settings?tab=organization', optional: false },
    { key: 'org_first_record', labelKey: 'onboarding.stepOrgFirstRecord', route: '/people', optional: false },
    { key: 'org_email_connected', labelKey: 'onboarding.stepOrgEmail', route: '/settings?tab=integrations', optional: true },
    { key: 'org_invite_sent', labelKey: 'onboarding.stepOrgInvite', route: '/settings?tab=users', optional: true },
    { key: 'org_import_done', labelKey: 'onboarding.stepOrgImport', route: '/imports', optional: true },
    { key: 'org_settings_visited', labelKey: 'onboarding.stepOrgSettings', route: '/settings', optional: true }
  ];
}

function serializeStep(definition, state) {
  return {
    key: definition.key,
    labelKey: definition.labelKey,
    route: definition.route,
    optional: definition.optional === true,
    status: state?.status || STEP_STATUS.PENDING,
    completedAt: state?.completedAt || null,
    skippedAt: state?.skippedAt || null
  };
}

function isFounderWizardComplete(user) {
  const map = stepMap(user?.onboarding?.steps);
  return FOUNDER_WIZARD_STEP_KEYS.every((key) => isStepDone(map.get(key)));
}

function shouldRedirectToOnboarding(user) {
  if (resolvePersona(user) !== ONBOARDING_PERSONAS.FOUNDER) return false;
  if (user?.onboarding?.completedAt) return false;
  return !isFounderWizardComplete(user);
}

function isOnboardingActive(user) {
  return !user?.onboarding?.completedAt;
}

async function initializeOnboardingForUser(user, { origin, welcomeNote = null, suggestedTask = null } = {}) {
  if (!user) return user;

  const persona = origin === ONBOARDING_ORIGINS.INVITED
    ? ONBOARDING_PERSONAS.MEMBER
    : ONBOARDING_PERSONAS.FOUNDER;

  const initialSteps = persona === ONBOARDING_PERSONAS.FOUNDER
    ? ensureSteps([], FOUNDER_WIZARD_STEP_KEYS)
    : ensureSteps([], MEMBER_STEP_KEYS);

  user.onboarding = {
    version: ONBOARDING_VERSION,
    origin: origin || null,
    persona,
    context: user.onboarding?.context || {},
    goalKey: user.onboarding?.goalKey || null,
    startedAt: null,
    completedAt: null,
    dismissedAt: null,
    welcomeNote: welcomeNote || user.onboarding?.welcomeNote || null,
    suggestedTask: suggestedTask || user.onboarding?.suggestedTask || null,
    steps: initialSteps,
    coachmarks: user.onboarding?.coachmarks || []
  };

  return user;
}

async function ensureOnboardingStarted(user) {
  if (!user?.onboarding?.origin) return user;
  if (!user.onboarding.startedAt) {
    user.onboarding.startedAt = new Date();
  }
  if (!user.onboarding.persona) {
    user.onboarding.persona = resolvePersona(user);
  }
  return user;
}

async function syncAutomaticCompletions(user, organization) {
  if (!user?.onboarding) return user;

  const persona = resolvePersona(user);
  const stepKeys = persona === ONBOARDING_PERSONAS.FOUNDER
    ? FOUNDER_WIZARD_STEP_KEYS
    : MEMBER_STEP_KEYS;
  let steps = ensureSteps(user.onboarding.steps || [], stepKeys);
  const context = await resolveContext(user, organization);
  const availableApps = resolveAvailableApps(organization, user);

  if (persona === ONBOARDING_PERSONAS.MEMBER) {
    const profileComplete = Boolean(
      user.avatar
      || user.onboarding?.profile?.timeZone
      || user.onboarding?.profile?.completedAt
      || (user.firstName && user.lastName)
    );
    if (profileComplete) {
      steps = markStep(steps, 'member_complete_profile', STEP_STATUS.COMPLETED);
    }
  }

  if (persona === ONBOARDING_PERSONAS.FOUNDER) {
    if (user.onboarding.goalKey) {
      steps = markStep(steps, 'founder_goal', STEP_STATUS.COMPLETED);
    }
    if (availableApps.length <= 1) {
      steps = markStep(steps, 'founder_first_app', STEP_STATUS.COMPLETED);
      if (availableApps[0]) {
        context.primaryAppKey = availableApps[0];
      }
    }
    const peopleCount = organization?._id
      ? await countOrgPeople(organization._id)
      : 0;
    if (peopleCount > 0) {
      steps = markStep(steps, 'founder_first_record', STEP_STATUS.COMPLETED);
    }
    const activeUsers = organization ? await countOrgActiveUsers(organization) : 0;
    if (activeUsers > 1) {
      steps = markStep(steps, 'founder_invite_teammate', STEP_STATUS.COMPLETED);
    }
    if (organization) {
      await syncOrgAutomaticCompletions(organization);
    }
  }

  user.onboarding.context = context;
  user.onboarding.steps = steps;

  if (persona === ONBOARDING_PERSONAS.FOUNDER && isFounderWizardComplete(user) && !user.onboarding.completedAt) {
    user.onboarding.completedAt = new Date();
  }

  const memberProgress = countProgress(steps, MEMBER_STEP_KEYS);
  if (
    persona === ONBOARDING_PERSONAS.MEMBER
    && memberProgress.completed === memberProgress.total
    && !user.onboarding.completedAt
  ) {
    user.onboarding.completedAt = new Date();
  }

  return user;
}

async function getInviterSummary(user, organization) {
  if (!user?.invitedBy) return null;

  const UserModel = User;
  const inviter = await UserModel.findById(user.invitedBy)
    .select('firstName lastName email')
    .lean();

  if (!inviter) return null;

  const name = [inviter.firstName, inviter.lastName].filter(Boolean).join(' ')
    || inviter.email;

  return { id: String(inviter._id), name };
}

function buildWelcomePayload(user, organization, context, inviter) {
  const persona = resolvePersona(user);
  const primaryRoute = resolvePrimaryRoute(context);

  return {
    orgName: organization?.name || '',
    firstName: user?.firstName || user?.username || '',
    inviterName: inviter?.name || null,
    roleName: context.roleName,
    welcomeNote: user?.onboarding?.welcomeNote || null,
    suggestedTask: user?.onboarding?.suggestedTask || null,
    entitledApps: context.entitledAppKeys,
    primaryAction: {
      labelKey: persona === ONBOARDING_PERSONAS.FOUNDER
        ? 'onboarding.actionOpenSetup'
        : 'onboarding.actionOpenModule',
      route: persona === ONBOARDING_PERSONAS.FOUNDER ? '/onboarding' : primaryRoute
    }
  };
}

async function computeTrialSummary(organization) {
  const subscription = organization?.subscription;
  if (!subscription || subscription.status !== 'trial') return null;

  const trialEnd = subscription.trialEndDate ? new Date(subscription.trialEndDate) : null;
  let daysRemaining = null;
  if (trialEnd) {
    daysRemaining = Math.max(0, Math.ceil((trialEnd - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  let contactsUsed = 0;
  try {
    contactsUsed = await People.countDocuments({
      organizationId: organization._id,
      deletedAt: null
    });
  } catch (_err) {
    contactsUsed = 0;
  }

  return {
    daysRemaining,
    contactsUsed,
    contactsLimit: organization?.limits?.maxContacts ?? null
  };
}

async function getUserOnboardingState(user, organization, options = {}) {
  await ensureOnboardingStarted(user);
  await syncAutomaticCompletions(user, organization);

  const persona = resolvePersona(user);
  const context = await resolveContext(user, organization);
  const inviter = persona === ONBOARDING_PERSONAS.MEMBER
    ? await getInviterSummary(user, organization)
    : null;

  const userStepMap = stepMap(user.onboarding?.steps);
  const availableApps = resolveAvailableApps(organization, user);
  const memberDefs = buildMemberStepDefinitions(context);
  const founderWizardDefs = buildFounderWizardDefinitions(context, availableApps);

  let steps = [];
  if (persona === ONBOARDING_PERSONAS.FOUNDER) {
    steps = founderWizardDefs.map((def) => serializeStep(def, userStepMap.get(def.key)));
  } else {
    steps = memberDefs.map((def) => serializeStep(def, userStepMap.get(def.key)));
  }

  const progressKeys = persona === ONBOARDING_PERSONAS.FOUNDER
    ? FOUNDER_WIZARD_STEP_KEYS
    : MEMBER_STEP_KEYS;
  const progress = countProgress(user.onboarding?.steps, progressKeys);

  let orgSteps = [];
  let orgProgress = { completed: 0, total: 0 };
  if (persona === ONBOARDING_PERSONAS.FOUNDER && organization) {
    const orgStepMap = stepMap(organization.onboarding?.steps);
    const orgDefs = buildOrgStepDefinitions();
    orgSteps = orgDefs.map((def) => serializeStep(def, orgStepMap.get(def.key)));
    orgProgress = countProgress(organization.onboarding?.steps, ORG_STEP_KEYS);
  }

  const showWelcome = isOnboardingActive(user)
    && !user.onboarding?.dismissedAt
    && (persona === ONBOARDING_PERSONAS.MEMBER || isFounderWizardComplete(user));

  const trial = persona === ONBOARDING_PERSONAS.FOUNDER
    ? await computeTrialSummary(organization)
    : null;

  const { resolveVerticalTemplate } = require('./onboardingVerticalTemplates');
  const peopleCount = organization?._id ? await countOrgPeople(organization._id) : 0;
  const verticalTemplate = organization ? resolveVerticalTemplate(organization) : null;
  const pendingCoachmarks = getPendingCoachmarks(user);
  const sampleDataOffer = persona === ONBOARDING_PERSONAS.FOUNDER && organization
    ? {
      available: !organization.onboarding?.sampleDataAccepted
        && !organization.onboarding?.sampleDataDeclinedAt
        && peopleCount === 0,
      accepted: Boolean(organization.onboarding?.sampleDataAccepted),
      declined: Boolean(organization.onboarding?.sampleDataDeclinedAt),
      templateKey: verticalTemplate?.key || 'sales_default'
    }
    : null;

  return {
    version: user.onboarding?.version || ONBOARDING_VERSION,
    origin: user.onboarding?.origin || null,
    persona,
    context,
    goalKey: user.onboarding?.goalKey || null,
    startedAt: user.onboarding?.startedAt || null,
    completedAt: user.onboarding?.completedAt || null,
    dismissedAt: user.onboarding?.dismissedAt || null,
    redirectTo: shouldRedirectToOnboarding(user) ? '/onboarding' : null,
    showWelcome,
    showSetupProgress: persona === ONBOARDING_PERSONAS.FOUNDER && isFounderWizardComplete(user),
    progress,
    steps,
    orgProgress,
    orgSteps,
    welcome: showWelcome || options.includeWelcome
      ? buildWelcomePayload(user, organization, context, inviter)
      : null,
    trial,
    goalOptions: GOAL_KEYS.map((key) => ({
      key,
      labelKey: `onboarding.goal${key.charAt(0).toUpperCase()}${key.slice(1)}`
    })),
    availableApps,
    moduleVisits: user.onboarding?.moduleVisits || [],
    pendingCoachmarks,
    verticalTemplate,
    sampleDataOffer
  };
}

async function getPlatformHomeOnboarding(req, organization) {
  if (!req?.user?._id) return null;

  const org = organization && organization.save
    ? organization
    : await Organization.findById(req.user.organizationId);

  if (!org) return null;

  let ScopedUser = User;
  if (org.database?.name && org.database.initialized) {
    const dbConnectionManager = require('../utils/databaseConnectionManager');
    const conn = await dbConnectionManager.getOrganizationConnection(org.database.name);
    ScopedUser = conn.models.User || User;
  }

  const user = await ScopedUser.findById(req.user._id);
  if (!user?.onboarding?.origin) return null;

  const state = await getUserOnboardingState(user, org, { includeWelcome: true });
  await user.save().catch(() => {});
  return state;
}

async function patchUserOnboarding(user, organization, body) {
  const action = String(body?.action || '').trim();
  if (!user.onboarding) {
    await initializeOnboardingForUser(user, { origin: body?.origin });
  }

  await ensureOnboardingStarted(user);

  if (action === 'dismiss') {
    user.onboarding.dismissedAt = new Date();
  } else if (action === 'set_goal') {
    const goalKey = String(body?.goalKey || '').trim();
    if (!GOAL_KEYS.includes(goalKey)) {
      const err = new Error('Invalid goal key');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    user.onboarding.goalKey = goalKey;
    user.onboarding.steps = markStep(
      user.onboarding.steps || [],
      'founder_goal',
      STEP_STATUS.COMPLETED
    );
  } else if (action === 'skip_step') {
    const stepKey = String(body?.stepKey || '').trim();
    user.onboarding.steps = markStep(
      user.onboarding.steps || [],
      stepKey,
      STEP_STATUS.SKIPPED
    );
  } else if (action === 'complete_step') {
    const stepKey = String(body?.stepKey || '').trim();
    user.onboarding.steps = markStep(
      user.onboarding.steps || [],
      stepKey,
      STEP_STATUS.COMPLETED
    );
  } else if (action === 'save_workspace') {
    if (!organization) {
      const err = new Error('Organization not found');
      err.code = 'ORG_NOT_FOUND';
      throw err;
    }
    const { name, timeZone, currency, dateFormat, language } = body;
    if (name !== undefined && String(name).trim()) {
      organization.name = String(name).trim();
    }
    if (!organization.settings) organization.settings = {};
    if (timeZone) organization.settings.timeZone = timeZone;
    if (currency) organization.settings.currency = String(currency).toUpperCase();
    if (dateFormat) organization.settings.dateFormat = dateFormat;
    if (language) organization.settings.language = language;

    await organization.save();

    if (!organization.onboarding) {
      organization.onboarding = { steps: ensureSteps([], ORG_STEP_KEYS) };
    }
    organization.onboarding.steps = markStep(
      organization.onboarding.steps || [],
      'org_workspace_profile',
      STEP_STATUS.COMPLETED
    );
    await organization.save();

    user.onboarding.steps = markStep(
      user.onboarding.steps || [],
      'founder_workspace',
      STEP_STATUS.COMPLETED
    );
  } else if (action === 'set_primary_app') {
    const appKey = String(body?.appKey || '').trim().toUpperCase();
    const availableApps = resolveAvailableApps(organization, user);
    if (!availableApps.includes(appKey)) {
      const err = new Error('Invalid app selection');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    if (!user.onboarding.context) user.onboarding.context = {};
    user.onboarding.context.primaryAppKey = appKey;
    user.onboarding.steps = markStep(
      user.onboarding.steps || [],
      'founder_first_app',
      STEP_STATUS.COMPLETED
    );
  } else if (action === 'create_first_contact') {
    if (!organization) {
      const err = new Error('Organization not found');
      err.code = 'ORG_NOT_FOUND';
      throw err;
    }
    await createFirstContactForUser(user, organization, body);
    user.onboarding.steps = markStep(
      user.onboarding.steps || [],
      'founder_first_record',
      STEP_STATUS.COMPLETED
    );
    if (!organization.onboarding) {
      organization.onboarding = { steps: ensureSteps([], ORG_STEP_KEYS) };
    }
    organization.onboarding.steps = markStep(
      organization.onboarding.steps || [],
      'org_first_record',
      STEP_STATUS.COMPLETED
    );
    await organization.save();
  } else if (action === 'mark_coachmark') {
    const key = String(body?.key || '').trim();
    if (!key) {
      const err = new Error('Coachmark key required');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    const coachmarks = user.onboarding.coachmarks || [];
    if (!coachmarks.find((c) => c.key === key)) {
      coachmarks.push({ key, seenAt: new Date() });
    }
    user.onboarding.coachmarks = coachmarks;
  } else if (action === 'record_module_visit') {
    const moduleKey = String(body?.moduleKey || '').trim();
    const appKey = String(body?.appKey || 'SALES').trim().toUpperCase();
    if (!moduleKey) {
      const err = new Error('moduleKey required');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    recordModuleVisit(user, moduleKey, appKey);
  } else if (action === 'accept_sample_data') {
    if (!organization) {
      const err = new Error('Organization not found');
      err.code = 'ORG_NOT_FOUND';
      throw err;
    }
    const { seedSampleDataForOrganization } = require('./onboardingSampleDataService');
    await seedSampleDataForOrganization(organization, user);
    user.onboarding.steps = markStep(
      user.onboarding.steps || [],
      'founder_first_record',
      STEP_STATUS.COMPLETED
    );
    if (!organization.onboarding) {
      organization.onboarding = { steps: ensureSteps([], ORG_STEP_KEYS) };
    }
    organization.onboarding.steps = markStep(
      organization.onboarding.steps || [],
      'org_first_record',
      STEP_STATUS.COMPLETED
    );
    await organization.save();
  } else if (action === 'decline_sample_data') {
    if (!organization) {
      const err = new Error('Organization not found');
      err.code = 'ORG_NOT_FOUND';
      throw err;
    }
    if (!organization.onboarding) {
      organization.onboarding = { steps: ensureSteps([], ORG_STEP_KEYS) };
    }
    organization.onboarding.sampleDataDeclinedAt = new Date();
    await organization.save();
  } else if (action === 'record_settings_visit') {
    if (!organization) {
      const err = new Error('Organization not found');
      err.code = 'ORG_NOT_FOUND';
      throw err;
    }
    if (!organization.onboarding) {
      organization.onboarding = { steps: ensureSteps([], ORG_STEP_KEYS) };
    }
    if (!organization.onboarding.settingsVisitedAt) {
      organization.onboarding.settingsVisitedAt = new Date();
      organization.onboarding.steps = markStep(
        organization.onboarding.steps || [],
        'org_settings_visited',
        STEP_STATUS.COMPLETED
      );
      await organization.save();
    }
  } else {
    const err = new Error('Unknown onboarding action');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  await syncAutomaticCompletions(user, organization);

  const wasComplete = Boolean(user.onboarding.completedAt);
  if (resolvePersona(user) === ONBOARDING_PERSONAS.FOUNDER && isFounderWizardComplete(user)) {
    if (!user.onboarding.completedAt) {
      user.onboarding.completedAt = new Date();
    }
  }

  await user.save();

  if (
    !wasComplete
    && user.onboarding.completedAt
    && resolvePersona(user) === ONBOARDING_PERSONAS.MEMBER
    && user.invitedBy
  ) {
    const { notifyInviterMemberReady } = require('./onboardingInviteNotifications');
    await notifyInviterMemberReady({
      inviterId: user.invitedBy,
      invitee: user,
      organizationId: user.organizationId
    }).catch(() => {});
  }

  return getUserOnboardingState(user, organization);
}

async function patchOrgOnboarding(organization, body) {
  const action = String(body?.action || '').trim();
  if (!organization.onboarding) {
    organization.onboarding = {
      setupCompletedAt: null,
      sampleDataAccepted: false,
      steps: ensureSteps([], ORG_STEP_KEYS)
    };
  }

  if (action === 'complete_step') {
    const stepKey = String(body?.stepKey || '').trim();
    organization.onboarding.steps = markStep(
      organization.onboarding.steps || [],
      stepKey,
      STEP_STATUS.COMPLETED
    );
  } else if (action === 'skip_step') {
    const stepKey = String(body?.stepKey || '').trim();
    organization.onboarding.steps = markStep(
      organization.onboarding.steps || [],
      stepKey,
      STEP_STATUS.SKIPPED
    );
  } else {
    const err = new Error('Unknown org onboarding action');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const orgProgress = countProgress(organization.onboarding.steps, ORG_STEP_KEYS);
  if (orgProgress.completed >= 4 && !organization.onboarding.setupCompletedAt) {
    organization.onboarding.setupCompletedAt = new Date();
  }

  await organization.save();
  return organization.onboarding;
}

function buildLoginOnboardingSummary(user) {
  if (!user?.onboarding?.origin) {
    return { redirectTo: '/platform/home' };
  }
  return {
    redirectTo: shouldRedirectToOnboarding(user) ? '/onboarding' : '/platform/home',
    persona: resolvePersona(user),
    origin: user.onboarding.origin,
    completed: Boolean(user.onboarding.completedAt)
  };
}

module.exports = {
  ONBOARDING_VERSION,
  ONBOARDING_ORIGINS,
  ONBOARDING_PERSONAS,
  STEP_STATUS,
  FOUNDER_WIZARD_STEP_KEYS,
  MEMBER_STEP_KEYS,
  ORG_STEP_KEYS,
  GOAL_KEYS,
  createStepState,
  markStep,
  resolvePersona,
  resolveContext,
  resolvePrimaryRoute,
  initializeOnboardingForUser,
  ensureOnboardingStarted,
  syncAutomaticCompletions,
  syncOrgAutomaticCompletions,
  countOrgConnectedMailboxes,
  countOrgCompletedImports,
  isFounderWizardComplete,
  shouldRedirectToOnboarding,
  getUserOnboardingState,
  getPlatformHomeOnboarding,
  patchUserOnboarding,
  patchOrgOnboarding,
  createFirstContactForUser,
  resolveAvailableApps,
  getOrgEnabledAppKeys,
  countOrgPeople,
  countOrgActiveUsers,
  markOrgInviteSent,
  getPendingCoachmarks,
  hasModuleVisit,
  recordModuleVisit,
  buildFirstTimeEmptyStateCopy,
  COACHMARK_KEYS,
  buildLoginOnboardingSummary
};
