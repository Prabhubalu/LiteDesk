import {
  CreditCardIcon,
  CubeIcon,
  DocumentCurrencyDollarIcon,
  DocumentTextIcon,
  ShoppingCartIcon
} from '@heroicons/vue/24/outline';
import type { Component } from 'vue';

/** Canonical Heroicon string ids stored on ModuleDefinition.ui.icon */
export const MODULE_ICON_IDS: Record<string, string> = {
  quotes: 'document-text',
  sales_orders: 'shopping-cart',
  invoices: 'document-currency-dollar',
  payments: 'credit-card',
  inventory: 'cube'
};

export const MODULE_ICON_COMPONENTS: Record<string, Component> = {
  quotes: DocumentTextIcon,
  sales_orders: ShoppingCartIcon,
  invoices: DocumentCurrencyDollarIcon,
  payments: CreditCardIcon,
  inventory: CubeIcon
};

const ROUTE_SLUG_TO_MODULE_KEY: Record<string, string> = {
  quotes: 'quotes',
  'sales-orders': 'sales_orders',
  invoices: 'invoices',
  payments: 'payments'
};

/** Legacy ModuleDefinition.ui.icon emoji → canonical id (module-specific where ambiguous). */
const LEGACY_EMOJI_BY_MODULE: Record<string, Record<string, string>> = {
  quotes: { '🧾': 'document-text' },
  sales_orders: { '📦': 'shopping-cart' },
  invoices: { '🧾': 'document-currency-dollar' },
  payments: { '💳': 'credit-card' }
};

export function normalizeModuleKey(key?: string): string {
  const raw = String(key || '').toLowerCase();
  return ROUTE_SLUG_TO_MODULE_KEY[raw] || raw;
}

export function getModuleIconId(moduleKey?: string): string {
  const key = normalizeModuleKey(moduleKey);
  return MODULE_ICON_IDS[key] || 'document-text';
}

export function getModuleIconComponent(moduleKey?: string): Component {
  const key = normalizeModuleKey(moduleKey);
  return MODULE_ICON_COMPONENTS[key] || DocumentTextIcon;
}

/** Resolve stored ui.icon (emoji, slug, or module key) to a canonical icon id. */
export function resolveStoredModuleIconId(icon?: string, moduleKey?: string): string {
  const raw = String(icon || '').trim();
  const key = normalizeModuleKey(moduleKey);
  const legacyForModule = LEGACY_EMOJI_BY_MODULE[key]?.[raw];
  if (legacyForModule) {
    return legacyForModule;
  }
  const lower = raw.toLowerCase();
  if (MODULE_ICON_IDS[lower]) {
    return MODULE_ICON_IDS[lower];
  }
  if (MODULE_ICON_IDS[normalizeModuleKey(lower)]) {
    return MODULE_ICON_IDS[normalizeModuleKey(lower)];
  }
  return getModuleIconId(moduleKey);
}
