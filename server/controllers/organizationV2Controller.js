const OrganizationV2 = require('../models/OrganizationV2');

// Create
exports.create = async (req, res) => {
  try {
    // OrganizationV2 doesn't have organizationId - it's a tenant-level model
    // Just create with the provided data
    const org = await OrganizationV2.create(req.body);
    res.status(201).json({ success: true, data: org });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error creating organization', error: error.message });
  }
};

// List
exports.list = async (req, res) => {
  try {
    const query = {};
    if (req.query.type) query.types = req.query.type;
    if (req.query.name) query.name = new RegExp(req.query.name, 'i');

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const data = await OrganizationV2.find(query).sort({ createdAt: -1 }).limit(limit).skip(skip);
    const total = await OrganizationV2.countDocuments(query);
    res.json({ success: true, data, meta: { page, limit, total } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching organizations', error: error.message });
  }
};

// Get by ID
exports.getById = async (req, res) => {
  try {
    const org = await OrganizationV2.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching organization', error: error.message });
  }
};

// Update
exports.update = async (req, res) => {
  try {
    const updated = await OrganizationV2.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error updating organization', error: error.message });
  }
};

// Delete
exports.remove = async (req, res) => {
  try {
    const deleted = await OrganizationV2.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: deleted._id });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting organization', error: error.message });
  }
};


