const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');

// All routes require authentication
router.use(protect);
router.use(resolveAppContext); // After auth, resolve appKey from URL
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(lazySalesInitialization); // Lazy initialize Sales if needed
router.use(requireSalesApp); // Enforce Sales-only access

// Event CRUD routes
router.get('/summary', checkPermission('events', 'view'), eventController.getEventSummary);
router.get('/meta', checkPermission('events', 'view'), eventController.getEventsListMeta);
router.get('/', eventController.getEvents);
router.get('/stats', eventController.getEventStats);
router.get('/export', eventController.exportEvents);
router.get('/:id', eventController.getEventById);
router.post('/', eventController.createEvent);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

// Bulk operations
router.post('/bulk-delete', eventController.bulkDeleteEvents);

// Event-specific actions
router.post('/:id/notes', eventController.addNote);
// Non-audit: category-backed status vocabulary; audit still uses complete/cancel/workflow
router.patch('/:id/status', checkPermission('events', 'edit'), eventController.updateEventStatus);

// Execution workflow routes
router.post('/:id/start', eventController.startEvent);
router.post('/:id/check-in', eventController.checkIn);
router.post('/:id/check-out', eventController.checkOut);
router.post('/:id/submit-audit', eventController.submitAudit);
router.post('/:id/approve-audit', eventController.approveAudit);
router.post('/:id/reject-audit', eventController.rejectAudit);
router.post('/:id/next-org', eventController.moveToNextOrg);
router.post('/:id/orders', eventController.createOrder);
router.post('/:id/complete', eventController.completeEvent);
router.post('/:id/cancel', eventController.cancelEvent);

module.exports = router;

