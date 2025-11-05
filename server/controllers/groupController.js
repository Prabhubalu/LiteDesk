const Group = require('../models/Group');
const User = require('../models/User');

// Create Group
exports.create = async (req, res) => {
    try {
        const userName = await getUserName(req.user?._id);
        
        const body = {
            ...req.body,
            organizationId: req.user.organizationId,
            createdBy: req.user?._id || null,
            members: req.body.members || [],
            activityLogs: [{
                user: userName,
                userId: req.user?._id || null,
                action: 'created this group',
                details: { type: 'create' },
                timestamp: new Date()
            }]
        };
        
        const group = await Group.create(body);
        const populatedGroup = await Group.findById(group._id)
            .populate('members', 'firstName lastName email username avatar')
            .populate('lead', 'firstName lastName email username avatar')
            .populate('roleIds', 'name description color icon level permissions')
            .populate('createdBy', 'firstName lastName email username');
        
        res.status(201).json({ success: true, data: populatedGroup });
    } catch (error) {
        console.error('Error creating group:', error);
        if (error.name === 'ValidationError') {
            const validationErrors = {};
            for (const field in error.errors) {
                validationErrors[field] = error.errors[field].message;
            }
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }
        res.status(400).json({
            success: false,
            message: 'Error creating group',
            error: error.message
        });
    }
};

// List Groups
exports.list = async (req, res) => {
    try {
        const query = { organizationId: req.user.organizationId };
        
        // Filter by active status
        if (req.query.isActive !== undefined) {
            query.isActive = req.query.isActive === 'true';
        }
        
        // Filter by type
        if (req.query.type) {
            query.type = req.query.type;
        }
        
        // Search
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { name: searchRegex },
                { description: searchRegex }
            ];
        }
        
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Sorting
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
        const sort = { [sortBy]: sortOrder };
        
        // Execute query
        const groups = await Group.find(query)
            .populate('members', 'firstName lastName email username avatar')
            .populate('lead', 'firstName lastName email username avatar')
            .populate('roleIds', 'name description color icon level permissions')
            .populate('createdBy', 'firstName lastName email username')
            .sort(sort)
            .limit(limit)
            .skip(skip);
        
        const total = await Group.countDocuments(query);
        
        res.json({
            success: true,
            data: groups,
            pagination: {
                currentPage: page,
                limit,
                totalPages: Math.ceil(total / limit),
                totalGroups: total
            }
        });
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching groups',
            error: error.message
        });
    }
};

// Get Group by ID
exports.getById = async (req, res) => {
    try {
        const group = await Group.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        })
            .populate('members', 'firstName lastName email username avatar phoneNumber')
            .populate('lead', 'firstName lastName email username avatar')
            .populate('roleIds', 'name description color icon level permissions')
            .populate('createdBy', 'firstName lastName email username')
            .populate('updatedBy', 'firstName lastName email username');
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
        
        res.json({ success: true, data: group });
    } catch (error) {
        console.error('Error fetching group:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching group',
            error: error.message
        });
    }
};

// Update Group
exports.update = async (req, res) => {
    try {
        const userName = await getUserName(req.user?._id);
        
        const group = await Group.findOneAndUpdate(
            { _id: req.params.id, organizationId: req.user.organizationId },
            {
                ...req.body,
                updatedBy: req.user?._id || null
            },
            { new: true, runValidators: true }
        )
            .populate('members', 'firstName lastName email username avatar')
            .populate('lead', 'firstName lastName email username avatar')
            .populate('roleIds', 'name description color icon level permissions')
            .populate('createdBy', 'firstName lastName email username');
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
        
        // Add activity log
        group.addActivityLog(userName, req.user?._id, 'updated this group', {
            fields: Object.keys(req.body)
        });
        await group.save();
        
        res.json({ success: true, data: group });
    } catch (error) {
        console.error('Error updating group:', error);
        if (error.name === 'ValidationError') {
            const validationErrors = {};
            for (const field in error.errors) {
                validationErrors[field] = error.errors[field].message;
            }
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }
        res.status(400).json({
            success: false,
            message: 'Error updating group',
            error: error.message
        });
    }
};

// Delete Group
exports.remove = async (req, res) => {
    try {
        const group = await Group.findOneAndDelete({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
        
        res.json({ success: true, message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting group',
            error: error.message
        });
    }
};

// Add Member to Group
exports.addMember = async (req, res) => {
    try {
        const { userId } = req.body;
        const userName = await getUserName(req.user?._id);
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        // Verify user belongs to same organization
        const user = await User.findOne({
            _id: userId,
            organizationId: req.user.organizationId
        });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found in your organization'
            });
        }
        
        const group = await Group.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
        
        if (group.addMember(userId)) {
            group.addActivityLog(userName, req.user?._id, 'added member to group', {
                userId,
                userName: user.getFullName()
            });
            await group.save();
            
            const populatedGroup = await Group.findById(group._id)
                .populate('members', 'firstName lastName email username avatar')
                .populate('lead', 'firstName lastName email username avatar')
                .populate('roleIds', 'name description color icon level permissions');
            
            res.json({ success: true, data: populatedGroup });
        } else {
            res.status(400).json({
                success: false,
                message: 'User is already a member of this group'
            });
        }
    } catch (error) {
        console.error('Error adding member:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding member',
            error: error.message
        });
    }
};

// Remove Member from Group
exports.removeMember = async (req, res) => {
    try {
        // Support both req.body (POST/DELETE with body) and req.query (GET with query params)
        const userId = req.body?.userId || req.query?.userId || req.body?.userId;
        const userName = await getUserName(req.user?._id);
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const group = await Group.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
        
        const user = await User.findById(userId);
        const userNameToRemove = user ? user.getFullName() : 'User';
        
        if (group.removeMember(userId)) {
            // If removed member was the lead, clear lead
            if (group.lead && group.lead.toString() === userId.toString()) {
                group.lead = null;
            }
            
            group.addActivityLog(userName, req.user?._id, 'removed member from group', {
                userId,
                userName: userNameToRemove
            });
            await group.save();
            
            const populatedGroup = await Group.findById(group._id)
                .populate('members', 'firstName lastName email username avatar')
                .populate('lead', 'firstName lastName email username avatar')
                .populate('roleIds', 'name description color icon level permissions');
            
            res.json({ success: true, data: populatedGroup });
        } else {
            res.status(400).json({
                success: false,
                message: 'User is not a member of this group'
            });
        }
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing member',
            error: error.message
        });
    }
};

// Get Activity Logs
exports.getActivityLogs = async (req, res) => {
    try {
        const group = await Group.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        }).select('activityLogs');
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
        
        res.json({
            success: true,
            data: group.activityLogs || []
        });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activity logs',
            error: error.message
        });
    }
};

// Helper function to get user name
async function getUserName(userId) {
    if (!userId) return 'System';
    try {
        const user = await User.findById(userId).select('firstName lastName username');
        if (user) {
            return (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User';
        }
        return 'System';
    } catch (error) {
        return 'System';
    }
}

