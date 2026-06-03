/**
 * Inventory app vs sales-only commercial UX.
 *
 * Sales Order = execution/work-order (progress, fulfillment events, billing).
 * Inventory app adds stock control (ATP, reservations, backorder, ledger) on top.
 *
 * Engine gating: server/services/inventoryCapabilityService.js
 */

import type { ModuleListConfig } from '@/platform/modules/moduleListRegistry';

export type OrgCapabilities = { inventory?: boolean } | null | undefined;

export function isInventoryEnabled(organization?: { capabilities?: OrgCapabilities } | null): boolean {
  return organization?.capabilities?.inventory === true;
}

/** Header/module fields hidden when Inventory is off (ledger & serial only). */
export const INVENTORY_GATED_FIELD_KEYS: Readonly<Record<string, readonly string[]>> = {
  items: ['stock_quantity', 'reorder_level', 'serial_numbers'],
  sales_orders: [],
  quotes: [],
  invoices: [],
  payments: [],
};

const GATED_LOOKUP = new Map<string, Set<string>>();
for (const [moduleKey, keys] of Object.entries(INVENTORY_GATED_FIELD_KEYS)) {
  GATED_LOOKUP.set(moduleKey, new Set(keys.map((k) => k.toLowerCase())));
}

export function isInventoryGatedField(moduleKey: string, fieldKey: string): boolean {
  const set = GATED_LOOKUP.get(String(moduleKey || '').toLowerCase());
  if (!set) return false;
  return set.has(String(fieldKey || '').trim().toLowerCase());
}

export function shouldHideFieldWhenInventoryDisabled(
  moduleKey: string,
  fieldKey: string,
  inventoryEnabled: boolean
): boolean {
  if (inventoryEnabled) return false;
  return isInventoryGatedField(moduleKey, fieldKey);
}

/** Serial/lot tracking — requires Inventory app. Non-Stock Product stays (catalog without ledger). */
export const INVENTORY_ONLY_ITEM_TYPES = new Set(['Serialized Product']);

export function filterItemTypeOptionsForCapabilities<T extends { value?: string; label?: string }>(
  options: T[],
  inventoryEnabled: boolean
): T[] {
  if (inventoryEnabled) return options;
  return options.filter((opt) => !INVENTORY_ONLY_ITEM_TYPES.has(String(opt?.value ?? opt?.label ?? '')));
}

/** SO fulfillment event types that imply warehouse/stock backorder semantics. */
export const INVENTORY_WAREHOUSE_FULFILLMENT_EVENT_TYPES = new Set(['backorder']);

const OPERATIONAL_FULFILLMENT_EVENT_TYPES = ['ship', 'deliver', 'complete', 'cancel', 'backorder'] as const;

export function getSalesOrderFulfillmentEventTypes(inventoryEnabled: boolean): readonly string[] {
  if (inventoryEnabled) return OPERATIONAL_FULFILLMENT_EVENT_TYPES;
  return OPERATIONAL_FULFILLMENT_EVENT_TYPES.filter(
    (type) => !INVENTORY_WAREHOUSE_FULFILLMENT_EVENT_TYPES.has(type)
  );
}

/**
 * List registry: no SO list/view changes for sales-only — execution progress stays visible.
 */
export function applyInventoryCapabilityToModuleListConfig(
  config: ModuleListConfig | null,
  _moduleKey: string,
  _inventoryEnabled: boolean
): ModuleListConfig | null {
  return config;
}

export function filterModuleFieldsForInventory<T extends { key?: string }>(
  moduleKey: string,
  fields: T[],
  inventoryEnabled: boolean
): T[] {
  if (inventoryEnabled || !Array.isArray(fields)) return fields;
  return fields.filter((f) => !shouldHideFieldWhenInventoryDisabled(moduleKey, String(f?.key || ''), false));
}
