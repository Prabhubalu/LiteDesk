'use strict';

const mongoose = require('mongoose');
const Form = require('../models/Form');

const PORTAL_FORM_VISIBILITIES = ['Partner', 'Public'];
const PORTAL_FORM_STATUSES = ['Active', 'Ready'];

async function assertPortalFormAccessible(organizationId, formId) {
  const id = String(formId || '').trim();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const form = await Form.findOne({
    _id: id,
    organizationId,
    status: { $in: PORTAL_FORM_STATUSES },
    visibility: { $in: PORTAL_FORM_VISIBILITIES }
  })
    .select('_id formId name description formType status visibility')
    .lean();

  return form;
}

async function listPortalAccessibleForms(organizationId, { limit = 25, skip = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safeSkip = Math.max(Number(skip) || 0, 0);

  const query = {
    organizationId,
    status: { $in: PORTAL_FORM_STATUSES },
    visibility: { $in: PORTAL_FORM_VISIBILITIES }
  };

  const [rows, total] = await Promise.all([
    Form.find(query)
      .select('formId name description formType status visibility updatedAt')
      .sort({ updatedAt: -1 })
      .skip(safeSkip)
      .limit(safeLimit)
      .lean(),
    Form.countDocuments(query)
  ]);

  return {
    rows: rows.map((row) => ({
      _id: row._id,
      formId: row.formId,
      name: row.name,
      description: row.description || '',
      formType: row.formType,
      status: row.status,
      visibility: row.visibility,
      updatedAt: row.updatedAt
    })),
    total
  };
}

module.exports = {
  assertPortalFormAccessible,
  listPortalAccessibleForms,
  PORTAL_FORM_VISIBILITIES,
  PORTAL_FORM_STATUSES
};
