import {
  AdjustmentsHorizontalIcon,
  ArrowsRightLeftIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  CubeIcon,
  DocumentCurrencyDollarIcon,
  DocumentTextIcon,
  InboxArrowDownIcon,
  ReceiptRefundIcon,
  ShoppingCartIcon,
  TruckIcon
} from '@heroicons/vue/24/outline';
import type { Component } from 'vue';

/** Canonical Heroicon string ids stored on ModuleDefinition.ui.icon */
export const MODULE_ICON_IDS: Record<string, string> = {
  quotes: 'document-text',
  sales_orders: 'shopping-cart',
  purchase_orders: 'document-text',
  receipt_notes: 'inbox-arrow-down',
  purchase_returns: 'arrow-uturn-left',
  delivery_notes: 'truck',
  delivery_returns: 'arrow-uturn-right',
  sales_returns: 'receipt-refund',
  stockrooms: 'building-storefront',
  stock_adjustments: 'adjustments-horizontal',
  stock_transfers: 'arrows-right-left',
  invoices: 'document-currency-dollar',
  payments: 'credit-card',
  inventory: 'cube',
  responses: 'clipboard-document-list',
  portal_support: 'lifebuoy',
  support: 'lifebuoy',
  portal_invoices: 'banknotes',
  portal_knowledge: 'book-open',
  knowledge: 'book-open'
};

export const MODULE_ICON_COMPONENTS: Record<string, Component> = {
  quotes: DocumentTextIcon,
  sales_orders: ShoppingCartIcon,
  purchase_orders: DocumentTextIcon,
  receipt_notes: InboxArrowDownIcon,
  purchase_returns: ArrowUturnLeftIcon,
  delivery_notes: TruckIcon,
  delivery_returns: ArrowUturnRightIcon,
  sales_returns: ReceiptRefundIcon,
  stockrooms: BuildingStorefrontIcon,
  stock_adjustments: AdjustmentsHorizontalIcon,
  stock_transfers: ArrowsRightLeftIcon,
  invoices: DocumentCurrencyDollarIcon,
  payments: CreditCardIcon,
  inventory: CubeIcon,
  responses: ClipboardDocumentListIcon
};

const ROUTE_SLUG_TO_MODULE_KEY: Record<string, string> = {
  quotes: 'quotes',
  'sales-orders': 'sales_orders',
  'purchase-orders': 'purchase_orders',
  'receipt-notes': 'receipt_notes',
  'purchase-returns': 'purchase_returns',
  'delivery-notes': 'delivery_notes',
  'delivery-returns': 'delivery_returns',
  'sales-returns': 'sales_returns',
  stockrooms: 'stockrooms',
  adjustments: 'stock_adjustments',
  transfers: 'stock_transfers',
  invoices: 'invoices',
  payments: 'payments'
};

/** Legacy ModuleDefinition.ui.icon emoji → canonical id (module-specific where ambiguous). */
const LEGACY_EMOJI_BY_MODULE: Record<string, Record<string, string>> = {
  quotes: { '🧾': 'document-text' },
  sales_orders: { '📦': 'shopping-cart' },
  invoices: { '🧾': 'document-currency-dollar' },
  payments: { '💳': 'credit-card' },
  responses: { '📋': 'clipboard-document-list' }
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
  const normalizedLower = normalizeModuleKey(lower);
  const iconIdFromLower = MODULE_ICON_IDS[normalizedLower];
  if (iconIdFromLower) {
    return iconIdFromLower;
  }
  if (/^[a-z0-9-]+$/.test(lower)) {
    return lower;
  }
  return getModuleIconId(moduleKey);
}
