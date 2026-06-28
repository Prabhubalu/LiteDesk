const { applyProjectionFilter } = require('../appProjectionQuery');
const { getProjection } = require('../moduleProjectionResolver');

function buildEventsListQuery(req) {
  const {
    startDateTime,
    endDateTime,
    eventType,
    status,
    search,
    relatedId,
    scope,
  } = req.query;

  let query = { organizationId: req.user.organizationId, deletedAt: null };

  if (req.query.appointmentOnly === 'true' || req.query.appointmentOnly === true) {
    query['appointment.isAppointment'] = true;
  }

  if (startDateTime || endDateTime) {
    query.startDateTime = {};
    if (startDateTime) query.startDateTime.$gte = new Date(startDateTime);
    if (endDateTime) query.startDateTime.$lte = new Date(endDateTime);
  }

  if (eventType) query.eventType = eventType;

  if (status) {
    const normalizedStatus = status.trim();
    const validStatuses = ['Planned', 'Completed', 'Cancelled'];
    if (validStatuses.includes(normalizedStatus)) {
      query.status = normalizedStatus;
    } else {
      const legacyMap = {
        PLANNED: 'Planned',
        STARTED: 'Planned',
        CHECKED_IN: 'Planned',
        IN_PROGRESS: 'Planned',
        PAUSED: 'Planned',
        CHECKED_OUT: 'Planned',
        SUBMITTED: 'Planned',
        PENDING_CORRECTIVE: 'Planned',
        NEEDS_REVIEW: 'Planned',
        REJECTED: 'Planned',
        APPROVED: 'Completed',
        CLOSED: 'Completed',
        COMPLETED: 'Completed',
        CANCELLED: 'Cancelled',
        CANCELED: 'Cancelled',
      };
      if (legacyMap[normalizedStatus.toUpperCase()]) {
        query.status = legacyMap[normalizedStatus.toUpperCase()];
      }
    }
  }

  if (relatedId) query.relatedToId = relatedId;

  if (scope === 'mine') {
    const currentUserId = req.user._id;
    query.$or = [
      { assignedTo: currentUserId },
      { auditorId: currentUserId },
      { reviewerId: currentUserId },
      { correctiveOwnerId: currentUserId },
      { createdBy: currentUserId },
    ];
  }

  const { buildSearchOrConditions } = require('../searchRelevance');
  const directSearchTerm = search ? String(search).trim() : '';
  if (directSearchTerm) {
    const searchConditions = buildSearchOrConditions(directSearchTerm, ['eventName', 'location', 'notes.text']);
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchConditions }];
      delete query.$or;
    } else {
      query.$or = searchConditions;
    }
  }

  const appKey = req.appKey || 'SALES';
  const moduleKey = 'events';
  const projectionMeta = getProjection(appKey, moduleKey);
  query = applyProjectionFilter({
    appKey,
    moduleKey,
    baseQuery: query,
    projectionMeta,
  });

  const { applyListFilterQueryParam } = require('../listFilterQuery');
  query = applyListFilterQueryParam(query, req.query, 'events', { userId: req.user?._id });

  return query;
}

module.exports = {
  buildEventsListQuery,
};
