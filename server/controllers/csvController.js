const People = require('../models/People');
const Deal = require('../models/Deal');
const Task = require('../models/Task');
const Organization = require('../models/Organization');
const { assignResolvedSource } = require('../services/sourceResolver');
const {
  mapRowToPeopleImportPayload,
  buildPeopleCreatePayload,
  buildPeopleUpdateSet,
} = require('../utils/peopleImportMapper');

const { parseCSV } = require('../services/import/importCsvParser');
const { stageCsvUpload, submitImportJob } = require('../services/import/importJobService');
const { runDuplicateCheck } = require('../services/import/importDuplicateCheckService');

function normalizeImportRequestBody(req) {
  if (typeof req.body?.config === 'string') {
    try {
      return { ...req.body, ...JSON.parse(req.body.config) };
    } catch {
      const error = new Error('Invalid import config JSON');
      error.statusCode = 400;
      throw error;
    }
  }
  return req.body;
}

async function stageCsvUploadHandler(req, res) {
  try {
    const data = await stageCsvUpload({
      organizationId: req.user.organizationId,
      importedBy: req.user._id,
      file: req.file,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Stage CSV upload error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Error staging CSV upload',
    });
  }
}

function createImportHandler(module) {
  return async (req, res) => {
    try {
      req.body = normalizeImportRequestBody(req);
      await submitImportJob({ req, res, module });
    } catch (error) {
      console.error(`Import ${module} handler error:`, error);
      if (!res.headersSent) {
        res.status(error.statusCode || 500).json({
          success: false,
          code: error.code,
          message: error.message || `Error importing ${module}`,
        });
      }
    }
  };
}

// Simple CSV stringifier
async function getTenantUserIds(organizationId) {
  const User = require('../models/User');
  const users = await User.find({ organizationId }).select('_id').lean();
  return users.map((user) => user._id);
}

async function buildCrmOrganizationQuery(organizationId) {
  const tenantUserIds = await getTenantUserIds(organizationId);
  return {
    isTenant: false,
    deletedAt: null,
    createdBy: { $in: tenantUserIds }
  };
}

// Simple CSV stringifier
const stringifyCSV = (data, headers) => {
  const escapeValue = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  const headerRow = headers.map(escapeValue).join(',');
  const dataRows = data.map(row => 
    headers.map(header => escapeValue(row[header])).join(',')
  );
  
  return [headerRow, ...dataRows].join('\n');
};

// @desc    Parse CSV file and return preview
// @route   POST /api/csv/parse
// @access  Private
const parseCSVFile = async (req, res) => {
  try {
    if (!req.body.csvData) {
      return res.status(400).json({
        success: false,
        message: 'No CSV data provided'
      });
    }

    const { headers, rows } = parseCSV(req.body.csvData);
    
    // Return first 5 rows as preview
    const preview = rows.slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        headers,
        preview,
        totalRows: rows.length
      }
    });
  } catch (error) {
    console.error('Parse CSV error:', error);
    res.status(500).json({
      success: false,
      message: 'Error parsing CSV file',
      error: error.message
    });
  }
};

// @desc    Check for duplicate people before import
// @route   POST /api/csv/check-duplicates/contacts
// @access  Private
const checkContactDuplicates = (req, res) => runDuplicateCheck(req, res, 'contacts');

// @desc    Check for duplicate deals before import
// @route   POST /api/csv/check-duplicates/deals
// @access  Private
const checkDealDuplicates = (req, res) => runDuplicateCheck(req, res, 'deals');

// @desc    Check for duplicate tasks before import
// @route   POST /api/csv/check-duplicates/tasks
// @access  Private
const checkTaskDuplicates = (req, res) => runDuplicateCheck(req, res, 'tasks');

// @desc    Check for duplicate organizations before import
// @route   POST /api/csv/check-duplicates/organizations
// @access  Private
const checkOrganizationDuplicates = (req, res) => runDuplicateCheck(req, res, 'organizations');

// @desc    Stage CSV for large imports (single upload, reused by import job)
// @route   POST /api/csv/staging
// @access  Private
const stageCsvUploadRoute = stageCsvUploadHandler;

// @desc    Import people from CSV (queued job)
// @route   POST /api/csv/import/contacts
// @access  Private
const importContacts = createImportHandler('contacts');

// @desc    Import deals from CSV (queued job)
// @route   POST /api/csv/import/deals
// @access  Private
const importDeals = createImportHandler('deals');

// @desc    Import organizations from CSV (queued job)
// @route   POST /api/csv/import/organizations
// @access  Private
const importOrganizations = createImportHandler('organizations');

// @desc    Import tasks from CSV (queued job)
// @route   POST /api/csv/import/tasks
// @access  Private
const importTasks = createImportHandler('tasks');

// @desc    Export people to CSV
// @route   GET /api/csv/export/contacts
// @access  Private
const exportContacts = async (req, res) => {
  try {
    const contacts = await People.find({
      organizationId: req.user.organizationId
    })
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    const headers = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'sales_type',
      'source',
      'contact_status',
      'lead_score',
      'assigned_to',
      'created_at'
    ];

    const { getSalesParticipationValues } = require('../utils/getSalesParticipationValues');
    const data = contacts.map(contact => {
      const sales = getSalesParticipationValues(contact);
      return {
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        sales_type: sales.role || '',
        source: contact.source || '',
        contact_status: sales.contact_status || '',
        lead_score: contact.lead_score || '',
        assigned_to: contact.assignedTo ? `${contact.assignedTo.firstName} ${contact.assignedTo.lastName}` : '',
        created_at: contact.createdAt ? new Date(contact.createdAt).toISOString() : ''
      };
    });

    const csv = stringifyCSV(data, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="contacts_${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting contacts',
      error: error.message
    });
  }
};

// @desc    Export deals to CSV
// @route   GET /api/csv/export/deals
// @access  Private
const exportDeals = async (req, res) => {
  try {
    const deals = await Deal.find({
      organizationId: req.user.organizationId
    })
      .populate('ownerId', 'firstName lastName email')
      .populate('contactId', 'first_name last_name email')
      .lean();

    const headers = [
      'name',
      'amount',
      'stage',
      'status',
      'priority',
      'probability',
      'expected_close_date',
      'contact_name',
      'contact_email',
      'owner_name',
      'created_at'
    ];

    const data = deals.map(deal => ({
      name: deal.name || '',
      amount: deal.amount || 0,
      stage: deal.stage || '',
      status: deal.status || '',
      priority: deal.priority || '',
      probability: deal.probability || '',
      expected_close_date: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split('T')[0] : '',
      contact_name: deal.contactId ? `${deal.contactId.first_name} ${deal.contactId.last_name}` : '',
      contact_email: deal.contactId?.email || '',
      owner_name: deal.ownerId ? `${deal.ownerId.firstName} ${deal.ownerId.lastName}` : '',
      created_at: deal.createdAt ? new Date(deal.createdAt).toISOString() : ''
    }));

    const csv = stringifyCSV(data, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="deals_${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export deals error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting deals',
      error: error.message
    });
  }
};

// @desc    Export organizations to CSV
// @route   GET /api/csv/export/organizations
// @access  Private
const exportOrganizations = async (req, res) => {
  try {
    const baseQuery = await buildCrmOrganizationQuery(req.user.organizationId);
    const organizations = await Organization.find(baseQuery).lean();

    const headers = [
      'name',
      'industry',
      'website',
      'phone',
      'address',
      'created_at'
    ];

    const data = organizations.map(org => ({
      name: org.name || '',
      industry: org.industry || '',
      website: org.website || '',
      phone: org.phone || '',
      address: org.address || '',
      created_at: org.createdAt ? new Date(org.createdAt).toISOString() : ''
    }));

    const csv = stringifyCSV(data, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="organizations_${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export organizations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting organizations',
      error: error.message
    });
  }
};

// @desc    Export tasks to CSV
// @route   GET /api/csv/export/tasks
// @access  Private
const exportTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ organizationId: req.user.organizationId })
      .populate('assignedTo', 'firstName lastName')
      .lean();

    const headers = [
      'title',
      'description',
      'status',
      'priority',
      'due_date',
      'assigned_to',
      'tags',
      'time_estimate',
      'created_at'
    ];

    const data = tasks.map(task => ({
      title: task.title || '',
      description: task.description || '',
      status: task.status || '',
      priority: task.priority || '',
      due_date: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      assigned_to: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '',
      tags: task.tags ? task.tags.join(', ') : '',
      time_estimate: task.timeEstimate || '',
      created_at: task.createdAt ? new Date(task.createdAt).toISOString() : ''
    }));

    const csv = stringifyCSV(data, headers);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tasks_${Date.now()}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Export tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting tasks',
      error: error.message
    });
  }
};

module.exports = {
  parseCSVFile,
  stageCsvUploadRoute,
  checkContactDuplicates,
  checkDealDuplicates,
  checkTaskDuplicates,
  checkOrganizationDuplicates,
  importContacts,
  importDeals,
  importTasks,
  importOrganizations,
  exportContacts,
  exportDeals,
  exportTasks,
  exportOrganizations
};

