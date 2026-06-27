'use strict';

const mongoose = require('mongoose');
const FormResponse = require('../models/FormResponse');
const Form = require('../models/Form');
const { resolvePortalPersonContext } = require('./portalUserScopeService');

async function buildPortalResponseAccessQuery(organizationId, user) {
  const { contactIds, businessOrganizationId } = await resolvePortalPersonContext(
    organizationId,
    user
  );
  const scopedContactIds = [...contactIds];
  if (user?.peopleId) {
    scopedContactIds.push(user.peopleId);
  }
  const uniqueContactIds = [...new Set(scopedContactIds.map((id) => String(id)))];
  const or = [];

  if (user?._id) {
    or.push({ submittedBy: user._id });
  }
  if (businessOrganizationId) {
    or.push({
      'linkedTo.type': 'Organization',
      'linkedTo.id': businessOrganizationId
    });
  }
  if (uniqueContactIds.length) {
    or.push({
      'linkedTo.type': 'Contact',
      'linkedTo.id': { $in: uniqueContactIds }
    });
  }

  if (!or.length) {
    return { organizationId, _id: null };
  }

  return {
    organizationId,
    $or: or,
    $and: [
      {
        $or: [
          { archived: { $exists: false } },
          { archived: false },
          { archived: null }
        ]
      },
      {
        $or: [
          { invalidated: { $exists: false } },
          { invalidated: false },
          { invalidated: null }
        ]
      }
    ]
  };
}

function shapePortalResponseSummary(row, formMeta = {}) {
  return {
    _id: row._id,
    responseId: row.responseId,
    formId: row.formId,
    formMongoId: formMeta._id || row.formId,
    formName: formMeta.name || '',
    formType: formMeta.formType || '',
    executionStatus: row.executionStatus,
    reviewStatus: row.reviewStatus || '',
    submittedAt: row.submittedAt,
    finalScore: row.kpis?.finalScore ?? null,
    compliancePercentage: row.kpis?.compliancePercentage ?? null
  };
}

function shapePortalResponseDetail(row, formMeta = {}) {
  return {
    ...shapePortalResponseSummary(row, formMeta),
    satisfactionPercentage: row.kpis?.satisfactionPercentage ?? null,
    rating: row.kpis?.rating ?? null,
    totalQuestions: row.kpis?.totalQuestions ?? 0,
    totalPassed: row.kpis?.totalPassed ?? 0,
    totalFailed: row.kpis?.totalFailed ?? 0
  };
}

async function listPortalResponses(organizationId, user, { limit = 25, skip = 0 } = {}) {
  const query = await buildPortalResponseAccessQuery(organizationId, user);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safeSkip = Math.max(Number(skip) || 0, 0);

  const [rows, total] = await Promise.all([
    FormResponse.find(query)
      .select(
        'responseId formId executionStatus reviewStatus submittedAt kpis.finalScore kpis.compliancePercentage'
      )
      .sort({ submittedAt: -1 })
      .skip(safeSkip)
      .limit(safeLimit)
      .lean(),
    FormResponse.countDocuments(query)
  ]);

  const formIds = [...new Set(rows.map((row) => String(row.formId)).filter(Boolean))];
  const forms = formIds.length
    ? await Form.find({ _id: { $in: formIds }, organizationId })
        .select('_id name formType')
        .lean()
    : [];
  const formById = new Map(forms.map((form) => [String(form._id), form]));

  return {
    rows: rows.map((row) => shapePortalResponseSummary(row, formById.get(String(row.formId)) || {})),
    total
  };
}

const IN_PROGRESS_STATUSES = ['In Progress', 'Not Started'];

function shapePortalFormFillResponse(row) {
  if (!row) return null;
  return {
    _id: row._id,
    responseId: row.responseId,
    formId: row.formId,
    executionStatus: row.executionStatus,
    reviewStatus: row.reviewStatus || '',
    submittedAt: row.submittedAt,
    responseDetails: Array.isArray(row.responseDetails) ? row.responseDetails : []
  };
}

async function getPortalFormResponseForFill(organizationId, formId, responseId, user) {
  const id = String(responseId || '').trim();
  if (!formId || !id || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const query = await buildPortalResponseAccessQuery(organizationId, user);
  const row = await FormResponse.findOne({
    ...query,
    _id: id,
    formId
  })
    .select('responseId formId executionStatus reviewStatus submittedAt responseDetails')
    .lean();

  return shapePortalFormFillResponse(row);
}

async function findPortalInProgressFormResponse(organizationId, formId, user) {
  if (!formId) return null;

  const query = await buildPortalResponseAccessQuery(organizationId, user);
  const row = await FormResponse.findOne({
    ...query,
    formId,
    executionStatus: { $in: IN_PROGRESS_STATUSES }
  })
    .sort({ updatedAt: -1 })
    .select('responseId formId executionStatus reviewStatus submittedAt responseDetails')
    .lean();

  return shapePortalFormFillResponse(row);
}

async function getPortalResponseById(organizationId, responseId, user) {
  const id = String(responseId || '').trim();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const query = await buildPortalResponseAccessQuery(organizationId, user);
  const row = await FormResponse.findOne({
    ...query,
    _id: id
  })
    .select(
      'responseId formId executionStatus reviewStatus submittedAt kpis.finalScore kpis.compliancePercentage kpis.satisfactionPercentage kpis.rating kpis.totalQuestions kpis.totalPassed kpis.totalFailed'
    )
    .lean();

  if (!row) return null;

  const form = await Form.findOne({ _id: row.formId, organizationId })
    .select('_id name formType visibility status')
    .lean();

  return shapePortalResponseDetail(row, form || {});
}

module.exports = {
  buildPortalResponseAccessQuery,
  listPortalResponses,
  getPortalResponseById,
  getPortalFormResponseForFill,
  findPortalInProgressFormResponse,
  shapePortalResponseSummary,
  shapePortalResponseDetail,
  shapePortalFormFillResponse
};
