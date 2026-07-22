const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/permissionMiddleware');
const {
  getAllRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  previewRule,
  getEventTypes,
  getActionTypes
} = require('../controllers/automationRuleController');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

// Apply middleware to all routes
router.use(protect);
router.use(requireAdmin());
router.use(createSettingsAuditMiddleware({ surface: 'automation', entityType: 'AutomationRule' }));

// Metadata endpoints
router.get('/metadata/event-types', getEventTypes);
router.get('/metadata/action-types', getActionTypes);

// CRUD endpoints
router.get('/', getAllRules);
router.get('/:id', getRuleById);
router.post('/', createRule);
router.put('/:id', updateRule);
router.delete('/:id', deleteRule);
router.post('/:id/toggle', toggleRule);

// Preview endpoint
router.post('/preview', previewRule);

module.exports = router;
