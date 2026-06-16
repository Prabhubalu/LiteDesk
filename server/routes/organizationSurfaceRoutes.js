/**
 * OrganizationSurface Routes
 * 
 * Routes for OrganizationSurface and CreateOrganizationSurface.
 * 
 * ARCHITECTURAL INTENT:
 * - POST /api/organizations: Dedicated endpoint for CreateOrganizationSurface (create mode)
 *   - Only accepts business organization fields (name, types, industry, website, phone, address)
 *   - Forces isTenant = false
 *   - Rejects tenant-only fields
 *   - Returns minimal organization identity (id, name, types)
 * 
 * - GET /api/organizations/:id/editable: Get editable data for CreateOrganizationSurface (edit mode)
 *   - Returns ONLY editable business fields (name, address, website, phone, industry, types)
 *   - Rejects tenant organizations
 *   - Filters by tenant context
 * 
 * - PATCH /api/organizations/:id: Update business organization (edit mode)
 * - PUT /api/organizations/:id: Backward-compatible alias for update (record-page parity)
 *   - Accepts ONLY editable business fields
 *   - Rejects tenant organizations
 *   - Filters by tenant context
 *   - Returns minimal organization identity (id, name, types)
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
const controller = require('../controllers/organizationV2Controller');
const createController = require('../controllers/organizationCreateController');

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
