/**
 * OrganizationSurface Routes
 * 
 * Routes for OrganizationSurface and CreateOrganizationSurface.
 * 
 * ARCHITECTURAL INTENT:
 * - POST /api/organizations: Create business organization (type-scoped fields allowed)
 *   - Forces isTenant = false
 *   - Rejects tenant-only fields
 *   - Filters payload by organization type field visibility
 *   - Returns minimal organization identity (id, name, types)
 * 
 * - GET /api/organizations/:id/editable: Get editable data for CreateOrganizationSurface (edit mode)
 *   - Returns editable business fields including type-scoped fields on the record
 *   - Rejects tenant organizations
 *   - Filters by tenant context
 * 
 * - PATCH /api/organizations/:id: Update business organization (edit mode)
 * - PUT /api/organizations/:id: Backward-compatible alias for update (record-page parity)
 *   - Accepts business-editable fields filtered by type visibility
 *   - Rejects tenant organizations
 *   - Filters by tenant context
 *
 * - GET /api/organizations/:id: Backward-compatible alias for organization detail
 *   - Maps to v2 organization getById behavior
 * 
 * - GET /api/organizations/:id/surface: OrganizationSurface endpoint
 *   - Alias route for /api/organizations/:id/surface
 *   - Maps to the same controller as /api/v2/organization/:id/surface
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/organizationV2Controller');
const createController = require('../controllers/organizationCreateController');
const vendorCatalogService = require('../services/vendorCatalogService');

function sendVendorCatalogError(res, err) {
  const status = err?.code === 'NOT_FOUND' ? 404 : err?.code === 'VALIDATION' ? 400 : 500;
  return res.status(status).json({
    success: false,
    message: err.message,
    code: err.code || 'UNKNOWN'
  });
}

router.use(protect);
router.use(resolveAppContext);
router.use(requireAppEntitlement);
router.use(lazySalesInitialization);
router.use(requireSalesApp);
router.use(organizationIsolation);

// CreateOrganizationSurface endpoint (must be before /:id route)
// ARCHITECTURAL INTENT: Dedicated endpoint for creation-only surface
// This endpoint enforces strict field filtering and business organization creation only
router.post('/', createController.create);

// Vendor Catalog nested on organization (Sales app context — org create/edit)
router.get('/:id/vendor-catalog', checkPermission('organizations', 'view'), async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || 'true') !== 'false';
    const data = await vendorCatalogService.listEntries({
      organizationId: req.user.organizationId,
      vendorId: req.params.id,
      status: req.query.status || null,
      includeInactive
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendVendorCatalogError(res, err);
  }
});

router.put('/:id/vendor-catalog', checkPermission('organizations', 'edit'), async (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entries)
      ? req.body.entries
      : Array.isArray(req.body)
        ? req.body
        : [];
    const data = await vendorCatalogService.replaceEntries({
      organizationId: req.user.organizationId,
      vendorId: req.params.id,
      entries,
      userId: req.user._id
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendVendorCatalogError(res, err);
  }
});


// Get editable organization data (for edit mode)
// Must be before /:id/surface route
router.get('/:id/editable', controller.getEditable);

// Update business organization (for edit mode)
// Must be before /:id/surface route
router.patch('/:id', controller.update);
router.put('/:id', controller.update);

// OrganizationSurface endpoint
router.get('/:id/surface', controller.getSurface);
router.get('/:id', controller.getById);

module.exports = router;
