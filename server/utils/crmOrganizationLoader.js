'use strict';

const mongoose = require('mongoose');
const Organization = require('../models/Organization');

/** Fields exposed on Organization.* merge tags for related CRM companies. */
const ORGANIZATION_MERGE_SELECT = 'name industry website phone address annualRevenue numberOfEmployees types slug email city state postalCode country isTenant';

function normalizeObjectIdString(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

/**
 * Load a CRM business organization (isTenant: false) for merge tags.
 * @param {string} tenantOrganizationId
 * @param {unknown} crmOrganizationId
 */
async function loadCrmOrganizationById(tenantOrganizationId, crmOrganizationId) {
  const id = normalizeObjectIdString(crmOrganizationId);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;

  const { buildTenantAccessibleCrmOrganizationQuery } = require('./crmOrganizationAccess');
  const query = await buildTenantAccessibleCrmOrganizationQuery(tenantOrganizationId, {
    recordIds: [id]
  });

  return Organization.findOne(query).select(ORGANIZATION_MERGE_SELECT).lean();
}

module.exports = {
  ORGANIZATION_MERGE_SELECT,
  loadCrmOrganizationById
};
