const Deal = require('../models/Deal');
const People = require('../models/People');

// @desc    Create new deal
// @route   POST /api/deals
// @access  Private
exports.createDeal = async (req, res) => {
    try {
        const newDeal = await Deal.create({
            ...req.body,
            organizationId: req.user.organizationId,
            ownerId: req.body.ownerId || req.user._id
        });
        
        const deal = await Deal.findById(newDeal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('ownerId', 'firstName lastName email');
        
        res.status(201).json({
            success: true,
            data: deal
        });
    } catch (error) {
        console.error('Create deal error:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error creating deal.', 
            error: error.message 
        });
    }
};

// @desc    Get all deals
// @route   GET /api/deals
// @access  Private
exports.getDeals = async (req, res) => {
    try {
        const query = { organizationId: req.user.organizationId };
        
        // Filter by user if needed
        if (req.filterByUser) {
            query.ownerId = req.filterByUser;
        }
        
        // Get pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Get filters
        if (req.query.stage) {
            query.stage = req.query.stage;
        }
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.priority) {
            query.priority = req.query.priority;
        }
        if (req.query.ownerId) {
            query.ownerId = req.query.ownerId;
        }
        if (req.query.contactId) {
            query.contactId = req.query.contactId;
        }
        if (req.query.accountId) {
            query.accountId = req.query.accountId;
        }
        
        // Search functionality
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { name: searchRegex },
                { description: searchRegex }
            ];
        }
        
        // Date range filter
        if (req.query.fromDate || req.query.toDate) {
            query.expectedCloseDate = {};
            if (req.query.fromDate) {
                query.expectedCloseDate.$gte = new Date(req.query.fromDate);
            }
            if (req.query.toDate) {
                query.expectedCloseDate.$lte = new Date(req.query.toDate);
            }
        }
        
        // Sorting
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortBy]: sortOrder };
        
        // Execute query
        const deals = await Deal.find(query)
            .populate('contactId', 'first_name last_name email')
            .populate('ownerId', 'firstName lastName email')
            .populate('accountId', 'name')
            .sort(sort)
            .limit(limit)
            .skip(skip);
        
        const total = await Deal.countDocuments(query);
        
        // Get statistics
        const stats = await Deal.aggregate([
            { $match: { organizationId: req.user.organizationId } },
            {
                $group: {
                    _id: null,
                    totalDeals: { $sum: 1 },
                    activeDeals: {
                        $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
                    },
                    wonDeals: {
                        $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] }
                    },
                    lostDeals: {
                        $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] }
                    },
                    totalValue: { $sum: '$amount' },
                    wonValue: {
                        $sum: { $cond: [{ $eq: ['$status', 'Won'] }, '$amount', 0] }
                    },
                    pipelineValue: {
                        $sum: { $cond: [{ $eq: ['$status', 'Active'] }, '$amount', 0] }
                    }
                }
            }
        ]);
        
        res.status(200).json({
            success: true,
            data: deals,
            pagination: {
                currentPage: page,
                limit,
                totalDeals: total,
                totalPages: Math.ceil(total / limit)
            },
            statistics: stats[0] || {
                totalDeals: 0,
                activeDeals: 0,
                wonDeals: 0,
                lostDeals: 0,
                totalValue: 0,
                wonValue: 0,
                pipelineValue: 0
            }
        });
    } catch (error) {
        console.error('Get deals error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching deals.', 
            error: error.message 
        });
    }
};

// @desc    Get single deal
// @route   GET /api/deals/:id
// @access  Private
exports.getDealById = async (req, res) => {
    try {
        const deal = await Deal.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        })
        .populate('contactId', 'first_name last_name email phone')
        .populate('ownerId', 'firstName lastName email')
        .populate('accountId', 'name industry')
        .populate('notes.createdBy', 'firstName lastName')
        .populate('stageHistory.changedBy', 'firstName lastName');
        
        if (!deal) {
            return res.status(404).json({ 
                success: false,
                message: 'Deal not found or access denied.' 
            });
        }
        
        res.status(200).json({
            success: true,
            data: deal
        });
    } catch (error) {
        console.error('Get deal error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching deal.', 
            error: error.message 
        });
    }
};

// @desc    Update deal
// @route   PUT /api/deals/:id
// @access  Private
exports.updateDeal = async (req, res) => {
    try {
        // Prevent changing organizationId
        delete req.body.organizationId;
        
        const updatedDeal = await Deal.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId 
            },
            req.body,
            { new: true, runValidators: true }
        )
        .populate('contactId', 'first_name last_name email')
        .populate('ownerId', 'firstName lastName email');

        if (!updatedDeal) {
            return res.status(404).json({ 
                success: false,
                message: 'Deal not found or access denied.' 
            });
        }
        
        res.status(200).json({
            success: true,
            data: updatedDeal
        });
    } catch (error) {
        console.error('Update deal error:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error updating deal.', 
            error: error.message 
        });
    }
};

// @desc    Delete deal
// @route   DELETE /api/deals/:id
// @access  Private
exports.deleteDeal = async (req, res) => {
    try {
        const result = await Deal.findOneAndDelete({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        });

        if (!result) {
            return res.status(404).json({ 
                success: false,
                message: 'Deal not found or access denied.' 
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Deal deleted successfully'
        });
    } catch (error) {
        console.error('Delete deal error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting deal.', 
            error: error.message 
        });
    }
};

// @desc    Add note to deal
// @route   POST /api/deals/:id/notes
// @access  Private
exports.addNote = async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Note text is required'
            });
        }
        
        const deal = await Deal.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId 
            },
            {
                $push: {
                    notes: {
                        text: text.trim(),
                        createdBy: req.user._id,
                        createdAt: new Date()
                    }
                },
                $set: {
                    lastActivityDate: new Date()
                }
            },
            { new: true, runValidators: true }
        )
        .populate('contactId', 'first_name last_name email')
        .populate('ownerId', 'firstName lastName email')
        .populate('notes.createdBy', 'firstName lastName');
        
        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }
        
        res.status(200).json({
            success: true,
            data: deal
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

// @desc    Get pipeline summary
// @route   GET /api/deals/pipeline/summary
// @access  Private
exports.getPipelineSummary = async (req, res) => {
    try {
        const summary = await Deal.aggregate([
            { 
                $match: { 
                    organizationId: req.user.organizationId,
                    status: 'Active'
                } 
            },
            {
                $group: {
                    _id: '$stage',
                    count: { $sum: 1 },
                    totalValue: { $sum: '$amount' },
                    avgProbability: { $avg: '$probability' },
                    deals: { 
                        $push: {
                            id: '$_id',
                            name: '$name',
                            amount: '$amount',
                            probability: '$probability',
                            expectedCloseDate: '$expectedCloseDate'
                        }
                    }
                }
            },
            {
                $project: {
                    stage: '$_id',
                    count: 1,
                    totalValue: 1,
                    weightedValue: { 
                        $multiply: ['$totalValue', { $divide: ['$avgProbability', 100] }] 
                    },
                    avgProbability: 1,
                    deals: 1
                }
            },
            { $sort: { stage: 1 } }
        ]);
        
        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Get pipeline summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pipeline summary',
            error: error.message
        });
    }
};

// @desc    Update deal stage
// @route   PATCH /api/deals/:id/stage
// @access  Private
exports.updateStage = async (req, res) => {
    try {
        const { stage } = req.body;
        
        const deal = await Deal.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!deal) {
            return res.status(404).json({
                success: false,
                message: 'Deal not found or access denied'
            });
        }
        
        deal.stage = stage;
        
        // Add to stage history
        deal.stageHistory.push({
            stage: stage,
            changedBy: req.user._id
        });
        
        // Auto-update probability based on stage
        const probabilities = { 
            'Lead': 10, 
            'Qualified': 25, 
            'Proposal': 50, 
            'Negotiation': 75, 
            'Closed Won': 100,
            'Closed Lost': 0
        };
        deal.probability = probabilities[stage];
        
        await deal.save();
        
        const updatedDeal = await Deal.findById(deal._id)
            .populate('contactId', 'first_name last_name email')
            .populate('ownerId', 'firstName lastName email');
        
        res.status(200).json({
            success: true,
            data: updatedDeal
        });
    } catch (error) {
        console.error('Update stage error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating stage',
            error: error.message
        });
    }
};

