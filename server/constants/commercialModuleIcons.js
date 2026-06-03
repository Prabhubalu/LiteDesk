/** Canonical Heroicon outline ids for commercial platform modules (client: moduleIcons.ts). */
const COMMERCIAL_MODULE_UI_ICONS = Object.freeze({
  quotes: 'document-text',
  sales_orders: 'shopping-cart',
  invoices: 'document-currency-dollar',
  payments: 'credit-card'
});

const LEGACY_EMOJI_ICONS = new Set(['🧾', '📦', '💳']);

function commercialModuleIconId(moduleKey) {
  return COMMERCIAL_MODULE_UI_ICONS[String(moduleKey || '').toLowerCase()] || null;
}

function shouldNormalizeCommercialIcon(currentIcon, moduleKey) {
  const canonical = commercialModuleIconId(moduleKey);
  if (!canonical) return false;
  const icon = String(currentIcon || '').trim();
  if (!icon || icon === 'module') return true;
  if (LEGACY_EMOJI_ICONS.has(icon)) return true;
  return icon !== canonical;
}

module.exports = {
  COMMERCIAL_MODULE_UI_ICONS,
  commercialModuleIconId,
  shouldNormalizeCommercialIcon
};
