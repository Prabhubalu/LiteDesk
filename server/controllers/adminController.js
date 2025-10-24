const Contact = require('../models/Contact');
const Organization = require('../models/Organization');

// @desc    Get all contacts across all organizations (Admin only)
// @route   GET /api/admin/contacts/all
// @access  Private (Admin/Owner only)
const getAllContactsAcrossOrgs = async (req, res) => {
    try {
        // Get pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Build query
        const query = {};
        
        // Search functionality
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { first_name: searchRegex },
                { last_name: searchRegex },
                { email: searchRegex },
                { company: searchRegex }
            ];
        }
        
        // Filters
        if (req.query.lifecycle_stage) {
            query.lifecycle_stage = req.query.lifecycle_stage;
        }
        if (req.query.status) {
            query.status = req.query.status;
        }
        
        // Sorting
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortBy]: sortOrder };
        
        // Execute query with organization populated
        const contacts = await Contact.find(query)
            .populate('organizationId', 'name industry')
            .populate('owner_id', 'firstName lastName email')
            .sort(sort)
            .limit(limit)
            .skip(skip);
        
        const total = await Contact.countDocuments(query);
        
        // Get statistics across all organizations
        const stats = await Contact.aggregate([
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
                    qualifiedContacts: {
                        $sum: { $cond: [{ $eq: ['$lifecycle_stage', 'Qualified'] }, 1, 0] }
                    }
                }
            }
        ]);
        
        // Get count by organization
        const orgStats = await Contact.aggregate([
            {
                $group: {
                    _id: '$organizationId',
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'organizations',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'organization'
                }
            },
            {
                $unwind: '$organization'
            },
            {
                $project: {
                    organizationName: '$organization.name',
                    count: 1
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
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
                qualifiedContacts: 0
            },
            organizationStats: orgStats
        });
    } catch (error) {
        console.error('Get all contacts error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching contacts',
            error: error.message
        });
    }
};

// @desc    Get all organizations (Admin only)
// @route   GET /api/admin/organizations/all
// @access  Private (Admin/Owner only)
const getAllOrganizations = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        const query = {};
        
        // Search
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { name: searchRegex },
                { industry: searchRegex }
            ];
        }
        
        // Filter by industry
        if (req.query.industry) {
            query.industry = req.query.industry;
        }
        
        // Filter by subscription tier
        if (req.query.tier) {
            query['subscription.tier'] = req.query.tier;
        }
        
        // Filter by status
        if (req.query.status) {
            query.isActive = req.query.status === 'active';
        }
        
        // Sorting
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
        const sort = { [sortBy]: sortOrder };
        
        const organizations = await Organization.find(query)
            .sort(sort)
            .limit(limit)
            .skip(skip)
            .lean();
        
        const total = await Organization.countDocuments(query);
        
        // Get contact counts for each organization
        const orgsWithCounts = await Promise.all(
            organizations.map(async (org) => {
                const contactCount = await Contact.countDocuments({ organizationId: org._id });
                return {
                    ...org,
                    contactCount
                };
            })
        );
        
        res.status(200).json({
            success: true,
            data: orgsWithCounts,
            pagination: {
                currentPage: page,
                limit,
                totalOrganizations: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get all organizations error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching organizations',
            error: error.message
        });
    }
};

// @desc    Get single contact by ID (Admin only - no org isolation)
// @route   GET /api/admin/contacts/:id
// @access  Private (Admin/Owner only)
const getContactById = async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id)
            .populate('organizationId', 'name industry')
            .populate('organization', 'name industry status')
            .populate('owner_id', 'firstName lastName email')
            .populate('account_id', 'name industry')
            .populate('notes.created_by', 'firstName lastName');
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        // Fetch related deals
        const Deal = require('../models/Deal');
        const deals = await Deal.find({ 
            contactId: req.params.id
        })
        .select('name amount stage expectedCloseDate probability priority')
        .sort({ createdAt: -1 })
        .limit(10);

        // Fetch related tasks
        const Task = require('../models/Task');
        const tasks = await Task.find({
            'relatedTo.type': 'Contact',
            'relatedTo.id': req.params.id
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
        console.error('Get contact by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching contact',
            error: error.message
        });
    }
};

// @desc    Get single organization by ID (Admin only)
// @route   GET /api/admin/organizations/:id
// @access  Private (Admin/Owner only)
const getOrganizationById = async (req, res) => {
    try {
        const organization = await Organization.findById(req.params.id).lean();
        
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }
        
        // Get contact count
        const contactCount = await Contact.countDocuments({ organizationId: organization._id });
        
        // Get user count
        const User = require('../models/User');
        const userCount = await User.countDocuments({ organizationId: organization._id });
        
        // Get deals count (if deals module exists)
        let dealCount = 0;
        try {
            const Deal = require('../models/Deal');
            dealCount = await Deal.countDocuments({ organizationId: organization._id });
        } catch (err) {
            // Deal model might not exist yet
        }
        
        res.status(200).json({
            success: true,
            data: {
                ...organization,
                contactCount
            },
            stats: {
                contacts: contactCount,
                users: userCount,
                deals: dealCount
            }
        });
    } catch (error) {
        console.error('Get organization by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching organization',
            error: error.message
        });
    }
};

module.exports = {
    getAllContactsAcrossOrgs,
    getAllOrganizations,
    getContactById,
    getOrganizationById
};

