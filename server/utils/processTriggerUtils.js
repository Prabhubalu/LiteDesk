'use strict';

/**
 * Process trigger matching and migration helpers (core trigger model).
 */

const CORE_TRIGGER_TYPES = ['record_created', 'record_updated', 'schedule', 'webhook', 'manual'];

/** Legacy domain eventType → core UX + optional field watch */
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
  if (!entityType) return null;
  return `${entityType}.created`;
}

function updatedEventType(entityType) {
  if (!entityType) return null;
  return `${entityType}.updated`;
}

/**
 * Whether a domain event matches process trigger updateWatch (record updated only).
 */
function matchesUpdateWatch(trigger, event) {
  if (!trigger || trigger.type !== 'domain_event') return true;
  const watch = trigger.updateWatch;
  if (!watch || watch.mode === 'any' || !Array.isArray(watch.fields) || watch.fields.length === 0) {
    return true;
  }
  const changed = event?.changedFields || [];
  if (!changed.length) {
    // No diff metadata — allow run (backward compat with granular events)
    return true;
  }
  return watch.fields.some((f) => changed.includes(f));
}

/**
 * Infer core trigger key from stored process.trigger
 */
function resolveCoreTriggerFromProcess(process) {
  const t = process?.trigger;
  if (!t) return 'manual';
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
  return 'manual';
}

function resolveUpdateWatchFromProcess(process) {
  const t = process?.trigger;
  if (t?.updateWatch) {
    return {
      mode: t.updateWatch.mode === 'fields' ? 'fields' : 'any',
      fields: Array.isArray(t.updateWatch.fields) ? [...t.updateWatch.fields] : []
    };
  }
  if (t?.type === 'domain_event' && t.eventType) {
    const legacy = LEGACY_EVENT_TO_CORE[t.eventType];
    if (legacy?.fields?.length) {
      return { mode: 'fields', fields: [...legacy.fields] };
    }
  }
  return { mode: 'any', fields: [] };
}

function resolveScheduleFromProcess(process) {
  const s = process?.trigger?.schedule;
  if (!s || typeof s !== 'object') {
    return { preset: 'daily', hour: 9, minute: 0, dayOfWeek: 1, timezone: 'UTC' };
  }
  return {
    preset: s.preset || s.frequency || 'daily',
    hour: s.hour ?? 9,
    minute: s.minute ?? 0,
    dayOfWeek: s.dayOfWeek ?? 1,
    timezone: s.timezone || 'UTC'
  };
}

module.exports = {
  CORE_TRIGGER_TYPES,
  LEGACY_EVENT_TO_CORE,
  createdEventType,
  updatedEventType,
  matchesUpdateWatch,
  resolveCoreTriggerFromProcess,
  resolveUpdateWatchFromProcess,
  resolveScheduleFromProcess
};
