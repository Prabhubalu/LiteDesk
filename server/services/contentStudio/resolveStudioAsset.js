'use strict';

/**
 * Content Studio covers/media for Articles use ContentAsset.
 * Blog uses MarketingAsset. Resolve by addon, with cross-library fallback.
 */
async function resolveStudioAsset({ organizationId, assetId, addonKey = 'articles' }) {
  const id = String(assetId || '').trim();
  if (!organizationId || !id) return null;

  const preferMarketing = addonKey === 'blog';
  const contentAssetService = require('../contentPlatform/contentAssetService');
  const marketingAssetService = require('../marketing/marketingAssetService');

  async function tryContent() {
    try {
      return await contentAssetService.getAssetById({ organizationId, assetId: id });
    } catch {
      return null;
    }
  }

  async function tryMarketing() {
    try {
      return await marketingAssetService.getAssetById({ organizationId, assetId: id });
    } catch {
      return null;
    }
  }

  if (preferMarketing) {
    return (await tryMarketing()) || (await tryContent());
  }
  return (await tryContent()) || (await tryMarketing());
}

module.exports = {
  resolveStudioAsset,
};
