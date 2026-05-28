const CATALOG_BUNDLE_PRICING_MODES = ['fixed', 'rollup'];

const CATALOG_BUNDLE_PRICING_DEFAULT = 'fixed';

function isCatalogBundlePricingMode(value) {
  return CATALOG_BUNDLE_PRICING_MODES.includes(value);
}

module.exports = {
  CATALOG_BUNDLE_PRICING_MODES,
  CATALOG_BUNDLE_PRICING_DEFAULT,
  isCatalogBundlePricingMode
};
