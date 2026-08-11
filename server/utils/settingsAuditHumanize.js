'use strict';

/**
 * Human-readable labels and field diffs for settings audit log.
 */

const SURFACE_LABELS = Object.freeze({
  settings: 'Settings',
  organization: 'Company details',
  security: 'Security',
  integrations: 'Integrations',
  addons: 'Add-ons',
  applications: 'Applications',
  automation: 'Automation',
  numbering: 'Module numbering',
  'business-hours': 'Business hours',
  roles: 'Roles & permissions',
  sharing: 'Sharing rules',
  groups: 'Groups & teams',
  users: 'Users & access',
  modules: 'Core modules',
  ai: 'AI settings',
  webforms: 'Web forms',
  notifications: 'Notifications',
  processes: 'Processes',
  'business-flows': 'Business flows',
  'email-policy': 'Email policy',
  subscriptions: 'Subscriptions'
});

const ACTION_LABELS = Object.freeze({
  create: 'Added',
  update: 'Updated',
  delete: 'Removed',
  invoke: 'Changed'
});

const FIELD_LABELS = Object.freeze({
  name: 'Name',
  logoUrl: 'Company logo',
  primaryColor: 'Brand color',
  timeZone: 'Time zone',
  timezone: 'Time zone',
  currency: 'Currency',
  locale: 'Locale',
  language: 'Language',
  defaultPhoneCountry: 'Default phone country',
  overtimeAllowed: 'Overtime allowed',
  holidayCalendarId: 'Holiday calendar',
  week: 'Weekly hours',
  isDefault: 'Default schedule',
  status: 'Status',
  effectiveFrom: 'Effective from',
  effectiveTo: 'Effective to',
  region: 'Region',
  dates: 'Holiday dates',
  passwordPolicy: 'Password policy',
  'passwordPolicy.minLength': 'Minimum password length',
  'passwordPolicy.requireUppercase': 'Require uppercase letters',
  'passwordPolicy.requireLowercase': 'Require lowercase letters',
  'passwordPolicy.requireNumbers': 'Require numbers',
  'passwordPolicy.requireSpecialChars': 'Require special characters',
  'passwordPolicy.expirationDays': 'Password expiration (days)',
  'passwordPolicy.preventReuse': 'Prevent password reuse',
  sessionRules: 'Session rules',
  'sessionRules.durationHours': 'Session duration (hours)',
  'sessionRules.idleTimeoutMinutes': 'Idle timeout (minutes)',
  'sessionRules.maxConcurrentSessions': 'Max concurrent sessions',
  loginRestrictions: 'Login restrictions',
  'loginRestrictions.ipWhitelist': 'Allowed IP addresses',
  'loginRestrictions.ipBlacklist': 'Blocked IP addresses',
  'loginRestrictions.allowedRegions': 'Allowed regions',
  'loginRestrictions.blockFailedAttempts': 'Block after failed attempts',
  'loginRestrictions.maxFailedAttempts': 'Max failed login attempts',
  'loginRestrictions.lockoutDurationMinutes': 'Lockout duration (minutes)',
  twoFactorAuth: 'Two-factor authentication',
  'twoFactorAuth.enabled': 'Two-factor authentication enabled',
  'twoFactorAuth.required': 'Two-factor authentication required',
  'twoFactorAuth.methods': 'Two-factor methods',
  enabled: 'Enabled',
  status: 'Status',
  email: 'Email',
  role: 'Role',
  title: 'Title',
  description: 'Description',
  credentialRotated: 'Publish webhook secret',
  trialEndDate: 'Trial end date',
  trialExtensionUsed: 'Trial extension used',
  tier: 'Plan tier',
  autoRenew: 'Auto-renew',
  dailySendLimit: 'Daily send limit',
  maxHourlyRate: 'Max hourly rate',
  maxCampaignSize: 'Max campaign size',
  warmupEnabled: 'Warmup enabled',
  reputationEnabled: 'Reputation enabled',
  creditsRemaining: 'Credits remaining',
  monthlyCredits: 'Monthly credits',
  format: 'Number format',
  prefix: 'Prefix',
  suffix: 'Suffix',
  sequenceLength: 'Sequence length',
  startingSequence: 'Starting sequence',
  currentSequence: 'Current sequence',
  resetRule: 'Reset rule',
  allowManualEdit: 'Allow manual edit (retired)'
});

/**
 * @param {string} [str]
 * @returns {string}
 */
function titleCase(str) {
  return String(str || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const MODULE_AREA_LABELS = Object.freeze({
  people: 'People',
  organizations: 'Organizations',
  deals: 'Deals',
  cases: 'Cases',
  tasks: 'Tasks',
  events: 'Events',
  forms: 'Forms',
  items: 'Items',
  quotes: 'Quotes',
  sales_orders: 'Sales orders',
  invoices: 'Invoices',
  payments: 'Payments',
  documents: 'Documents',
  imports: 'Imports',
  reports: 'Reports'
});

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function extractModuleKeyFromSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value.moduleKey || value.key || null;
  if (!raw) return null;
  return String(raw).trim().toLowerCase() || null;
}

/**
 * @param {string} path
 * @returns {string|null}
 */
function extractModuleKeyFromPath(path) {
  const p = String(path || '');
  const numberingMatch = p.match(/\/module-numbering\/([^/?#]+)/i);
  if (numberingMatch?.[1]) {
    try {
      return decodeURIComponent(numberingMatch[1]).trim().toLowerCase();
    } catch {
      return String(numberingMatch[1]).trim().toLowerCase();
    }
  }
  const systemMatch = p.match(/\/modules\/system\/([^/?#]+)/i);
  if (systemMatch?.[1]) return String(systemMatch[1]).trim().toLowerCase();
  return null;
}

/**
 * Human label for a module key (e.g. deals → Deals).
 * @param {string} moduleKey
 * @returns {string}
 */
function getModuleAreaLabel(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (!key) return '';
  if (MODULE_AREA_LABELS[key]) return MODULE_AREA_LABELS[key];
  return titleCase(key.replace(/[_-]+/g, ' '));
}

/**
 * @param {string} surface
 * @returns {string}
 */
function getSurfaceLabel(surface) {
  const key = String(surface || '').trim();
  return SURFACE_LABELS[key] || titleCase(key.replace(/[-_]/g, ' ')) || 'Settings';
}

/**
 * Area chip label — for modules, include the specific module (Deals, Cases, …).
 * @param {object} params
 * @param {string} [params.surface]
 * @param {unknown} [params.before]
 * @param {unknown} [params.after]
 * @param {string} [params.path]
 * @param {string} [params.moduleKey]
 * @returns {string}
 */
function resolveAreaLabel(params = {}) {
  const surface = String(params.surface || '').trim();
  const base = getSurfaceLabel(surface);

  const moduleKey =
    (params.moduleKey && String(params.moduleKey).trim().toLowerCase()) ||
    extractModuleKeyFromSnapshot(params.after) ||
    extractModuleKeyFromSnapshot(params.before) ||
    extractModuleKeyFromPath(params.path || '');

  if (surface === 'numbering') {
    if (!moduleKey) return base;
    const mod = getModuleAreaLabel(moduleKey);
    return mod ? `${base} · ${mod}` : base;
  }

  if (surface !== 'modules') return base;
  if (!moduleKey) return base;
  return getModuleAreaLabel(moduleKey);
}

/**
 * @param {string} action
 * @returns {string}
 */
function getActionLabel(action) {
  return ACTION_LABELS[action] || titleCase(String(action || 'changed'));
}

/**
 * @param {string} path
 * @param {string} [surface]
 * @returns {string}
 */
function getFieldLabel(path, surface) {
  const key = String(path || '');
  if (surface === 'organization' && (key === 'name' || key.endsWith('.name'))) {
    return 'Company name';
  }
  if (surface === 'business-hours' && key === 'name') {
    return 'Schedule name';
  }
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const leaf = key.split('.').pop() || key;
  if (FIELD_LABELS[leaf]) return FIELD_LABELS[leaf];
  // fields.amount.label → "Amount · Label"
  if (key.startsWith('fields.')) {
    const parts = key.split('.').slice(1).map((p) => titleCase(p.replace(/([A-Z])/g, ' $1')));
    return parts.join(' · ');
  }
  // pipelineSettings.sales.stages.won.probability → "Pipeline · Sales · Stages · Won · Probability"
  if (key.startsWith('pipelineSettings.')) {
    const parts = key.split('.').slice(1).map((p) => titleCase(p.replace(/([A-Z])/g, ' $1')));
    return `Pipeline · ${parts.join(' · ')}`;
  }
  // week.monday.closed → "Monday · Closed"
  if (key.startsWith('week.')) {
    const parts = key.split('.').slice(1).map((p) => titleCase(p.replace(/([A-Z])/g, ' $1')));
    return `Weekly hours · ${parts.join(' · ')}`;
  }
  return titleCase(leaf.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' '));
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatDisplayValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value
      .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Flatten nested objects to dotted paths (depth-limited).
 * @param {unknown} value
 * @param {string} [prefix]
 * @param {number} [depth]
 * @returns {Record<string, unknown>}
 */
function flattenObject(value, prefix = '', depth = 0) {
  if (value == null || typeof value !== 'object' || Array.isArray(value) || depth > 6) {
    return { [prefix || '_']: value };
  }
  const out = {};
  const entries = Object.entries(value);
  if (entries.length === 0 && prefix) {
    out[prefix] = value;
    return out;
  }
  for (const [key, nested] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (
      nested != null &&
      typeof nested === 'object' &&
      !Array.isArray(nested) &&
      !(nested instanceof Date)
    ) {
      Object.assign(out, flattenObject(nested, path, depth + 1));
    } else {
      out[path] = nested;
    }
  }
  return out;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function valuesEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'object' || typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return String(a) === String(b);
}

/**
 * @param {unknown} before
 * @param {unknown} after
 * @param {object} [options]
 * @param {string} [options.surface]
 * @returns {Array<{ field: string, label: string, from: string, to: string, fromRaw: unknown, toRaw: unknown }>}
 */
function buildChangeList(before, after, options = {}) {
  const surface = options.surface || '';
  const beforeObj =
    before && typeof before === 'object' && !Array.isArray(before) ? before : null;
  const afterObj =
    after && typeof after === 'object' && !Array.isArray(after) ? after : null;

  // Without a before snapshot we cannot know what actually changed — avoid listing every saved field.
  if (!beforeObj || !afterObj) return [];

  const flatBefore = flattenObject(beforeObj);
  const flatAfter = flattenObject(afterObj);
  const keys = new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)]);
  const changes = [];

  for (const field of keys) {
    if (!field || field === '_') continue;
    const leaf = field.split('.').pop() || '';
    if (/^(password|secret|token|apiKey|webhookSecret)/i.test(leaf)) {
      continue;
    }
    if (
      /^(dataRegion|industry|_id|__v|organizationId|createdBy|modifiedBy|createdAt|updatedAt|moduleKey)$/i.test(
        leaf
      )
    ) {
      continue;
    }
    const fromRaw = Object.prototype.hasOwnProperty.call(flatBefore, field)
      ? flatBefore[field]
      : undefined;
    const toRaw = Object.prototype.hasOwnProperty.call(flatAfter, field)
      ? flatAfter[field]
      : undefined;

    const normalize = (v) => (v == null || v === '' ? null : v);
    if (valuesEqual(normalize(fromRaw), normalize(toRaw))) continue;

    changes.push({
      field,
      label: getFieldLabel(field, surface),
      from: formatDisplayValue(fromRaw),
      to: formatDisplayValue(toRaw),
      fromRaw: fromRaw === undefined ? null : fromRaw,
      toRaw: toRaw === undefined ? null : toRaw
    });
  }

  return changes;
}

/**
 * Infer a short action phrase from the URL path for invoke-style ops.
 * @param {string} path
 * @returns {string|null}
 */
function inferInvokePhrase(path) {
  const p = String(path || '').toLowerCase();
  if (p.includes('/enable')) return 'Enabled';
  if (p.includes('/disable')) return 'Disabled';
  if (p.includes('/install')) return 'Installed';
  if (p.includes('/uninstall')) return 'Uninstalled';
  if (p.includes('/archive')) return 'Archived';
  if (p.includes('/test')) return 'Ran a test for';
  if (p.includes('/toggle')) return 'Toggled';
  if (p.includes('/duplicate')) return 'Duplicated';
  if (p.includes('/extend')) return 'Extended';
  if (p.includes('/suspend')) return 'Suspended';
  if (p.includes('/reactivate')) return 'Reactivated';
  if (p.includes('/verify')) return 'Verified';
  if (p.includes('/resync')) return 'Resynced sequence for';
  return null;
}

/**
 * @param {object} params
 * @param {string} params.surface
 * @param {string} params.action
 * @param {string} [params.path]
 * @param {Array<{ label: string, from: string, to: string }>} [params.changes]
 * @returns {{ title: string, subtitle: string, surfaceLabel: string, actionLabel: string, changes: Array }}
 */
function buildPresentation(params) {
  const surface = params.surface || 'settings';
  const action = params.action || 'update';
  const path = params.path || '';
  const changes = Array.isArray(params.changes)
    ? params.changes
    : buildChangeList(params.before, params.after, { surface });

  const surfaceLabel = resolveAreaLabel({
    surface,
    before: params.before,
    after: params.after,
    path,
    moduleKey: params.moduleKey
  });
  const invokePhrase = action === 'invoke' ? inferInvokePhrase(path) : null;
  const actionLabel = invokePhrase || getActionLabel(action);

  const hasBefore =
    params.before != null &&
    typeof params.before === 'object' &&
    Object.keys(params.before).length > 0;

  let title;
  if (changes.length === 1) {
    const c = changes[0];
    if (!hasBefore || c.from === '—' || c.from === '') {
      title = `Set ${c.label} to ${c.to}`;
    } else {
      title = `Changed ${c.label} from “${c.from}” to “${c.to}”`;
    }
  } else if (changes.length > 1) {
    title = hasBefore
      ? `${actionLabel} ${surfaceLabel.toLowerCase()}`
      : `Saved ${surfaceLabel.toLowerCase()}`;
  } else if (invokePhrase) {
    title = `${invokePhrase} ${surfaceLabel.toLowerCase()}`;
  } else {
    title = `${actionLabel} ${surfaceLabel.toLowerCase()}`;
  }

  let subtitle = '';
  if (changes.length > 1) {
    subtitle = hasBefore
      ? `${changes.length} fields changed`
      : `${changes.length} settings saved`;
  } else if (changes.length === 0) {
    subtitle = surfaceLabel;
  }

  return {
    title,
    subtitle,
    surfaceLabel,
    actionLabel,
    changes: changes.map((c) => ({
      field: c.field,
      label: c.label,
      from: c.from,
      to: c.to
    }))
  };
}

/**
 * Compact one-line summary for storage.
 * @param {object} params
 * @returns {string}
 */
function buildHumanSummary(params) {
  const presentation = buildPresentation(params);
  if (presentation.changes.length > 1) {
    const labels = presentation.changes
      .slice(0, 3)
      .map((c) => c.label)
      .join(', ');
    const more =
      presentation.changes.length > 3
        ? ` +${presentation.changes.length - 3} more`
        : '';
    return `${presentation.title}: ${labels}${more}`.slice(0, 500);
  }
  return presentation.title.slice(0, 500);
}

module.exports = {
  SURFACE_LABELS,
  ACTION_LABELS,
  FIELD_LABELS,
  getSurfaceLabel,
  resolveAreaLabel,
  getModuleAreaLabel,
  getActionLabel,
  getFieldLabel,
  formatDisplayValue,
  flattenObject,
  buildChangeList,
  buildPresentation,
  buildHumanSummary,
  inferInvokePhrase
};
