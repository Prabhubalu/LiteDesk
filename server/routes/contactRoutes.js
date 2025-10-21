// server/routes/contactRoutes.js
const express = require('express');
const { 
    createContact, 
    getContacts, 
    getContactById, 
    updateContact, 
    deleteContact 
} = require('../controllers/contactController');
const { protect } = require('../middleware/authMiddleware'); // Your JWT Middleware

const router = express.Router();

// Routes that handle collections (GET all, POST new)
router.route('/')
    .get(protect, getContacts)    // GET /api/contacts (Protected)
    .post(protect, createContact); // POST /api/contacts (Protected)

// Routes that handle single resources (GET by ID, PUT, DELETE)
router.route('/:id')
    .get(protect, getContactById)
    .put(protect, updateContact)
    .delete(protect, deleteContact);

module.exports = router;