const People = require('../models/People');

// Create People
exports.create = async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Get user name for activity log
    const user = await User.findById(req.user._id).select('firstName lastName username');
    const userName = user ? 
      (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User' 
      : 'System';
    
    const body = {
      ...req.body,
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
      // Add initial activity log for record creation
      activityLogs: [{
        user: userName,
        userId: req.user._id,
        action: 'created this record',
        details: { type: 'create' },
        timestamp: new Date()
      }]
    };
    const record = await People.create(body);
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error creating record', error: error.message });
  }
};

// List People with org isolation and basic filters
exports.list = async (req, res) => {
  try {
    const query = { organizationId: req.user.organizationId };
    if (req.query.type) query.type = req.query.type;
    if (req.query.email) query.email = req.query.email;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const User = require('../models/User');
    const data = await People.find(query)
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('organization', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);
    const total = await People.countDocuments(query);
    res.json({ success: true, data, meta: { page, limit, total } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching records', error: error.message });
  }
};

// Get by ID
exports.getById = async (req, res) => {
  try {
    const record = await People.findOne({ _id: req.params.id, organizationId: req.user.organizationId })
      .populate('organization', 'name industry status email phone website')
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('notes.created_by', 'firstName lastName');
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching record', error: error.message });
  }
};

// Update
exports.update = async (req, res) => {
  try {
    // Remove createdBy from body to prevent it from being changed
    const { createdBy, ...updateData } = req.body;
    
    // If someone tried to change createdBy, log a warning (but don't fail the request)
    if (createdBy !== undefined) {
      console.warn(`Attempt to modify createdBy field blocked for People record ${req.params.id}`);
    }
    
    // Ensure organization field is properly formatted (ObjectId string or null)
    if (updateData.organization !== undefined) {
      if (updateData.organization === null || updateData.organization === '') {
        updateData.organization = null;
      } else if (typeof updateData.organization === 'object' && updateData.organization._id) {
        // If it's an object with _id, extract the _id
        updateData.organization = updateData.organization._id;
      }
      // Otherwise keep it as is (should be an ObjectId string)
    }
    
    console.log('📝 Updating People record:', {
      id: req.params.id,
      organization: updateData.organization,
      organizationType: typeof updateData.organization,
      updateKeys: Object.keys(updateData)
    });
    
    const updated = await People.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId },
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('organization', 'name');
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    
    console.log('✅ Updated People record:', {
      id: updated._id,
      organization: updated.organization,
      organizationType: typeof updated.organization
    });
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('❌ Error updating People record:', error);
    res.status(400).json({ success: false, message: 'Error updating record', error: error.message });
  }
};

// Delete
exports.remove = async (req, res) => {
  try {
    const deleted = await People.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: deleted._id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting record', error: error.message });
  }
};

// Add note to person
exports.addNote = async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note text is required'
      });
    }
    
    const person = await People.findOneAndUpdate(
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
        }
      },
      { new: true, runValidators: true }
    )
    .populate('organization', 'name industry status email phone website')
    .populate('assignedTo', 'firstName lastName email')
    .populate('notes.created_by', 'firstName lastName');
    
    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found or access denied'
      });
    }
    
    res.status(200).json({
      success: true,
      data: person
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

// Get activity logs for a person
exports.getActivityLogs = async (req, res) => {
  try {
    const person = await People.findOne({ 
      _id: req.params.id, 
      organizationId: req.user.organizationId 
    }).select('activityLogs');
    
    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found or access denied'
      });
    }
    
    // Sort by timestamp (newest first)
    const logs = (person.activityLogs || []).sort((a, b) => 
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

// Add activity log to a person
exports.addActivityLog = async (req, res) => {
  try {
    const { user, action, details } = req.body;
    
    if (!user || !action) {
      return res.status(400).json({
        success: false,
        message: 'User and action are required'
      });
    }
    
    const person = await People.findOneAndUpdate(
      { 
        _id: req.params.id, 
        organizationId: req.user.organizationId 
      },
      {
        $push: {
          activityLogs: {
            user: user,
            userId: req.user._id,
            action: action,
            details: details || null,
            timestamp: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found or access denied'
      });
    }
    
    // Return the newly added log
    const newLog = person.activityLogs[person.activityLogs.length - 1];
    
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


