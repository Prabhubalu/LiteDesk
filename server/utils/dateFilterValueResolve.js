'use strict';

/**
 * Resolve list-style DateFilterValue ({ preset, op, quick, date, … }) to a Mongo date condition
 * or test whether a field value matches that filter.
 * Shared by process / SLA / assignment / marketing evaluators.
 */

const { buildDateFieldQuery } = require('./listQueryBuilders/tasksListQuery');

const FAKE_FIELD = '__dateFilter';

function isDateFilterValue(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value.preset != null || value.op != null || value.quick != null)
  );
}

function toComparableDate(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Map DateFilterValue → query params consumed by buildDateFieldQuery.
 * @param {object} value
 * @returns {Record<string, unknown>}
 */
function dateFilterValueToQueryParams(value) {
  const params = {};
  if (!value || typeof value !== 'object') return params;

  if (value.quick === 'fromNow' || value.preset === 'fromNow') {
    params[`${FAKE_FIELD}Preset`] = 'fromNow';
    return params;
  }
  if (value.quick === 'beforeNow' || value.preset === 'beforeNow') {
    params[`${FAKE_FIELD}Preset`] = 'beforeNow';
    return params;
  }
  if (value.preset) {
    params[`${FAKE_FIELD}Preset`] = value.preset;
    return params;
  }
  if (value.op === 'empty') {
    params[`${FAKE_FIELD}Op`] = 'empty';
    return params;
  }
  if (value.op === 'notEmpty') {
    params[`${FAKE_FIELD}Op`] = 'notEmpty';
    return params;
  }
  if (value.op === 'lastDays' || value.op === 'nextDays') {
    params[`${FAKE_FIELD}Op`] = value.op;
    params[`${FAKE_FIELD}Days`] = value.days;
    return params;
  }
  if (value.op === 'on') {
    params[`${FAKE_FIELD}Op`] = 'on';
    params[FAKE_FIELD] = value.date;
    return params;
  }
  if (value.op === 'before') {
    params[`${FAKE_FIELD}Op`] = 'before';
    params[`${FAKE_FIELD}To`] = value.date;
    return params;
  }
  if (value.op === 'after') {
    params[`${FAKE_FIELD}Op`] = 'after';
    params[`${FAKE_FIELD}From`] = value.date;
    return params;
  }
  if (value.op === 'between') {
    params[`${FAKE_FIELD}Op`] = 'between';
    params[`${FAKE_FIELD}From`] = value.from;
    params[`${FAKE_FIELD}To`] = value.to;
    return params;
  }
  return params;
}

/**
 * @param {unknown} value
 * @returns {object|'EMPTY'|null} Mongo date condition ({ $gte, $lte }) or EMPTY
 */
function dateFilterValueToMongoCondition(value) {
  if (!isDateFilterValue(value)) return null;
  const params = dateFilterValueToQueryParams(value);
  if (Object.keys(params).length === 0) return null;
  return buildDateFieldQuery(FAKE_FIELD, params);
}

/**
 * Instant for gt/lt/before/after when the filter is open-ended or a point-in-time preset.
 * @param {object|'EMPTY'|null} cond
 * @returns {Date|null}
 */
function mongoConditionToInstant(cond) {
  if (!cond || cond === 'EMPTY') return null;
  if (cond.$gte && !cond.$lte) return cond.$gte;
  if (cond.$lte && !cond.$gte) return cond.$lte;
  if (cond.$gte) return cond.$gte;
  return null;
}

/**
 * Whether fieldValue falls inside the DateFilterValue window.
 * @param {unknown} fieldValue
 * @param {unknown} filterValue
 * @returns {boolean}
 */
function fieldMatchesDateFilterValue(fieldValue, filterValue) {
  const cond = dateFilterValueToMongoCondition(filterValue);
  if (cond === 'EMPTY') {
    return fieldValue == null || fieldValue === '';
  }
  if (!cond) return false;
  const d = toComparableDate(fieldValue);
  if (!d) return false;
  if (cond.$gte && d < cond.$gte) return false;
  if (cond.$lte && d > cond.$lte) return false;
  return true;
}

/**
 * Evaluate a compare operator when the RHS may be a DateFilterValue.
 * Falls back to null if RHS is not a date filter (caller should use scalar logic).
 * @returns {boolean|null}
 */
function evaluateDateFilterAwareCompare(fieldValue, operator, rightValue) {
  if (!isDateFilterValue(rightValue)) return null;

  const op = String(operator || 'equals').toLowerCase();
  const matches = fieldMatchesDateFilterValue(fieldValue, rightValue);

  if (
    op === 'equals' ||
    op === '==' ||
    op === '===' ||
    op === 'is'
  ) {
    return matches;
  }
  if (op === 'not_equals' || op === '!=' || op === '!==' || op === 'is_not') {
    return !matches;
  }

  const cond = dateFilterValueToMongoCondition(rightValue);
  const instant = mongoConditionToInstant(cond);
  const left = toComparableDate(fieldValue);
  if (!left || !instant) return false;

  if (op === 'before' || op === 'lt' || op === 'less_than') return left < instant;
  if (op === 'after' || op === 'gt' || op === 'greater_than') return left > instant;
  if (op === 'lte') return left <= instant;
  if (op === 'gte') return left >= instant;

  return matches;
}

module.exports = {
  isDateFilterValue,
  toComparableDate,
  dateFilterValueToQueryParams,
  dateFilterValueToMongoCondition,
  fieldMatchesDateFilterValue,
  evaluateDateFilterAwareCompare,
};
