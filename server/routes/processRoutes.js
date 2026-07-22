const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/permissionMiddleware');
const {
  getAllProcesses,
  getDesignerMetadata,
  evaluateExpression,
  getProcessById,
  createProcess,
  updateProcess,
  updateProcessStatus,
  duplicateProcess,
  testProcess,
  runProcessNow,
  getProcessExecutions,
  getExecutionGraphState,
  rotateProcessWebhookSecret,
  deleteProcess
} = require('../controllers/processController');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

// Apply middleware to all routes
router.use(protect);
router.use(requireAdmin());
router.use(createSettingsAuditMiddleware({ surface: 'processes', entityType: 'Process' }));

// CRUD endpoints
router.get('/', getAllProcesses);
router.get('/designer-metadata', getDesignerMetadata);
router.post('/evaluate-expression', evaluateExpression);
router.get('/:id', getProcessById);
router.post('/', createProcess);
router.put('/:id', updateProcess);
router.delete('/:id', deleteProcess);

// Status management
router.put('/:id/status', updateProcessStatus);

// Process operations
router.post('/:id/duplicate', duplicateProcess);
router.post('/:id/webhook/rotate-secret', rotateProcessWebhookSecret);
router.post('/:id/test', testProcess);
router.post('/:id/run-now', runProcessNow);
router.get('/:id/executions', getProcessExecutions);
router.get('/:id/executions/:executionId/graph-state', getExecutionGraphState);

module.exports = router;
