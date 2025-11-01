const People = require('../models/People');

// Create People
exports.create = async (req, res) => {
  try {
    const body = {
      ...req.body,
      organizationId: req.user.organizationId,
      createdBy: req.user._id
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


