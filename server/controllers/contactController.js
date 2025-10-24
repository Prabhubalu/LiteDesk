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
            .populate('organization', 'name industry')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);
        
        const total = await Contact.countDocuments(query);
        
        // Get statistics
        const stats = await Contact.aggregate([
            { $match: { organizationId: req.user.organizationId } },
            {
                $group: {
                    _id: null,
                    totalContacts: { $sum: 1 },
                    leadContacts: {
                        $sum: { $cond: [{ $eq: ['$lifecycle_stage', 'Lead'] }, 1, 0] }
                    },
                    customerContacts: {
                        $sum: { $cond: [{ $eq: ['$lifecycle_stage', 'Customer'] }, 1, 0] }
                    },
                    activeThisMonth: {
                        $sum: { 
                            $cond: [
                                { 
                                    $gte: ['$last_activity_at', new Date(new Date().setDate(1))]
                                }, 
                                1, 
                                0
                            ] 
                        }
                    }
                }
            }
        ]);
        
        res.status(200).json({
            success: true,
            data: contacts,
            pagination: {
                currentPage: page,
                limit,
                totalContacts: total,
                totalPages: Math.ceil(total / limit)
            },
            statistics: stats[0] || {
                totalContacts: 0,
                leadContacts: 0,
                customerContacts: 0,
                activeThisMonth: 0
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
        .populate('account_id', 'name industry')
        .populate('organization', 'name industry status');
        
        if (!contact) {
            return res.status(404).json({ 
                success: false,
                message: 'Contact not found or access denied.' 
            });
        }

        // Fetch related deals
        const Deal = require('../models/Deal');
        const deals = await Deal.find({ 
            contactId: req.params.id,
            organizationId: req.user.organizationId
        })
        .select('name amount stage expectedCloseDate probability priority')
        .sort({ createdAt: -1 })
        .limit(10);

        // Fetch related tasks
        const Task = require('../models/Task');
        const tasks = await Task.find({
            'relatedTo.type': 'Contact',
            'relatedTo.id': req.params.id,
            organizationId: req.user.organizationId
        })
        .select('title status priority dueDate')
        .sort({ createdAt: -1 })
        .limit(10);
        
        res.status(200).json({
            success: true,
            data: {
                ...contact.toObject(),
                relatedDeals: deals,
                relatedTasks: tasks
            }
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
        // Prevent changing organizationId and system fields
        delete req.body.organizationId;
        delete req.body.createdAt;
        delete req.body.updatedAt;
        delete req.body._id;
        delete req.body.__v;
        
        // Remove populated fields that should only be ObjectIds
        if (req.body.owner_id && typeof req.body.owner_id === 'object') {
            req.body.owner_id = req.body.owner_id._id;
        }
        if (req.body.account_id && typeof req.body.account_id === 'object') {
            req.body.account_id = req.body.account_id._id;
        }
        if (req.body.organization && typeof req.body.organization === 'object') {
            req.body.organization = req.body.organization._id;
        }
        if (req.body.reports_to && typeof req.body.reports_to === 'object') {
            req.body.reports_to = req.body.reports_to._id;
        }
        
        // Clean notes array - remove populated created_by
        if (req.body.notes && Array.isArray(req.body.notes)) {
            req.body.notes = req.body.notes.map(note => {
                if (note.created_by && typeof note.created_by === 'object') {
                    return {
                        ...note,
                        created_by: note.created_by._id
                    };
                }
                return note;
            });
        }
        
        console.log('Updating contact with data:', JSON.stringify(req.body, null, 2));
        
        const updatedContact = await Contact.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId // Organization isolation
            },
            req.body,
            { new: true, runValidators: true }
        )
        .populate('owner_id', 'username email firstName lastName')
        .populate('organization', 'name industry status')
        .populate('account_id', 'name industry');

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
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
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

// --- 6. ADD Note to Contact ---
exports.addNote = async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Note text is required'
            });
        }
        
        const contact = await Contact.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId 
            },
            {
                $push: {
                    notes: {
                        text: text.trim(),
                        created_by: req.user._id,
                        created_at: new Date()
                    }
                },
                $set: {
                    last_activity_at: new Date()
                }
            },
            { new: true, runValidators: true }
        )
        .populate('owner_id', 'username email firstName lastName')
        .populate('organization', 'name industry')
        .populate('notes.created_by', 'firstName lastName');
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found or access denied'
            });
        }
        
        res.status(200).json({
            success: true,
            data: contact
        });
    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding note',
            error: error.message
        });
    }
};