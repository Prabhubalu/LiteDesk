const {
  CASE_STATUSES,
  CASE_STATUS_TRANSITIONS,
  SLA_PAUSE_STATUSES
} = require('../constants/caseLifecycle');

const ACTIVE_SLA_STATUSES = new Set(['New', 'Assigned', 'In Progress']);
const SLA_PAUSE_STATUS_SET = new Set(SLA_PAUSE_STATUSES);

function isValidCaseStatus(status) {
  return CASE_STATUSES.includes(status);
}

function canTransitionCaseStatus(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  const allowed = CASE_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

function createInitialSlaCycle(cycleNo = 1, now = new Date()) {
  return {
    cycleNo,
    startedAt: now,
    pausedAt: null,
    pauseSegments: [],
    stoppedAt: null,
    status: 'running',
    responseTargetAt: null,
    responseMetAt: null,
    resolutionTargetAt: null,
    policySnapshot: {}
  };
}

function closeOpenPauseSegment(cycle, now) {
  if (cycle.status !== 'paused' || !cycle.pausedAt) return cycle;
  const segments = Array.isArray(cycle.pauseSegments) ? [...cycle.pauseSegments] : [];
  segments.push({ from: cycle.pausedAt, to: now });
  return {
    ...cycle,
    pauseSegments: segments,
    pausedAt: null
  };
}

function applyStatusToSlaCycle(currentCycle, nextStatus, now = new Date()) {
  let cycle = {
    ...currentCycle,
    pauseSegments: Array.isArray(currentCycle?.pauseSegments) ? [...currentCycle.pauseSegments] : []
  };

  if (SLA_PAUSE_STATUS_SET.has(nextStatus)) {
    if (cycle.status !== 'paused') {
      cycle.status = 'paused';
      cycle.pausedAt = now;
    }
    return cycle;
  }

  if (nextStatus === 'Resolved' || nextStatus === 'Closed') {
    cycle = closeOpenPauseSegment(cycle, now);
    cycle.status = 'stopped';
    if (!cycle.stoppedAt) cycle.stoppedAt = now;
    return cycle;
  }

  if (ACTIVE_SLA_STATUSES.has(nextStatus)) {
    cycle = closeOpenPauseSegment(cycle, now);
    cycle.status = 'running';
    return cycle;
  }

  return cycle;
}

function createReopenedSlaState(currentCycle, now = new Date()) {
  const previousCycle = {
    ...currentCycle,
    status: 'stopped',
    stoppedAt: currentCycle?.stoppedAt || now
  };

  const nextCycleNo = Number(currentCycle?.cycleNo || 0) + 1;
  return {
    previousCycle,
    nextCycle: createInitialSlaCycle(nextCycleNo, now)
  };
}

module.exports = {
  isValidCaseStatus,
  canTransitionCaseStatus,
  createInitialSlaCycle,
  applyStatusToSlaCycle,
  createReopenedSlaState
};
