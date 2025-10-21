// server/controllers/contactController.js
const Contact = require('../models/Contact');

// --- 1. CREATE Contact (C) ---
exports.createContact = async (req, res) => {
    try {
        // Create contact with organization isolation
        const newContact = await Contact.create({
            ...req.body,
            organizationId: req.user.organizationId, // Multi-tenancy
            owner_id: req.body.owner_id || req.user._id // Default to current user if not specified
        });
        
        res.status(201).json({
            success: true,
            data: newContact
        });
    } catch (error) {
        console.error('Create contact error:', error);
        
        // Handle duplicate email within organization
        if (error.code === 11000) {
            return res.status(409).json({ 
                success: false,
                message: 'A contact with this email already exists in your organization.' 
            });
        }
        
        res.status(400).json({ 
            success: false,
            message: 'Error creating contact.', 
            error: error.message 
        });
    }
};

// --- 2. READ All Contacts (R) ---
exports.getContacts = async (req, res) => {
    try {
        // Build query with organization isolation
        const query = { organizationId: req.user.organizationId };
        
        // If user doesn't have viewAll permission, filter by owner
        if (req.filterByUser) {
            query.owner_id = req.filterByUser;
        }
        
        // Get pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Get filters
        if (req.query.lifecycle_stage) {
            query.lifecycle_stage = req.query.lifecycle_stage;
        }
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.lead_source) {
            query.lead_source = req.query.lead_source;
        }
        
        // Search functionality
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { first_name: searchRegex },
                { last_name: searchRegex },
                { email: searchRegex },
                { job_title: searchRegex }
            ];
        }
        
        // Execute query
        const contacts = await Contact.find(query)
            .populate('owner_id', 'username email firstName lastName')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);
        
        const total = await Contact.countDocuments(query);
        
        res.status(200).json({
            success: true,
            data: contacts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching contacts.', 
            error: error.message 
        });
    }
};

// --- 3. READ Single Contact (R) ---
exports.getContactById = async (req, res) => {
    try {
        const contact = await Contact.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId // Organization isolation
        })
        .populate('owner_id', 'username email firstName lastName')
        .populate('account_id', 'name industry');
        
        if (!contact) {
            return res.status(404).json({ 
                success: false,
                message: 'Contact not found or access denied.' 
            });
        }
        
        res.status(200).json({
            success: true,
            data: contact
        });
    } catch (error) {
        console.error('Get contact error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching contact.', 
            error: error.message 
        });
    }
};

// --- 4. UPDATE Contact (U) ---
exports.updateContact = async (req, res) => {
    try {
        // Prevent changing organizationId
        delete req.body.organizationId;
        
        const updatedContact = await Contact.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId // Organization isolation
            },
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedContact) {
            return res.status(404).json({ 
                success: false,
                message: 'Contact not found or access denied.' 
            });
        }
        
        res.status(200).json({
            success: true,
            data: updatedContact
        });
    } catch (error) {
        console.error('Update contact error:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error updating contact.', 
            error: error.message 
        });
    }
};

// --- 5. DELETE Contact (D) ---
exports.deleteContact = async (req, res) => {
    try {
        const result = await Contact.findOneAndDelete({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId // Organization isolation
        });

        if (!result) {
            return res.status(404).json({ 
                success: false,
                message: 'Contact not found or access denied.' 
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Contact deleted successfully'
        });
    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting contact.', 
            error: error.message 
        });
    }
};