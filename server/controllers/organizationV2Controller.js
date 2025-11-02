const Organization = require('../models/Organization');

// Create (CRM organization)
exports.create = async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Get user name for activity log (if user is authenticated)
    let userName = 'System';
    if (req.user && req.user._id) {
      const user = await User.findById(req.user._id).select('firstName lastName username');
      if (user) {
        userName = (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User';
      }
    }
    
    const body = {
      ...req.body,
      // Set createdBy from authenticated user
      createdBy: req.user?._id || null,
      // Default assignedTo to creator if not provided (similar to tasks)
      assignedTo: req.body.assignedTo || req.user?._id || null,
      // Mark as CRM organization (not tenant)
      isTenant: false,
      // Add initial activity log for record creation
      activityLogs: [{
        user: userName,
        userId: req.user?._id || null,
        action: 'created this record',
        details: { type: 'create' },
        timestamp: new Date()
      }]
    };
    
    const org = await Organization.create(body);
    res.status(201).json({ success: true, data: org });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error creating organization', error: error.message });
  }
};

// List (CRM organizations only)
exports.list = async (req, res) => {
  try {
    const query = { isTenant: false }; // Only CRM organizations
    if (req.query.type) query.types = req.query.type;
    if (req.query.name) query.name = new RegExp(req.query.name, 'i');

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const data = await Organization.find(query)
      .populate('createdBy', 'firstName lastName email avatar username')
      .populate('assignedTo', 'firstName lastName email avatar username')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    const total = await Organization.countDocuments(query);
    res.json({ success: true, data, meta: { page, limit, total } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching organizations', error: error.message });
  }
};

// Get by ID (CRM organization)
exports.getById = async (req, res) => {
  try {
    const org = await Organization.findOne({ _id: req.params.id, isTenant: false })
      .populate('createdBy', 'firstName lastName email avatar username')
      .populate('assignedTo', 'firstName lastName email avatar username');
    if (!org) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching organization', error: error.message });
  }
};

// Update (CRM organization)
exports.update = async (req, res) => {
  try {
    const updated = await Organization.findOneAndUpdate(
      { _id: req.params.id, isTenant: false }, 
      req.body, 
      { new: true }
    )
      .populate('createdBy', 'firstName lastName email avatar username')
      .populate('assignedTo', 'firstName lastName email avatar username');
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error updating organization', error: error.message });
  }
};

// Delete (CRM organization only - tenants cannot be deleted this way)
exports.remove = async (req, res) => {
  try {
    const deleted = await Organization.findOneAndDelete({ _id: req.params.id, isTenant: false });
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: deleted._id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting organization', error: error.message });
  }
};

// Get activity logs for an organization
exports.getActivityLogs = async (req, res) => {
  try {
    const org = await Organization.findOne({ _id: req.params.id, isTenant: false }).select('activityLogs');
    
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
    console.error('Get activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity logs',
      error: error.message
    });
  }
};

// Add activity log to an organization
exports.addActivityLog = async (req, res) => {
  try {
    const { user, action, details } = req.body;
    
    if (!user || !action) {
      return res.status(400).json({
        success: false,
        message: 'User and action are required'
      });
    }
    
    const org = await Organization.findOneAndUpdate(
      { _id: req.params.id, isTenant: false },
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
    console.error('Add activity log error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding activity log',
      error: error.message
    });
  }
};


