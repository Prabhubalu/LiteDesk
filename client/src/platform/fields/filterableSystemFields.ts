/**
 * Platform allowlist: audit/system fields eligible for module list/board filters.
 *
 * Module APIs omit these from create/edit schema; list columns already re-merge
 * config-visible system fields. Filters use this SSOT so Created/Modified/Created By
 * appear platform-wide without per-module picker hacks.
 *
 * Key aliases (e.g. events: createdTime/modifiedTime) map to the same filter UX.
 */

import type { BaseFilterType } from './BaseFieldModel';
import { normalizeFieldKeyForMetadataLookup } from './BaseFieldModel';

export type FilterableSystemFieldDef = {
  /** Canonical storage key as stored on most modules */
  key: string;
  filterType: Extract<BaseFilterType, 'date' | 'user'>;
  /** List column / filter dataType */
  dataType: 'datetime' | 'user';
  /** Sort order within the audit block (lower = earlier in picker) */
  order: number;
};

/** Canonical audit filter fields (plus known storage aliases). */
const FILTERABLE_SYSTEM_FIELDS: readonly FilterableSystemFieldDef[] = [
  { key: 'createdAt', filterType: 'date', dataType: 'datetime', order: 9001 },
  { key: 'createdTime', filterType: 'date', dataType: 'datetime', order: 9001 },
  { key: 'updatedAt', filterType: 'date', dataType: 'datetime', order: 9002 },
  { key: 'modifiedTime', filterType: 'date', dataType: 'datetime', order: 9002 },
  { key: 'createdBy', filterType: 'user', dataType: 'user', order: 9003 },
] as const;

const BY_NORMALIZED_KEY = new Map(
  FILTERABLE_SYSTEM_FIELDS.map((def) => [normalizeFieldKeyForMetadataLookup(def.key), def])
);

export function getFilterableSystemFieldDefs(): readonly FilterableSystemFieldDef[] {
  return FILTERABLE_SYSTEM_FIELDS;
}

export function getFilterableSystemFieldDef(fieldKey: string): FilterableSystemFieldDef | undefined {
  return BY_NORMALIZED_KEY.get(normalizeFieldKeyForMetadataLookup(fieldKey));
}

export function isFilterableSystemFieldKey(fieldKey: string): boolean {
  return BY_NORMALIZED_KEY.has(normalizeFieldKeyForMetadataLookup(fieldKey));
}
