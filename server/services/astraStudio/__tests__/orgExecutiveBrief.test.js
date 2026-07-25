'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isOrgScopedCanvas,
  panelMetricsFromOrgBrief,
  fmtMoney,
} = require('../orgExecutiveBrief');

describe('org executive brief', () => {
  it('detects org-scoped canvas types and prompts', () => {
    assert.equal(isOrgScopedCanvas('executive_report', ''), true);
    assert.equal(isOrgScopedCanvas('quarterly_business_review', ''), true);
    assert.equal(isOrgScopedCanvas('opportunity_war_room', ''), false);
    assert.equal(
      isOrgScopedCanvas('blank', 'Build an executive report for this quarter pipeline and revenue'),
      true,
    );
  });

  it('formats money compactly', () => {
    assert.equal(fmtMoney(0), '$0');
    assert.equal(fmtMoney(999), '$999');
    assert.ok(/k$/i.test(fmtMoney(12000)) || fmtMoney(12000).includes('12'));
  });

  it('picks panel metrics by title', () => {
    const brief = {
      kpiMetrics: [{ label: 'Open deals', value: '3' }],
      orgPanelMetrics: {
        revenue: [{ label: 'Won value', value: '$10k' }],
        pipeline: [{ label: 'Pipeline', value: '$50k' }],
        forecast: [{ label: 'Negotiation', value: '$20k' }],
        funnel: [{ label: 'Open', value: '3' }],
        trends: [{ label: 'Negotiation', value: '$20k' }],
        default: [{ label: 'Open deals', value: '3' }],
      },
    };
    assert.equal(panelMetricsFromOrgBrief(brief, 'Revenue')[0].label, 'Won value');
    assert.equal(panelMetricsFromOrgBrief(brief, 'Pipeline')[0].label, 'Pipeline');
    assert.equal(panelMetricsFromOrgBrief(brief, 'Forecast')[0].label, 'Negotiation');
    assert.equal(panelMetricsFromOrgBrief(brief, 'Funnel')[0].label, 'Open');
  });
});
