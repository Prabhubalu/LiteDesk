const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeResolutionMetrics,
  computeResponseMetrics,
  computeDailyTrends,
  computeOwnerPerformance,
  computeSegmentPerformance
} = require('../caseAnalytics');

test('computeResolutionMetrics calculates compliance and averages', () => {
  const data = [
    {
      currentSlaCycle: {
        startedAt: new Date('2026-01-01T00:00:00Z'),
        stoppedAt: new Date('2026-01-01T01:00:00Z'),
        resolutionTargetAt: new Date('2026-01-01T02:00:00Z')
      },
      slaCycles: []
    },
    {
      currentSlaCycle: {
        startedAt: new Date('2026-01-02T00:00:00Z'),
        stoppedAt: new Date('2026-01-02T03:00:00Z'),
        resolutionTargetAt: new Date('2026-01-02T02:00:00Z')
      },
      slaCycles: []
    }
  ];
  const result = computeResolutionMetrics(data);
  assert.equal(result.totalCycles, 2);
  assert.equal(result.compliantCycles, 1);
  assert.equal(result.breachedCycles, 1);
  assert.equal(result.slaCompliancePercent, 50);
  assert.equal(result.averageResolutionMinutes, 120);
});

test('computeResponseMetrics uses first external activity only', () => {
  const data = [
    {
      createdAt: new Date('2026-01-01T00:00:00Z'),
      activities: [
        { internal: true, createdAt: new Date('2026-01-01T00:05:00Z') },
        { internal: false, createdAt: new Date('2026-01-01T00:20:00Z') }
      ]
    }
  ];
  const result = computeResponseMetrics(data);
  assert.equal(result.measuredCases, 1);
  assert.equal(result.averageFirstResponseMinutes, 20);
});

test('computeDailyTrends builds created/resolved/breached series', () => {
  const data = [
    {
      createdAt: new Date('2026-01-01T08:00:00Z'),
      currentSlaCycle: {
        startedAt: new Date('2026-01-01T08:00:00Z'),
        stoppedAt: new Date('2026-01-02T08:00:00Z'),
        resolutionTargetAt: new Date('2026-01-02T09:00:00Z')
      },
      slaCycles: []
    },
    {
      createdAt: new Date('2026-01-01T10:00:00Z'),
      currentSlaCycle: {
        startedAt: new Date('2026-01-01T10:00:00Z'),
        stoppedAt: new Date('2026-01-02T12:00:00Z'),
        resolutionTargetAt: new Date('2026-01-02T11:00:00Z')
      },
      slaCycles: []
    }
  ];
  const result = computeDailyTrends(data, {
    from: new Date('2026-01-01T00:00:00Z'),
    to: new Date('2026-01-03T00:00:00Z')
  });
  assert.equal(result.length, 3);
  assert.equal(result[0].created, 2);
  assert.equal(result[1].resolved, 2);
  assert.equal(result[1].breached, 1);
});

test('computeOwnerPerformance computes per-owner metrics', () => {
  const ownerA = 'owner-a';
  const ownerB = 'owner-b';
  const data = [
    {
      assignedTo: ownerA,
      status: 'In Progress',
      currentSlaCycle: {
        startedAt: new Date('2026-01-01T00:00:00Z'),
        stoppedAt: null,
        resolutionTargetAt: new Date('2026-01-01T02:00:00Z')
      },
      slaCycles: []
    },
    {
      assignedTo: ownerA,
      status: 'Resolved',
      currentSlaCycle: {
        startedAt: new Date('2026-01-02T00:00:00Z'),
        stoppedAt: new Date('2026-01-02T01:00:00Z'),
        resolutionTargetAt: new Date('2026-01-02T02:00:00Z')
      },
      slaCycles: [{ cycleNo: 1 }]
    },
    {
      assignedTo: ownerB,
      status: 'Closed',
      currentSlaCycle: {
        startedAt: new Date('2026-01-03T00:00:00Z'),
        stoppedAt: new Date('2026-01-03T03:00:00Z'),
        resolutionTargetAt: new Date('2026-01-03T02:00:00Z')
      },
      slaCycles: []
    }
  ];

  const result = computeOwnerPerformance(data);
  const a = result.find((row) => row.assignedTo === ownerA);
  const b = result.find((row) => row.assignedTo === ownerB);
  assert.equal(a.totalCases, 2);
  assert.equal(a.openCases, 1);
  assert.equal(a.reopenRatePercent, 50);
  assert.equal(a.resolvedCycles, 1);
  assert.equal(a.slaCompliancePercent, 100);
  assert.equal(b.slaCompliancePercent, 0);
});

test('computeSegmentPerformance computes distribution and SLA compliance by segment', () => {
  const data = [
    {
      priority: 'High',
      currentSlaCycle: {
        startedAt: new Date('2026-01-01T00:00:00Z'),
        stoppedAt: new Date('2026-01-01T01:00:00Z'),
        resolutionTargetAt: new Date('2026-01-01T02:00:00Z')
      },
      slaCycles: []
    },
    {
      priority: 'High',
      currentSlaCycle: {
        startedAt: new Date('2026-01-02T00:00:00Z'),
        stoppedAt: new Date('2026-01-02T03:00:00Z'),
        resolutionTargetAt: new Date('2026-01-02T02:00:00Z')
      },
      slaCycles: []
    },
    {
      priority: 'Low',
      currentSlaCycle: {
        startedAt: new Date('2026-01-03T00:00:00Z'),
        stoppedAt: null,
        resolutionTargetAt: new Date('2026-01-03T02:00:00Z')
      },
      slaCycles: []
    }
  ];

  const result = computeSegmentPerformance(data, 'priority');
  const high = result.find((row) => row.segment === 'High');
  const low = result.find((row) => row.segment === 'Low');
  assert.equal(high.totalCases, 2);
  assert.equal(high.resolvedCycles, 2);
  assert.equal(high.compliantCycles, 1);
  assert.equal(high.breachedCycles, 1);
  assert.equal(high.slaCompliancePercent, 50);
  assert.equal(low.totalCases, 1);
  assert.equal(low.resolvedCycles, 0);
});
