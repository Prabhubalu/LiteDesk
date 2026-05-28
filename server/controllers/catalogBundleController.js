const {
  getBundleComponents,
  replaceBundleComponents,
  searchVariants,
  expandBundlePreview
} = require('../services/catalogBundleService');

exports.getBundleComponents = async (req, res) => {
  try {
    const data = await getBundleComponents(req.params.variantId, req.user.organizationId);
    res.json({ success: true, data });
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.code === 'NOT_BUNDLE') {
      return res.status(404).json({ success: false, message: err.message, code: err.code });
    }
    console.error('getBundleComponents error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error fetching bundle components' });
  }
};

exports.putBundleComponents = async (req, res) => {
  try {
    const data = await replaceBundleComponents({
      bundleVariantId: req.params.variantId,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      components: req.body?.components || [],
      pricingMode: req.body?.pricingMode
    });
    res.json({ success: true, data });
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.code === 'NOT_BUNDLE') {
      return res.status(404).json({ success: false, message: err.message, code: err.code });
    }
    if (['VALIDATION', 'SELF_REFERENCE', 'DUPLICATE_COMPONENT'].includes(err.code)) {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('putBundleComponents error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error saving bundle components' });
  }
};

exports.getBundleExpandPreview = async (req, res) => {
  try {
    const data = await expandBundlePreview({
      organizationId: req.user.organizationId,
      bundleVariantId: req.params.variantId,
      priceBookId: req.query.priceBookId || null,
      quantity: req.query.quantity ?? 1,
      asOfDate: req.query.asOfDate || null
    });
    res.json({ success: true, data });
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.code === 'NOT_BUNDLE') {
      return res.status(404).json({ success: false, message: err.message, code: err.code });
    }
    console.error('getBundleExpandPreview error:', err);
    res.status(400).json({ success: false, message: err.message || 'Error expanding bundle' });
  }
};

exports.searchCatalogVariants = async (req, res) => {
  try {
    const data = await searchVariants(req.user.organizationId, {
      q: req.query.q || '',
      excludeVariantId: req.query.excludeVariantId || null,
      limit: req.query.limit
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error('searchCatalogVariants error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error searching variants' });
  }
};
