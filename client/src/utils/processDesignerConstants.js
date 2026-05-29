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
  quote: 'quotes'
};

const CORE_TRIGGER_VALUES = ['record_created', 'record_updated', 'schedule', 'webhook', 'manual'];

const CORE_TRIGGER_DESC_KEYS = {
  record_created: 'process.designerTriggerDescRecordCreated',
  record_updated: 'process.designerTriggerDescRecordUpdated',
  schedule: 'process.designerTriggerDescSchedule',
  webhook: 'process.designerTriggerDescWebhook',
  manual: 'process.designerTriggerDescManual'
};

const MODULE_SINGULAR_KEYS = {
  people: 'process.designerModulePerson',
  organization: 'process.designerModuleOrganization',
  deal: 'process.designerModuleDeal',
  quote: 'process.designerModuleQuote'
};

export function getAppOptions(t) {
  return [
    { value: 'SALES', label: t('process.designerAppSales') },
    { value: 'AUDIT', label: t('process.designerAppAudit') },
    { value: 'PORTAL', label: t('process.designerAppPortal') }
  ];
}

export function getModuleOptions(t) {
  return [
    { value: 'people', label: t('process.designerModulePeople') },
    { value: 'organization', label: t('process.designerModuleOrganization') },
    { value: 'deal', label: t('process.designerModuleDeal') },
    { value: 'quote', label: t('process.designerModuleQuote') }
  ];
}

export function getModuleLabel(t, entityType, { plural = false } = {}) {
  if (plural) {
    return getModuleOptions(t).find((m) => m.value === entityType)?.label || entityType;
  }
  return t(MODULE_SINGULAR_KEYS[entityType] || 'process.designerModuleRecordFallback');
}

/** Layer 1 — only top-level “Starts when” options */
export function getCoreTriggerOptions(t) {
  return [
    { value: 'record_created', label: t('process.designerTriggerRecordCreated') },
    { value: 'record_updated', label: t('process.designerTriggerRecordUpdated') },
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
    { value: 'weekly', label: t('process.designerScheduleWeekly') }
  ];
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
      { value: 'ownerId', label: t('process.designerWatchOwner') }
    ],
    quote: [
      any,
      { value: 'status', label: t('process.designerWatchQuoteStatus') },
      { value: 'grandTotal', label: t('process.designerWatchGrandTotal') },
      { value: 'globalDiscountTotal', label: t('process.designerWatchGlobalDiscount') },
      { value: 'ownerId', label: t('process.designerWatchOwner') }
    ]
  };
  return byModule[entityType] || [any];
}

const LEGACY_EVENT_TO_CORE = {
  'people.lifecycle.changed': { core: 'record_updated', fields: ['lifecycle'] },
  'people.sales_type.changed': { core: 'record_updated', fields: ['sales_type'] },
  'organization.lifecycle.changed': { core: 'record_updated', fields: ['lifecycle'] },
  'organization.type.changed': { core: 'record_updated', fields: ['type'] },
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
      { value: 'ownerId', label: t('process.designerWatchOwner') },
      { value: 'status', label: t('process.designerCondStatus') }
    ],
    quote: [
      { value: 'status', label: t('process.designerWatchQuoteStatus') },
      { value: 'grandTotal', label: t('process.designerWatchGrandTotal') },
      { value: 'globalDiscountTotal', label: t('process.designerWatchGlobalDiscount') },
      { value: 'subtotal', label: t('process.designerWatchSubtotal') },
      { value: 'ownerId', label: t('process.designerWatchOwner') }
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
  return {
    preset: s?.preset || 'daily',
    hour: s?.hour ?? 9,
    minute: s?.minute ?? 0,
    dayOfWeek: s?.dayOfWeek ?? 1,
    timezone: s?.timezone || 'UTC'
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
  return {
    preset: schedule?.preset || 'daily',
    frequency: schedule?.preset || 'daily',
    hour: Number(schedule?.hour ?? 9),
    minute: Number(schedule?.minute ?? 0),
    dayOfWeek: Number(schedule?.dayOfWeek ?? 1),
    timezone: schedule?.timezone || 'UTC'
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
      needsTriggerNode: false,
      schedule: buildScheduleConfig(schedule)
    };
  }
  if (coreTrigger === 'record_created') {
    return {
      type: 'domain_event',
      eventType: createdEventType(entityType),
      needsTriggerNode: true
    };
  }
  if (coreTrigger === 'record_updated') {
    return {
      type: 'domain_event',
      eventType: updatedEventType(entityType),
      needsTriggerNode: true,
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
