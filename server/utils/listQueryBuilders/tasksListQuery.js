const { getProjection } = require('../moduleProjectionResolver');
const { applyProjectionFilter } = require('../appProjectionQuery');

/**
 * Build a Mongo date-range condition from list query params for a field prefix
 * (e.g. dueDate → dueDatePreset / dueDateOp / dueDateFrom / …).
 * @returns {object|'EMPTY'|null}
 */
function buildDateFieldQuery(fieldPrefix, queryParams) {
  const now = new Date();
  const preset = queryParams[`${fieldPrefix}Preset`];
  const op = queryParams[`${fieldPrefix}Op`];
  const rawSingle = queryParams[fieldPrefix];
  const singleDate = (rawSingle && String(rawSingle) !== 'null') ? rawSingle : null;
  const from = (queryParams[`${fieldPrefix}From`] && String(queryParams[`${fieldPrefix}From`]) !== 'null')
    ? queryParams[`${fieldPrefix}From`]
    : null;
  const to = (queryParams[`${fieldPrefix}To`] && String(queryParams[`${fieldPrefix}To`]) !== 'null')
    ? queryParams[`${fieldPrefix}To`]
    : null;
  const days = parseInt(queryParams[`${fieldPrefix}Days`], 10);

  if (preset) {
    let start;
    let end;
    if (preset === 'today') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      end.setMilliseconds(-1);
    } else if (preset === 'thisWeek') {
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
      end.setMilliseconds(-1);
    } else if (preset === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (preset === 'thisQuarter') {
      const q = Math.floor(now.getMonth() / 3) + 1;
      start = new Date(now.getFullYear(), (q - 1) * 3, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999);
    } else if (preset === 'thisYear') {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (preset === 'fromNow') {
      return { $gte: now };
    } else if (preset === 'beforeNow') {
      return { $lte: new Date(now.getTime() - 1000) };
    } else {
      return null;
    }
    return { $gte: start, $lte: end };
  }

  if (op === 'empty') {
    return 'EMPTY';
  }
  if (op === 'notEmpty') {
    return { $exists: true, $ne: null };
  }
  if (op === 'lastDays' && !Number.isNaN(days) && days >= 1) {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    return { $gte: start, $lte: end };
  }
  if (op === 'nextDays' && !Number.isNaN(days) && days >= 1) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() + days);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end };
  }
  if (op === 'on' && singleDate) {
    const d = new Date(singleDate);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end };
  }
  if (op === 'before' && (singleDate || to)) {
    const dateStr = singleDate || to;
    const d = new Date(dateStr);
    d.setHours(23, 59, 59, 999);
    return { $lte: d };
  }
  if (op === 'after' && (singleDate || from)) {
    const dateStr = singleDate || from;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return { $gte: d };
  }
  if (op === 'between' && from && to) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end };
  }

  if (singleDate && !op) {
    const date = new Date(singleDate);
    if (Number.isNaN(date.getTime())) return null;
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end };
  }
  return null;
}

function buildDueDateQuery(queryParams) {
  return buildDateFieldQuery('dueDate', queryParams);
}

function appendDateFieldCondition(query, fieldName, queryParams, fieldPrefix = fieldName) {
  const condition = buildDateFieldQuery(fieldPrefix, queryParams);
  if (condition === 'EMPTY') {
    return {
      $and: [
        query,
        { $or: [{ [fieldName]: null }, { [fieldName]: { $exists: false } }] },
      ],
    };
  }
  if (condition) {
    query[fieldName] = condition;
  }
  return query;
}

function buildTasksListQuery(req) {
  const {
    status,
    priority,
    assignedTo,
    projectId,
    contactId,
    organizationId,
    overdue,
    open,
    dueToday,
    search,
  } = req.query;

  let query = { organizationId: req.user.organizationId, deletedAt: null };

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assignedTo) {
    if (assignedTo === 'unassigned' || assignedTo === 'null') {
      query = {
        $and: [
          query,
          { $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] },
        ],
      };
    } else {
      query.assignedTo = assignedTo === 'me' ? req.user._id : assignedTo;
    }
  }
  if (projectId) query.projectId = projectId;
  if (contactId) {
    query['relatedTo.type'] = 'contact';
    query['relatedTo.id'] = contactId;
  }
  if (organizationId) {
    query['relatedTo.type'] = 'organization';
    query['relatedTo.id'] = organizationId;
  }

  query = appendDateFieldCondition(query, 'dueDate', req.query);
  query = appendDateFieldCondition(query, 'createdAt', req.query);
  query = appendDateFieldCondition(query, 'updatedAt', req.query);

  if (overdue === 'true') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    query.dueDate = { $lt: start };
    query.status = { $nin: ['completed', 'cancelled'] };
  }

  if (open === 'true' || dueToday === 'true') {
    query.status = { $nin: ['completed', 'cancelled'] };
  }

  if (dueToday === 'true') {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setMilliseconds(-1);
    query.dueDate = { $gte: start, $lte: end };
  }

  const { buildSearchOrConditions } = require('../searchRelevance');
  const directSearchTerm = search ? String(search).trim() : '';
  if (directSearchTerm) {
    query.$or = buildSearchOrConditions(directSearchTerm, ['title', 'description', 'tags']);
  }

  const appKey = req.appKey || 'SALES';
  const moduleKey = 'tasks';
  const projectionMeta = getProjection(appKey, moduleKey);
  query = applyProjectionFilter({
    appKey,
    moduleKey,
    baseQuery: query,
    projectionMeta,
  });

  const { applyListFilterQueryParam } = require('../listFilterQuery');
  query = applyListFilterQueryParam(query, req.query, 'tasks', { userId: req.user?._id });

  return query;
}

module.exports = {
  buildDateFieldQuery,
  buildDueDateQuery,
  buildTasksListQuery,
};
