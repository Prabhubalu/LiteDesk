/**
 * ============================================================================
 * PLATFORM CORE: Business Flow Routes (Process Designer Phase 4D)
 * ============================================================================
 *
 * GET    /api/admin/business-flows
 * GET    /api/admin/business-flows/:id
 * POST   /api/admin/business-flows
 * PUT    /api/admin/business-flows/:id
 * DELETE /api/admin/business-flows/:id
 * GET    /api/admin/business-flows/:id/health
 * GET    /api/admin/business-flows/:id/metrics
 * GET    /api/admin/business-flows/:id/bottlenecks
 *
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getBusinessFlows,
  getBusinessFlowById,
  createBusinessFlow,
  updateBusinessFlow,
  deleteBusinessFlow,
  getFlowHealth,
  getFlowMetrics,
  getFlowBottlenecks
} = require('../controllers/businessFlowController');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

router.use(protect);
router.use(createSettingsAuditMiddleware({ surface: 'business-flows', entityType: 'BusinessFlow' }));

// All routes require admin (check in controller if needed)
router.get('/', getBusinessFlows);
router.get('/:id', getBusinessFlowById);
router.get('/:id/health', getFlowHealth);
router.get('/:id/metrics', getFlowMetrics);
router.get('/:id/bottlenecks', getFlowBottlenecks);
router.post('/', createBusinessFlow);
router.put('/:id', updateBusinessFlow);
router.delete('/:id', deleteBusinessFlow);

module.exports = router;
