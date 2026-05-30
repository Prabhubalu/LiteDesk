const People = require('../../models/People');
const Deal = require('../../models/Deal');
const Task = require('../../models/Task');
const Organization = require('../../models/Organization');
const { resolveImportRowsSource } = require('./importCsvReader');
const { DUPLICATE_CHECK_MAX_SAMPLES } = require('./importConstants');
const { buildCrmOrganizationQuery } = require('./importRowProcessors');

function mapCsvField(row, fieldMapping, targetField) {
  for (const [csvField, mappedField] of Object.entries(fieldMapping)) {
    if (mappedField === targetField && row[csvField]) {
      return String(row[csvField]).trim();
    }
  }
  return null;
}

function buildContactsDuplicateQuery(row, fieldMapping, checkFields, organizationId) {
  const query = { organizationId };
  const matchedFields = [];
  let canCheck = true;

  for (const checkField of checkFields) {
    if (checkField === 'email') {
      const email = mapCsvField(row, fieldMapping, 'email');
      if (email) {
        query.email = email.toLowerCase();
        matchedFields.push({ field: 'email', value: email });
      } else canCheck = false;
    } else if (checkField === 'phone') {
      const phone = mapCsvField(row, fieldMapping, 'phone');
      if (phone) {
        query.phone = phone;
        matchedFields.push({ field: 'phone', value: phone });
      } else canCheck = false;
    } else if (checkField === 'full_name') {
      const firstName = mapCsvField(row, fieldMapping, 'first_name');
      const lastName = mapCsvField(row, fieldMapping, 'last_name');
      if (firstName && lastName) {
        query.first_name = firstName;
        query.last_name = lastName;
        matchedFields.push({ field: 'full_name', value: `${firstName} ${lastName}` });
      } else canCheck = false;
    } else if (checkField === 'email_company') {
      const email = mapCsvField(row, fieldMapping, 'email');
      const company = mapCsvField(row, fieldMapping, 'company');
      if (email && company) {
        query.email = email.toLowerCase();
        query.company = company;
        matchedFields.push({ field: 'email + company', value: `${email} @ ${company}` });
      } else canCheck = false;
    } else if (checkField === 'phone_company') {
      const phone = mapCsvField(row, fieldMapping, 'phone');
      const company = mapCsvField(row, fieldMapping, 'company');
      if (phone && company) {
        query.phone = phone;
        query.company = company;
        matchedFields.push({ field: 'phone + company', value: `${phone} @ ${company}` });
      } else canCheck = false;
    }
  }

  return { query, matchedFields, canCheck };
}

function buildDealsDuplicateQuery(row, fieldMapping, checkFields, organizationId) {
  const query = { organizationId };
  const matchedFields = [];
  let canCheck = true;

  for (const checkField of checkFields) {
    if (checkField === 'name') {
      const name = mapCsvField(row, fieldMapping, 'name');
      if (name) {
        query.name = name;
        matchedFields.push({ field: 'name', value: name });
      } else canCheck = false;
    } else if (checkField === 'name_amount') {
      const name = mapCsvField(row, fieldMapping, 'name');
      let amount = null;
      for (const [csvField, dealField] of Object.entries(fieldMapping)) {
        if (dealField === 'amount' && row[csvField]) {
          amount = parseFloat(String(row[csvField]).replace(/[^0-9.-]+/g, ''));
        }
      }
      if (name && amount != null && !Number.isNaN(amount)) {
        query.name = name;
        query.amount = amount;
        matchedFields.push({ field: 'name + amount', value: `${name} ($${amount})` });
      } else canCheck = false;
    } else if (checkField === 'name_stage') {
      const name = mapCsvField(row, fieldMapping, 'name');
      const stage = mapCsvField(row, fieldMapping, 'stage');
      if (name && stage) {
        query.name = name;
        query.stage = stage;
        matchedFields.push({ field: 'name + stage', value: `${name} (${stage})` });
      } else canCheck = false;
    }
  }

  return { query, matchedFields, canCheck };
}

function buildTasksDuplicateQuery(row, fieldMapping, checkFields, organizationId) {
  const query = { organizationId };
  const matchedFields = [];
  let canCheck = true;

  for (const checkField of checkFields) {
    if (checkField === 'title') {
      const title = mapCsvField(row, fieldMapping, 'title');
      if (title) {
        query.title = title;
        matchedFields.push({ field: 'title', value: title });
      } else canCheck = false;
    }
  }

  return { query, matchedFields, canCheck };
}

function buildOrganizationsDuplicateQuery(row, fieldMapping, checkFields, organizationId, crmBaseQuery) {
  const query = { ...crmBaseQuery };
  const matchedFields = [];
  let canCheck = true;

  for (const checkField of checkFields) {
    if (checkField === 'name') {
      const name = mapCsvField(row, fieldMapping, 'name');
      if (name) {
        query.name = name;
        matchedFields.push({ field: 'name', value: name });
      } else canCheck = false;
    }
  }

  return { query, matchedFields, canCheck };
}

const MODULE_HANDLERS = {
  contacts: {
    Model: People,
    defaultCheckFields: ['email'],
    buildQuery: buildContactsDuplicateQuery,
    formatExisting: (existing) => ({
      _id: existing._id,
      first_name: existing.first_name,
      last_name: existing.last_name,
      email: existing.email,
      phone: existing.phone,
      company: existing.company,
      lifecycle_stage: existing.lifecycle_stage,
      createdAt: existing.createdAt,
    }),
  },
  deals: {
    Model: Deal,
    defaultCheckFields: ['name'],
    buildQuery: buildDealsDuplicateQuery,
    formatExisting: (existing) => ({
      _id: existing._id,
      name: existing.name,
      amount: existing.amount,
      stage: existing.stage,
      status: existing.status,
      createdAt: existing.createdAt,
    }),
  },
  tasks: {
    Model: Task,
    defaultCheckFields: ['title'],
    buildQuery: buildTasksDuplicateQuery,
    formatExisting: (existing) => ({
      _id: existing._id,
      title: existing.title,
      status: existing.status,
      priority: existing.priority,
      createdAt: existing.createdAt,
    }),
  },
  organizations: {
    Model: Organization,
    defaultCheckFields: ['name'],
    buildQuery: buildOrganizationsDuplicateQuery,
    formatExisting: (existing) => ({
      _id: existing._id,
      name: existing.name,
      industry: existing.industry,
      website: existing.website,
      createdAt: existing.createdAt,
    }),
  },
};

async function runDuplicateCheck(req, res, module) {
  try {
    const handler = MODULE_HANDLERS[module];
    if (!handler) {
      return res.status(400).json({ success: false, message: `Unsupported module: ${module}` });
    }

    const {
      csvData,
      stagingId,
      fieldMapping,
      checkFields = handler.defaultCheckFields,
    } = req.body;

    if (!fieldMapping) {
      return res.status(400).json({
        success: false,
        message: 'fieldMapping is required',
      });
    }

    if (!csvData && !stagingId) {
      return res.status(400).json({
        success: false,
        message: 'CSV data or stagingId is required',
      });
    }

    const organizationId = req.user.organizationId;
    const source = await resolveImportRowsSource({ organizationId, csvData, stagingId });
    const crmBaseQuery = module === 'organizations'
      ? await buildCrmOrganizationQuery(organizationId)
      : null;

    let duplicateCount = 0;
    let uniqueCount = 0;
    const duplicateRecords = [];
    let samplesTruncated = false;

    for await (const { rowNumber, row } of source.rows()) {
      const buildArgs = module === 'organizations'
        ? [row, fieldMapping, checkFields, organizationId, crmBaseQuery]
        : [row, fieldMapping, checkFields, organizationId];
      const { query, matchedFields, canCheck } = handler.buildQuery(...buildArgs);

      if (!canCheck || matchedFields.length === 0) {
        uniqueCount += 1;
        continue;
      }

      const existing = await handler.Model.findOne(query).lean();
      if (existing) {
        duplicateCount += 1;
        if (duplicateRecords.length < DUPLICATE_CHECK_MAX_SAMPLES) {
          duplicateRecords.push({
            rowNumber,
            data: row,
            matchedField: matchedFields.map((f) => f.field).join(' AND '),
            matchedValue: matchedFields.map((f) => f.value).join(', '),
            existingRecord: handler.formatExisting(existing),
          });
        } else {
          samplesTruncated = true;
        }
      } else {
        uniqueCount += 1;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        total: source.totalRows,
        duplicates: duplicateCount,
        unique: uniqueCount,
        duplicateRecords,
        uniqueRecords: [],
        checkedFields: checkFields,
        samplesTruncated,
        scannedFromStaging: Boolean(stagingId),
      },
    });
  } catch (error) {
    console.error(`Check duplicates (${module}) error:`, error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Error checking for duplicates',
    });
  }
}

module.exports = {
  runDuplicateCheck,
};
