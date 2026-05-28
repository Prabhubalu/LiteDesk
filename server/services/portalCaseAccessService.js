const People = require('../models/People');
const Case = require('../models/Case');
const { getPortalUserEmail } = require('../platform/mailroom/connectors/portal/portalSafety');
const { resolvePortalAudience } = require('../platform/mailroom/connectors/portal/portalAudience');
const { mergePortalConnector } = require('../platform/mailroom/connectors/portal/portalConnectorDefaults');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolvePortalContactIds(organizationId, userEmail) {
  if (!userEmail) return [];
  const rows = await People.find({
    organizationId,
    deletedAt: null,
    email: new RegExp(`^${escapeRegex(userEmail)}$`, 'i')
  })
    .select('_id')
    .lean();
  return rows.map((r) => r._id);
}

async function buildCustomerCaseAccessQuery(organizationId, user) {
  const email = getPortalUserEmail(user);
  const contactIds = await resolvePortalContactIds(organizationId, email);
  const or = [];
  if (email) {
    or.push({ requesterEmail: new RegExp(`^${escapeRegex(email)}$`, 'i') });
  }
  if (contactIds.length) {
    or.push({ contactId: { $in: contactIds } });
  }
  if (!or.length) {
    return { organizationId, deletedAt: null, _id: null };
  }
  return {
    organizationId,
    deletedAt: null,
    $or: or
  };
}

/**
 * Partner users: cases linked to their contact record or customer organization they represent.
 */
async function buildPartnerCaseAccessQuery(organizationId, user) {
  const email = getPortalUserEmail(user);
  const or = [];

  const person = email
    ? await People.findOne({
      organizationId,
      deletedAt: null,
      email: new RegExp(`^${escapeRegex(email)}$`, 'i')
    })
      .select('_id organizationId')
      .lean()
    : null;

  if (person?._id) {
    or.push({ contactId: person._id });
  }
  if (person?.organizationId) {
    or.push({ organizationRefId: person.organizationId });
  }
  if (email) {
    or.push({ requesterEmail: new RegExp(`^${escapeRegex(email)}$`, 'i') });
  }

  if (!or.length) {
    return { organizationId, deletedAt: null, _id: null };
  }
  return {
    organizationId,
    deletedAt: null,
    $or: or
  };
}

async function buildPortalCaseAccessQuery(organizationId, user, options = {}) {
  const portalConfig = mergePortalConnector(options.portalConfig || {});
  const audience = options.audience
    || await resolvePortalAudience(user, portalConfig);

  if (audience === 'partner') {
    return buildPartnerCaseAccessQuery(organizationId, user);
  }
  return buildCustomerCaseAccessQuery(organizationId, user);
}

async function findPortalAccessibleCase(organizationId, caseId, user, options = {}) {
  const base = await buildPortalCaseAccessQuery(organizationId, user, options);
  return Case.findOne({
    ...base,
    _id: caseId
  }).lean();
}

function filterPortalActivities(activities = []) {
  return activities.filter((act) => act && act.internal !== true);
}

function shapePortalCaseSummary(row) {
  return {
    _id: row._id,
    caseId: row.caseId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    channel: row.channel,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function shapePortalCaseDetail(row, activities) {
  return {
    ...shapePortalCaseSummary(row),
    requesterEmail: row.requesterEmail,
    activities: filterPortalActivities(activities)
  };
}

module.exports = {
  buildPortalCaseAccessQuery,
  buildCustomerCaseAccessQuery,
  buildPartnerCaseAccessQuery,
  findPortalAccessibleCase,
  filterPortalActivities,
  shapePortalCaseSummary,
  shapePortalCaseDetail,
  resolvePortalAudience
};
