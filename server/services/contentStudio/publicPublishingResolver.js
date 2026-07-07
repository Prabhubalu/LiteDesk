'use strict';

const Organization = require('../../models/Organization');

async function resolveOrganizationForPublic(orgKey) {
  const key = String(orgKey || '').trim().toLowerCase();
  if (!key) return null;

  return Organization.findOne({ isTenant: true, slug: key })
    .select('_id slug name contentPublishing')
    .lean();
}

module.exports = {
  resolveOrganizationForPublic,
};
