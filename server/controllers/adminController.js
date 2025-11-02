const People = require('../models/People');
const Organization = require('../models/Organization');
const OrganizationV2 = require('../models/OrganizationV2');

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
            query.type = req.query.lifecycle_stage === 'Lead' ? 'Lead' : 'Contact';
        }
        if (req.query.status) {
            query.contact_status = req.query.status;
        }
        
        // Sorting
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortBy]: sortOrder };
        
        // Execute query with organization populated
        const contacts = await People.find(query)
            .populate('organization', 'name industry email website')
            .populate('assignedTo', 'firstName lastName email avatar')
            .populate('createdBy', 'firstName lastName email avatar username')
            .sort(sort)
            .limit(limit)
            .skip(skip);
        
        const total = await People.countDocuments(query);
        
        // Get statistics across all organizations
        const stats = await People.aggregate([
            {
                $group: {
                    _id: null,
                    totalContacts: { $sum: 1 },
                    leadContacts: { $sum: { $cond: [{ $eq: ['$type', 'Lead'] }, 1, 0] } },
                    customerContacts: { $sum: { $cond: [{ $eq: ['$type', 'Contact'] }, 1, 0] } }
                }
            }
        ]);
        
        // Get count by organization
        const orgStats = await People.aggregate([
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
        
        // Fetch from OrganizationV2 (where new organizations are created)
        // Note: Search might not work perfectly for V2 fields, but basic queries should work
        // Note: Not using .lean() here to ensure populate() works correctly (matches People controller pattern)
        const organizations = await OrganizationV2.find(query)
            .populate('createdBy', 'firstName lastName email avatar username')
            .populate('assignedTo', 'firstName lastName email avatar username')
            .sort(sort)
            .limit(limit)
            .skip(skip);
        
        const total = await OrganizationV2.countDocuments(query);
        
        // Get contact counts for each organization
        const orgsWithCounts = await Promise.all(
            organizations.map(async (org) => {
                // For V2 records, use legacyOrganizationId to count contacts if available
                // Otherwise use the _id directly
                const orgIdForContacts = org.legacyOrganizationId || org._id;
                const contactCount = await People.countDocuments({ organizationId: orgIdForContacts });
                
                // Convert Mongoose document to plain object with populated fields preserved
                // Use .toObject({ virtuals: true }) to ensure populated fields are included
                const orgObj = org.toObject ? org.toObject({ virtuals: true }) : org;
                
                // Debug: Log assignedTo to verify populate is working
                if (orgObj.assignedTo) {
                    console.log(`[DEBUG] Organization ${orgObj.name}: assignedTo populated:`, {
                        type: typeof orgObj.assignedTo,
                        isObject: typeof orgObj.assignedTo === 'object' && orgObj.assignedTo !== null && !Array.isArray(orgObj.assignedTo),
                        hasFirstName: !!orgObj.assignedTo?.firstName,
                        hasId: !!orgObj.assignedTo?._id,
                        keys: orgObj.assignedTo ? Object.keys(orgObj.assignedTo) : []
                    });
                } else {
                    console.log(`[DEBUG] Organization ${orgObj.name}: assignedTo is ${orgObj.assignedTo === null ? 'null' : 'undefined'}`);
                }
                
                // Ensure populated fields are properly included in response
                // If assignedTo is still an ObjectId string, that means populate didn't work
                const responseObj = {
                    ...orgObj,
                    contactCount
                };
                
                // Explicitly include populated fields (they should already be there, but ensure it)
                if (orgObj.createdBy && typeof orgObj.createdBy === 'object') {
                    responseObj.createdBy = orgObj.createdBy;
                }
                if (orgObj.assignedTo && typeof orgObj.assignedTo === 'object') {
                    responseObj.assignedTo = orgObj.assignedTo;
                }
                
                return responseObj;
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
        const contact = await People.findById(req.params.id)
            .populate('organization', 'name industry status email phone website')
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email avatar username');
        
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
            'relatedTo.type': 'contact',
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

// @desc    Update contact by ID (Admin only)
// @route   PUT /api/admin/contacts/:id
// @access  Private (Admin/Owner only)
const updateContactById = async (req, res) => {
    try {
        const contact = await People.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Contact updated successfully',
            data: contact
        });
    } catch (error) {
        console.error('Update contact by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating contact',
            error: error.message
        });
    }
};

// @desc    Get single organization by ID (Admin only)
// @route   GET /api/admin/organizations/:id
// @access  Private (Admin/Owner only)
const getOrganizationById = async (req, res) => {
    try {
        // Try OrganizationV2 first (where new organizations are created)
        // Note: Using .lean() after populate() should work, but if it doesn't, remove .lean()
        let organization = await OrganizationV2.findById(req.params.id)
            .populate('createdBy', 'firstName lastName email avatar username')
            .populate('assignedTo', 'firstName lastName email avatar username')
            .lean();
        
        // If not found in V2, try legacy Organization
        if (!organization) {
            organization = await Organization.findById(req.params.id).lean();
        }
        
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }
        
        // For V2 records, use legacyOrganizationId to count contacts if available
        // Otherwise use the _id directly
        const orgIdForContacts = organization.legacyOrganizationId || organization._id;
        
        // Get contact count (using People model, not Contact)
        const contactCount = await People.countDocuments({ organizationId: orgIdForContacts });
        
        // Get user count
        const User = require('../models/User');
        const userCount = await User.countDocuments({ organizationId: orgIdForContacts });
        
        // Get deals count (if deals module exists)
        let dealCount = 0;
        try {
            const Deal = require('../models/Deal');
            dealCount = await Deal.countDocuments({ organizationId: orgIdForContacts });
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

// @desc    Update organization by ID (Admin only)
// @route   PUT /api/admin/organizations/:id
// @access  Private (Admin/Owner only)
const updateOrganizationById = async (req, res) => {
    try {
        // Try to find and update in OrganizationV2 first
        let organization = await OrganizationV2.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        )
        .populate('createdBy', 'firstName lastName email avatar username')
        .populate('assignedTo', 'firstName lastName email avatar username');
        
        if (!organization) {
            // Try legacy Organization
            organization = await Organization.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true, runValidators: true }
            );
            
            if (!organization) {
                return res.status(404).json({
                    success: false,
                    message: 'Organization not found'
                });
            }
        }
        
        res.status(200).json({
            success: true,
            message: 'Organization updated successfully',
            data: organization
        });
    } catch (error) {
        console.error('Update organization by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating organization',
            error: error.message
        });
    }
};

// @desc    Get activity logs for a contact (Admin only)
// @route   GET /api/admin/contacts/:id/activity-logs
// @access  Private (Admin/Owner only)
const getContactActivityLogs = async (req, res) => {
    try {
        const contact = await People.findById(req.params.id).select('activityLogs');
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }
        
        // Sort by timestamp (newest first)
        const logs = (contact.activityLogs || []).sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('Get contact activity logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity logs',
            error: error.message
        });
    }
};

// @desc    Add activity log to a contact (Admin only)
// @route   POST /api/admin/contacts/:id/activity-logs
// @access  Private (Admin/Owner only)
const addContactActivityLog = async (req, res) => {
    try {
        const { user, action, details } = req.body;
        
        if (!user || !action) {
            return res.status(400).json({
                success: false,
                message: 'User and action are required'
            });
        }
        
        const contact = await People.findByIdAndUpdate(
            req.params.id,
            {
                $push: {
                    activityLogs: {
                        user: user,
                        userId: req.user?._id || null,
                        action: action,
                        details: details || null,
                        timestamp: new Date()
                    }
                }
            },
            { new: true, runValidators: true }
        );
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }
        
        // Return the newly added log
        const newLog = contact.activityLogs[contact.activityLogs.length - 1];
        
        res.status(200).json({
            success: true,
            data: newLog
        });
    } catch (error) {
        console.error('Add contact activity log error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding activity log',
            error: error.message
        });
    }
};

// @desc    Get activity logs for an organization (Admin only)
// @route   GET /api/admin/organizations/:id/activity-logs
// @access  Private (Admin/Owner only)
const getOrganizationActivityLogs = async (req, res) => {
    try {
        // Try OrganizationV2 first
        let org = await OrganizationV2.findById(req.params.id).select('activityLogs').lean();
        
        if (!org) {
            // Try legacy Organization (though it might not have activityLogs)
            org = await Organization.findById(req.params.id).select('activityLogs').lean();
        }
        
        if (!org) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }
        
        // Sort by timestamp (newest first)
        const logs = (org.activityLogs || []).sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('Get organization activity logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity logs',
            error: error.message
        });
    }
};

// @desc    Add activity log to an organization (Admin only)
// @route   POST /api/admin/organizations/:id/activity-logs
// @access  Private (Admin/Owner only)
const addOrganizationActivityLog = async (req, res) => {
    try {
        const { user, action, details } = req.body;
        
        if (!user || !action) {
            return res.status(400).json({
                success: false,
                message: 'User and action are required'
            });
        }
        
        // Try OrganizationV2 first
        let org = await OrganizationV2.findByIdAndUpdate(
            req.params.id,
            {
                $push: {
                    activityLogs: {
                        user: user,
                        userId: req.user?._id || null,
                        action: action,
                        details: details || null,
                        timestamp: new Date()
                    }
                }
            },
            { new: true, runValidators: true }
        );
        
        if (!org) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }
        
        // Return the newly added log
        const newLog = org.activityLogs[org.activityLogs.length - 1];
        
        res.status(200).json({
            success: true,
            data: newLog
        });
    } catch (error) {
        console.error('Add organization activity log error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding activity log',
            error: error.message
        });
    }
};

// @desc    Delete contact by ID (Admin only)
// @route   DELETE /api/admin/contacts/:id
// @access  Private (Admin/Owner only)
const deleteContactById = async (req, res) => {
    try {
        const contact = await People.findByIdAndDelete(req.params.id);
        
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Contact deleted successfully',
            data: contact._id
        });
    } catch (error) {
        console.error('Delete contact by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting contact',
            error: error.message
        });
    }
};

// @desc    Delete organization by ID (Admin only)
// @route   DELETE /api/admin/organizations/:id
// @access  Private (Admin/Owner only)
const deleteOrganizationById = async (req, res) => {
    try {
        // Try OrganizationV2 first
        let org = await OrganizationV2.findByIdAndDelete(req.params.id);
        
        if (!org) {
            // Try legacy Organization
            org = await Organization.findByIdAndDelete(req.params.id);
        }
        
        if (!org) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Organization deleted successfully',
            data: org._id
        });
    } catch (error) {
        console.error('Delete organization by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting organization',
            error: error.message
        });
    }
};

module.exports = {
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
};

