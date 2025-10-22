// server/routes/contactRoutes.js
const express = require('express');
const { 
    createContact, 
    getContacts, 
    getContactById, 
    updateContact, 
    deleteContact,
    addNote
} = require('../controllers/contactController');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkPermission, filterByOwnership } = require('../middleware/permissionMiddleware');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('contacts'));

// Routes that handle collections (GET all, POST new)
router.route('/')
    .get(filterByOwnership('contacts'), checkPermission('contacts', 'view'), getContacts)
    .post(checkPermission('contacts', 'create'), createContact);

// Routes that handle single resources (GET by ID, PUT, DELETE)
router.route('/:id')
    .get(checkPermission('contacts', 'view'), getContactById)
    .put(checkPermission('contacts', 'edit'), updateContact)
    .delete(checkPermission('contacts', 'delete'), deleteContact);

// Add note to contact
router.post('/:id/notes', checkPermission('contacts', 'edit'), addNote);

module.exports = router;