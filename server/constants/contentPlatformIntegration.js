'use strict';

/** @typedef {'legacy' | 'shadow' | 'platform'} ContentPlatformRenderMode */

const VALID_MODES = new Set(['legacy', 'shadow', 'platform']);

/**
 * Per-module Content Platform document render configuration.
 * @type {Record<string, { purpose: string, moduleScope: string, seedKey: string, envModeKey: string }>}
 */
const MODULE_DOCUMENT_CONFIG = {
  quotes: {
    purpose: 'quote',
    moduleScope: 'quotes',
    seedKey: 'quote-default',
    envModeKey: 'CONTENT_PLATFORM_QUOTES_MODE'
  },
  invoices: {
    purpose: 'invoice',
    moduleScope: 'invoices',
    seedKey: 'invoice-default',
    envModeKey: 'CONTENT_PLATFORM_INVOICES_MODE'
  },
  purchase_orders: {
    purpose: 'purchase_order',
    moduleScope: 'purchase_orders',
    seedKey: 'purchase-order',
    envModeKey: 'CONTENT_PLATFORM_PURCHASE_ORDERS_MODE'
  },
  purchase_returns: {
    purpose: 'purchase_return',
    moduleScope: 'purchase_returns',
    seedKey: 'purchase-return',
    envModeKey: 'CONTENT_PLATFORM_PURCHASE_RETURNS_MODE'
  }
};

/**
 * @param {string} moduleKey
 * @returns {ContentPlatformRenderMode}
 */
function getModuleRenderMode(moduleKey) {
  const config = MODULE_DOCUMENT_CONFIG[moduleKey];
  if (!config) return 'legacy';

  const raw = String(process.env[config.envModeKey] || 'legacy').trim().toLowerCase();
  return VALID_MODES.has(raw) ? /** @type {ContentPlatformRenderMode} */ (raw) : 'legacy';
}

/**
 * Optional explicit template override per module (for testing / rollout).
 * @param {string} moduleKey
 * @returns {string | null}
 */
function getModuleTemplateOverride(moduleKey) {
  const envKey = moduleKey === 'quotes'
    ? 'CONTENT_PLATFORM_QUOTE_TEMPLATE_ID'
    : 'CONTENT_PLATFORM_INVOICE_TEMPLATE_ID';
  const value = String(process.env[envKey] || '').trim();
  return value || null;
}

module.exports = {
  MODULE_DOCUMENT_CONFIG,
  VALID_MODES,
  getModuleRenderMode,
  getModuleTemplateOverride
};
