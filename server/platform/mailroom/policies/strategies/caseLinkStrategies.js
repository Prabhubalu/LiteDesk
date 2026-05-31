/**
 * Case link policy — decides create / append / reopen / flag from candidates + policy only.
 */

const OPEN_STATUSES = new Set(['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer']);

function isOpenCase(caseRecord) {
  return caseRecord && OPEN_STATUSES.has(String(caseRecord.status || ''));
}

function daysBetween(a, b) {
  return Math.abs(a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000);
}

function evaluateCaseLink(message, candidates, caseLinkPolicy, options = {}) {
  const policy = caseLinkPolicy || {};
  const openCases = (candidates.openCases || []).filter(isOpenCase);
  const resolvedCases = candidates.resolvedCases || [];
  const trace = [];
  const threadingTarget = options.threadingTarget || null;

  if (candidates.explicitCaseId) {
    trace.push('explicit case id provided');
    return {
      action: 'append',
      caseId: candidates.explicitCaseId,
      reason: 'explicit_case',
      trace
    };
  }

  if (threadingTarget?.caseId) {
    const action = policy.onOpenCaseMatch?.action || 'append';
    trace.push(`threading target case: ${threadingTarget.caseId}`);
    return {
      action,
      caseId: threadingTarget.caseId,
      reason: 'threading_case_match',
      trace
    };
  }

  if (openCases.length > 0) {
    const target = openCases[0];
    const action = policy.onOpenCaseMatch?.action || 'append';
    trace.push(`open case match: ${target._id || target.id}`);
    return {
      action,
      caseId: target._id || target.id,
      reason: 'open_case_match',
      trace
    };
  }

  const reopenCfg = policy.onResolvedWithinDays || {};
  if (reopenCfg.enabled && resolvedCases.length > 0) {
    const days = Number(reopenCfg.days) || 7;
    const now = new Date();
    const recent = resolvedCases.find((c) => {
      const closedAt = c.closedAt || c.updatedAt || c.resolvedAt;
      if (!closedAt) return false;
      return daysBetween(now, new Date(closedAt)) <= days;
    });
    if (recent) {
      const action = reopenCfg.action || 'reopen';
      trace.push(`resolved case within ${days} days: ${recent._id || recent.id}`);
      return {
        action,
        caseId: recent._id || recent.id,
        reason: 'resolved_within_window',
        trace
      };
    }
  }

  const noMatchAction = policy.onNoMatch?.action || 'create_case';
  trace.push('no case match; applying onNoMatch');
  return {
    action: noMatchAction,
    caseId: null,
    reason: 'no_match',
    defaults: policy.defaults || {},
    trace
  };
}

module.exports = {
  evaluateCaseLink,
  isOpenCase,
  OPEN_STATUSES
};
