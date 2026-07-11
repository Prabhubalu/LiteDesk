/**
 * ============================================================================
 * Person Profile Composer
 * ============================================================================
 *
 * Pure logic utility for composing a structured Person profile from:
 * - Raw person data (People model document or plain object)
 * - Resolved app context
 * - Enabled apps
 * - Permission snapshot
 *
 * Requirements:
 * - Input: person data, resolved app context, enabled apps, permissions
 * - Output: structured profile sections with read/write flags
 * - Core fields shared and consistent
 * - App fields isolated per app
 * - No UI rendering
 *
 * This utility does NOT:
 * - Hit the database
 * - Perform any UI rendering
 * - Merge app configurations
 * - Infer permissions (all permission flags are inputs)
 * ============================================================================
 */

const { APP_KEYS } = require('../constants/appKeys');
const { getSalesParticipationValues } = require('./getSalesParticipationValues');

// ---------------------------------------------------------------------------
// Field classifications
// ---------------------------------------------------------------------------

/**
 * Core fields for People.
 * These are shared and consistent across all apps.
 *
 * NOTE:
 * - Field names are aligned with People.js schema
 * - Does not include app-specific lead/contact fields
 */
const CORE_FIELD_KEYS = [
  // Identity & contact
  'salutation',
  'first_name',
  'last_name',
  'email',
  'phone',
  'mobile',

  // Classification & flags
  'source',
  'tags',
  'do_not_contact',

  // Relationships (CRM organization link, not tenant)
  'organization',

  // System / audit
  'organizationId',
  'createdBy',
  'assignedTo',
  'legacyContactId',

  // Activity
  'activityLogs',

  // Timestamps (from Mongoose timestamps option)
  'createdAt',
  'updatedAt'
];

/**
 * App-specific fields for People, keyed by appKey.
 *
 * IMPORTANT:
 * - These are isolated per app
 * - They are NOT shared across apps
 * - They must never be merged into a single configuration
 *
 * This map can be safely extended with additional apps in the future without
 * changing the core composition logic.
 */
const APP_FIELD_KEYS_BY_APP = {
  [APP_KEYS.SALES]: [
    // Lead/Contact role (participations.SALES.role) - 'type' removed; use role only
    // Lead-specific (SALES-specific)
    'lead_status',
    'lead_owner',
    'lead_score',
    'interest_products',
    'qualification_date',
    'qualification_notes',
    'estimated_value',

    // Contact-specific (SALES-specific)
    'contact_status',
    'role',
    'birthday',
    'preferred_contact_method'
  ]

  // Other apps (HELPDESK, PROJECTS, AUDIT, PORTAL, etc.) can be added here
  // when they introduce app-specific People fields.
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a raw app key to uppercase, or null if invalid.
 *
 * @param {string | undefined | null} raw
 * @returns {string | null}
 */
function normalizeAppKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  return normalized || null;
}

/**
 * Shallow-pick a set of keys from a source object.
 *
 * @param {Object} source
 * @param {string[]} keys
 * @returns {Object}
 */
function pickFields(source, keys) {
  const result = {};
  if (!source || typeof source !== 'object') return result;

  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }
  });

  return result;
}

/**
 * Check if a person has participation in a given app.
 * 
 * A person has participation in an app if any app-specific field is set.
 * For SALES app, checks participations.SALES.role (exposed as sales_type in profile fields).
 * 
 * @param {Object} person - Person data (Mongoose document or plain object)
 * @param {string} appKey - Normalized app key (e.g., 'SALES', 'HELPDESK')
 * @returns {boolean} - True if person has participation in the app
 */
function hasAppParticipation(person, appKey) {
  if (!person || !appKey) return false;
  
  const normalizedAppKey = normalizeAppKey(appKey);
  if (!normalizedAppKey) return false;
  
  // Normalize person data to a plain object
  const rawPerson =
    person && typeof person.toObject === 'function'
      ? person.toObject()
      : person || {};

  // Helpdesk (and similar): participation is only participations.APPKEY.role — no top-level app fields yet
  if (normalizedAppKey === 'HELPDESK') {
    const p = rawPerson.participations?.HELPDESK;
    return !!(p && String(p.role || '').trim());
  }
  
  // Get app-specific fields for this app
  const appFieldKeys = APP_FIELD_KEYS_BY_APP[normalizedAppKey];
  if (!appFieldKeys || !Array.isArray(appFieldKeys) || appFieldKeys.length === 0) {
    // If no app-specific fields defined, person cannot have participation
    return false;
  }
  
  // For SALES app, participations.SALES.role is the participation marker
  if (normalizedAppKey === APP_KEYS.SALES) {
    const { role } = getSalesParticipationValues(rawPerson);
    if (role) return true;
  }
  
  // Check if any app-specific field is set (not null, undefined, empty string, or empty array)
  for (const fieldKey of appFieldKeys) {
    const value = rawPerson[fieldKey];
    
    // Skip null, undefined, empty string
    if (value === null || value === undefined || value === '') {
      continue;
    }
    
    // Skip empty arrays (empty arrays don't indicate participation)
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    
    // For SALES, role (participations.SALES.role) was already checked above
    
    // Field has a meaningful value - participation exists
    return true;
  }
  
  return false;
}

/**
 * Get a human-readable app name from appKey.
 * 
 * @param {string} appKey - App key (e.g., 'SALES', 'HELPDESK')
 * @returns {string} - Human-readable app name
 */
function getAppDisplayName(appKey) {
  const normalizedAppKey = normalizeAppKey(appKey);
  if (!normalizedAppKey) return appKey || 'Unknown App';
  
  // Map app keys to display names
  const appNameMap = {
    [APP_KEYS.SALES]: 'Sales',
    'HELPDESK': 'Helpdesk',
    'PROJECTS': 'Projects',
    'AUDIT': 'Audit',
    'PORTAL': 'Portal'
  };
  
  return appNameMap[normalizedAppKey] || normalizedAppKey;
}

/**
 * Compose a structured Person profile.
 *
 * @param {Object} options
 * @param {Object} options.person
 *   Person data, either a Mongoose People document or a plain object.
 *
 * @param {Object} options.resolvedAppContext
 *   Resolved app context (e.g. from resolvePeopleAppContext):
 *   {
 *     appKey: string,
 *     confidence?: string,
 *     isAmbiguous?: boolean
 *   }
 *
 * @param {string[]} options.enabledApps
 *   Organization-level enabled app keys.
 *
 * @param {Object} options.permissions
 *   Permission snapshot with minimal expected shape:
 *   {
 *     core: {
 *       canView: boolean,
 *       canEdit: boolean
 *     },
 *     apps: {
 *       [appKey: string]: {
 *         canView: boolean,
 *         canEdit: boolean
 *       }
 *     }
 *   }
 *
 * @returns {{
 *   core: {
 *     appKey: 'PLATFORM',
 *     fields: Object,
 *     canView: boolean,
 *     canEdit: boolean
 *   },
 *   apps: {
 *     [appKey: string]: {
 *       appKey: string,
 *       fields: Object,
 *       canView: boolean,
 *       canEdit: boolean
 *     }
 *   }
 * }}
 */
function composePersonProfile({
  person,
  resolvedAppContext = {},
  enabledApps = [],
  permissions = {}
}) {
  // Normalize person data to a plain object
  const rawPerson =
    person && typeof person.toObject === 'function'
      ? person.toObject()
      : person || {};

  const contextAppKey = normalizeAppKey(resolvedAppContext.appKey);
  const normalizedEnabledApps = (enabledApps || [])
    .map(normalizeAppKey)
    .filter(Boolean);

  const corePerms = permissions.core || {};
  const appPerms = permissions.apps || {};

  // ---------------------------------------------------------------------------
  // Core section (shared & consistent)
  // ---------------------------------------------------------------------------
  const coreFields = pickFields(rawPerson, CORE_FIELD_KEYS);

  const coreSection = {
    appKey: 'PLATFORM',
    fields: coreFields,
    canView: !!corePerms.canView,
    canEdit: !!corePerms.canEdit
  };

  // ---------------------------------------------------------------------------
  // App-specific sections (isolated per app)
  // ---------------------------------------------------------------------------
  const appsSections = {};

  Object.entries(APP_FIELD_KEYS_BY_APP).forEach(([rawAppKey, fieldKeys]) => {
    const appKey = normalizeAppKey(rawAppKey);
    if (!appKey) return;

    // App must be enabled at org level
    if (!normalizedEnabledApps.includes(appKey)) {
      return;
    }

    // For SALES, prefer participations over legacy top-level fields
    let fields;
    if (appKey === APP_KEYS.SALES) {
      const { role, lead_status, contact_status } = getSalesParticipationValues(rawPerson);
      fields = pickFields(rawPerson, fieldKeys);
      if (role != null) fields.sales_type = role;
      if (lead_status != null) fields.lead_status = lead_status;
      if (contact_status != null) fields.contact_status = contact_status;
    } else {
      fields = pickFields(rawPerson, fieldKeys);
    }

    // Include app section even if no fields are present yet
    // This allows users to add app-specific fields to a person that doesn't have any
    // The section will show as empty but editable (if permissions allow)

    const perms = appPerms[appKey] || {};

    appsSections[appKey] = {
      appKey,
      fields, // May be empty object if no fields are set yet
      canView: !!perms.canView,
      // App fields are editable only when:
      // - User has canEdit for that app
      // - Current resolved app context matches the app
      canEdit: !!perms.canEdit && contextAppKey === appKey
    };
  });

  return {
    core: coreSection,
    apps: appsSections
  };
}

module.exports = {
  composePersonProfile,
  CORE_FIELD_KEYS,
  APP_FIELD_KEYS_BY_APP,
  hasAppParticipation,
  getAppDisplayName
};


