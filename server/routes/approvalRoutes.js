/**
 * ============================================================================
 * PLATFORM CORE: Approval Routes (Process Engine Phase 3)
 * ============================================================================
 *
 * POST /api/admin/approvals/:id/approve
 * POST /api/admin/approvals/:id/reject
 * GET /api/approvals (user-facing)
 * GET /api/approvals/:id (user-facing)
 *
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { approve, reject, getMyApprovals, getApprovalById, getQuoteWorkspaceForApproval } = require('../controllers/approvalController');

router.use(protect);

// User-facing: Get my approvals (must come before /:id)
router.get('/', getMyApprovals);

// User-facing: Get approval detail (must come before POST routes)
router.get('/:id/quote-workspace', getQuoteWorkspaceForApproval);
router.get('/:id', getApprovalById);

// Approve: admin or approver (authorization checked in controller)
router.post('/:id/approve', approve);

// Reject: admin or approver (authorization checked in controller)
router.post('/:id/reject', reject);

module.exports = router;
