/**
 * ============================================================================
 * Phase 0I.2: Response Detail Routes (Read-Only)
 * ============================================================================
 * 
 * Read-only endpoint for Response Detail view:
 * - GET /api/responses/:responseId
 * 
 * This endpoint provides:
 * - Response execution & review state
 * - Failed questions summary
 * - Linked corrective actions (read-only)
 * - Audit timeline entries
 * 
 * ⚠️ READ-ONLY - No mutations allowed
 * ⚠️ App boundary enforced
 * ⚠️ Uses Record Context as source of truth
 * 
 * ============================================================================
 */

const express = require('express');
const { getResponseDetail } = require('../controllers/responseDetailController');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);
router.use(resolveAppContext); // Resolve appKey from URL
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(organizationIsolation);

// Get response detail (read-only)
// SAFETY: Response Detail is read-only.
// Any execution or review mutations must occur via Platform execution controllers only.
router.get('/:responseId', checkPermission('responses', 'view'), getResponseDetail);

module.exports = router;

