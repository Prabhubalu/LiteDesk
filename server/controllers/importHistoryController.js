const ImportHistory = require('../models/ImportHistory');

// @desc    Get all import history for an organization
// @route   GET /api/imports
// @access  Private
const getImportHistory = async (req, res) => {
  try {
    const { module, status, importedBy, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = { organizationId: req.user.organizationId };
    
    // Filters
    if (module) query.module = module;
    if (status) query.status = status;
    if (importedBy) query.importedBy = importedBy;
    
    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const total = await ImportHistory.countDocuments(query);
    const imports = await ImportHistory.find(query)
      .populate('importedBy', 'firstName lastName email')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: imports,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get import history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching import history',
      error: error.message
    });
  }
};

// @desc    Get single import history by ID
// @route   GET /api/imports/:id
// @access  Private
const getImportById = async (req, res) => {
  try {
    const importRecord = await ImportHistory.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).populate('importedBy', 'firstName lastName email avatar');
    
    if (!importRecord) {
      return res.status(404).json({
        success: false,
        message: 'Import record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: importRecord
    });
  } catch (error) {
    console.error('Get import by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching import record',
      error: error.message
    });
  }
};

// @desc    Get import statistics
// @route   GET /api/imports/stats/summary
// @access  Private
const getImportStats = async (req, res) => {
  try {
    const { organizationId } = req.user;
    
    // Total imports
    const totalImports = await ImportHistory.countDocuments({ organizationId });
    
    // Imports by module
    const byModule = await ImportHistory.aggregate([
      { $match: { organizationId: organizationId } },
      { $group: { _id: '$module', count: { $sum: 1 } } }
    ]);
    
    // Imports by status
    const byStatus = await ImportHistory.aggregate([
      { $match: { organizationId: organizationId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Total records imported
    const totalRecords = await ImportHistory.aggregate([
      { $match: { organizationId: organizationId } },
      {
        $group: {
          _id: null,
          created: { $sum: '$stats.created' },
          updated: { $sum: '$stats.updated' },
          errors: { $sum: '$stats.errors' }
        }
      }
    ]);
    
    // Recent imports (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentImports = await ImportHistory.countDocuments({
      organizationId,
      createdAt: { $gte: sevenDaysAgo }
    });
    
    // Average processing time
    const avgProcessingTime = await ImportHistory.aggregate([
      { $match: { organizationId: organizationId, status: { $ne: 'processing' } } },
      { $group: { _id: null, avgTime: { $avg: '$processingTime' } } }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        totalImports,
        recentImports,
        byModule: byModule.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byStatus: byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        totalRecordsCreated: totalRecords[0]?.created || 0,
        totalRecordsUpdated: totalRecords[0]?.updated || 0,
        totalErrors: totalRecords[0]?.errors || 0,
        avgProcessingTime: Math.round(avgProcessingTime[0]?.avgTime || 0)
      }
    });
  } catch (error) {
    console.error('Get import stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching import statistics',
      error: error.message
    });
  }
};

// @desc    Delete import history record
// @route   DELETE /api/imports/:id
// @access  Private (Admin only)
const deleteImportHistory = async (req, res) => {
  try {
    const importRecord = await ImportHistory.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    
    if (!importRecord) {
      return res.status(404).json({
        success: false,
        message: 'Import record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Import record deleted successfully'
    });
  } catch (error) {
    console.error('Delete import history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting import record',
      error: error.message
    });
  }
};

// @desc    Get imported records by import ID and type (created/updated)
// @route   GET /api/imports/:id/records/:type
// @access  Private
const getImportedRecords = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id, type } = req.params; // type: 'created' or 'updated'
    
    // Validate type
    if (!['created', 'updated'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid record type. Must be "created" or "updated"' });
    }
    
    // Get the import history record
    const importRecord = await ImportHistory.findOne({ _id: id, organizationId });
    
    if (!importRecord) {
      return res.status(404).json({ success: false, message: 'Import record not found' });
    }
    
    const recordIds = importRecord.recordIds?.[type] || [];
    
    if (recordIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    
    // Fetch actual records based on module type
    let records = [];
    const People = require('../models/People');
    const Deal = require('../models/Deal');
    const Task = require('../models/Task');
    const Organization = require('../models/Organization');
    
    switch (importRecord.module) {
      case 'contacts':
        records = await People.find({ _id: { $in: recordIds }, organizationId }).lean();
        break;
      case 'deals':
        records = await Deal.find({ _id: { $in: recordIds}, organizationId }).lean();
        break;
      case 'tasks':
        records = await Task.find({ _id: { $in: recordIds }, organizationId })
          .populate('assignedTo', 'firstName lastName')
          .lean();
        break;
      case 'organizations':
        records = await Organization.find({ _id: { $in: recordIds } }).lean();
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid module type' });
    }
    
    res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.error('Get imported records error:', error);
    res.status(500).json({ success: false, message: 'Error fetching imported records', error: error.message });
  }
};

module.exports = {
  getImportHistory,
  getImportById,
  getImportStats,
  deleteImportHistory,
  getImportedRecords
};

