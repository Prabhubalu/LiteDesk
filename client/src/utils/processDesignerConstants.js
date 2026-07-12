/**
 * Process designer: app, module, core triggers, and field options.
 */

/** HeadlessSelect button styles for process designer panels */
export const PROCESS_SELECT_BUTTON_CLASS =
  '!bg-white dark:!bg-gray-900 !py-1.5 !text-sm/6 border border-gray-300 dark:border-gray-600 rounded-lg shadow-none';

/** Header toolbar controls — matches Save button (h-8, text-sm, px-3) */
export const PROCESS_HEADER_BTN_CLASS =
  'inline-flex items-center justify-center h-8 px-3 text-sm font-medium rounded-lg leading-none';

export const PROCESS_HEADER_TAB_ACTIVE = `${PROCESS_HEADER_BTN_CLASS} bg-indigo-600 text-white`;

export const PROCESS_HEADER_TAB_INACTIVE = `${PROCESS_HEADER_BTN_CLASS} text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700`;

export const PROCESS_HEADER_SELECT_BUTTON_CLASS =
  '!inline-flex !items-center !h-8 !min-h-8 !max-h-8 !py-0 !px-3 !text-sm !leading-5 !bg-white dark:!bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg shadow-none';

export const PROCESS_HEADER_SELECT_OPTIONS_CLASS = 'z-[250]';

/** Standard text input (matches HeadlessSelect / app form fields) */
export const PROCESS_INPUT_CLASS =
  'block w-full min-w-0 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500';

/** Process designer header title — background on hover/focus only */
export const PROCESS_TITLE_INPUT_CLASS =
  'block w-full min-w-0 rounded-md bg-transparent px-2 py-1 text-lg font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/80 focus:bg-gray-100 dark:focus:bg-gray-700/80 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:outline-indigo-500';

/** HeadlessSelect button styles for creation wizard */
export const WIZARD_SELECT_BUTTON_CLASS =
  '!bg-white dark:!bg-gray-800 !py-2.5 !text-sm/6 border border-gray-300 dark:border-gray-600 rounded-lg shadow-none';

export const ENTITY_TYPE_TO_MODULE_KEY = {
  people: 'people',
  organization: 'organizations',
  deal: 'deals',
  quote: 'quotes',
  live_chat_session: 'live_chat_sessions'
};

/** Registry moduleKey → process entityType (legacy singular forms kept for CRM entities). */
const MODULE_KEY_TO_ENTITY_TYPE = {
  people: 'people',
  organizations: 'organization',
  organization: 'organization',
  deals: 'deal',
  deal: 'deal',
  quotes: 'quote',
  quote: 'quote',
  live_chat_sessions: 'live_chat_session',
  live_chat_session: 'live_chat_session'
};

const CORE_TRIGGER_VALUES = [
  'record_created',
  'record_updated',
  'record_created_or_updated',
  'schedule',
  'webhook',
  'manual'
];

const CORE_TRIGGER_DESC_KEYS = {
  record_created: 'process.designerTriggerDescRecordCreated',
  record_updated: 'process.designerTriggerDescRecordUpdated',
  record_created_or_updated: 'process.designerTriggerDescRecordCreatedOrUpdated',
  schedule: 'process.designerTriggerDescSchedule',
  webhook: 'process.designerTriggerDescWebhook',
  manual: 'process.designerTriggerDescManual'
};

const MODULE_SINGULAR_KEYS = {
  people: 'process.designerModulePerson',
  organization: 'process.designerModuleOrganization',
  deal: 'process.designerModuleDeal',
  quote: 'process.designerModuleQuote',
  live_chat_session: 'process.designerModuleLiveChat'
};

const FALLBACK_APP_I18N = {
  PLATFORM: 'process.designerAppCore',
  SALES: 'process.designerAppSales',
  AUDIT: 'process.designerAppAudit',
  PORTAL: 'process.designerAppPortal',
  HELPDESK: 'process.designerAppHelpdesk'
};

const FALLBACK_MODULE_I18N = {
  people: 'process.designerModulePeople',
  organization: 'process.designerModuleOrganization',
  deal: 'process.designerModuleDeal',
  quote: 'process.designerModuleQuote',
  live_chat_session: 'process.designerModuleLiveChat'
};

/** @type {{ appOptions: Array<{value: string, label: string}>, modulesByApp: Record<string, Array<{value: string, label: string}>> } | null} */
let processScopeCache = null;

export function moduleKeyToEntityType(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  return MODULE_KEY_TO_ENTITY_TYPE[key] || key;
}

function fallbackAppOptions(t) {
  return Object.entries(FALLBACK_APP_I18N).map(([value, key]) => ({
    value,
    label: t(key)
  }));
}

function fallbackModuleOption(t, entityType) {
  return {
    value: entityType,
    label: t(FALLBACK_MODULE_I18N[entityType] || 'process.designerModuleUnknown')
  };
}

/**
 * Load apps + modules from tenant app registry (source of truth).
 * PLATFORM is labeled Core. Core modules also merge GET /settings/core-modules.
 */
export async function loadProcessScopeFromRegistry(t) {
  const { getAppRegistry } = await import('@/utils/getAppRegistry');
  const { fetchCoreModulesSettingsCached } = await import('@/utils/tenantSchemaApiCache');
  const registry = await getAppRegistry();
  const appOptions = [];
  const modulesByApp = {};

  for (const entry of Object.values(registry || {})) {
    if (!entry?.appKey) continue;
    const appKey = String(entry.appKey).toUpperCase();
    if (modulesByApp[appKey]) continue;

    const label =
      appKey === 'PLATFORM'
        ? t('process.designerAppCore')
        : FALLBACK_APP_I18N[appKey]
          ? t(FALLBACK_APP_I18N[appKey])
          : entry.label || entry.name || appKey;

    appOptions.push({
      value: appKey,
      label,
      order: typeof entry.order === 'number' ? entry.order : 999
    });

    const seen = new Set();
    const modules = [];
    for (const mod of entry.modules || []) {
      if (!mod?.moduleKey) continue;
      if (mod.showInSidebar === false) continue;
      const entityType = moduleKeyToEntityType(mod.moduleKey);
      if (!entityType || seen.has(entityType)) continue;
      seen.add(entityType);
      modules.push({
        value: entityType,
        label: mod.label || mod.moduleKey
      });
    }
    modulesByApp[appKey] = modules;
  }

  // Core = platform-owned modules from settings (people, orgs, tasks, events, …)
  try {
    const coreRes = await fetchCoreModulesSettingsCached();
    const coreModules = Array.isArray(coreRes?.modules) ? coreRes.modules : [];
    const seen = new Set((modulesByApp.PLATFORM || []).map((m) => m.value));
    const merged = [...(modulesByApp.PLATFORM || [])];
    for (const mod of coreModules) {
      if (!mod?.platformOwned || !mod?.moduleKey) continue;
      if (mod.enabled === false) continue;
      const entityType = moduleKeyToEntityType(mod.moduleKey);
      if (!entityType || seen.has(entityType)) continue;
      seen.add(entityType);
      merged.push({
        value: entityType,
        label: mod.label || mod.moduleKey
      });
    }
    merged.sort((a, b) => a.label.localeCompare(b.label));
    modulesByApp.PLATFORM = merged;

    if (!appOptions.some((a) => a.value === 'PLATFORM')) {
      appOptions.unshift({
        value: 'PLATFORM',
        label: t('process.designerAppCore'),
        order: 0
      });
    }
  } catch (e) {
    console.warn('[loadProcessScopeFromRegistry] core-modules merge skipped', e);
  }

  for (const key of Object.keys(modulesByApp)) {
    modulesByApp[key].sort((a, b) => a.label.localeCompare(b.label));
  }

  appOptions.sort((a, b) => {
    if (a.value === 'PLATFORM') return -1;
    if (b.value === 'PLATFORM') return 1;
    if (a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label);
  });

  processScopeCache = {
    appOptions: appOptions.map(({ value, label }) => ({ value, label })),
    modulesByApp
  };
  return processScopeCache;
}

export function getAppOptions(t) {
  if (processScopeCache?.appOptions?.length) return processScopeCache.appOptions;
  return fallbackAppOptions(t);
}

/**
 * Modules for the process Module dropdown.
 * @param {Function} t
 * @param {string} [appKey] — when set, only modules under that app
 */
export function getModuleOptions(t, appKey) {
  const key = appKey ? String(appKey).toUpperCase() : '';
  if (processScopeCache?.modulesByApp) {
    if (key) return processScopeCache.modulesByApp[key] || [];
    return Object.values(processScopeCache.modulesByApp).flat();
  }
  if (!key) {
    return Object.keys(FALLBACK_MODULE_I18N).map((entityType) => fallbackModuleOption(t, entityType));
  }
  return [];
}

export function getModuleLabel(t, entityType, { plural = false } = {}) {
  if (plural) {
    return getModuleOptions(t).find((m) => m.value === entityType)?.label || entityType;
  }
  if (MODULE_SINGULAR_KEYS[entityType]) {
    return t(MODULE_SINGULAR_KEYS[entityType]);
  }
  const fromRegistry = getModuleOptions(t).find((m) => m.value === entityType)?.label;
  return fromRegistry || t('process.designerModuleRecordFallback');
}

/** Layer 1 — only top-level “Starts when” options */
export function getCoreTriggerOptions(t) {
  return [
    { value: 'record_created', label: t('process.designerTriggerRecordCreated') },
    { value: 'record_updated', label: t('process.designerTriggerRecordUpdated') },
    { value: 'record_created_or_updated', label: t('process.designerTriggerRecordCreatedOrUpdated') },
    { value: 'schedule', label: t('process.designerTriggerSchedule') },
    { value: 'webhook', label: t('process.designerTriggerWebhook') },
    { value: 'manual', label: t('process.designerTriggerManual') }
  ];
}

export function getCoreTriggerDescription(t, coreTrigger) {
  const key = CORE_TRIGGER_DESC_KEYS[coreTrigger];
  return key ? t(key) : '';
}

export function getSchedulePresetOptions(t) {
  return [
    { value: 'hourly', label: t('process.designerScheduleHourly') },
    { value: 'daily', label: t('process.designerScheduleDaily') },
    { value: 'weekly', label: t('process.designerScheduleWeekly') },
    { value: 'monthly', label: t('process.designerScheduleMonthly') }
  ];
}

export function getScheduleDayOfWeekOptions(t) {
  return [
    { value: 0, label: t('process.designerScheduleSunday') },
    { value: 1, label: t('process.designerScheduleMonday') },
    { value: 2, label: t('process.designerScheduleTuesday') },
    { value: 3, label: t('process.designerScheduleWednesday') },
    { value: 4, label: t('process.designerScheduleThursday') },
    { value: 5, label: t('process.designerScheduleFriday') },
    { value: 6, label: t('process.designerScheduleSaturday') }
  ];
}

export function toScheduleHour12(hour24) {
  const h = Number(hour24);
  const normalized = Number.isFinite(h) ? ((h % 24) + 24) % 24 : 9;
  const hour = normalized % 12;
  return hour === 0 ? 12 : hour;
}

export function toScheduleHour24(hour12, period) {
  const h = Number(hour12);
  const normalized = Number.isFinite(h) ? h : 12;
  if (period === 'AM') {
    return normalized === 12 ? 0 : normalized;
  }
  return normalized === 12 ? 12 : normalized + 12;
}

export function getScheduleHour12Options() {
  return [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((value) => ({
    value,
    label: String(value)
  }));
}

export function getSchedulePeriodOptions(t) {
  return [
    { value: 'AM', label: t('process.setupPeriodAm') },
    { value: 'PM', label: t('process.setupPeriodPm') }
  ];
}

export function getTriggerBehaviourOptions(t) {
  return [
    { value: 'first_time', label: t('process.setupTriggerBehaviourFirstTime') },
    { value: 'every_time', label: t('process.setupTriggerBehaviourEveryTime') }
  ];
}

/** first_time / every_time applies to record-event triggers only — not schedule. */
export function triggerBehaviourApplies(coreTrigger) {
  return coreTrigger !== 'schedule';
}

export function resolveTriggerBehaviourForSave(coreTrigger, behaviour) {
  if (!triggerBehaviourApplies(coreTrigger)) return 'every_time';
  return behaviour === 'first_time' ? 'first_time' : 'every_time';
}

function watchFieldsForModule(t, entityType) {
  const any = { value: '__any__', label: t('process.designerWatchAnyField') };
  const byModule = {
    people: [
      any,
      { value: 'lifecycle', label: t('process.designerWatchLifecycle') },
      { value: 'sales_type', label: t('process.designerWatchSalesRole') },
      { value: 'lead_status', label: t('process.designerWatchLeadStatus') },
      { value: 'contact_status', label: t('process.designerWatchContactStatus') }
    ],
    organization: [
      any,
      { value: 'types', label: t('process.designerWatchType') },
      { value: 'customerStatus', label: t('process.designerWatchCustomerStatus') },
      { value: 'partnerStatus', label: t('process.designerWatchPartnerStatus') },
      { value: 'vendorStatus', label: t('process.designerWatchVendorStatus') }
    ],
    deal: [
      any,
      { value: 'stage', label: t('process.designerWatchStage') },
      { value: 'pipeline', label: t('process.designerWatchPipeline') },
      { value: 'amount', label: t('process.designerWatchAmount') },
      { value: 'assignedTo', label: t('process.designerWatchOwner') }
    ],
    quote: [
      any,
      { value: 'status', label: t('process.designerWatchQuoteStatus') },
      { value: 'grandTotal', label: t('process.designerWatchGrandTotal') },
      { value: 'globalDiscountTotal', label: t('process.designerWatchGlobalDiscount') },
      { value: 'assignedTo', label: t('process.designerWatchOwner') }
    ]
  };
  return byModule[entityType] || [any];
}

const LEGACY_EVENT_TO_CORE = {
  'people.lifecycle.changed': {
    core: 'record_updated',
    fields: ['lifecycle', 'lead_status', 'contact_status']
  },
  'people.sales_type.changed': { core: 'record_updated', fields: ['sales_type'] },
  'organization.lifecycle.changed': {
    core: 'record_updated',
    fields: ['customerStatus', 'partnerStatus', 'vendorStatus']
  },
  'organization.type.changed': { core: 'record_updated', fields: ['types'] },
  'deal.stage.changed': { core: 'record_updated', fields: ['stage'] },
  'deal.pipeline.changed': { core: 'record_updated', fields: ['pipeline'] },
  'deal.deal.won': { core: 'record_updated', fields: ['stage'] },
  'deal.deal.lost': { core: 'record_updated', fields: ['stage'] },
  'form.submitted': { core: 'manual' },
  'record.created': { core: 'record_created' },
  'record.updated': { core: 'record_updated' }
};

function createdEventType(entityType) {
  return entityType ? `${entityType}.created` : null;
}

function updatedEventType(entityType) {
  return entityType ? `${entityType}.updated` : null;
}

/** Flat list for Starts when dropdown (no module groups). */
export function coreTriggerOptions(t) {
  return getCoreTriggerOptions(t);
}

export function updateWatchFieldOptions(entityType, t) {
  return watchFieldsForModule(t, entityType);
}

export function getConditionFieldsByModule(t, entityType) {
  const byModule = {
    people: [
      { value: 'lifecycle', label: t('process.designerWatchLifecycle') },
      { value: 'sales_type', label: t('process.designerCondSalesType') },
      { value: 'lead_status', label: t('process.designerWatchLeadStatus') },
      { value: 'contact_status', label: t('process.designerWatchContactStatus') }
    ],
    organization: [
      { value: 'lifecycle', label: t('process.designerWatchLifecycle') },
      { value: 'type', label: t('process.designerWatchType') },
      { value: 'customerStatus', label: t('process.designerWatchCustomerStatus') },
      { value: 'partnerStatus', label: t('process.designerWatchPartnerStatus') },
      { value: 'vendorStatus', label: t('process.designerWatchVendorStatus') }
    ],
    deal: [
      { value: 'stage', label: t('process.designerWatchStage') },
      { value: 'amount', label: t('process.designerWatchAmount') },
      { value: 'pipeline', label: t('process.designerWatchPipeline') },
      { value: 'assignedTo', label: t('process.designerWatchOwner') },
      { value: 'status', label: t('process.designerCondStatus') }
    ],
    quote: [
      { value: 'status', label: t('process.designerWatchQuoteStatus') },
      { value: 'grandTotal', label: t('process.designerWatchGrandTotal') },
      { value: 'globalDiscountTotal', label: t('process.designerWatchGlobalDiscount') },
      { value: 'subtotal', label: t('process.designerWatchSubtotal') },
      { value: 'assignedTo', label: t('process.designerWatchOwner') }
    ]
  };
  return byModule[entityType] || [];
}

export function getConditionOperatorOptions(t) {
  return [
    { value: 'equals', label: t('process.opEquals') },
    { value: 'not_equals', label: t('process.opNotEquals') },
    { value: 'greater_than', label: t('process.opGreaterThan') },
    { value: 'less_than', label: t('process.opLessThan') },
    { value: 'contains', label: t('process.opContains') }
  ];
}

export function getBooleanValueOptions(t) {
  return [
    { value: 'true', label: t('process.boolTrue') },
    { value: 'false', label: t('process.boolFalse') }
  ];
}

export function getFieldRuleOptions(t) {
  return [
    { value: 'mandatory', label: t('process.fieldRuleMandatory') },
    { value: 'default', label: t('process.fieldRuleDefault') },
    { value: 'visibility', label: t('process.fieldRuleVisibility') }
  ];
}

export function getOwnershipAssignmentOptions(t) {
  return [
    { value: 'owner', label: t('process.ownershipOwner') },
    { value: 'role', label: t('process.ownershipRole') },
    { value: 'rule', label: t('process.ownershipRule') }
  ];
}

export function getStatusGuardFieldOptions(t) {
  return [
    { value: 'stage', label: t('process.guardFieldStage') },
    { value: 'status', label: t('process.guardFieldStatus') },
    { value: 'lifecycle', label: t('process.guardFieldLifecycle') }
  ];
}

export function getWaitUnitOptions(t) {
  return [
    { value: 'minutes', label: t('process.waitUnitMinutes') },
    { value: 'hours', label: t('process.waitUnitHours') },
    { value: 'days', label: t('process.waitUnitDays') }
  ];
}

export function getWaitPresets(t) {
  return [
    { label: t('process.waitPreset15Min'), duration: 15, unit: 'minutes' },
    { label: t('process.waitPreset1Hour'), duration: 1, unit: 'hours' },
    { label: t('process.waitPreset2Days'), duration: 2, unit: 'days' },
    { label: t('process.waitPreset1Week'), duration: 7, unit: 'days' }
  ];
}

/** Draft processes with placeholder manual trigger before user picks “Starts when”. */
export function isTriggerSelectionPending(process) {
  if (process?.triggerConfigured === false) return true;
  if (process?.triggerConfigured === true) return false;
  return (
    process?.status === 'draft' &&
    process?.trigger?.type === 'manual' &&
    !process?.trigger?.eventType &&
    !(process?.nodes?.length)
  );
}

export function resolveCoreTriggerFromProcess(process) {
  if (isTriggerSelectionPending(process)) return '';
  const t = process?.trigger;
  if (!t?.type) return '';
  if (t.type === 'manual') return 'manual';
  if (t.type === 'webhook') return 'webhook';
  if (t.type === 'schedule') return 'schedule';
  if (t.type === 'domain_event' && t.eventType) {
    if (t.includeCreated && String(t.eventType).endsWith('.updated')) {
      return 'record_created_or_updated';
    }
    const created = createdEventType(process.entityType);
    const updated = updatedEventType(process.entityType);
    if (t.eventType === created) return 'record_created';
    if (t.eventType === updated) return 'record_updated';
    const legacy = LEGACY_EVENT_TO_CORE[t.eventType];
    if (legacy) return legacy.core;
    if (t.eventType.endsWith('.created')) return 'record_created';
    if (t.eventType.endsWith('.updated')) return 'record_updated';
  }
  return '';
}

export function resolveUpdateWatchFromProcess(process) {
  const t = process?.trigger;
  if (t?.updateWatch) {
    return {
      mode: t.updateWatch.mode === 'fields' ? 'fields' : 'any',
      watchField: t.updateWatch.fields?.[0] || '__any__'
    };
  }
  if (t?.type === 'domain_event' && t.eventType) {
    const legacy = LEGACY_EVENT_TO_CORE[t.eventType];
    if (legacy?.fields?.length) {
      return { mode: 'fields', watchField: legacy.fields[0] };
    }
  }
  return { mode: 'any', watchField: '__any__' };
}

export function resolveScheduleFromProcess(process) {
  const s = process?.trigger?.schedule;
  const browserTz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';
  return {
    preset: s?.preset || 'daily',
    hour: s?.hour ?? 9,
    minute: s?.minute ?? 0,
    dayOfWeek: s?.dayOfWeek ?? 1,
    dayOfMonth: s?.dayOfMonth ?? 1,
    timezone: s?.timezone || browserTz || 'UTC'
  };
}

export function defaultCoreTriggerForModule() {
  return '';
}

export function coerceCoreTriggerForModule(coreTrigger) {
  if (coreTrigger && CORE_TRIGGER_VALUES.includes(coreTrigger)) return coreTrigger;
  return '';
}

function buildUpdateWatch(watchField) {
  if (!watchField || watchField === '__any__') {
    return { mode: 'any', fields: [] };
  }
  return { mode: 'fields', fields: [watchField] };
}

function buildScheduleConfig(schedule) {
  const browserTz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC';
  return {
    preset: schedule?.preset || 'daily',
    frequency: schedule?.preset || 'daily',
    hour: Number(schedule?.hour ?? 9),
    minute: Number(schedule?.minute ?? 0),
    dayOfWeek: Number(schedule?.dayOfWeek ?? 1),
    dayOfMonth: Number(schedule?.dayOfMonth ?? 1),
    timezone: schedule?.timezone || browserTz || 'UTC'
  };
}

/**
 * Map core trigger UX → engine trigger + canvas needsTriggerNode.
 */
export function applyCoreTrigger(coreTrigger, entityType, options = {}) {
  const { payloadMapping = {}, updateWatchField = '__any__', schedule = {} } = options;

  if (coreTrigger === 'manual') {
    return { type: 'manual', eventType: null, needsTriggerNode: false };
  }
  if (coreTrigger === 'webhook') {
    return {
      type: 'webhook',
      eventType: null,
      needsTriggerNode: true,
      payloadMapping: payloadMapping || {}
    };
  }
  if (coreTrigger === 'schedule') {
    return {
      type: 'schedule',
      eventType: null,
      needsTriggerNode: true,
      schedule: buildScheduleConfig(schedule)
    };
  }
  if (coreTrigger === 'record_created') {
    return {
      type: 'domain_event',
      eventType: createdEventType(entityType),
      needsTriggerNode: true,
      includeCreated: false
    };
  }
  if (coreTrigger === 'record_updated') {
    return {
      type: 'domain_event',
      eventType: updatedEventType(entityType),
      needsTriggerNode: true,
      includeCreated: false,
      updateWatch: buildUpdateWatch(updateWatchField)
    };
  }
  if (coreTrigger === 'record_created_or_updated') {
    return {
      type: 'domain_event',
      eventType: updatedEventType(entityType),
      needsTriggerNode: true,
      includeCreated: true,
      updateWatch: buildUpdateWatch(updateWatchField)
    };
  }
  return { type: null, eventType: null, needsTriggerNode: false, unset: true };
}

export function buildTriggerFromCore(
  coreTrigger,
  entityType,
  { payloadMapping = {}, updateWatchField = '__any__', schedule = {} } = {},
  existingTrigger = {}
) {
  if (!coreTrigger) return null;
  const applied = applyCoreTrigger(coreTrigger, entityType, {
    payloadMapping,
    updateWatchField,
    schedule
  });

  if (applied.type === 'webhook') {
    return {
      type: 'webhook',
      eventType: null,
      webhookKey: existingTrigger.webhookKey || null,
      version: existingTrigger.version || 1,
      payloadMapping: applied.payloadMapping || {}
    };
  }
  if (applied.type === 'manual') {
    return { type: 'manual', eventType: null };
  }
  if (applied.type === 'schedule') {
    return {
      type: 'schedule',
      eventType: null,
      schedule: applied.schedule
    };
  }
  return {
    type: 'domain_event',
    eventType: applied.eventType,
    includeCreated: applied.includeCreated === true,
    updateWatch: applied.updateWatch || { mode: 'any', fields: [] }
  };
}

function formatClockTime(hour, minute) {
  const h = Number(hour ?? 9);
  const m = Number(minute ?? 0);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${h12} ${period}`;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function scheduleSummarySentence(schedule, t) {
  const preset = schedule?.preset || 'daily';
  if (preset === 'hourly') return t('process.designerScopeScheduleHourly');
  const time = formatClockTime(schedule?.hour, schedule?.minute);
  if (preset === 'weekly') {
    return t('process.designerScopeScheduleWeekly', { time });
  }
  if (preset === 'monthly') {
    return t('process.designerScopeScheduleMonthly', {
      day: schedule?.dayOfMonth ?? 1,
      time
    });
  }
  return t('process.designerScopeScheduleDaily', { time });
}

export function buildProcessScopeSentence(process, t) {
  const mod = getModuleLabel(t, process?.entityType);
  const core = process?.coreTrigger ?? resolveCoreTriggerFromProcess(process);

  if (!core) return t('process.designerScopeSelectStart');
  if (core === 'manual') return t('process.designerScopeManual');
  if (core === 'webhook') return t('process.designerScopeWebhook');
  if (core === 'schedule') {
    return scheduleSummarySentence(resolveScheduleFromProcess(process), t);
  }
  if (core === 'record_created') return t('process.designerScopeRecordCreated', { module: mod });
  if (core === 'record_created_or_updated') {
    const watch = resolveUpdateWatchFromProcess(process);
    if (watch.mode === 'fields' && watch.watchField && watch.watchField !== '__any__') {
      const label =
        updateWatchFieldOptions(process?.entityType, t).find((o) => o.value === watch.watchField)?.label ||
        watch.watchField;
      return t('process.designerScopeRecordCreatedOrUpdatedField', { module: mod, field: label });
    }
    return t('process.designerScopeRecordCreatedOrUpdated', { module: mod });
  }
  if (core === 'record_updated') {
    const watch = resolveUpdateWatchFromProcess(process);
    if (watch.mode === 'fields' && watch.watchField && watch.watchField !== '__any__') {
      const label =
        updateWatchFieldOptions(process?.entityType, t).find((o) => o.value === watch.watchField)?.label ||
        watch.watchField;
      return t('process.designerScopeRecordUpdatedField', { module: mod, field: label });
    }
    return t('process.designerScopeRecordUpdated', { module: mod });
  }
  return t('process.designerScopeGeneric', { module: mod });
}

/** @deprecated use resolveCoreTriggerFromProcess */
export function resolveStartsWhenFromProcess(process) {
  return resolveCoreTriggerFromProcess(process);
}

/** @deprecated use buildTriggerFromCore */
export function buildTriggerFromStartsWhen(startsWhen, payloadMapping = {}, existingTrigger = {}) {
  return buildTriggerFromCore(startsWhen, null, { payloadMapping }, existingTrigger);
}

/** @deprecated */
export function applyStartsWhen(startsWhen, entityType, payloadMapping = {}) {
  return applyCoreTrigger(startsWhen, entityType, { payloadMapping });
}

export function conditionFieldToPath(fieldKey, entityType) {
  if (!fieldKey) return '';
  if (fieldKey.startsWith('event.') || fieldKey.startsWith('dataBag.')) return fieldKey;
  return `event.currentState.${fieldKey}`;
}

export function conditionPathToField(path) {
  if (!path) return '';
  return String(path).replace(/^event\.currentState\./, '').replace(/^event\./, '');
}

/** Two-block IF shape: Block1 AND + Block2 OR, combined by blockCombinator. */
export function normalizeProcessConditionGroup(config = {}) {
  const emptyLeaf = () => ({
    field: '',
    operator: 'equals',
    valueMode: 'raw',
    value: '',
    expression: ''
  });

  const normalizeCombinator = (raw) => {
    const c = String(raw || 'AND').toUpperCase();
    return c === 'OR' || c === 'ANY' ? 'OR' : 'AND';
  };

  const collectLeaves = (items, out = []) => {
    if (!Array.isArray(items)) return out;
    for (const item of items) {
      if (item && Array.isArray(item.conditions)) collectLeaves(item.conditions, out);
      else if (item?.field != null) {
        const mode = String(item.valueMode || 'raw').toLowerCase() === 'expression' ? 'expression' : 'raw';
        out.push({
          field: item.field || '',
          operator: item.operator || 'equals',
          valueMode: mode,
          value: item.value ?? '',
          expression: item.expression != null ? String(item.expression) : ''
        });
      }
    }
    return out;
  };

  const cg =
    config.conditionGroup && typeof config.conditionGroup === 'object'
      ? config.conditionGroup
      : config;

  if (cg.andBlock || cg.orBlock) {
    const andConds = Array.isArray(cg.andBlock?.conditions) ? cg.andBlock.conditions : [];
    const orConds = Array.isArray(cg.orBlock?.conditions) ? cg.orBlock.conditions : [];
    const needsDefault = !andConds.length && !orConds.length;
    return {
      blockCombinator: normalizeCombinator(cg.blockCombinator),
      andBlock: { conditions: needsDefault ? [emptyLeaf()] : andConds },
      orBlock: { conditions: orConds }
    };
  }

  if (Array.isArray(cg.conditions)) {
    const leaves = collectLeaves(cg.conditions);
    const combinator = normalizeCombinator(cg.combinator);
    if (combinator === 'OR') {
      return {
        blockCombinator: 'AND',
        andBlock: { conditions: [emptyLeaf()] },
        orBlock: { conditions: leaves }
      };
    }
    return {
      blockCombinator: 'AND',
      andBlock: { conditions: leaves.length ? leaves : [emptyLeaf()] },
      orBlock: { conditions: [] }
    };
  }

  const leaf = config.condition && typeof config.condition === 'object' ? config.condition : null;
  if (leaf?.field || leaf?.operator) {
    return {
      blockCombinator: 'AND',
      andBlock: {
        conditions: [
          {
            field: leaf.field || '',
            operator: leaf.operator || 'equals',
            valueMode: String(leaf.valueMode || 'raw').toLowerCase() === 'expression' ? 'expression' : 'raw',
            value: leaf.value ?? '',
            expression: leaf.expression != null ? String(leaf.expression) : ''
          }
        ]
      },
      orBlock: { conditions: [] }
    };
  }

  if (config.field && config.operator) {
    return {
      blockCombinator: 'AND',
      andBlock: {
        conditions: [
          {
            field: config.field,
            operator: config.operator,
            valueMode: String(config.valueMode || 'raw').toLowerCase() === 'expression' ? 'expression' : 'raw',
            value: config.value ?? '',
            expression: config.expression != null ? String(config.expression) : ''
          }
        ]
      },
      orBlock: { conditions: [] }
    };
  }

  return {
    blockCombinator: 'AND',
    andBlock: { conditions: [emptyLeaf()] },
    orBlock: { conditions: [] }
  };
}
