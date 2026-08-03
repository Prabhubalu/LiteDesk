const express = require('express');
const vendorCatalogService = require('../services/vendorCatalogService');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { requireInventoryApp } = require('../middleware/requireInventoryAppMiddleware');

function sendError(res, err) {
  const status = err?.code === 'NOT_FOUND' ? 404 : err?.code === 'VALIDATION' ? 400 : 500;
  return res.status(status).json({
    success: false,
    message: err.message,
    code: err.code || 'UNKNOWN'
  });
}

const router = express.Router();
router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(requireInventoryApp);
router.use(organizationIsolation);
router.use(checkTrialStatus);

/** GET /api/inventory/vendor-catalog/:vendorId */
router.get('/:vendorId', checkPermission('inventory', 'view'), async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || 'true') !== 'false';
    const status = req.query.status || null;
    const data = await vendorCatalogService.listEntries({
      organizationId: req.user.organizationId,
      vendorId: req.params.vendorId,
      status,
      includeInactive
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

/** PUT /api/inventory/vendor-catalog/:vendorId — replace full catalog */
router.put('/:vendorId', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entries)
      ? req.body.entries
      : Array.isArray(req.body)
        ? req.body
        : [];
    const data = await vendorCatalogService.replaceEntries({
      organizationId: req.user.organizationId,
      vendorId: req.params.vendorId,
      entries,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

/** POST /api/inventory/vendor-catalog/:vendorId/entries — upsert one */
router.post('/:vendorId/entries', checkPermission('inventory', 'adjust'), async (req, res) => {
  try {
    const data = await vendorCatalogService.upsertEntry({
      organizationId: req.user.organizationId,
      vendorId: req.params.vendorId,
      payload: req.body || {},
      userId: req.user._id
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

/** DELETE /api/inventory/vendor-catalog/:vendorId/entries/:entryId */
router.delete(
  '/:vendorId/entries/:entryId',
  checkPermission('inventory', 'adjust'),
  async (req, res) => {
    try {
      await vendorCatalogService.deleteEntry({
        organizationId: req.user.organizationId,
        vendorId: req.params.vendorId,
        entryId: req.params.entryId
      });
      return res.json({ success: true });
    } catch (err) {
      return sendError(res, err);
    }
  }
);

/** GET /api/inventory/vendor-catalog/:vendorId/variants/search */
router.get(
  '/:vendorId/variants/search',
  checkPermission('inventory', 'view'),
  async (req, res) => {
    try {
      const data = await vendorCatalogService.searchVariantsForVendor({
        organizationId: req.user.organizationId,
        vendorId: req.params.vendorId,
        q: req.query.q || req.query.search || '',
        scope: req.query.scope || 'linked',
        limit: req.query.limit
      });
      return res.json({ success: true, data });
    } catch (err) {
      return sendError(res, err);
    }
  }
);

module.exports = router;
