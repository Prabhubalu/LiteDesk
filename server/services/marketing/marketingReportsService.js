'use strict';

const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Campaign = require('../../models/Campaign');
const MarketingAudience = require('../../models/MarketingAudience');

/**
 * @param {unknown} value
 * @returns {number}
 */
function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function toRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num > 1 ? num / 100 : num;
}

/**
 * @param {{ from?: string|Date, to?: string|Date, days?: number }} query
 */
function resolveReportRange(query = {}) {
  const now = new Date();
  let to = query.to ? new Date(query.to) : now;
  if (Number.isNaN(to.getTime())) {
    to = now;
  }

  let from;
  if (query.from) {
    from = new Date(query.from);
  } else {
    const days = Math.min(365, Math.max(1, parseInt(String(query.days || 30), 10) || 30));
    from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  }

  if (Number.isNaN(from.getTime())) {
    from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (from.getTime() > to.getTime()) {
    const swap = from;
    from = to;
    to = swap;
  }

  return { from, to };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {{ from?: string|Date, to?: string|Date, days?: number }} query
 */
async function buildMarketingReportsSummary(organizationId, query = {}) {
  const { from, to } = resolveReportRange(query);
  const orgObjectId = new mongoose.Types.ObjectId(String(organizationId));

  const [campaignRows, audienceGrowth, engagementTrend] = await Promise.all([
    Campaign.find({
      organizationId: orgObjectId,
      $or: [
        { 'stats.sendCompletedAt': { $gte: from, $lte: to } },
        { 'stats.sendStartedAt': { $gte: from, $lte: to } },
        { updatedAt: { $gte: from, $lte: to }, status: { $in: ['completed', 'running', 'failed'] } }
      ]
    })
      .sort({ 'stats.sendCompletedAt': -1, updatedAt: -1 })
      .select(
        'name subject status campaignType stats.totalRecipients stats.delivered stats.uniqueOpens stats.uniqueClicks stats.openRate stats.clickRate stats.sendCompletedAt abTest.enabled abTest.status'
      )
      .lean(),
    MarketingAudience.aggregate([
      { $match: { organizationId: orgObjectId, createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          audiences: { $sum: 1 },
          members: { $sum: '$memberCount' }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    Campaign.aggregate([
      {
        $match: {
          organizationId: orgObjectId,
          'stats.sendCompletedAt': { $gte: from, $lte: to }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$stats.sendCompletedAt' } },
          campaigns: { $sum: 1 },
          recipients: { $sum: '$stats.totalRecipients' },
          delivered: { $sum: '$stats.delivered' },
          uniqueOpens: { $sum: '$stats.uniqueOpens' },
          uniqueClicks: { $sum: '$stats.uniqueClicks' }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  const totals = campaignRows.reduce(
    (acc, row) => {
      acc.campaigns += 1;
      acc.recipients += toNumber(row.stats?.totalRecipients);
      acc.delivered += toNumber(row.stats?.delivered);
      acc.uniqueOpens += toNumber(row.stats?.uniqueOpens);
      acc.uniqueClicks += toNumber(row.stats?.uniqueClicks);
      return acc;
    },
    { campaigns: 0, recipients: 0, delivered: 0, uniqueOpens: 0, uniqueClicks: 0 }
  );

  return {
    generatedAt: new Date().toISOString(),
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      ...totals,
      openRate: totals.recipients > 0 ? totals.uniqueOpens / totals.recipients : 0,
      clickRate: totals.recipients > 0 ? totals.uniqueClicks / totals.recipients : 0,
      deliveryRate: totals.recipients > 0 ? totals.delivered / totals.recipients : 0
    },
    campaigns: campaignRows.map((row) => ({
      _id: row._id,
      name: row.name,
      subject: row.subject || '',
      status: row.status,
      campaignType: row.campaignType || 'standard',
      abTestStatus: row.abTest?.status || 'none',
      stats: {
        totalRecipients: toNumber(row.stats?.totalRecipients),
        delivered: toNumber(row.stats?.delivered),
        uniqueOpens: toNumber(row.stats?.uniqueOpens),
        uniqueClicks: toNumber(row.stats?.uniqueClicks),
        openRate: toRate(row.stats?.openRate),
        clickRate: toRate(row.stats?.clickRate),
        sendCompletedAt: row.stats?.sendCompletedAt || null
      }
    })),
    audienceGrowth: audienceGrowth.map((row) => ({
      date: row._id,
      audiences: toNumber(row.audiences),
      members: toNumber(row.members)
    })),
    engagementTrend: engagementTrend.map((row) => ({
      date: row._id,
      campaigns: toNumber(row.campaigns),
      recipients: toNumber(row.recipients),
      delivered: toNumber(row.delivered),
      uniqueOpens: toNumber(row.uniqueOpens),
      uniqueClicks: toNumber(row.uniqueClicks),
      openRate: toNumber(row.recipients) > 0 ? toNumber(row.uniqueOpens) / toNumber(row.recipients) : 0,
      clickRate: toNumber(row.recipients) > 0 ? toNumber(row.uniqueClicks) / toNumber(row.recipients) : 0
    }))
  };
}

/**
 * @param {Array<object>} campaigns
 */
function campaignsToCsvRows(campaigns) {
  const header = [
    'Campaign',
    'Subject',
    'Status',
    'Type',
    'Recipients',
    'Delivered',
    'Unique Opens',
    'Unique Clicks',
    'Open Rate',
    'Click Rate',
    'Sent At'
  ];

  const lines = [header.join(',')];
  for (const row of campaigns) {
    const stats = row.stats || {};
    lines.push(
      [
        csvEscape(row.name),
        csvEscape(row.subject),
        csvEscape(row.status),
        csvEscape(row.campaignType),
        toNumber(stats.totalRecipients),
        toNumber(stats.delivered),
        toNumber(stats.uniqueOpens),
        toNumber(stats.uniqueClicks),
        formatPercent(stats.openRate),
        formatPercent(stats.clickRate),
        stats.sendCompletedAt ? new Date(stats.sendCompletedAt).toISOString() : ''
      ].join(',')
    );
  }
  return lines.join('\n');
}

function csvEscape(value) {
  const raw = String(value ?? '');
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function formatPercent(value) {
  return `${(toRate(value) * 100).toFixed(2)}%`;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {{ from?: string|Date, to?: string|Date, days?: number }} query
 */
async function exportCampaignPerformanceCsv(organizationId, query = {}) {
  const summary = await buildMarketingReportsSummary(organizationId, query);
  return {
    filename: `marketing-campaigns-${summary.range.from.slice(0, 10)}-${summary.range.to.slice(0, 10)}.csv`,
    contentType: 'text/csv; charset=utf-8',
    body: campaignsToCsvRows(summary.campaigns)
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {{ from?: string|Date, to?: string|Date, days?: number }} query
 */
async function exportCampaignPerformanceXlsx(organizationId, query = {}) {
  const summary = await buildMarketingReportsSummary(organizationId, query);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Campaign Performance');

  sheet.columns = [
    { header: 'Campaign', key: 'name', width: 32 },
    { header: 'Subject', key: 'subject', width: 36 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Type', key: 'campaignType', width: 12 },
    { header: 'Recipients', key: 'totalRecipients', width: 12 },
    { header: 'Delivered', key: 'delivered', width: 12 },
    { header: 'Unique Opens', key: 'uniqueOpens', width: 14 },
    { header: 'Unique Clicks', key: 'uniqueClicks', width: 14 },
    { header: 'Open Rate', key: 'openRate', width: 12 },
    { header: 'Click Rate', key: 'clickRate', width: 12 },
    { header: 'Sent At', key: 'sendCompletedAt', width: 22 }
  ];

  for (const row of summary.campaigns) {
    sheet.addRow({
      name: row.name,
      subject: row.subject,
      status: row.status,
      campaignType: row.campaignType,
      totalRecipients: row.stats.totalRecipients,
      delivered: row.stats.delivered,
      uniqueOpens: row.stats.uniqueOpens,
      uniqueClicks: row.stats.uniqueClicks,
      openRate: row.stats.openRate,
      clickRate: row.stats.clickRate,
      sendCompletedAt: row.stats.sendCompletedAt ? new Date(row.stats.sendCompletedAt) : null
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    filename: `marketing-campaigns-${summary.range.from.slice(0, 10)}-${summary.range.to.slice(0, 10)}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: Buffer.from(buffer)
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {{ from?: string|Date, to?: string|Date, days?: number }} query
 */
async function exportCampaignPerformancePdf(organizationId, query = {}) {
  const summary = await buildMarketingReportsSummary(organizationId, query);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    /** @type {Buffer[]} */
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      resolve({
        filename: `marketing-campaigns-${summary.range.from.slice(0, 10)}-${summary.range.to.slice(0, 10)}.pdf`,
        contentType: 'application/pdf',
        body: Buffer.concat(chunks)
      });
    });
    doc.on('error', reject);

    doc.fontSize(18).text('Marketing Campaign Performance', { underline: true });
    doc.moveDown();
    doc.fontSize(10).fillColor('#444');
    doc.text(`Period: ${summary.range.from.slice(0, 10)} → ${summary.range.to.slice(0, 10)}`);
    doc.text(`Generated: ${summary.generatedAt.slice(0, 19)}Z`);
    doc.moveDown();

    doc.fontSize(12).fillColor('#000').text('Summary', { underline: true });
    doc.fontSize(10).fillColor('#444');
    doc.text(`Campaigns: ${summary.totals.campaigns}`);
    doc.text(`Recipients: ${summary.totals.recipients}`);
    doc.text(`Delivered: ${summary.totals.delivered}`);
    doc.text(`Open rate: ${formatPercent(summary.totals.openRate)}`);
    doc.text(`Click rate: ${formatPercent(summary.totals.clickRate)}`);
    doc.moveDown();

    doc.fontSize(12).fillColor('#000').text('Campaigns', { underline: true });
    doc.moveDown(0.5);

    for (const row of summary.campaigns.slice(0, 40)) {
      doc.fontSize(10).fillColor('#000').text(row.name, { continued: false });
      doc.fontSize(9).fillColor('#555');
      doc.text(
        `${row.stats.totalRecipients} recipients · ${formatPercent(row.stats.openRate)} opens · ${formatPercent(row.stats.clickRate)} clicks`
      );
      doc.moveDown(0.4);
    }

    doc.end();
  });
}

module.exports = {
  resolveReportRange,
  buildMarketingReportsSummary,
  exportCampaignPerformanceCsv,
  exportCampaignPerformanceXlsx,
  exportCampaignPerformancePdf,
  campaignsToCsvRows
};
