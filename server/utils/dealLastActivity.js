/**
 * Deal Last Activity — engagement timestamp for list/sort/staleness.
 * Counts sales engagement, not every field edit.
 */

const NON_ENGAGEMENT_ACTIONS = new Set([
  'field_changed',
  'restored description version',
]);

const KNOWN_ENGAGEMENT_ACTIONS = new Set([
  'created',
  'changed stage',
  'added a note',
  'edited a note',
  'added a comment',
  'edited a comment',
]);

/**
 * @param {unknown} action
 * @returns {boolean}
 */
function isDealEngagementAction(action) {
  const normalized = String(action || '')
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  if (NON_ENGAGEMENT_ACTIONS.has(normalized)) return false;
  if (KNOWN_ENGAGEMENT_ACTIONS.has(normalized)) return true;
  // Explicit activity-log entries (calls, meetings, custom) count as engagement
  return true;
}

/**
 * @param {object|null|undefined} record
 * @returns {{ lastActivityDate: Date|null, lastActivityAction: string|null }}
 */
function resolveDealLastActivity(record) {
  const logs = Array.isArray(record?.activityLogs) ? record.activityLogs : [];
  let bestTs = null;
  let bestAction = null;

  for (const log of logs) {
    if (!isDealEngagementAction(log?.action)) continue;
    const ts = log?.timestamp ? new Date(log.timestamp).getTime() : NaN;
    if (!Number.isFinite(ts)) continue;
    if (bestTs == null || ts > bestTs) {
      bestTs = ts;
      bestAction = typeof log.action === 'string' ? log.action : null;
    }
  }

  const storedTs = record?.lastActivityDate
    ? new Date(record.lastActivityDate).getTime()
    : NaN;

  if (bestTs != null) {
    if (Number.isFinite(storedTs) && storedTs > bestTs) {
      return {
        lastActivityDate: new Date(storedTs),
        lastActivityAction: bestAction,
      };
    }
    return {
      lastActivityDate: new Date(bestTs),
      lastActivityAction: bestAction,
    };
  }

  if (Number.isFinite(storedTs)) {
    return {
      lastActivityDate: new Date(storedTs),
      lastActivityAction: null,
    };
  }

  const createdTs = record?.createdAt ? new Date(record.createdAt).getTime() : NaN;
  if (Number.isFinite(createdTs)) {
    return {
      lastActivityDate: new Date(createdTs),
      lastActivityAction: 'created',
    };
  }

  return { lastActivityDate: null, lastActivityAction: null };
}

/**
 * @param {object} deal — mongoose doc or plain object
 * @param {Date} [at]
 */
function touchDealLastActivity(deal, at = new Date()) {
  if (!deal) return;
  deal.lastActivityDate = at;
}

/**
 * @param {object} deal — mongoose doc or plain object
 * @returns {object}
 */
function attachDealLastActivity(deal) {
  if (!deal) return deal;
  const plain = typeof deal.toObject === 'function' ? deal.toObject() : { ...deal };
  const resolved = resolveDealLastActivity(plain);
  plain.lastActivityDate = resolved.lastActivityDate;
  plain.lastActivityAction = resolved.lastActivityAction;
  return plain;
}

module.exports = {
  isDealEngagementAction,
  resolveDealLastActivity,
  touchDealLastActivity,
  attachDealLastActivity,
  KNOWN_ENGAGEMENT_ACTIONS,
  NON_ENGAGEMENT_ACTIONS,
};
