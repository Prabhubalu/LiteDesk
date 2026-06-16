import { targetRowFromStandard } from '@/constants/helpdeskSlaPolicy';

const CASE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export function minutesToHours(minutes) {
  return Math.max(1, Math.round(Number(minutes || 0) / 60));
}

export function hoursToMinutes(hours) {
  return Math.max(1, Math.round(Number(hours || 0) * 60));
}

export function buildPriorityTargetGrid(targets = [], priorities = CASE_PRIORITIES, standardTargets = {}) {
  const grid = {};
  for (const priority of priorities) {
    const response = targets.find((row) => row.milestoneKey === 'first_response' && row.priorityKey === priority);
    const resolution = targets.find((row) => row.milestoneKey === 'resolution' && row.priorityKey === priority);
    if (response || resolution) {
      grid[priority] = {
        responseHours: minutesToHours(response?.durationMinutes),
        resolutionHours: minutesToHours(resolution?.durationMinutes)
      };
      continue;
    }
    grid[priority] = targetRowFromStandard(priority, standardTargets, priorities);
  }
  return grid;
}

export function priorityGridToTargets(grid = {}, priorities = CASE_PRIORITIES) {
  const targets = [];
  for (const priority of priorities) {
    const row = grid[priority];
    if (!row) continue;
    if (Number(row.responseHours) > 0) {
      targets.push({
        milestoneKey: 'first_response',
        priorityKey: priority,
        durationMinutes: hoursToMinutes(row.responseHours)
      });
    }
    if (Number(row.resolutionHours) > 0) {
      targets.push({
        milestoneKey: 'resolution',
        priorityKey: priority,
        durationMinutes: hoursToMinutes(row.resolutionHours)
      });
    }
  }
  return targets;
}

export function genericCompletionHours(targets = []) {
  const resolution = targets.find((row) => row.milestoneKey === 'resolution');
  if (resolution?.durationMinutes) return minutesToHours(resolution.durationMinutes);
  const first = targets[0];
  if (first?.durationMinutes) return minutesToHours(first.durationMinutes);
  return 8;
}

export function completionHoursToTargets(hours, milestoneKey = 'resolution') {
  return [{
    milestoneKey,
    priorityKey: '',
    durationMinutes: hoursToMinutes(hours)
  }];
}

export { CASE_PRIORITIES };
