const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Event CRUD routes
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
router.patch('/:id/status', eventController.updateEventStatus);

module.exports = router;

