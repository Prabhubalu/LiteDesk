'use strict';

const mongoose = require('mongoose');
const Event = require('../models/Event');
const FormResponse = require('../models/FormResponse');
const { resolvePortalPersonContext } = require('./portalUserScopeService');

const AUDIT_EVENT_TYPES = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'];

function buildPortalAuditAccessQueryFromContext(organizationId, { businessOrganizationId, userId } = {}) {
  const or = [];

  if (businessOrganizationId) {
    or.push({ relatedToId: businessOrganizationId });
    or.push({
      isMultiOrg: true,
      'orgList.organizationId': businessOrganizationId
    });
  }

  if (userId) {
    or.push({ correctiveOwnerId: userId });
  }

  if (!or.length) {
    return { organizationId, _id: null };
  }

  return {
    organizationId,
    eventType: { $in: AUDIT_EVENT_TYPES },
    $or: or
  };
}

/**
 * Audits visible to a portal user: linked to their business org, on a beat route
 * including that org, or where they are the assigned corrective owner.
 */
async function buildPortalAuditAccessQuery(organizationId, user) {
  const { businessOrganizationId } = await resolvePortalPersonContext(organizationId, user);
  return buildPortalAuditAccessQueryFromContext(organizationId, {
    businessOrganizationId,
    userId: user?._id
  });
}

async function findPortalAccessibleEvent(organizationId, eventKey, user) {
  const base = await buildPortalAuditAccessQuery(organizationId, user);
  const id = String(eventKey || '').trim();
  if (!id) return null;

  if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
    return Event.findOne({ ...base, _id: id }).lean();
  }

  return Event.findOne({ ...base, eventId: id }).lean();
}

async function listPortalAccessibleEvents(organizationId, user, { select, sort, limit, skip } = {}) {
  const base = await buildPortalAuditAccessQuery(organizationId, user);
  let query = Event.find(base);
  if (select) query = query.select(select);
  if (sort) query = query.sort(sort);
  if (skip) query = query.skip(skip);
  if (limit) query = query.limit(limit);
  return query.lean();
}

async function countPortalAccessibleEvents(organizationId, user, extraQuery = {}) {
  const base = await buildPortalAuditAccessQuery(organizationId, user);
  return Event.countDocuments({ ...base, ...extraQuery });
}

async function countOpenCorrectiveActionsForUser(organizationId, user) {
  const events = await Event.find(await buildPortalAuditAccessQuery(organizationId, user))
    .select('_id')
    .lean();
  const eventIds = events.map((event) => event._id);
  if (!eventIds.length) return 0;

  const formResponses = await FormResponse.find({
    'linkedTo.type': 'Event',
    'linkedTo.id': { $in: eventIds },
    organizationId
  })
    .select('correctiveActions')
    .lean();

  let openActions = 0;
  formResponses.forEach((response) => {
    (response.correctiveActions || []).forEach((action) => {
      const status = String(action.managerAction?.status || 'open')
        .toLowerCase()
        .replace(/\s+/g, '_');
      if (status === 'open' || status === 'in_progress') {
        openActions += 1;
      }
    });
  });
  return openActions;
}

module.exports = {
  AUDIT_EVENT_TYPES,
  buildPortalAuditAccessQueryFromContext,
  buildPortalAuditAccessQuery,
  findPortalAccessibleEvent,
  listPortalAccessibleEvents,
  countPortalAccessibleEvents,
  countOpenCorrectiveActionsForUser
};
