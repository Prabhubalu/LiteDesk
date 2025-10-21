// server/controllers/contactController.js
const Contact = require('../models/Contact');

// --- 1. CREATE Contact (C) ---
exports.createContact = async (req, res) => {
    try {
        // The 'vertical' should ideally be auto-assigned from req.user
        // We'll trust the input for now but secure it later.
        const newContact = await Contact.create({
            ...req.body,
            // SECURITY: Ensure the contact is linked to the user's vertical
            vertical: req.user.vertical 
        });
        res.status(201).json(newContact);
    } catch (error) {
        res.status(400).json({ message: 'Error creating contact.', error: error.message });
    }
};

// --- 2. READ All Contacts (R) ---
exports.getContacts = async (req, res) => {
    try {
        // FILTERING: Only show contacts belonging to the user's business vertical
        const contacts = await Contact.find({ vertical: req.user.vertical });
        res.status(200).json(contacts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching contacts.', error: error.message });
    }
};

// --- 3. READ Single Contact (R) ---
exports.getContactById = async (req, res) => {
    try {
        const contact = await Contact.findOne({ 
            _id: req.params.id, 
            vertical: req.user.vertical // Security filter
        });
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found or access denied.' });
        }
        res.status(200).json(contact);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching contact.', error: error.message });
    }
};

// --- 4. UPDATE Contact (U) ---
exports.updateContact = async (req, res) => {
    try {
        const updatedContact = await Contact.findOneAndUpdate(
            { _id: req.params.id, vertical: req.user.vertical }, // Find condition
            req.body, // Update data
            { new: true, runValidators: true } // Return updated document and run Mongoose validators
        );

        if (!updatedContact) {
            return res.status(404).json({ message: 'Contact not found or access denied.' });
        }
        res.status(200).json(updatedContact);
    } catch (error) {
        res.status(400).json({ message: 'Error updating contact.', error: error.message });
    }
};

// --- 5. DELETE Contact (D) ---
exports.deleteContact = async (req, res) => {
    try {
        const result = await Contact.findOneAndDelete({ 
            _id: req.params.id, 
            vertical: req.user.vertical // Security filter
        });

        if (!result) {
            return res.status(404).json({ message: 'Contact not found or access denied.' });
        }
        res.status(204).send(); // 204 No Content for successful deletion
    } catch (error) {
        res.status(500).json({ message: 'Error deleting contact.', error: error.message });
    }
};