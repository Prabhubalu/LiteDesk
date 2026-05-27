function parsePositiveInt(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  const normalized = Math.floor(parsed);
  return typeof max === 'number' ? Math.min(normalized, max) : normalized;
}

function toArrayFilterValue(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseCaseListQuery(query, { CASE_STATUSES, CASE_PRIORITIES, CASE_TYPES, CASE_CHANNELS }) {
  const filters = {};
  const errors = [];

  const statusFilters = toArrayFilterValue(query.status);
  if (statusFilters.length > 0) {
    const invalidStatus = statusFilters.find((status) => !CASE_STATUSES.includes(status));
    if (invalidStatus) {
      errors.push('Invalid status filter');
    } else {
      filters.status = statusFilters.length === 1 ? statusFilters[0] : { $in: statusFilters };
    }
  }

  if (query.priority != null && query.priority !== '') {
    if (!CASE_PRIORITIES.includes(query.priority)) {
      errors.push('Invalid priority filter');
    } else {
      filters.priority = query.priority;
    }
  }

  if (query.caseType != null && query.caseType !== '') {
    if (!CASE_TYPES.includes(query.caseType)) {
      errors.push('Invalid caseType filter');
    } else {
      filters.caseType = query.caseType;
    }
  }

  if (query.channel != null && query.channel !== '') {
    if (!CASE_CHANNELS.includes(query.channel)) {
      errors.push('Invalid channel filter');
    } else {
      filters.channel = query.channel;
    }
  }

  if (query.caseOwnerId != null && query.caseOwnerId !== '') {
    filters.caseOwnerId = query.caseOwnerId;
  }
  if (query.slaBreached != null && query.slaBreached !== '') {
    const normalizedSlaBreached = String(query.slaBreached).trim().toLowerCase();
    if (normalizedSlaBreached === 'true') filters.slaBreached = true;
    else if (normalizedSlaBreached === 'false') filters.slaBreached = false;
    else errors.push('Invalid slaBreached filter');
  }
  if (query.updatedWithinDays != null && query.updatedWithinDays !== '') {
    const days = parsePositiveInt(query.updatedWithinDays, -1, 365);
    if (days < 0) {
      errors.push('Invalid updatedWithinDays filter');
    } else {
      const now = new Date();
      filters.updatedAt = {
        $gte: new Date(now.getTime() - (days * 24 * 60 * 60 * 1000))
      };
    }
  }

  const allowedSortBy = new Set(['updatedAt', 'createdAt', 'priority', 'status']);
  const sortBy = allowedSortBy.has(query.sortBy) ? query.sortBy : 'updatedAt';
  const sortDir = String(query.sortDir || 'desc').toLowerCase() === 'asc' ? 1 : -1;

  return {
    errors,
    filters,
    limit: Math.max(1, parsePositiveInt(query.limit, 50, 200)),
    skip: parsePositiveInt(query.skip, 0, 100000),
    sort: { [sortBy]: sortDir }
  };
}

module.exports = {
  parseCaseListQuery
};
