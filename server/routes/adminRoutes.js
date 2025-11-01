const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/permissionMiddleware');
const {
    getAllContactsAcrossOrgs,
    getAllOrganizations,
    getContactById,
    updateContactById,
    deleteContactById,
    getContactActivityLogs,
    addContactActivityLog,
    getOrganizationById,
    updateOrganizationById,
    deleteOrganizationById,
    getOrganizationActivityLogs,
    addOrganizationActivityLog
} = require('../controllers/adminController');

// Apply middleware to all routes
router.use(protect);
router.use(requireAdmin());

// Get all contacts across all organizations
router.get('/contacts/all', getAllContactsAcrossOrgs);

// Activity logs for contacts (must be before /:id route)
router.get('/contacts/:id/activity-logs', getContactActivityLogs);
router.post('/contacts/:id/activity-logs', addContactActivityLog);

// Get single contact by ID (no org isolation)
router.get('/contacts/:id', getContactById);

// Update contact by ID
router.put('/contacts/:id', updateContactById);

// Delete contact by ID
router.delete('/contacts/:id', deleteContactById);

// Get all organizations
router.get('/organizations/all', getAllOrganizations);

// Activity logs for organizations (must be before /:id route)
router.get('/organizations/:id/activity-logs', getOrganizationActivityLogs);
router.post('/organizations/:id/activity-logs', addOrganizationActivityLog);

// Get single organization by ID
router.get('/organizations/:id', getOrganizationById);

// Update organization by ID
router.put('/organizations/:id', updateOrganizationById);

// Delete organization by ID
router.delete('/organizations/:id', deleteOrganizationById);

module.exports = router;

