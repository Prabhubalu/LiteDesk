'use strict';

/**
 * Org-wide CRM snapshot for executive_report canvases (no deal/person focus).
 */

const { DEAL_STATUS } = require('../../constants/dealStatus');

function money(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function fmtMoney(n) {
  const v = money(n);
  if (!v) return '$0';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v).toLocaleString()}`;
}

function isOrgScopedCanvas(canvasType = '', prompt = '') {
  const t = String(canvasType || '').toLowerCase();
  if (
    t === 'executive_report'
    || t === 'quarterly_business_review'
    || /executive|board\s*report|pipeline\s*report|revenue\s*report/.test(t)
  ) {
    return true;
  }
  return /\b(executive\s+report|board\s+report|this\s+quarter|pipeline\s+and\s+revenue|org(?:anization)?(?:-|\s+)wide)\b/i.test(
    String(prompt || ''),
  );
}

/**
 * @returns {Promise<{
 *   situation: object,
 *   llmText: string,
 *   kpiMetrics: Array,
 *   orgPanelMetrics: Record<string, Array>,
 *   riskBullets: string,
 *   openTasks: Array,
 * }>}
 */
async function buildOrgExecutiveBrief({ organizationId } = {}) {
  if (!organizationId) {
    return emptyBrief();
  }

  let tenantName = 'Organization';
  try {
    const Organization = require('../../models/Organization');
    const org = await Organization.findById(organizationId).select('name').lean();
    if (org?.name) tenantName = String(org.name).trim();
  } catch {
    // keep default
  }

  const Deal = require('../../models/Deal');
  const base = { organizationId, deletedAt: null };

  const [openDeals, wonDeals, lostDeals, openCount, wonCount, lostCount] = await Promise.all([
    Deal.find({ ...base, status: DEAL_STATUS.OPEN })
      .select('name amount stage status expectedCloseDate updatedAt')
      .sort({ amount: -1 })
      .limit(40)
      .lean()
      .catch(() => []),
    Deal.find({ ...base, status: DEAL_STATUS.WON })
      .select('name amount stage status updatedAt')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean()
      .catch(() => []),
    Deal.find({ ...base, status: DEAL_STATUS.LOST })
      .select('name amount stage status updatedAt')
      .sort({ updatedAt: -1 })
      .limit(12)
      .lean()
      .catch(() => []),
    Deal.countDocuments({ ...base, status: DEAL_STATUS.OPEN }).catch(() => 0),
    Deal.countDocuments({ ...base, status: DEAL_STATUS.WON }).catch(() => 0),
    Deal.countDocuments({ ...base, status: DEAL_STATUS.LOST }).catch(() => 0),
  ]);

  const openList = Array.isArray(openDeals) ? openDeals : [];
  const wonList = Array.isArray(wonDeals) ? wonDeals : [];
  const lostList = Array.isArray(lostDeals) ? lostDeals : [];

  const pipelineAmount = openList.reduce((s, d) => s + money(d.amount), 0);
  const wonAmount = wonList.reduce((s, d) => s + money(d.amount), 0);
  const lostAmount = lostList.reduce((s, d) => s + money(d.amount), 0);

  /** @type {Record<string, { count: number, amount: number }>} */
  const byStage = {};
  for (const d of openList) {
    const stage = String(d.stage || d.status || 'Open').trim() || 'Open';
    if (!byStage[stage]) byStage[stage] = { count: 0, amount: 0 };
    byStage[stage].count += 1;
    byStage[stage].amount += money(d.amount);
  }
  const stageRows = Object.entries(byStage)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 6);

  let openTaskCount = 0;
  let overdueTaskCount = 0;
  try {
    const Task = require('../../models/Task');
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    openTaskCount = await Task.countDocuments({
      organizationId,
      deletedAt: null,
      status: { $nin: ['completed', 'done', 'Cancelled', 'cancelled'] },
    }).catch(() => 0);
    overdueTaskCount = await Task.countDocuments({
      organizationId,
      deletedAt: null,
      status: { $nin: ['completed', 'done', 'Cancelled', 'cancelled'] },
      dueDate: { $lt: dayStart, $ne: null },
    }).catch(() => 0);
  } catch {
    // optional
  }

  let expiredQuoteCount = 0;
  try {
    const Quote = require('../../models/Quote');
    expiredQuoteCount = await Quote.countDocuments({
      organizationId,
      deletedAt: null,
      status: 'Expired',
    }).catch(() => 0);
  } catch {
    // optional
  }

  const related = openList.slice(0, 16).map((d) => ({
    moduleKey: 'deals',
    id: String(d._id),
    title: d.name || 'Deal',
    status: d.status || d.stage || '',
    subtitle: [d.stage, fmtMoney(d.amount)].filter(Boolean).join(' · '),
  }));

  const situation = {
    ok: true,
    orgScoped: true,
    focus: {
      moduleKey: 'organizations',
      title: `${tenantName} pipeline`,
      name: tenantName,
      status: 'Open',
    },
    related,
    activities: [],
    communications: [],
    signals: {
      openDeals: related.slice(0, 8),
      expiredQuotes: expiredQuoteCount
        ? [{ title: `${expiredQuoteCount} expired quote(s)` }]
        : [],
      openCases: [],
    },
    orgMetrics: {
      tenantName,
      openCount,
      wonCount,
      lostCount,
      pipelineAmount,
      wonAmount,
      lostAmount,
      openTaskCount,
      overdueTaskCount,
      expiredQuoteCount,
      byStage: stageRows.map(([stage, row]) => ({
        stage,
        count: row.count,
        amount: row.amount,
      })),
    },
  };

  const lines = [];
  lines.push(`FOCUS: [organization] ${tenantName} — org-wide executive report (not a single deal)`);
  lines.push('PIPELINE SNAPSHOT:');
  lines.push(`- Open deals: ${openCount} · pipeline ${fmtMoney(pipelineAmount)}`);
  lines.push(`- Won (recent sample): ${wonCount} · ${fmtMoney(wonAmount)}`);
  lines.push(`- Lost (recent sample): ${lostCount} · ${fmtMoney(lostAmount)}`);
  if (stageRows.length) {
    lines.push('OPEN BY STAGE:');
    for (const [stage, row] of stageRows) {
      lines.push(`- ${stage}: ${row.count} deals · ${fmtMoney(row.amount)}`);
    }
  }
  if (openList.length) {
    lines.push('TOP OPEN DEALS:');
    for (const d of openList.slice(0, 8)) {
      lines.push(
        `- ${d.name || 'Deal'} · ${d.stage || d.status || 'Open'} · ${fmtMoney(d.amount)}`,
      );
    }
  }
  if (expiredQuoteCount) lines.push(`- Expired quotes: ${expiredQuoteCount}`);
  if (openTaskCount) {
    lines.push(`- Open tasks: ${openTaskCount}${overdueTaskCount ? ` (${overdueTaskCount} overdue)` : ''}`);
  }
  lines.push(
    'INSTRUCTION: Write an executive report for the whole organization pipeline/revenue. '
    + 'Do not invent deals. Prefer named deals and stage totals from this snapshot. '
    + 'Do not frame this as a single-deal war room.',
  );

  const llmText = lines.join('\n').slice(0, 4500);

  const pipelineMetrics = [
    { label: 'Open deals', value: String(openCount) },
    { label: 'Pipeline', value: fmtMoney(pipelineAmount) },
    { label: 'Won (sample)', value: fmtMoney(wonAmount) },
  ];
  const revenueMetrics = [
    { label: 'Won value', value: fmtMoney(wonAmount) },
    { label: 'Open pipeline', value: fmtMoney(pipelineAmount) },
    { label: 'Lost (sample)', value: fmtMoney(lostAmount) },
  ];
  const forecastMetrics = stageRows.slice(0, 4).map(([stage, row]) => ({
    label: stage,
    value: fmtMoney(row.amount),
  }));
  if (!forecastMetrics.length) {
    forecastMetrics.push(
      { label: 'Pipeline', value: fmtMoney(pipelineAmount) },
      { label: 'Open deals', value: String(openCount) },
    );
  }
  const funnelMetrics = stageRows.slice(0, 5).map(([stage, row]) => ({
    label: stage,
    value: String(row.count),
  }));
  if (!funnelMetrics.length) {
    funnelMetrics.push(
      { label: 'Open', value: String(openCount) },
      { label: 'Won', value: String(wonCount) },
      { label: 'Lost', value: String(lostCount) },
    );
  }

  const riskLines = [];
  if (expiredQuoteCount) {
    riskLines.push(`• Risk: ${expiredQuoteCount} expired quote(s) across the org`);
  }
  if (overdueTaskCount) {
    riskLines.push(`• Risk: ${overdueTaskCount} overdue open task(s)`);
  }
  if (lostCount && pipelineAmount > 0 && lostAmount > pipelineAmount * 0.5) {
    riskLines.push(`• Risk: Recent lost value (${fmtMoney(lostAmount)}) is high vs open pipeline`);
  }
  for (const d of openList.slice(0, 3)) {
    if (/stalled|risk|hold/i.test(`${d.stage || ''} ${d.name || ''}`)) {
      riskLines.push(`• Risk: ${d.name} — ${d.stage || 'at risk'}`);
    }
  }
  if (!riskLines.length && openCount === 0) {
    riskLines.push('• Risk: No open deals in pipeline');
  }

  return {
    situation,
    llmText,
    kpiMetrics: pipelineMetrics,
    orgPanelMetrics: {
      revenue: revenueMetrics,
      pipeline: pipelineMetrics,
      forecast: forecastMetrics,
      trends: forecastMetrics,
      funnel: funnelMetrics,
      default: pipelineMetrics,
    },
    riskBullets: riskLines.slice(0, 6).join('\n'),
    openTasks: [],
    signalBullets: openList.slice(0, 4).map((d) => (
      `• Signal: Open deal “${String(d.name || 'Deal').slice(0, 48)}” — ${d.stage || 'Open'} · ${fmtMoney(d.amount)}`
    )).join('\n'),
  };
}

function emptyBrief() {
  return {
    situation: null,
    llmText: '',
    kpiMetrics: [],
    orgPanelMetrics: {},
    riskBullets: '',
    openTasks: [],
    signalBullets: '',
  };
}

function panelMetricsFromOrgBrief(brief, title = '', type = '') {
  const map = brief?.orgPanelMetrics || {};
  const t = `${title} ${type}`.toLowerCase();
  if (/revenue/.test(t)) return map.revenue || [];
  if (/pipeline/.test(t)) return map.pipeline || [];
  if (/forecast/.test(t)) return map.forecast || [];
  if (/funnel/.test(t)) return map.funnel || [];
  if (/trend/.test(t)) return map.trends || [];
  return map.default || brief?.kpiMetrics || [];
}

module.exports = {
  isOrgScopedCanvas,
  buildOrgExecutiveBrief,
  panelMetricsFromOrgBrief,
  fmtMoney,
};
