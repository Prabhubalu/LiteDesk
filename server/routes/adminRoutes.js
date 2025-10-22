const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/permissionMiddleware');
const {
    getAllContactsAcrossOrgs,
    getAllOrganizations,
    getContactById,
    getOrganizationById
} = require('../controllers/adminController');

// Apply middleware to all routes
router.use(protect);
router.use(requireAdmin());

// Get all contacts across all organizations
router.get('/contacts/all', getAllContactsAcrossOrgs);

// Get single contact by ID (no org isolation)
router.get('/contacts/:id', getContactById);

// Get all organizations
router.get('/organizations/all', getAllOrganizations);

// Get single organization by ID
router.get('/organizations/:id', getOrganizationById);

module.exports = router;

