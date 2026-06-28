function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffMinutes(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e || e < s) return null;
  return Math.round((e.getTime() - s.getTime()) / 60000);
}

function collectCycles(caseRecord) {
  const historical = Array.isArray(caseRecord.slaCycles) ? caseRecord.slaCycles : [];
  const current = caseRecord.currentSlaCycle ? [caseRecord.currentSlaCycle] : [];
  return [...historical, ...current];
}

function computeResolutionMetrics(cases) {
  let totalCycles = 0;
  let compliantCycles = 0;
  let totalResolutionMinutes = 0;
  let resolvedCycleCount = 0;
  let breachedCycles = 0;

  for (const row of cases) {
    for (const cycle of collectCycles(row)) {
      const stoppedAt = toDate(cycle.stoppedAt);
      if (!stoppedAt) continue;
      totalCycles += 1;
      const targetAt = toDate(cycle.resolutionTargetAt);
      if (targetAt) {
        if (stoppedAt <= targetAt) compliantCycles += 1;
        else breachedCycles += 1;
      }
      const minutes = diffMinutes(cycle.startedAt, stoppedAt);
      if (minutes != null) {
        totalResolutionMinutes += minutes;
        resolvedCycleCount += 1;
      }
    }
  }

  return {
    totalCycles,
    compliantCycles,
    breachedCycles,
    slaCompliancePercent: totalCycles > 0 ? Math.round((compliantCycles / totalCycles) * 100) : 0,
    averageResolutionMinutes: resolvedCycleCount > 0 ? Math.round(totalResolutionMinutes / resolvedCycleCount) : null
  };
}

function computeResponseMetrics(cases) {
  let totalMinutes = 0;
  let count = 0;
  for (const row of cases) {
    const createdAt = toDate(row.createdAt);
    if (!createdAt) continue;
    const activities = Array.isArray(row.activities) ? row.activities : [];
    const firstExternal = activities
      .map((activity) => ({
        internal: Boolean(activity.internal),
        at: toDate(activity.createdAt)
      }))
      .filter((entry) => entry.at)
      .sort((a, b) => a.at - b.at)
      .find((entry) => entry.internal === false);
    if (!firstExternal?.at) continue;
    const minutes = diffMinutes(createdAt, firstExternal.at);
    if (minutes != null) {
      totalMinutes += minutes;
      count += 1;
    }
  }
  return {
    averageFirstResponseMinutes: count > 0 ? Math.round(totalMinutes / count) : null,
    measuredCases: count
  };
}

function toUtcDateKey(value) {
  const date = toDate(value);
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function enumerateDateKeys(from, to) {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end || start > end) return [];
  const keys = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= endDay) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function computeDailyTrends(cases, { from, to }) {
  const keys = enumerateDateKeys(from, to);
  const map = new Map(keys.map((key) => [key, { date: key, created: 0, resolved: 0, breached: 0 }]));

  for (const row of cases) {
    const createdKey = toUtcDateKey(row.createdAt);
    if (createdKey && map.has(createdKey)) {
      map.get(createdKey).created += 1;
    }

    for (const cycle of collectCycles(row)) {
      const stoppedAt = toDate(cycle.stoppedAt);
      if (!stoppedAt) continue;
      const resolvedKey = toUtcDateKey(stoppedAt);
      if (!resolvedKey || !map.has(resolvedKey)) continue;
      map.get(resolvedKey).resolved += 1;

      const targetAt = toDate(cycle.resolutionTargetAt);
      if (targetAt && stoppedAt > targetAt) {
        map.get(resolvedKey).breached += 1;
      }
    }
  }

  return keys.map((key) => map.get(key));
}

function computeOwnerPerformance(cases) {
  const buckets = new Map();

  for (const row of cases) {
    const assignedTo = row.assignedTo ? String(row.assignedTo) : null;
    if (!assignedTo) continue;
    if (!buckets.has(assignedTo)) {
      buckets.set(assignedTo, {
        assignedTo,
        totalCases: 0,
        openCases: 0,
        reopenedCases: 0,
        resolvedCycles: 0,
        compliantCycles: 0,
        totalResolutionMinutes: 0
      });
    }
    const bucket = buckets.get(assignedTo);
    bucket.totalCases += 1;
    if (!['Resolved', 'Closed'].includes(row.status)) {
      bucket.openCases += 1;
    }
    if (Array.isArray(row.slaCycles) && row.slaCycles.length > 0) {
      bucket.reopenedCases += 1;
    }

    for (const cycle of collectCycles(row)) {
      const stoppedAt = toDate(cycle.stoppedAt);
      if (!stoppedAt) continue;
      bucket.resolvedCycles += 1;
      const targetAt = toDate(cycle.resolutionTargetAt);
      if (targetAt && stoppedAt <= targetAt) {
        bucket.compliantCycles += 1;
      }
      const minutes = diffMinutes(cycle.startedAt, stoppedAt);
      if (minutes != null) {
        bucket.totalResolutionMinutes += minutes;
      }
    }
  }

  return Array.from(buckets.values()).map((bucket) => ({
    assignedTo: bucket.assignedTo,
    totalCases: bucket.totalCases,
    openCases: bucket.openCases,
    reopenRatePercent: bucket.totalCases > 0 ? Math.round((bucket.reopenedCases / bucket.totalCases) * 100) : 0,
    resolvedCycles: bucket.resolvedCycles,
    slaCompliancePercent: bucket.resolvedCycles > 0
      ? Math.round((bucket.compliantCycles / bucket.resolvedCycles) * 100)
      : 0,
    averageResolutionMinutes: bucket.resolvedCycles > 0
      ? Math.round(bucket.totalResolutionMinutes / bucket.resolvedCycles)
      : null
  }));
}

function computeSegmentPerformance(cases, segmentKey) {
  const buckets = new Map();

  for (const row of cases) {
    const segmentValue = row?.[segmentKey];
    const key = segmentValue ? String(segmentValue) : 'Unknown';
    if (!buckets.has(key)) {
      buckets.set(key, {
        segment: key,
        totalCases: 0,
        resolvedCycles: 0,
        compliantCycles: 0,
        breachedCycles: 0
      });
    }

    const bucket = buckets.get(key);
    bucket.totalCases += 1;

    for (const cycle of collectCycles(row)) {
      const stoppedAt = toDate(cycle.stoppedAt);
      if (!stoppedAt) continue;
      bucket.resolvedCycles += 1;
      const targetAt = toDate(cycle.resolutionTargetAt);
      if (targetAt && stoppedAt <= targetAt) {
        bucket.compliantCycles += 1;
      } else if (targetAt) {
        bucket.breachedCycles += 1;
      }
    }
  }

  return Array.from(buckets.values()).map((bucket) => ({
    segment: bucket.segment,
    totalCases: bucket.totalCases,
    resolvedCycles: bucket.resolvedCycles,
    compliantCycles: bucket.compliantCycles,
    breachedCycles: bucket.breachedCycles,
    slaCompliancePercent: bucket.resolvedCycles > 0
      ? Math.round((bucket.compliantCycles / bucket.resolvedCycles) * 100)
      : 0
  }));
}

module.exports = {
  computeResolutionMetrics,
  computeResponseMetrics,
  computeDailyTrends,
  computeOwnerPerformance,
  computeSegmentPerformance
};
