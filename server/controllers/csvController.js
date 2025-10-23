const Contact = require('../models/Contact');
const Deal = require('../models/Deal');
const Task = require('../models/Task');
const Organization = require('../models/Organization');
const ImportHistory = require('../models/ImportHistory');

// NOTE: Install these packages: npm install csv-parse csv-stringify multer
// For now, using basic CSV parsing

// Simple CSV parser (fallback if csv-parse not installed)
const parseCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    // Basic CSV parsing (handles simple cases)
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj;
  });
  
  return { headers, rows };
};

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

// @desc    Check for duplicate contacts before import
// @route   POST /api/csv/check-duplicates/contacts
// @access  Private
const checkContactDuplicates = async (req, res) => {
  try {
    const { csvData, fieldMapping, checkFields = ['email'] } = req.body;

    if (!csvData || !fieldMapping) {
      return res.status(400).json({
        success: false,
        message: 'CSV data and field mapping are required'
      });
    }

    const { rows } = parseCSV(csvData);
    const duplicates = [];
    const unique = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2; // +2 for header row and 0-index
      
      // Build query based on selected check fields
      const query = { organizationId: req.user.organizationId };
      const matchedFields = [];
      let canCheck = true;
      
      for (const checkField of checkFields) {
        if (checkField === 'email') {
          let email = null;
          for (const [csvField, contactField] of Object.entries(fieldMapping)) {
            if (contactField === 'email' && row[csvField]) {
              email = row[csvField].trim().toLowerCase();
              break;
            }
          }
          if (email) {
            query.email = email;
            matchedFields.push({ field: 'email', value: email });
          } else {
            canCheck = false;
          }
        } else if (checkField === 'phone') {
          let phone = null;
          for (const [csvField, contactField] of Object.entries(fieldMapping)) {
            if (contactField === 'phone' && row[csvField]) {
              phone = row[csvField].trim();
              break;
            }
          }
          if (phone) {
            query.phone = phone;
            matchedFields.push({ field: 'phone', value: phone });
          } else {
            canCheck = false;
          }
        } else if (checkField === 'full_name') {
          let firstName = null;
          let lastName = null;
          for (const [csvField, contactField] of Object.entries(fieldMapping)) {
            if (contactField === 'first_name' && row[csvField]) {
              firstName = row[csvField].trim();
            }
            if (contactField === 'last_name' && row[csvField]) {
              lastName = row[csvField].trim();
            }
          }
          if (firstName && lastName) {
            query.first_name = firstName;
            query.last_name = lastName;
            matchedFields.push({ field: 'full_name', value: `${firstName} ${lastName}` });
          } else {
            canCheck = false;
          }
        } else if (checkField === 'email_company') {
          let email = null;
          let company = null;
          for (const [csvField, contactField] of Object.entries(fieldMapping)) {
            if (contactField === 'email' && row[csvField]) {
              email = row[csvField].trim().toLowerCase();
            }
            if (contactField === 'company' && row[csvField]) {
              company = row[csvField].trim();
            }
          }
          if (email && company) {
            query.email = email;
            query.company = company;
            matchedFields.push({ field: 'email + company', value: `${email} @ ${company}` });
          } else {
            canCheck = false;
          }
        } else if (checkField === 'phone_company') {
          let phone = null;
          let company = null;
          for (const [csvField, contactField] of Object.entries(fieldMapping)) {
            if (contactField === 'phone' && row[csvField]) {
              phone = row[csvField].trim();
            }
            if (contactField === 'company' && row[csvField]) {
              company = row[csvField].trim();
            }
          }
          if (phone && company) {
            query.phone = phone;
            query.company = company;
            matchedFields.push({ field: 'phone + company', value: `${phone} @ ${company}` });
          } else {
            canCheck = false;
          }
        }
      }

      if (!canCheck || Object.keys(query).length === 1) {
        unique.push({
          rowNumber,
          data: row,
          reason: 'Missing required fields to check'
        });
        continue;
      }

      // Check for existing contact with all matching fields
      const existing = await Contact.findOne(query).lean();

      if (existing) {
        duplicates.push({
          rowNumber,
          data: row,
          matchedField: matchedFields.map(f => f.field).join(' AND '),
          matchedValue: matchedFields.map(f => f.value).join(', '),
          existingRecord: {
            _id: existing._id,
            first_name: existing.first_name,
            last_name: existing.last_name,
            email: existing.email,
            phone: existing.phone,
            company: existing.company,
            lifecycle_stage: existing.lifecycle_stage,
            createdAt: existing.createdAt
          }
        });
      } else {
        unique.push({
          rowNumber,
          data: row
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        total: rows.length,
        duplicates: duplicates.length,
        unique: unique.length,
        duplicateRecords: duplicates,
        uniqueRecords: unique,
        checkedFields: checkFields
      }
    });
  } catch (error) {
    console.error('Check duplicates error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking for duplicates',
      error: error.message
    });
  }
};

// @desc    Check for duplicate deals before import
// @route   POST /api/csv/check-duplicates/deals
// @access  Private
const checkDealDuplicates = async (req, res) => {
  try {
    const { csvData, fieldMapping, checkFields = ['name'] } = req.body;

    if (!csvData || !fieldMapping) {
      return res.status(400).json({
        success: false,
        message: 'CSV data and field mapping are required'
      });
    }

    const { rows } = parseCSV(csvData);
    const duplicates = [];
    const unique = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      
      // Build query based on selected check fields
      const query = { organizationId: req.user.organizationId };
      const matchedFields = [];
      let canCheck = true;
      
      for (const checkField of checkFields) {
        if (checkField === 'name') {
          let dealName = null;
          for (const [csvField, dealField] of Object.entries(fieldMapping)) {
            if (dealField === 'name' && row[csvField]) {
              dealName = row[csvField].trim();
              break;
            }
          }
          if (dealName) {
            query.name = dealName;
            matchedFields.push({ field: 'name', value: dealName });
          } else {
            canCheck = false;
          }
        } else if (checkField === 'name_amount') {
          let dealName = null;
          let amount = null;
          for (const [csvField, dealField] of Object.entries(fieldMapping)) {
            if (dealField === 'name' && row[csvField]) {
              dealName = row[csvField].trim();
            }
            if (dealField === 'amount' && row[csvField]) {
              amount = parseFloat(row[csvField].replace(/[^0-9.-]+/g, ''));
            }
          }
          if (dealName && amount) {
            query.name = dealName;
            query.amount = amount;
            matchedFields.push({ field: 'name + amount', value: `${dealName} ($${amount})` });
          } else {
            canCheck = false;
          }
        } else if (checkField === 'name_stage') {
          let dealName = null;
          let stage = null;
          for (const [csvField, dealField] of Object.entries(fieldMapping)) {
            if (dealField === 'name' && row[csvField]) {
              dealName = row[csvField].trim();
            }
            if (dealField === 'stage' && row[csvField]) {
              stage = row[csvField].trim();
            }
          }
          if (dealName && stage) {
            query.name = dealName;
            query.stage = stage;
            matchedFields.push({ field: 'name + stage', value: `${dealName} (${stage})` });
          } else {
            canCheck = false;
          }
        }
      }

      if (!canCheck || Object.keys(query).length === 1) {
        unique.push({
          rowNumber,
          data: row,
          reason: 'Missing required fields to check'
        });
        continue;
      }

      // Check for existing deal with all matching fields
      const existing = await Deal.findOne(query).lean();

      if (existing) {
        duplicates.push({
          rowNumber,
          data: row,
          matchedField: matchedFields.map(f => f.field).join(' AND '),
          matchedValue: matchedFields.map(f => f.value).join(', '),
          existingRecord: {
            _id: existing._id,
            name: existing.name,
            amount: existing.amount,
            stage: existing.stage,
            status: existing.status,
            createdAt: existing.createdAt
          }
        });
      } else {
        unique.push({
          rowNumber,
          data: row
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        total: rows.length,
        duplicates: duplicates.length,
        unique: unique.length,
        duplicateRecords: duplicates,
        uniqueRecords: unique,
        checkedFields: checkFields
      }
    });
  } catch (error) {
    console.error('Check duplicates error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking for duplicates',
      error: error.message
    });
  }
};

// @desc    Import contacts from CSV
// @route   POST /api/csv/import/contacts
// @access  Private
const importContacts = async (req, res) => {
  const startTime = Date.now();
  let importHistory = null;
  
  try {
    const { csvData, fieldMapping, updateExisting, fileName, duplicateCheckFields, shouldCheckDuplicates } = req.body;

    if (!csvData || !fieldMapping) {
      return res.status(400).json({
        success: false,
        message: 'CSV data and field mapping are required'
      });
    }

    const { rows, headers } = parseCSV(csvData);
    
    // Create import history record
    importHistory = await ImportHistory.create({
      organizationId: req.user.organizationId,
      module: 'contacts',
      fileName: fileName || 'import.csv',
      importedBy: req.user._id,
      status: 'processing',
      duplicateCheckEnabled: shouldCheckDuplicates !== false,
      duplicateCheckFields: duplicateCheckFields || [],
      duplicateAction: updateExisting ? 'update' : 'skip',
      metadata: {
        csvHeaders: headers,
        fieldMapping,
        totalRows: rows.length
      },
      stats: {
        total: rows.length
      }
    });
    
    const results = {
      total: rows.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      createdIds: [],
      updatedIds: []
    };

    for (const [index, row] of rows.entries()) {
      try {
        // Map CSV fields to Contact fields
        const contactData = {
          organizationId: req.user.organizationId
        };

        Object.keys(fieldMapping).forEach(csvField => {
          const contactField = fieldMapping[csvField];
          if (contactField && row[csvField]) {
            // Handle nested fields (e.g., 'address.street')
            if (contactField.includes('.')) {
              const [parent, child] = contactField.split('.');
              if (!contactData[parent]) contactData[parent] = {};
              contactData[parent][child] = row[csvField];
            } else {
              contactData[contactField] = row[csvField];
            }
          }
        });

        // Check duplicates only if enabled
        if (shouldCheckDuplicates && contactData.email) {
          const existing = await Contact.findOne({
            organizationId: req.user.organizationId,
            email: contactData.email
          });

          if (existing) {
            if (updateExisting) {
              await Contact.updateOne({ _id: existing._id }, contactData);
              results.updated++;
              results.updatedIds.push(existing._id);
            } else {
              results.failed++;
              results.errors.push({
                row: index + 2,
                error: 'Contact with this email already exists'
              });
            }
          } else {
            const newContact = await Contact.create(contactData);
            results.created++;
            results.createdIds.push(newContact._id);
          }
        } else {
          // No duplicate check or no email - always create
          const newContact = await Contact.create(contactData);
          results.created++;
          results.createdIds.push(newContact._id);
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: index + 2,
          error: error.message
        });
      }
    }

    // Update import history with final results
    const processingTime = Date.now() - startTime;
    const finalStatus = results.failed === results.total ? 'failed' : 
                       results.failed > 0 ? 'partial' : 'completed';
    
    await ImportHistory.findByIdAndUpdate(importHistory._id, {
      status: finalStatus,
      'stats.created': results.created,
      'stats.updated': results.updated,
      'stats.skipped': results.failed,
      'stats.failed': results.failed,
      'recordIds.created': results.createdIds,
      'recordIds.updated': results.updatedIds,
      errors: results.errors,
      processingTime
    });

    res.status(200).json({
      success: true,
      data: {
        ...results,
        importId: importHistory._id
      }
    });
  } catch (error) {
    console.error('Import contacts error:', error);
    
    // Update import history with failure
    if (importHistory) {
      await ImportHistory.findByIdAndUpdate(importHistory._id, {
        status: 'failed',
        errors: [{ row: 0, error: error.message }],
        processingTime: Date.now() - startTime
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error importing contacts',
      error: error.message
    });
  }
};

// @desc    Import deals from CSV
// @route   POST /api/csv/import/deals
// @access  Private
const importDeals = async (req, res) => {
  const startTime = Date.now();
  let importHistory = null;
  
  try {
    const { csvData, fieldMapping, updateExisting = false, fileName = 'import.csv', shouldCheckDuplicates = false, duplicateCheckFields = [] } = req.body;

    if (!csvData || !fieldMapping) {
      return res.status(400).json({
        success: false,
        message: 'CSV data and field mapping are required'
      });
    }

    const { headers, rows } = parseCSV(csvData);
    
    // Create import history record
    importHistory = await ImportHistory.create({
      organizationId: req.user.organizationId,
      module: 'deals',
      fileName,
      importedBy: req.user._id,
      status: 'processing',
      duplicateCheckEnabled: shouldCheckDuplicates !== false,
      duplicateCheckFields: duplicateCheckFields || [],
      duplicateAction: updateExisting ? 'update' : 'skip',
      metadata: {
        csvHeaders: headers,
        fieldMapping,
        totalRows: rows.length
      },
      stats: {
        total: rows.length
      }
    });
    
    const results = {
      total: rows.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      createdIds: [],
      updatedIds: []
    };

    for (const [index, row] of rows.entries()) {
      try {
        const dealData = {
          organizationId: req.user.organizationId,
          ownerId: req.user._id
        };

        Object.keys(fieldMapping).forEach(csvField => {
          const dealField = fieldMapping[csvField];
          if (dealField && row[csvField]) {
            // Convert amount to number
            if (dealField === 'amount') {
              dealData[dealField] = parseFloat(row[csvField].replace(/[^0-9.-]+/g, ''));
            } else if (dealField === 'expectedCloseDate') {
              dealData[dealField] = new Date(row[csvField]);
            } else {
              dealData[dealField] = row[csvField];
            }
          }
        });

        // Validate deal name is required
        if (!dealData.name) {
          results.failed++;
          results.errors.push({
            row: index + 2,
            error: 'Deal name is required'
          });
          continue;
        }

        // Check duplicates only if enabled
        if (shouldCheckDuplicates) {
          const existing = await Deal.findOne({
            organizationId: req.user.organizationId,
            name: dealData.name
          });

          if (existing) {
            if (updateExisting) {
              await Deal.updateOne({ _id: existing._id }, dealData);
              results.updated++;
              results.updatedIds.push(existing._id);
            } else {
              results.failed++;
              results.errors.push({
                row: index + 2,
                error: 'Deal with this name already exists'
              });
            }
          } else {
            const newDeal = await Deal.create(dealData);
            results.created++;
            results.createdIds.push(newDeal._id);
          }
        } else {
          // No duplicate check - always create
          const newDeal = await Deal.create(dealData);
          results.created++;
          results.createdIds.push(newDeal._id);
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: index + 2,
          error: error.message
        });
      }
    }

    // Update import history with final results
    const processingTime = Date.now() - startTime;
    const finalStatus = results.failed === results.total ? 'failed' : 
                       results.failed > 0 ? 'partial' : 'completed';
    
    await ImportHistory.findByIdAndUpdate(importHistory._id, {
      status: finalStatus,
      'stats.created': results.created,
      'stats.updated': results.updated,
      'stats.skipped': results.failed - results.errors.length,
      'stats.failed': results.failed,
      'recordIds.created': results.createdIds,
      'recordIds.updated': results.updatedIds,
      errors: results.errors,
      processingTime
    });

    res.status(200).json({
      success: true,
      data: {
        ...results,
        importId: importHistory._id
      }
    });
  } catch (error) {
    console.error('Import deals error:', error);
    
    // Update import history with failure
    if (importHistory) {
      await ImportHistory.findByIdAndUpdate(importHistory._id, {
        status: 'failed',
        errors: [{ row: 0, error: error.message }],
        processingTime: Date.now() - startTime
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error importing deals',
      error: error.message
    });
  }
};

// @desc    Export contacts to CSV
// @route   GET /api/csv/export/contacts
// @access  Private
const exportContacts = async (req, res) => {
  try {
    const contacts = await Contact.find({
      organizationId: req.user.organizationId
    })
    .populate('owner_id', 'firstName lastName email')
    .lean();

    const headers = [
      'first_name',
      'last_name',
      'email',
      'phone',
      'job_title',
      'company',
      'lifecycle_stage',
      'lead_source',
      'status',
      'lead_score',
      'owner_name',
      'created_at'
    ];

    const data = contacts.map(contact => ({
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      job_title: contact.job_title || '',
      company: contact.company || '',
      lifecycle_stage: contact.lifecycle_stage || '',
      lead_source: contact.lead_source || '',
      status: contact.status || '',
      lead_score: contact.lead_score || '',
      owner_name: contact.owner_id ? `${contact.owner_id.firstName} ${contact.owner_id.lastName}` : '',
      created_at: contact.createdAt ? new Date(contact.createdAt).toISOString() : ''
    }));

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
// @access  Private (Admin only)
const exportOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.find().lean();

    const headers = [
      'name',
      'industry',
      'is_active',
      'subscription_tier',
      'subscription_status',
      'trial_start_date',
      'trial_end_date',
      'created_at'
    ];

    const data = organizations.map(org => ({
      name: org.name || '',
      industry: org.industry || '',
      is_active: org.isActive ? 'Yes' : 'No',
      subscription_tier: org.subscription?.tier || '',
      subscription_status: org.subscription?.status || '',
      trial_start_date: org.subscription?.trialStartDate ? new Date(org.subscription.trialStartDate).toISOString().split('T')[0] : '',
      trial_end_date: org.subscription?.trialEndDate ? new Date(org.subscription.trialEndDate).toISOString().split('T')[0] : '',
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

// @desc    Import tasks from CSV
// @route   POST /api/csv/import/tasks
// @access  Private
const importTasks = async (req, res) => {
  const startTime = Date.now();
  let importHistory = null;
  
  try {
    const { csvData, fieldMapping, updateExisting = false, fileName = 'import.csv', shouldCheckDuplicates = false, duplicateCheckFields = [] } = req.body;
    const { organizationId, _id: userId } = req.user;

    if (!csvData || !fieldMapping) {
      return res.status(400).json({
        success: false,
        message: 'CSV data and field mapping are required'
      });
    }

    const { headers, rows } = parseCSV(csvData);
    
    // Create import history record
    importHistory = await ImportHistory.create({
      organizationId,
      module: 'tasks',
      fileName,
      importedBy: userId,
      status: 'processing',
      duplicateCheckEnabled: shouldCheckDuplicates !== false,
      duplicateCheckFields: duplicateCheckFields || [],
      duplicateAction: updateExisting ? 'update' : 'skip',
      metadata: {
        csvHeaders: headers,
        fieldMapping,
        totalRows: rows.length
      },
      stats: {
        total: rows.length
      }
    });
    
    const results = { 
      created: 0, 
      updated: 0, 
      skipped: 0, 
      errors: [],
      createdIds: [],
      updatedIds: []
    };

    for (const [index, row] of rows.entries()) {
      try {
        const taskData = { organizationId, createdBy: userId, assignedBy: userId };

        // Map fields from CSV to task schema
        for (const [csvField, taskField] of Object.entries(fieldMapping)) {
          if (row[csvField] !== undefined && row[csvField] !== '') {
            if (taskField === 'dueDate') {
              taskData[taskField] = new Date(row[csvField]);
            } else if (taskField === 'timeEstimate') {
              taskData[taskField] = parseInt(row[csvField]) || 0;
            } else if (taskField === 'tags') {
              taskData[taskField] = row[csvField].split(',').map(t => t.trim());
            } else {
              taskData[taskField] = row[csvField];
            }
          }
        }

        // Set defaults if not provided
        if (!taskData.title) {
          results.errors.push({ row: index + 2, error: 'Title is required' });
          results.skipped++;
          continue;
        }
        if (!taskData.assignedTo) taskData.assignedTo = userId;
        if (!taskData.status) taskData.status = 'todo';
        if (!taskData.priority) taskData.priority = 'medium';

        // Check duplicates only if enabled
        if (shouldCheckDuplicates) {
          const existing = await Task.findOne({
            organizationId,
            title: taskData.title
          });

          if (existing && updateExisting) {
            await Task.findByIdAndUpdate(existing._id, taskData);
            results.updated++;
            results.updatedIds.push(existing._id);
          } else if (!existing) {
            const newTask = await Task.create(taskData);
            results.created++;
            results.createdIds.push(newTask._id);
          } else {
            results.skipped++;
          }
        } else {
          // No duplicate check - always create
          const newTask = await Task.create(taskData);
          results.created++;
          results.createdIds.push(newTask._id);
        }
      } catch (error) {
        results.errors.push({ row: index + 2, error: error.message });
      }
    }

    // Update import history with final results
    const processingTime = Date.now() - startTime;
    const totalRecords = results.created + results.updated + results.skipped;
    const finalStatus = totalRecords === 0 && results.errors.length > 0 ? 'failed' : 
                       results.errors.length > 0 ? 'partial' : 'completed';
    
    await ImportHistory.findByIdAndUpdate(importHistory._id, {
      status: finalStatus,
      'stats.created': results.created,
      'stats.updated': results.updated,
      'stats.skipped': results.skipped,
      'stats.failed': results.errors.length,
      'recordIds.created': results.createdIds,
      'recordIds.updated': results.updatedIds,
      errors: results.errors,
      processingTime
    });

    res.status(200).json({
      success: true,
      data: {
        ...results,
        total: rows.length,
        failed: results.errors.length,
        importId: importHistory._id
      }
    });
  } catch (error) {
    console.error('Import tasks error:', error);
    
    // Update import history with failure
    if (importHistory) {
      await ImportHistory.findByIdAndUpdate(importHistory._id, {
        status: 'failed',
        errors: [{ row: 0, error: error.message }],
        processingTime: Date.now() - startTime
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error importing tasks',
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

// @desc    Check for duplicate tasks before import
// @route   POST /api/csv/check-duplicates/tasks
// @access  Private
const checkTaskDuplicates = async (req, res) => {
  try {
    const { csvData, fieldMapping, checkFields = ['title'] } = req.body;

    if (!csvData || !fieldMapping) {
      return res.status(400).json({
        success: false,
        message: 'CSV data and field mapping are required'
      });
    }

    const { rows } = parseCSV(csvData);
    const duplicates = [];
    const unique = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      
      const query = { organizationId: req.user.organizationId };
      const matchedFields = [];
      let canCheck = true;
      
      for (const checkField of checkFields) {
        if (checkField === 'title') {
          let title = null;
          for (const [csvField, taskField] of Object.entries(fieldMapping)) {
            if (taskField === 'title' && row[csvField]) {
              title = row[csvField].trim();
              break;
            }
          }
          if (title) {
            query.title = title;
            matchedFields.push({ field: 'title', value: title });
          } else {
            canCheck = false;
          }
        }
      }

      if (!canCheck || Object.keys(query).length === 1) {
        unique.push({
          rowNumber,
          data: row,
          reason: 'Missing required fields to check'
        });
        continue;
      }

      const existing = await Task.findOne(query).lean();

      if (existing) {
        duplicates.push({
          rowNumber,
          data: row,
          matchedField: matchedFields.map(f => f.field).join(' AND '),
          matchedValue: matchedFields.map(f => f.value).join(', '),
          existingRecord: {
            _id: existing._id,
            title: existing.title,
            status: existing.status,
            priority: existing.priority,
            dueDate: existing.dueDate,
            createdAt: existing.createdAt
          }
        });
      } else {
        unique.push({
          rowNumber,
          data: row
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        total: rows.length,
        duplicates: duplicates.length,
        unique: unique.length,
        duplicateRecords: duplicates,
        uniqueRecords: unique,
        checkedFields: checkFields
      }
    });
  } catch (error) {
    console.error('Check duplicates error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking for duplicates',
      error: error.message
    });
  }
};

module.exports = {
  parseCSVFile,
  checkContactDuplicates,
  checkDealDuplicates,
  checkTaskDuplicates,
  importContacts,
  importDeals,
  importTasks,
  exportContacts,
  exportDeals,
  exportTasks,
  exportOrganizations
};

