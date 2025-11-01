const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/permissionMiddleware');
const {
    getAllContactsAcrossOrgs,
    getAllOrganizations,
    getContactById,
    updateContactById,
    getOrganizationById,
    updateOrganizationById
} = require('../controllers/adminController');

// Apply middleware to all routes
router.use(protect);
router.use(requireAdmin());

// Get all contacts across all organizations
router.get('/contacts/all', getAllContactsAcrossOrgs);

// Get single contact by ID (no org isolation)
router.get('/contacts/:id', getContactById);

// Update contact by ID
router.put('/contacts/:id', updateContactById);

// Get all organizations
router.get('/organizations/all', getAllOrganizations);

// Get single organization by ID
router.get('/organizations/:id', getOrganizationById);

// Update organization by ID
router.put('/organizations/:id', updateOrganizationById);

module.exports = router;

