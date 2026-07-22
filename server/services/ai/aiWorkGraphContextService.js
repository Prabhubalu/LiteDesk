'use strict';

/**
 * Full CRM context pack for Work-Graph Ask / Research.
 * Primary record + related records + activities (embedded + RecordActivity).
 */

const mongoose = require('mongoose');
const { getRecordContext } = require('../recordContextService');
const { redactText } = require('./piiRedaction');
const People = require('../../models/People');
const Deal = require('../../models/Deal');
const Case = require('../../models/Case');
const Organization = require('../../models/Organization');
const Task = require('../../models/Task');
const Event = require('../../models/Event');
const Quote = require('../../models/Quote');
const Item = require('../../models/Item');
const Document = require('../../models/Document');
const RecordActivity = require('../../models/RecordActivity');
const User = require('../../models/User');
const {
  detectGroupField,
  detectExplicitGroupField,
} = require('./aiAstraReportBuilderService');

const MAX_CONTEXT_CHARS = 20000;
const MAX_LIST_CONTEXT_CHARS = 24000;
const MAX_COMPLETE_CONTEXT_CHARS = 120000;
/**
 * Record-page pack: load richer raw graph; map-reduce digests (ASTRA_CHUNKED_CONTEXT_V1)
 * compress related volume before the final answer LLM so we do not lose coverage to a hard trim.
 */
const MAX_RECORD_CONTEXT_CHARS = 72000;
/** Report/overview: aggregates are 100%; detail rows stay small to control tokens. */
const MAX_REPORT_CONTEXT_CHARS = 28000;
const MAX_LIST_SAMPLE = 50;
const MAX_REPORT_RECORDS = 40;
const MAX_COMPLETE_RECORDS = 2000;
const MAX_RELATED_GROUPS = 20;
const MAX_RELATED_PER_GROUP = 10;
const MAX_RELATED_PER_GROUP_RECORD = 12;
const MAX_RELATED_PER_GROUP_COMPLETE = 100;
const MAX_RELATED_TOTAL_RECORD = 36;
const MAX_PRIMARY_ACTIVITIES = 40;
const MAX_PRIMARY_ACTIVITIES_RECORD = 40;
const MAX_RELATED_ACTIVITIES = 12;
const MAX_RELATED_ACTIVITIES_RECORD = 10;

const SKIP_KEYS = new Set([
  '_id', '__v', 'organizationId', 'createdBy', 'updatedBy', 'deletedAt', 'deletedBy',
  'deletionReason', 'password', 'tokens', 'activityLogs', 'stageHistory',
  'descriptionVersions', 'comments', 'attachments',
]);

function formatUserRef(user) {
  if (!user) return '';
  if (typeof user === 'string' || user instanceof mongoose.Types.ObjectId) {
    return String(user);
  }
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.username || user.email || String(user._id || '');
}

function personDisplayName(doc) {
  if (!doc) return '';
  const title = doc.title || doc.salutation || doc.prefix || '';
  const first = doc.first_name || doc.firstName || '';
  const last = doc.last_name || doc.lastName || '';
  const name = [title, first, last].filter(Boolean).join(' ').trim();
  return name || doc.email || String(doc._id || '');
}

function listMatchQuery(moduleKey, organizationId) {
  const key = String(moduleKey || '').toLowerCase();
  const orgOid = mongoose.Types.ObjectId.isValid(String(organizationId))
    ? new mongoose.Types.ObjectId(String(organizationId))
    : null;
  if (!orgOid) return null;

  if (key === 'organizations' || key === 'organization') {
    return { isTenant: false };
  }

  const q = { organizationId: orgOid };
  const Model = getModel(key);
  if (Model?.schema?.paths?.deletedAt) q.deletedAt = null;
  return q;
}

function summarizeListDoc(moduleKey, doc) {
  if (!doc) return '';
  const key = String(moduleKey || '').toLowerCase();
  const id = String(doc._id || '');
  const label = recordLabel(key, doc);
  const bits = [`${label} (id:${id})`];

  if (key === 'deals') {
    if (doc.stage) bits.push(`stage=${doc.stage}`);
    if (doc.status) bits.push(`status=${doc.status}`);
    if (doc.amount != null) bits.push(`amount=${doc.amount}`);
    if (doc.pipeline) bits.push(`pipeline=${doc.pipeline}`);
    const owner = formatUserRef(doc.assignedTo);
    if (owner) bits.push(`owner=${owner}`);
    const account = typeof doc.accountId === 'object' ? doc.accountId?.name : '';
    if (account) bits.push(`account=${account}`);
    const contact = typeof doc.contactId === 'object'
      ? personDisplayName(doc.contactId)
      : '';
    if (contact) bits.push(`contact=${contact}`);
  } else if (key === 'people') {
    if (doc.email) bits.push(`email=${doc.email}`);
    if (doc.phone || doc.mobile) bits.push(`phone=${doc.phone || doc.mobile}`);
    const org = typeof doc.organization === 'object' ? doc.organization?.name : '';
    if (org) bits.push(`org=${org}`);
    const owner = formatUserRef(doc.assignedTo || doc.lead_owner);
    if (owner) bits.push(`owner=${owner}`);
  } else if (key === 'tasks') {
    if (doc.status) bits.push(`status=${doc.status}`);
    if (doc.priority) bits.push(`priority=${doc.priority}`);
    if (doc.dueDate || doc.due_date) bits.push(`due=${doc.dueDate || doc.due_date}`);
    const owner = formatUserRef(doc.assignedTo);
    if (owner) bits.push(`owner=${owner}`);
  } else if (key === 'events') {
    if (doc.eventType) bits.push(`type=${doc.eventType}`);
    if (doc.status) bits.push(`status=${doc.status}`);
    if (doc.startDateTime) bits.push(`start=${doc.startDateTime}`);
    const owner = formatUserRef(doc.assignedTo);
    if (owner) bits.push(`owner=${owner}`);
  } else if (key === 'cases') {
    if (doc.status) bits.push(`status=${doc.status}`);
    if (doc.priority) bits.push(`priority=${doc.priority}`);
    const owner = formatUserRef(doc.assignedTo);
    if (owner) bits.push(`owner=${owner}`);
  } else if (key === 'organizations') {
    if (doc.industry) bits.push(`industry=${doc.industry}`);
    if (doc.status) bits.push(`status=${doc.status}`);
    if (doc.website) bits.push(`website=${doc.website}`);
  } else if (doc.status) {
    bits.push(`status=${doc.status}`);
  }

  return `- ${bits.join(' | ')}`.slice(0, 420);
}

function resolveSchemaGroupField(Model, fieldKey = '') {
  const key = String(fieldKey || '').trim();
  if (!key || !Model?.schema?.paths) return '';
  if (Model.schema.paths[key]) return key;
  const lower = key.toLowerCase();
  const compact = lower.replace(/_/g, '');
  for (const pathKey of Object.keys(Model.schema.paths)) {
    if (pathKey.startsWith('_') || pathKey.includes('.')) continue;
    const pl = pathKey.toLowerCase();
    if (pl === lower || pl.replace(/_/g, '') === compact) return pathKey;
  }
  // "type" → taskType / caseType / eventType / *Type picklists
  if (compact === 'type') {
    for (const preferred of ['taskType', 'caseType', 'eventType', 'type']) {
      if (Model.schema.paths[preferred]) return preferred;
    }
    const typed = Object.keys(Model.schema.paths).find(
      (p) => !p.includes('.') && /type$/i.test(p) && p.toLowerCase() !== 'relatedto'
    );
    if (typed) return typed;
  }
  return '';
}

function isUserRefGroupField(Model, fieldKey = '') {
  const path = Model?.schema?.paths?.[fieldKey];
  if (!path) return false;
  if (['assignedTo', 'createdBy', 'updatedBy', 'ownerId', 'modifiedBy'].includes(fieldKey)) {
    return true;
  }
  return path.options?.ref === 'User' || path.caster?.options?.ref === 'User';
}

async function buildModuleAggregates(Model, match, moduleKey, { question = '' } = {}) {
  const key = String(moduleKey || '').toLowerCase();
  const lines = [];
  const series = [];
  const total = await Model.countDocuments(match);
  lines.push(`Total accessible records: ${total}`);

  const explicit = detectExplicitGroupField(question, key);
  // detectGroupField always returns a default — only use defaults when user did not name a dimension
  const fallbackDefault = key === 'deals' ? 'stage' : (key === 'events' ? 'eventType' : 'status');
  const preferred = explicit || fallbackDefault;

  let groupField = resolveSchemaGroupField(Model, preferred);
  if (!groupField && explicit && Model.schema?.paths?.[explicit]) {
    groupField = explicit;
  }
  if (!groupField && !explicit) {
    groupField = resolveSchemaGroupField(Model, fallbackDefault) || null;
  }

  // Last resort: any known categorical path (only when no explicit dimension was asked)
  if (!groupField && !explicit && Model.schema?.paths) {
    for (const candidate of ['status', 'stage', 'priority', 'taskType', 'caseType', 'eventType', 'type', 'assignedTo']) {
      const resolved = resolveSchemaGroupField(Model, candidate);
      if (resolved) {
        groupField = resolved;
        break;
      }
    }
  }

  if (groupField && Model.schema?.paths?.[groupField]) {
    const groups = await Model.aggregate([
      { $match: match },
      {
        $group: {
          _id: `$${groupField}`,
          count: { $sum: 1 },
          ...(key === 'deals' ? { totalAmount: { $sum: { $ifNull: ['$amount', 0] } } } : {}),
        },
      },
      { $sort: { count: -1 } },
      { $limit: 25 },
    ]);

    let labelById = null;
    if (groups.length && isUserRefGroupField(Model, groupField)) {
      const ids = groups
        .map((row) => row._id)
        .filter((id) => id != null && mongoose.isValidObjectId(id));
      if (ids.length) {
        const users = await User.find({ _id: { $in: ids } })
          .select('firstName lastName email username')
          .lean();
        labelById = new Map(
          users.map((u) => [String(u._id), formatUserRef(u) || String(u._id)])
        );
      }
    }

    if (groups.length) {
      lines.push(`Breakdown by ${groupField}:`);
      for (const row of groups) {
        let label;
        if (row._id == null || row._id === '') {
          label = '(empty)';
        } else if (labelById) {
          label = labelById.get(String(row._id)) || String(row._id);
        } else {
          label = String(row._id);
        }
        const amountBit = row.totalAmount != null ? `, amount=${row.totalAmount}` : '';
        lines.push(`  ${label}: ${row.count}${amountBit}`);
        series.push({
          label,
          value: Number(row.count) || 0,
          amount: Number(row.totalAmount) || 0,
          dimension: groupField,
        });
      }
    }
  }

  let dealStats = null;
  if (key === 'deals') {
    const stats = await Model.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $ifNull: ['$amount', 0] } },
          openCount: { $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] } },
          wonCount: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] } },
          lostCount: { $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] } },
          pipelineValue: {
            $sum: { $cond: [{ $eq: ['$status', 'Open'] }, { $ifNull: ['$amount', 0] }, 0] },
          },
        },
      },
    ]);
    const s = stats[0];
    if (s) {
      dealStats = {
        totalValue: Number(s.totalValue) || 0,
        pipelineValue: Number(s.pipelineValue) || 0,
        openCount: Number(s.openCount) || 0,
        wonCount: Number(s.wonCount) || 0,
        lostCount: Number(s.lostCount) || 0,
      };
      lines.push(
        `Deal stats: totalValue=${dealStats.totalValue}, pipelineValue=${dealStats.pipelineValue}, open=${dealStats.openCount}, won=${dealStats.wonCount}, lost=${dealStats.lostCount}`,
      );
    }
  }

  return { total, lines, series, groupField, stats: dealStats };
}

function resolveAstraChartType(question = '') {
  const q = String(question || '').toLowerCase();
  if (/\b(pie|donut)\b/.test(q)) return 'pie';
  if (/\b(line|trend)\b/.test(q)) return 'line';
  if (/\b(bar|column|histogram)\b/.test(q)) return 'bar';
  if (/\b(chart|graph|visuali[sz]e|plot)\b/.test(q)) return 'pie';
  return '';
}

function looksLikeChartIntent(question = '') {
  return Boolean(resolveAstraChartType(question))
    || /\b(chart|graph|visuali[sz]e|plot|dashboard)\b/i.test(String(question || ''));
}

function buildAstraVisualsFromSeries({
  question = '',
  moduleKey = '',
  series = [],
  groupField = '',
} = {}) {
  if (!Array.isArray(series) || !series.length) return [];
  const chartType = resolveAstraChartType(question) || 'pie';
  const useAmount = /\b(value|amount|revenue|pipeline value|\$)\b/i.test(String(question || ''))
    && series.some((s) => Number(s.amount) > 0);
  const points = series.map((s) => ({
    label: String(s.label || '(empty)'),
    value: useAmount ? Number(s.amount) || 0 : Number(s.value) || 0,
  })).filter((p) => p.label);

  if (!points.length) return [];
  const dim = groupField || 'category';
  const metric = useAmount ? 'amount' : 'count';
  const mod = String(moduleKey || 'records');
  return [{
    id: `astra_${mod}_${dim}_${metric}`,
    component: 'chart',
    chartType,
    title: useAmount
      ? `${mod} by ${dim} (${metric})`
      : `${mod} by ${dim}`,
    metricLabel: metric,
    points,
  }];
}

function recordLabel(moduleKey, doc) {
  if (!doc) return '';
  const key = String(moduleKey || '').toLowerCase();
  if (key === 'people') return personDisplayName(doc);
  if (key === 'events') return doc.eventName || doc.title || String(doc._id);
  if (key === 'quotes') return doc.quoteTitle || doc.quoteNumber || String(doc._id);
  if (key === 'cases') return doc.title || doc.caseId || String(doc._id);
  if (key === 'items') return doc.item_name || doc.item_code || String(doc._id);
  if (key === 'documents') return doc.title || doc.documentNumber || String(doc._id);
  return doc.name || doc.title || doc.label || personDisplayName(doc) || String(doc._id);
}

function getModel(moduleKey) {
  switch (String(moduleKey || '').toLowerCase()) {
    case 'people': return People;
    case 'organizations':
    case 'organization': return Organization;
    case 'deals': return Deal;
    case 'cases': return Case;
    case 'tasks': return Task;
    case 'events': return Event;
    case 'quotes': return Quote;
    case 'items': return Item;
    case 'documents': return Document;
    default: return null;
  }
}

async function loadDocument(organizationId, moduleKey, recordId) {
  const Model = getModel(moduleKey);
  if (!Model || !recordId) return null;
  const key = String(moduleKey || '').toLowerCase();
  const id = mongoose.Types.ObjectId.isValid(String(recordId))
    ? new mongoose.Types.ObjectId(String(recordId))
    : null;
  if (!id && key !== 'events') return null;

  let query;
  if (key === 'organizations' || key === 'organization') {
    query = Model.findOne({ _id: id, isTenant: false });
  } else if (key === 'events') {
    query = Model.findOne({
      organizationId,
      $or: [
        ...(id ? [{ _id: id }] : []),
        { eventId: String(recordId) },
      ],
    });
  } else {
    const q = { _id: id, organizationId };
    if (Model.schema?.paths?.deletedAt) q.deletedAt = null;
    query = Model.findOne(q);
  }

  if (Model.schema?.paths?.assignedTo) {
    query = query.populate('assignedTo', 'firstName lastName email username');
  }
  if (key === 'people' && Model.schema?.paths?.lead_owner) {
    query = query.populate('lead_owner', 'firstName lastName email username');
  }
  if (key === 'people' && Model.schema?.paths?.organization) {
    query = query.populate('organization', 'name industry status email phone website');
  }

  return query.lean();
}

function pushScalarFields(lines, doc, { prefix = '', maxFields = 40 } = {}) {
  if (!doc) return;
  let count = 0;
  for (const [field, value] of Object.entries(doc)) {
    if (SKIP_KEYS.has(field)) continue;
    if (value == null || value === '') continue;
    if (typeof value === 'object') continue;
    lines.push(`${prefix}${field}: ${String(value).slice(0, 240)}`);
    count += 1;
    if (count >= maxFields) break;
  }
  if (doc.customFields && typeof doc.customFields === 'object') {
    for (const [field, value] of Object.entries(doc.customFields)) {
      if (value == null || value === '' || typeof value === 'object') continue;
      lines.push(`${prefix}custom.${field}: ${String(value).slice(0, 240)}`);
      count += 1;
      if (count >= maxFields + 20) break;
    }
  }
}

function formatEmbeddedActivities(activityLogs, limit) {
  const rows = Array.isArray(activityLogs) ? activityLogs : [];
  return rows.slice(-limit).map((row) => {
    const stamp = row.timestamp || row.createdAt || row.changedAt;
    const when = stamp ? new Date(stamp).toISOString() : '';
    const who = row.user || row.actor || 'System';
    const body = String(row.message || row.action || row.stageName || row.stage || '')
      .replace(/\s+/g, ' ')
      .trim();
    return `- [${when}] ${who}: ${body}`.slice(0, 300);
  }).filter((line) => line.length > 10);
}

async function loadRecordActivities(organizationId, moduleKey, recordId, limit) {
  if (!organizationId || !moduleKey || !recordId) return [];
  const idStr = String(recordId);
  const orIds = [{ recordId: idStr }];
  if (mongoose.Types.ObjectId.isValid(idStr)) {
    orIds.push({ recordId: new mongoose.Types.ObjectId(idStr) });
  }

  const rows = await RecordActivity.find({
    organizationId,
    moduleKey: String(moduleKey).toLowerCase(),
    $or: orIds,
  })
    .populate('author', 'firstName lastName email username')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rows.reverse().map((entry) => {
    const when = entry.createdAt ? new Date(entry.createdAt).toISOString() : '';
    const who = formatUserRef(entry.author) || 'System';
    if (entry.type === 'comment') {
      const body = String(entry.content || '').replace(/\s+/g, ' ').trim();
      return `- [${when}] ${who} (comment): ${body}`.slice(0, 320);
    }
    const body = String(entry.message || entry.action || 'activity').replace(/\s+/g, ' ').trim();
    return `- [${when}] ${who}: ${body}`.slice(0, 320);
  });
}

function buildPrimarySection(moduleKey, doc, { maxFields } = {}) {
  const lines = [];
  const key = String(moduleKey || '').toLowerCase();
  const fieldCap = Number.isFinite(maxFields)
    ? maxFields
    : (key === 'people' ? 20 : 40);
  lines.push(`=== PRIMARY RECORD (${key}) ===`);
  lines.push(`Label: ${recordLabel(key, doc)}`);

  if (key === 'people') {
    const sales = doc.participations?.SALES || {};
    lines.push(`Person: ${personDisplayName(doc)}`);
    if (doc.email) lines.push(`Email: ${doc.email}`);
    if (doc.phone || doc.mobile) lines.push(`Phone: ${doc.phone || doc.mobile}`);
    if (doc.job_title) lines.push(`Job title: ${doc.job_title}`);
    const assignee = formatUserRef(doc.assignedTo);
    if (assignee) lines.push(`Assigned to (owner / who is handling this contact): ${assignee}`);
    const leadOwner = formatUserRef(doc.lead_owner);
    if (leadOwner) lines.push(`Lead owner: ${leadOwner}`);
    if (doc.organization) {
      const orgName = typeof doc.organization === 'object'
        ? (doc.organization.name || String(doc.organization._id || ''))
        : String(doc.organization);
      if (orgName) lines.push(`Linked company/organization: ${orgName}`);
    }
    if (Array.isArray(doc.tags) && doc.tags.length) lines.push(`Tags: ${doc.tags.join(', ')}`);
    lines.push(`Do not contact: ${doc.do_not_contact ? 'yes' : 'no'}`);
    if (sales.role) lines.push(`Sales role: ${sales.role}`);
    if (sales.lead_status) lines.push(`Lead status: ${sales.lead_status}`);
    if (sales.contact_status) lines.push(`Contact status: ${sales.contact_status}`);
    const description = Array.isArray(doc.descriptionVersions) && doc.descriptionVersions.length
      ? doc.descriptionVersions[doc.descriptionVersions.length - 1]?.content
      : doc.description;
    if (description) lines.push(`Description: ${String(description).slice(0, 600)}`);
  }

  if (key === 'deals' || key === 'deal') {
    lines.push('=== DEAL SNAPSHOT (authoritative) ===');
    if (doc.name) lines.push(`Deal name: ${doc.name}`);
    if (doc.stage || doc.status) lines.push(`Stage: ${doc.stage || doc.status}`);
    if (doc.amount != null) lines.push(`Amount / expected value: ${doc.amount}`);
    if (doc.probability != null) lines.push(`Probability: ${doc.probability}%`);
    if (doc.weightedAmount != null) lines.push(`Weighted value: ${doc.weightedAmount}`);
    if (doc.closeDate || doc.expectedCloseDate) {
      lines.push(`Close date: ${doc.closeDate || doc.expectedCloseDate}`);
    }
    if (doc.dealType || doc.type) lines.push(`Deal type: ${doc.dealType || doc.type}`);
    if (doc.pipeline || doc.pipelineName) lines.push(`Pipeline: ${doc.pipelineName || doc.pipeline}`);
    const dealOwner = formatUserRef(doc.assignedTo);
    if (dealOwner) lines.push(`Owner: ${dealOwner}`);
    if (doc.description) lines.push(`Description: ${String(doc.description).slice(0, 400)}`);
  }

  pushScalarFields(lines, doc, { maxFields: fieldCap });

  if (Array.isArray(doc.stageHistory) && doc.stageHistory.length) {
    lines.push('Stage history:');
    lines.push(...formatEmbeddedActivities(doc.stageHistory, 12));
  }
  if (Array.isArray(doc.activityLogs) && doc.activityLogs.length) {
    lines.push('Embedded activity log:');
    lines.push(...formatEmbeddedActivities(doc.activityLogs, Math.max(MAX_PRIMARY_ACTIVITIES, fieldCap)));
  }

  return lines;
}

function buildRelatedSection(index, moduleKey, doc, activities, opts = {}) {
  const lines = [];
  const key = String(moduleKey || '').toLowerCase();
  const maxFields = Number.isFinite(opts.maxFields) ? opts.maxFields : 18;
  const activityLimit = Number.isFinite(opts.activityLimit) ? opts.activityLimit : MAX_RELATED_ACTIVITIES;
  lines.push(`[${index}] RELATED ${key}: ${recordLabel(key, doc)}`);
  if (key === 'people' && doc.email) {
    lines.push(`  Email: ${doc.email}`);
  }
  const assignee = formatUserRef(doc.assignedTo);
  if (assignee) lines.push(`  Assigned to: ${assignee}`);
  pushScalarFields(lines, doc, { prefix: '  ', maxFields });
  if (Array.isArray(doc.activityLogs) && doc.activityLogs.length) {
    lines.push('  Embedded activity:');
    lines.push(...formatEmbeddedActivities(doc.activityLogs, activityLimit).map((l) => `  ${l}`));
  }
  if (activities.length) {
    lines.push(`  Record activity / comments (${activities.length}):`);
    lines.push(...activities.map((l) => `  ${l}`));
  }
  return lines;
}

function collectRelatedRefs(context, { maxPerGroup = MAX_RELATED_PER_GROUP } = {}) {
  const refs = [];
  const seen = new Set();
  const relationships = Array.isArray(context?.relationships) ? context.relationships : [];
  for (const rel of relationships.slice(0, MAX_RELATED_GROUPS)) {
    const moduleKey = String(rel.target?.moduleKey || rel.moduleKey || '').toLowerCase();
    const records = Array.isArray(rel.records) ? rel.records : [];
    for (const row of records.slice(0, maxPerGroup)) {
      const id = String(row.recordId || row._id || row.id || '');
      if (!moduleKey || !id) continue;
      const dedupe = `${moduleKey}:${id}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      refs.push({
        moduleKey,
        recordId: id,
        relationshipKey: rel.relationshipKey || rel.label || moduleKey,
        stubLabel: row.label || row.name || row.title || row.secondaryText || id,
      });
    }
  }
  return refs;
}

/**
 * Astra chooses context depth from the question.
 * - sample: fast Q&A (bounded)
 * - record: in-product record page — rich primary + related + activities, latency-bounded
 * - complete: full DB coverage for counts/sums/"every record"
 * - report: 100% aggregates + small detail sample (token-safe)
 *
 * @param {string} question
 * @param {{ pageKind?: string }} [opts]
 */
function resolveAstraContextMode(question = '', opts = {}) {
  const q = String(question || '').toLowerCase();
  const pageKind = String(opts.pageKind || '').toLowerCase();
  if (!q.trim() && pageKind !== 'record') return 'sample';

  if (/\b(report|dashboard|export|spreadsheet|csv|xlsx|pdf report|status report|pipeline report|weekly report|monthly report|generate (a |an )?(report|summary)|write (a |an )?report|full report|pie chart|bar chart|line chart|chart|graph|visuali[sz]e)\b/.test(q)) {
    return 'report';
  }
  if (/\b(complete data|full data|without omitt?ing|do not omit|don't omit|all records|every (deal|contact|person|task|event|case|organization|row)|entire (pipeline|list|module|dataset)|break(down)? of (all|every)|sum of all|total of all|across all)\b/.test(q)) {
    return 'complete';
  }
  if (/\b(how many|count|total value|pipeline value|by stage|by status|aggregate|analytics)\b/.test(q)
    && /\b(all|every|overall|entire|whole)\b/.test(q)) {
    return 'complete';
  }
  // Record page: detailed but capped (avoid complete-mode 100-related fan-out).
  if (pageKind === 'record') {
    return 'record';
  }
  return 'sample';
}

function listSortSpec(moduleKey, Model) {
  const key = String(moduleKey || '').toLowerCase();
  if (key === 'events') return { modifiedTime: -1, startDateTime: -1 };
  if (key === 'tasks') return { updatedAt: -1, createdAt: -1 };
  if (Model?.schema?.paths?.updatedAt) return { updatedAt: -1 };
  if (Model?.schema?.paths?.createdAt) return { createdAt: -1 };
  return { _id: -1 };
}

async function loadListDocuments(Model, match, moduleKey, { limit }) {
  const normalizedModule = String(moduleKey || '').toLowerCase();
  let query = Model.find(match).sort(listSortSpec(normalizedModule, Model)).limit(limit);
  if (Model.schema?.paths?.assignedTo) {
    query = query.populate('assignedTo', 'firstName lastName email username');
  }
  if (normalizedModule === 'deals') {
    query = query
      .populate('contactId', 'first_name last_name firstName lastName email')
      .populate('accountId', 'name')
      .populate('assignedTo', 'firstName lastName email username');
  }
  if (normalizedModule === 'people') {
    query = query
      .populate('organization', 'name')
      .populate('lead_owner', 'firstName lastName email username');
  }
  return query.lean();
}

/**
 * Build rich CRM context for assistant / work-graph Ask.
 */
async function buildWorkGraphContextPack({
  organizationId,
  appKey = 'SALES',
  moduleKey,
  recordId,
  mode = 'sample',
  redactOptions = {},
}) {
  const citations = [];
  const lines = [];
  const normalizedModule = String(moduleKey || '').toLowerCase();
  const rawMode = String(mode || 'sample');
  const contextMode = ['complete', 'report', 'record'].includes(rawMode) ? rawMode : 'sample';
  const isRecordMode = contextMode === 'record';
  const deep = contextMode === 'complete' || contextMode === 'report' || isRecordMode;
  const relatedCap = contextMode === 'complete'
    ? MAX_RELATED_PER_GROUP_COMPLETE
    : (isRecordMode ? MAX_RELATED_PER_GROUP_RECORD : MAX_RELATED_PER_GROUP);
  const relatedTotalCap = isRecordMode ? MAX_RELATED_TOTAL_RECORD : Infinity;
  const charCap = contextMode === 'sample'
    ? MAX_CONTEXT_CHARS
    : (contextMode === 'report'
      ? MAX_REPORT_CONTEXT_CHARS
      : (isRecordMode ? MAX_RECORD_CONTEXT_CHARS : MAX_COMPLETE_CONTEXT_CHARS));
  const primaryActivityLimit = contextMode === 'complete'
    ? 80
    : (isRecordMode ? MAX_PRIMARY_ACTIVITIES_RECORD : MAX_PRIMARY_ACTIVITIES);
  const relatedActivityLimit = contextMode === 'complete'
    ? 30
    : (isRecordMode ? MAX_RELATED_ACTIVITIES_RECORD : MAX_RELATED_ACTIVITIES);
  const relatedFieldLimit = contextMode === 'complete' ? 40 : (isRecordMode ? 22 : 18);
  const primaryFieldLimit = contextMode === 'complete'
    ? (normalizedModule === 'people' ? 40 : 60)
    : (isRecordMode
      ? (normalizedModule === 'people' ? 28 : 36)
      : (normalizedModule === 'people' ? 20 : 40));

  const [context, primaryDoc] = await Promise.all([
    getRecordContext(organizationId, appKey, normalizedModule, recordId, {
      includeRelated: true,
    }),
    loadDocument(organizationId, normalizedModule, recordId),
  ]);

  if (!primaryDoc) {
    return {
      text: '',
      citations: [],
      found: false,
      contextMode,
    };
  }

  lines.push(`CRM page context for ${normalizedModule} ${recordId}`);
  lines.push(`Context mode: ${contextMode}`);
  if (deep) {
    lines.push(
      isRecordMode
        ? 'RECORD ANALYSIS: Primary fields, recent activities/comments, and top related records (with their recent activities) are included. Prefer these facts over speculation.'
        : 'DEEP RECORD ANALYSIS: Primary record fields, primary activities/comments, related records with their fields, and related-record activities are all included below. Prefer these facts over speculation.',
    );
  }
  lines.push(...buildPrimarySection(normalizedModule, primaryDoc, { maxFields: primaryFieldLimit }));

  citations.push({
    index: 1,
    sourceType: normalizedModule,
    sourceId: String(primaryDoc._id),
    excerpt: recordLabel(normalizedModule, primaryDoc).slice(0, 200),
    ...(normalizedModule === 'people' && primaryDoc.email
      ? { email: String(primaryDoc.email).trim() }
      : {}),
  });

  // Deals: surface primary contact email explicitly for compose drafts.
  if (normalizedModule === 'deals') {
    const contactId = primaryDoc.contactId || primaryDoc.primaryContactId || primaryDoc.personId;
    if (contactId) {
      const contact = await loadDocument(organizationId, 'people', String(contactId));
      if (contact) {
        lines.push('=== PRIMARY CONTACT ===');
        lines.push(`Contact: ${recordLabel('people', contact)}`);
        if (contact.email) lines.push(`Contact email: ${contact.email}`);
        citations.push({
          index: citations.length + 1,
          sourceType: 'people',
          sourceId: String(contact._id),
          excerpt: recordLabel('people', contact).slice(0, 200),
          ...(contact.email ? { email: String(contact.email).trim() } : {}),
        });
      }
    }
    // Always surface linked quotes (expiry is high-signal for coaching).
    try {
      const orgOid = mongoose.Types.ObjectId.isValid(String(organizationId))
        ? new mongoose.Types.ObjectId(String(organizationId))
        : null;
      const dealOid = mongoose.Types.ObjectId.isValid(String(primaryDoc._id))
        ? new mongoose.Types.ObjectId(String(primaryDoc._id))
        : null;
      if (orgOid && dealOid) {
        const quotes = await Quote.find({
          organizationId: orgOid,
          deletedAt: null,
          dealId: dealOid,
        })
          .sort({ updatedAt: -1 })
          .limit(6)
          .select('quoteTitle quoteNumber status validUntil expiryDate totalAmount grandTotal updatedAt')
          .lean();
        if (quotes.length) {
          lines.push(`=== LINKED QUOTES (${quotes.length}) ===`);
          for (const q of quotes) {
            const label = q.quoteTitle || q.quoteNumber || String(q._id);
            const status = q.status || 'unknown';
            const exp = q.validUntil || q.expiryDate || '';
            const amt = q.grandTotal ?? q.totalAmount;
            const expired = exp && new Date(exp).getTime() < Date.now();
            lines.push(
              `- Quote: ${label} · status=${status}`
              + (amt != null ? ` · amount=${amt}` : '')
              + (exp ? ` · validUntil=${exp}${expired ? ' (EXPIRED)' : ''}` : ''),
            );
            citations.push({
              index: citations.length + 1,
              sourceType: 'quotes',
              sourceId: String(q._id),
              excerpt: String(label).slice(0, 200),
            });
          }
        }
      }
    } catch (_) { /* non-fatal */ }
  }

  const primaryActivities = await loadRecordActivities(
    organizationId,
    normalizedModule,
    primaryDoc._id,
    primaryActivityLimit,
  );
  if (primaryActivities.length) {
    lines.push(`Primary record activity / comments (${primaryActivities.length}):`);
    lines.push(...primaryActivities);
  }

  let relatedRefs = collectRelatedRefs(context, { maxPerGroup: relatedCap });
  if (Number.isFinite(relatedTotalCap) && relatedRefs.length > relatedTotalCap) {
    relatedRefs = relatedRefs.slice(0, relatedTotalCap);
  }
  lines.push(`=== RELATED RECORDS (${relatedRefs.length}) ===`);

  let citationIndex = citations.length + 1;
  const relatedDocs = await Promise.all(
    relatedRefs.map(async (ref) => {
      const doc = await loadDocument(organizationId, ref.moduleKey, ref.recordId);
      const activities = doc
        ? await loadRecordActivities(
          organizationId,
          ref.moduleKey,
          doc._id,
          relatedActivityLimit,
        )
        : [];
      return { ref, doc, activities };
    }),
  );

  for (const { ref, doc, activities } of relatedDocs) {
    if (!doc) {
      lines.push(`[${citationIndex}] RELATED ${ref.moduleKey}: ${ref.stubLabel} (unavailable)`);
      citations.push({
        index: citationIndex,
        sourceType: ref.moduleKey,
        sourceId: ref.recordId,
        excerpt: String(ref.stubLabel).slice(0, 200),
      });
      citationIndex += 1;
      continue;
    }
    lines.push(...buildRelatedSection(citationIndex, ref.moduleKey, doc, activities, {
      maxFields: relatedFieldLimit,
      activityLimit: relatedActivityLimit,
    }));
    citations.push({
      index: citationIndex,
      sourceType: ref.moduleKey,
      sourceId: String(doc._id),
      excerpt: recordLabel(ref.moduleKey, doc).slice(0, 200),
      ...(String(ref.moduleKey).toLowerCase() === 'people' && doc.email
        ? { email: String(doc.email).trim() }
        : {}),
    });
    citationIndex += 1;
  }

  const text = redactText(lines.join('\n').slice(0, charCap), {
    preserveEmails: true,
    ...redactOptions,
  });
  return {
    text,
    citations,
    found: text.length > 40,
    updatedAt: primaryDoc.updatedAt || primaryDoc.updated_at || null,
    contextMode,
  };
}

/**
 * List / module index page context.
 * mode=sample → bounded sample; mode=complete|report → DB aggregates + all rows (hard cap).
 */
async function buildModuleListContextPack({
  organizationId,
  moduleKey,
  mode = 'sample',
  question = '',
  redactOptions = {},
}) {
  const normalizedModule = String(moduleKey || '').toLowerCase();
  const Model = getModel(normalizedModule);
  const match = listMatchQuery(normalizedModule, organizationId);
  const contextMode = ['complete', 'report'].includes(String(mode || '')) ? String(mode) : 'sample';
  if (!Model || !match) {
    return { text: '', citations: [], found: false, pageKind: 'list', contextMode };
  }

  const complete = contextMode === 'complete';
  const report = contextMode === 'report';
  const rowLimit = complete
    ? MAX_COMPLETE_RECORDS
    : (report ? MAX_REPORT_RECORDS : MAX_LIST_SAMPLE);
  const charCap = complete
    ? MAX_COMPLETE_CONTEXT_CHARS
    : (report ? MAX_REPORT_CONTEXT_CHARS : MAX_LIST_CONTEXT_CHARS);

  const lines = [
    `CRM LIST PAGE CONTEXT for module=${normalizedModule}`,
    'Staff is viewing the module list (All records), not a single record.',
    `Context mode: ${contextMode}`,
    complete
      ? 'COMPLETE DATA MODE: aggregates cover 100% of matching DB records. Detail rows below are loaded from the database for this answer.'
      : report
        ? 'REPORT MODE: aggregates cover 100% of matching DB records. Detail rows are a ranked sample for examples — use aggregates for totals, never invent amounts.'
        : 'SAMPLE MODE: use aggregates + sample. Prefer names over ids.',
  ];
  if (report) {
    lines.push(
      'REPORT MODE: produce a proper staff report from aggregates + sample rows. Use only DB facts below. Do not invent rows or amounts.',
    );
  }

  const { total, lines: aggLines, series, groupField, stats } = await buildModuleAggregates(
    Model,
    match,
    normalizedModule,
    { question }
  );
  lines.push(...aggLines);
  lines.push('=== AGGREGATES ARE COMPLETE (100% of matching records in DB) ===');

  const docs = await loadListDocuments(Model, match, normalizedModule, { limit: rowLimit });
  const sectionLabel = complete
    ? `=== DETAIL RECORDS FROM DB (${docs.length} of ${total}; hard cap ${MAX_COMPLETE_RECORDS}) ===`
    : report
      ? `=== REPORT SAMPLE ROWS (${docs.length} of ${total}; cap ${MAX_REPORT_RECORDS}; aggregates above are complete) ===`
      : `=== SAMPLE RECORDS (newest ${docs.length} of ${total}; cap ${MAX_LIST_SAMPLE}) ===`;
  lines.push(sectionLabel);

  const citations = [];
  let omittedForSize = 0;
  let usedChars = lines.join('\n').length;
  for (const doc of docs) {
    const row = summarizeListDoc(normalizedModule, doc);
    if (usedChars + row.length + 1 > charCap - 400) {
      omittedForSize += 1;
      continue;
    }
    lines.push(row);
    usedChars += row.length + 1;
    citations.push({
      index: citations.length + 1,
      sourceType: normalizedModule,
      sourceId: String(doc._id),
      excerpt: recordLabel(normalizedModule, doc).slice(0, 200),
      ...(normalizedModule === 'people' && doc.email
        ? { email: String(doc.email).trim() }
        : {}),
    });
  }

  const notLoaded = Math.max(0, total - docs.length);
  if (complete || report) {
    if (notLoaded > 0) {
      lines.push(
        `Memory cap: ${notLoaded} record(s) exist beyond the ${rowLimit} row load. Aggregates above still include ALL ${total} records — use aggregates for totals; do not invent missing detail rows.`,
      );
    }
    if (omittedForSize > 0) {
      lines.push(
        `Size cap: ${omittedForSize} loaded row(s) omitted from text to fit context. Aggregates remain complete for all ${total} records.`,
      );
    }
    if (complete && notLoaded === 0 && omittedForSize === 0) {
      lines.push(`All ${total} matching record(s) are included in detail below/above.`);
    }
  } else if (total > docs.length) {
    lines.push(
      `Note: ${total - docs.length} additional record(s) exist but were omitted from the sample. Ask for a report / complete data if you need every row.`,
    );
  }

  const text = redactText(lines.join('\n').slice(0, charCap), {
    preserveEmails: true,
    ...redactOptions,
  });
  return {
    text,
    citations,
    found: text.length > 40,
    pageKind: 'list',
    contextMode,
    totalRecords: total,
    sampleSize: docs.length,
    completeCoverage: complete && notLoaded === 0 && omittedForSize === 0,
    visualSeries: series,
    groupField: groupField || '',
    stats: stats || null,
  };
}

const WORKSPACE_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'at', 'with', 'from',
  'me', 'my', 'i', 'we', 'our', 'you', 'your', 'this', 'that', 'these', 'those',
  'prepare', 'prep', 'help', 'please', 'summarize', 'summary', 'suggest', 'suggestion',
  'talking', 'points', 'point', 'related', 'context', 'lookup', 'search', 'find',
  'about', 'into', 'across', 'based', 'using', 'need', 'needs', 'want', 'can', 'could',
  'should', 'would', 'today', 'tomorrow', 'upcoming', 'next', 'all', 'every', 'brief',
  'meeting', 'call', 'email', 'draft', 'write', 'create', 'update', 'clear', 'finish',
  'item', 'items', 'thing', 'things', 'due', 'overdue', 'order', 'impact', 'action',
  'plan', 'short', 'give', 'them', 'their', 'by', 'first',
]);

/**
 * Extract search phrases from a free-form Astra question for workspace lookup.
 */
function extractWorkspaceSearchQueries(question = '') {
  const raw = String(question || '').trim();
  if (!raw) return [];

  const queries = [];
  const quoted = [...raw.matchAll(/[“”"']([^“”"']{2,80})[“”"']/g)];
  for (const match of quoted) {
    const phrase = String(match[1] || '').trim();
    if (phrase) queries.push(phrase);
  }

  const cleaned = raw
    .replace(/[“”"']/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !WORKSPACE_STOP_WORDS.has(t.toLowerCase()));

  // Prefer multi-word name/title fragments (e.g. "Sports meeting Darshan" → keep meaningful chunks)
  if (tokens.length >= 2) {
    queries.push(tokens.slice(0, 6).join(' '));
  }
  for (const token of tokens) {
    if (/^[A-Z]/.test(token) || token.length >= 4) {
      queries.push(token);
    }
  }

  const unique = [];
  const seen = new Set();
  for (const q of queries) {
    const key = q.toLowerCase();
    if (seen.has(key) || key.length < 2) continue;
    seen.add(key);
    unique.push(q);
    if (unique.length >= 4) break;
  }
  return unique;
}

/** Short / definite-reference turns that inherit the active contact/deal from chat history. */
function isThinFollowUpQuestion(question = '') {
  const q = String(question || '').trim();
  if (!q || q.length > 140) return false;
  // Non-CRM artifacts — never sticky to prior contact/pipeline context.
  if (/\b(content|contents|document|documents|file|files|deck|slides?|presentation|brief|briefing|outline|canvas)\b/i.test(q)) {
    return false;
  }
  if (/\b(the|that|this|his|her|their|its)\s+(quote|quotes|deal|deals|contact|person|lead|account|organization|company|task|event|meeting|case|email|opportunity)\b/i.test(q)) {
    return true;
  }
  if (/^(give|show|get|fetch|open|send|share|find)\s+(me\s+)?(the|that|this)\b/i.test(q)) {
    return true;
  }
  if (/^(what about|and|also|same)\b/i.test(q)) return true;
  if (/\b(for (him|her|them|this)|same (person|contact|deal))\b/i.test(q)) return true;
  return false;
}

/** Short deepeners that continue the open thread without naming a new subject. */
function isStickyDeepenerQuestion(question = '') {
  const q = String(question || '').trim();
  if (!q || q.length > 160) return false;
  if (/^(more details?|tell me more|go deeper|expand on (that|this|it)|continue|keep going|go on)\.?$/i.test(q)) {
    return true;
  }
  if (/^(i want |give me |get me |show me )?(more |a |the )?(detail(?:ed)?|deeper|full|further)(\s+(analy[sz]e|analysis|breakdown|overview|details?|info|information))?\.?$/i.test(q)) {
    return true;
  }
  if (/^(detail(?:ed)?|deep)\s+analy[sz](is|e)\.?$/i.test(q)) return true;
  if (/^(what else|anything else|and then|next)\??$/i.test(q)) return true;
  // Pronoun / relative asks without a new primary entity
  if (/\b(their|them|they|this|that|it)\b/i.test(q) && q.length <= 120) return true;
  return false;
}

/**
 * User clearly starts a different task (org-wide CRM, new person, pivot language).
 * Sticky conversation focus must NOT override these.
 * Keep this conservative — false switches break free-form follow-ups.
 */
function isExplicitTopicSwitch(question = '', anchors = []) {
  const q = String(question || '').trim();
  if (!q) return false;
  if (/\b(instead|different topic|new topic|forget (?:that|this|it)|never ?mind|unrelated|start over|new (?:chat|thread))\b/i.test(q)) {
    return true;
  }
  // Company leadership / public role — never answer from sticky CRM contact
  try {
    const { isCompanyLeadershipQuestion } = require('./aiWebResearchService');
    if (isCompanyLeadershipQuestion(q)) return true;
  } catch (_) { /* ignore */ }
  // Org-wide / personal CRM analytics with no thread reference
  if (/\b(my |our |all |the )?(pipeline|open deals?|closed won|closed lost|stage distribution|deals? by stage)\b/i.test(q)
    && !/\b(their|this company|that company|the (?:company|organization|website|site)|about (?:them|it))\b/i.test(q)) {
    return true;
  }
  if (/\b(due today|overdue|my (?:tasks?|meetings?|calendar)|meetings? today|tasks? due)\b/i.test(q)) {
    return true;
  }
  const focusBlob = (Array.isArray(anchors) ? anchors : []).join(' ').toLowerCase();

  // New contact/company only when user explicitly introduces them
  const intro = q.match(
    /\b(?:about|summarize|summary of|contact|person|with|for)\s+([A-Z][\p{L}'.-]+(?:\s+[A-Z][\p{L}'.-]+)+)/u,
  );
  if (intro?.[1]) {
    const name = intro[1].trim().toLowerCase();
    if (name.length >= 3 && focusBlob && !focusBlob.includes(name)) {
      return true;
    }
  }

  // New website host when ask is about that host and it is not already in focus
  const host = q.match(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)\b/i);
  if (host?.[1]) {
    const h = host[1].toLowerCase();
    const brand = h.split('.')[0];
    if (focusBlob && !focusBlob.includes(h) && !focusBlob.includes(brand)) {
      if (/\b(website|site|analy[sz]|research|about|look up|from (?:the )?(?:web|internet))\b/i.test(q)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Pull person/company/website anchors from recent chat turns so follow-ups
 * stay on the same thread without re-naming the subject every time.
 */
function extractConversationEntityAnchors(history = []) {
  const texts = (Array.isArray(history) ? history : [])
    .slice(-12)
    .map((row) => String(row?.content || row?.body || '').trim())
    .filter(Boolean);
  const anchors = [];
  const push = (phrase) => {
    const p = String(phrase || '').trim().replace(/\s+/g, ' ');
    if (p.length < 2 || p.length > 80) return;
    if (/^(reports?e2e|give|show|the|and|open|deal|quote|summarize|summary|pipeline|overview|metrics|analysis|key takeaway)\b/i.test(p)) {
      return;
    }
    anchors.push(p);
  };

  for (const text of texts) {
    for (const match of text.matchAll(/[“”"']([^“”"']{2,80})[“”"']/g)) {
      push(match[1]);
    }
    const withName = text.match(
      /\b(?:summarize|summary of|about|with|for|contact|person)\s+([A-Z][\p{L}'.-]+(?:\s+[A-Z][\p{L}'.-]+){0,3})/u,
    );
    if (withName) push(withName[1]);
    for (const match of text.matchAll(/\b([A-Z][\p{L}'.-]+(?:\s+[A-Z][\p{L}'.-]+)+)\b/gu)) {
      push(match[1]);
    }
    for (const match of text.matchAll(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.(?:com|io|co|net|org|ai|app)(?:\.[a-z]{2,})?)\b/gi)) {
      push(match[1]);
      const brand = String(match[1] || '').split('.')[0];
      if (brand && brand.length >= 3) push(brand.charAt(0).toUpperCase() + brand.slice(1));
    }
    // "Conversation focus: X; Y" from prior blended turns
    const focusLine = text.match(/\[?Conversation focus[:\]]\s*([^\n]+)/i);
    if (focusLine?.[1]) {
      for (const part of focusLine[1].split(/[;|,]/)) push(part);
    }
  }

  const unique = [];
  const seen = new Set();
  // Prefer longer phrases (full names) first.
  for (const a of anchors.sort((x, y) => y.length - x.length)) {
    const key = a.toLowerCase();
    if (seen.has(key)) continue;
    // Skip if a longer unique already contains this token-only fragment.
    if (unique.some((u) => u.toLowerCase().includes(key) && u.length > a.length)) continue;
    seen.add(key);
    unique.push(a);
    if (unique.length >= 5) break;
  }
  return unique;
}

/**
 * Default for ALL same-chat turns: keep Conversation focus.
 * Only drop sticky focus when the user explicitly starts a different task.
 */
function resolveWorkspaceQuestionWithHistory(question = '', history = []) {
  const q = String(question || '').trim();
  const anchors = extractConversationEntityAnchors(history);
  if (!q || !anchors.length) {
    return {
      question: q,
      anchors,
      searchQueries: extractWorkspaceSearchQueries(q),
      sticky: false,
      explicitSwitch: false,
    };
  }
  const qLower = q.toLowerCase();
  const alreadyNamed = anchors.some((a) => qLower.includes(a.toLowerCase()));
  const explicitSwitch = isExplicitTopicSwitch(q, anchors);
  const baseQueries = extractWorkspaceSearchQueries(q);
  // Always sticky in the same chat unless user explicitly switches task.
  const sticky = !explicitSwitch;
  const blended = sticky
    ? `${q}\n[Conversation focus: ${anchors.join('; ')}]`
    : q;
  const searchQueries = [];
  const seen = new Set();
  for (const item of [...(sticky ? anchors : []), ...baseQueries, ...extractWorkspaceSearchQueries(blended)]) {
    const key = String(item || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    searchQueries.push(item);
    if (searchQueries.length >= 6) break;
  }
  return {
    question: blended,
    anchors,
    searchQueries,
    sticky,
    explicitSwitch,
    alreadyNamed,
  };
}

function flattenSearchHits(results = {}) {
  const modules = ['people', 'organizations', 'deals', 'tasks', 'events', 'forms', 'items', 'quotes'];
  const hits = [];
  for (const moduleKey of modules) {
    const rows = Array.isArray(results[moduleKey]) ? results[moduleKey] : [];
    for (const row of rows) {
      hits.push({
        moduleKey,
        id: String(row.id || row._id || ''),
        title: String(row.title || '').trim(),
        subtitle: String(row.subtitle || '').trim(),
        route: String(row.route || '').trim(),
      });
    }
  }
  return hits.filter((h) => h.id && h.title);
}

function isAttentionWorkQuestion(question = '') {
  const q = String(question || '').toLowerCase();
  return /\b(due today|due tomorrow|overdue|needs? attention|action items?|work items?|to-?dos?)\b/.test(q)
    || /\b(items?|things?)\s+(due|overdue)\b/.test(q)
    || /\b(due|overdue)\s+(items?|things?|tasks?|work)\b/.test(q);
}

/** Meetings / events schedule questions ("do I have any meetings today?"). */
function isCalendarScheduleQuestion(question = '') {
  const q = String(question || '').toLowerCase();
  const hasCalendarNoun = /\b(meeting|meetings|event|events|appointment|appointments|calendar)\b/.test(q);
  if (!hasCalendarNoun) return false;
  return /\b(today|tonight|tomorrow|this week|next week|upcoming|scheduled|do i have|any (meetings|events)|next (meeting|event)|my (meetings|events|calendar))\b/.test(q);
}

/**
 * User wants content produced (deck/slides/brief), not a CRM reminder task.
 * Includes common typos (prepate) and "prepare … for the meeting" without saying task.
 */
function isContentCreationQuestion(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  if (/\b(create|add|schedule|set)\s+(a\s+)?(task|reminder|to-?do)\b/.test(q)) return false;

  // Bare content asks ("give me the content") — Content Studio / docs, not CRM pipeline.
  if (/^(give|show|get|open|find|share)\s+(me\s+)?(the\s+)?content\b/.test(q)
    || /\b(content studio|my content|content documents?)\b/.test(q)) {
    return true;
  }

  // Require an explicit content artifact — bare "prepare for the meeting" is CRM Canvas, not a deck.
  const artifact = /\b(deck|slides?|slideshow|presentation|pitch\s*deck|one[- ]pager|leave[- ]behind|meeting\s+brief|briefing|outline)\b/;
  const verb = /\b(prepare|prepate|prep|create|make|build|draft|write|generate|compose|put together)\b/;
  return artifact.test(q) && verb.test(q);
}

function ymdInTimeZone(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date instanceof Date ? date : new Date(date));
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().slice(0, 10);
  }
}

function formatInstantInTimeZone(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(date instanceof Date ? date : new Date(date));
  } catch {
    return String(date);
  }
}

async function resolveAstraTimeZone(organizationId, userId) {
  try {
    const [org, user] = await Promise.all([
      organizationId
        ? Organization.findById(organizationId).select('settings.timeZone').lean()
        : null,
      userId
        ? User.findById(userId).select('onboarding.profile.timeZone').lean()
        : null,
    ]);
    return (
      user?.onboarding?.profile?.timeZone
      || org?.settings?.timeZone
      || 'UTC'
    );
  } catch {
    return 'UTC';
  }
}

/**
 * Deterministic calendar buckets for "meetings today / next meeting" — assigned to current user.
 * Prefer this over unsorted module samples so the model cannot pick a past event as "next".
 */
async function buildCalendarMeetingsContextLines({ organizationId, userId }) {
  if (!organizationId || !userId) {
    return { lines: [], citations: [], todayCount: 0, upcomingCount: 0 };
  }

  const timeZone = await resolveAstraTimeZone(organizationId, userId);
  const now = new Date();
  const todayYmd = ymdInTimeZone(now, timeZone);
  let tomorrowYmd = todayYmd;
  try {
    const { DateTime } = require('luxon');
    tomorrowYmd = DateTime.fromJSDate(now, { zone: timeZone }).plus({ days: 1 }).toISODate();
  } catch (_) {
    const t = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    tomorrowYmd = ymdInTimeZone(t, timeZone);
  }
  const rangeStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  let docs = [];
  try {
    docs = await Event.find({
      organizationId,
      deletedAt: null,
      status: { $nin: ['Cancelled'] },
      startDateTime: { $gte: rangeStart, $lte: rangeEnd },
      $or: [
        { assignedTo: userId },
        { createdBy: userId },
        { auditorId: userId },
        { reviewerId: userId },
        { correctiveOwnerId: userId },
      ],
    })
      .sort({ startDateTime: 1 })
      .limit(100)
      .select('eventName eventType startDateTime endDateTime status')
      .lean();
  } catch (err) {
    console.warn('[AstraWorkspaceContext] Calendar meetings query failed:', err?.message || err);
    return { lines: [], citations: [], todayCount: 0, upcomingCount: 0 };
  }

  const today = [];
  const tomorrow = [];
  const upcoming = [];
  const recentPast = [];
  for (const doc of docs) {
    if (!doc.startDateTime) continue;
    const start = new Date(doc.startDateTime);
    const ymd = ymdInTimeZone(start, timeZone);
    if (ymd === todayYmd) today.push(doc);
    else if (ymd === tomorrowYmd) tomorrow.push(doc);
    else if (start >= now) upcoming.push(doc);
    else recentPast.push(doc);
  }

  const remainingToday = today.filter((d) => new Date(d.startDateTime) >= now);
  const nextMeeting = remainingToday[0] || tomorrow[0] || upcoming[0] || null;
  const plannedTotal = docs.filter((d) => String(d.status || '') === 'Planned').length;

  const formatRow = (doc, idx) => {
    const start = new Date(doc.startDateTime);
    const local = formatInstantInTimeZone(start, timeZone);
    return `${idx}. ${doc.eventName || 'Untitled'} type=${doc.eventType || 'Meeting'} status=${doc.status || ''} start=${doc.startDateTime} local=${local} ymd=${ymdInTimeZone(start, timeZone)} (id=${doc._id})`;
  };

  const lines = [
    '=== CALENDAR MEETINGS (source of truth for meetings/events today / tomorrow / next meeting — assigned to current user) ===',
    `Now: ${now.toISOString()} (timezone=${timeZone}, todayYmd=${todayYmd}, tomorrowYmd=${tomorrowYmd})`,
    `Counts: today=${today.length}, tomorrow=${tomorrow.length}, remainingToday=${remainingToday.length}, upcomingAfterTomorrow=${upcoming.length}, plannedInWindow=${plannedTotal}`,
    'For "meetings/events today": answer ONLY from Today below.',
    'For "meetings/events tomorrow": answer ONLY from Tomorrow below. Never include other days.',
    'Next meeting = first Remaining today, else first Tomorrow, else first Upcoming. Never pick a past startDateTime as next.',
  ];
  const citations = [];

  const pushGroup = (title, rows, limit = 25) => {
    lines.push(`--- ${title} (${rows.length}) ---`);
    if (!rows.length) {
      lines.push('(none)');
      return;
    }
    rows.slice(0, limit).forEach((doc, idx) => {
      lines.push(formatRow(doc, idx + 1));
      citations.push({
        index: citations.length + 1,
        sourceType: 'events',
        sourceId: String(doc._id),
        excerpt: String(doc.eventName || '').slice(0, 200),
      });
    });
  };

  pushGroup('Today', today);
  pushGroup('Tomorrow', tomorrow);
  pushGroup('Remaining today (start >= now)', remainingToday);
  pushGroup('Upcoming after tomorrow', upcoming, 15);
  if (nextMeeting) {
    lines.push(
      `--- Next meeting ---`,
      formatRow(nextMeeting, 1),
    );
  } else {
    lines.push('--- Next meeting ---', '(none in window)');
  }
  if (recentPast.length) {
    pushGroup('Recent past (context only — not next)', recentPast.slice(-5), 5);
  }

  return {
    lines,
    citations,
    todayCount: today.length,
    upcomingCount: upcoming.length + remainingToday.length + tomorrow.length,
  };
}

/**
 * Same Attention source as Platform Home / inbox — assigned tasks & events for this user.
 * Calendar-day "due today" matches summarizeAttentionItems in platformHomeService.
 */
async function buildAttentionInboxContextLines({ organizationId, userId }) {
  if (!organizationId || !userId) {
    return { lines: [], citations: [], dueTodayCount: 0, overdueCount: 0 };
  }
  let items = [];
  try {
    const { buildInboxItemsForUser } = require('../../controllers/inboxController');
    items = await buildInboxItemsForUser(userId, organizationId);
  } catch (err) {
    console.warn('[AstraWorkspaceContext] Attention inbox failed:', err?.message || err);
    return { lines: [], citations: [], dueTodayCount: 0, overdueCount: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const overdue = [];
  const dueToday = [];
  const upcoming = [];
  for (const item of items) {
    if (item.isOverdue) {
      overdue.push(item);
      continue;
    }
    if (!item.dueAt) continue;
    const due = new Date(item.dueAt);
    if (due >= today && due < tomorrow) dueToday.push(item);
    else if (due >= tomorrow) upcoming.push(item);
  }

  const formatRow = (item, idx) => {
    const kind = item.kind === 'event' ? 'event' : 'task';
    const due = item.dueAt ? ` dueAt=${item.dueAt}` : '';
    const label = item.attentionLabel ? ` [${item.attentionLabel}]` : '';
    const related = item.relatedLabel ? ` — ${item.relatedLabel}` : '';
    return `${idx}. (${kind}) ${item.title || 'Untitled'}${label}${related}${due} (id=${item.id})`;
  };

  const lines = [
    '=== ATTENTION (source of truth for due today / overdue — assigned to current user) ===',
    `Counts: overdue=${overdue.length}, dueToday=${dueToday.length}, upcomingNearTerm=${upcoming.length}, attentionTotal=${items.length}`,
    'For "due today" / "finish my tasks due today" questions: answer ONLY from Due today / Overdue below. Do not claim zero if Due today lists any rows.',
  ];
  const citations = [];

  const pushGroup = (title, rows) => {
    lines.push(`--- ${title} (${rows.length}) ---`);
    if (!rows.length) {
      lines.push('(none)');
      return;
    }
    rows.slice(0, 25).forEach((item, idx) => {
      lines.push(formatRow(item, idx + 1));
      citations.push({
        index: citations.length + 1,
        sourceType: item.kind === 'event' ? 'events' : 'tasks',
        sourceId: String(item.id),
        excerpt: String(item.title || '').slice(0, 200),
      });
    });
  };

  pushGroup('Overdue', overdue);
  pushGroup('Due today', dueToday);
  pushGroup('Upcoming (near-term Attention)', upcoming.slice(0, 10));

  return {
    lines,
    citations,
    dueTodayCount: dueToday.length,
    overdueCount: overdue.length,
  };
}

/**
 * Infer which CRM modules a workspace question likely needs (tenant-scoped list queries).
 */
function detectWorkspaceModulesFromQuestion(question = '') {
  const q = String(question || '').toLowerCase();
  const modules = [];
  const push = (key) => {
    if (!modules.includes(key)) modules.push(key);
  };

  // "items due today / overdue items" = attention work (tasks/events), NOT inventory Items module.
  const attentionWork = isAttentionWorkQuestion(q);

  if (attentionWork) {
    push('tasks');
    push('events');
  }

  if (/\b(deal|deals|pipeline|opportunit|won|lost|stage)\b/.test(q)) push('deals');
  if (/\b(task|tasks|to-?dos?|todo)\b/.test(q) || attentionWork) push('tasks');
  if (/\b(event|events|meeting|meetings|calendar|appointment)\b/.test(q) || attentionWork) {
    push('events');
  }
  if (/\b(people|person|contact|contacts|lead|leads)\b/.test(q)) push('people');
  if (/\b(organization|organizations|company|companies|account|accounts)\b/.test(q)) {
    push('organizations');
  }
  if (/\b(case|cases|ticket|tickets|helpdesk)\b/.test(q)) push('cases');

  // Inventory Items only when clearly product/SKU language — never from "items due today".
  if (!attentionWork && /\b(sku|inventory|product|products|catalog)\b/.test(q)) {
    push('items');
  } else if (!attentionWork && /\b(item module|items module|inventory items?)\b/.test(q)) {
    push('items');
  }

  // Broad analytics / “what’s going on” → deals first (token control).
  // Only pull tasks/events when the question names them.
  if (!modules.length && /\b(how many|count|total|pipeline|report|dashboard|summary|overview)\b/.test(q)) {
    push('deals');
    if (/\b(task|tasks|to-?dos?|todo)\b/.test(q)) push('tasks');
    if (/\b(event|events|meeting|meetings|calendar)\b/.test(q)) push('events');
  }

  return modules.slice(0, 4);
}

/**
 * Full-app Astra context when no single CRM page is focused.
 * Tenant-isolated reads only (Global Search + module list packs + record expansion).
 * Never used for deletes; callers must not auto-write from this pack.
 */
async function buildWorkspaceContextPack({
  organizationId,
  userId = null,
  appKey = 'SALES',
  question = '',
  mode = 'sample',
  history = [],
  onProgress = null,
  redactOptions = {},
}) {
  const emit = (step, detail = '') => {
    if (typeof onProgress === 'function') {
      try { onProgress({ step, detail: detail || undefined }); } catch (_) { /* ignore */ }
    }
  };
  const contextMode = ['complete', 'report'].includes(String(mode || '')) ? String(mode) : 'sample';
  const searchService = require('../searchService');
  const resolved = resolveWorkspaceQuestionWithHistory(question, history);
  const effectiveQuestion = resolved.question || question;
  const queries = resolved.searchQueries.length
    ? resolved.searchQueries
    : extractWorkspaceSearchQueries(effectiveQuestion);
  const moduleKeys = detectWorkspaceModulesFromQuestion(effectiveQuestion);
  const qLower = String(effectiveQuestion || '').toLowerCase();
  const attentionWork = isAttentionWorkQuestion(qLower);
  const calendarSchedule = isCalendarScheduleQuestion(qLower);
  const citations = [];
  const lines = [
    'CRM workspace context (full-app mode — tenant-isolated READS only)',
    'Policy: query/search allowed; never delete; never write directly (propose create/update only).',
    `Context mode: ${contextMode}`,
    `Organization scope: ${organizationId}`,
  ];
  if (resolved.anchors.length) {
    lines.push(`Conversation focus (from chat history): ${resolved.anchors.join('; ')}`);
  }
  if (resolved.sticky && resolved.anchors.length) {
    lines.push(
      'FOLLOW-UP RULE: keep answering about Conversation focus above. Do not switch to org-wide pipeline/deals/tasks unless the user explicitly names that new task.',
    );
  } else if (resolved.explicitSwitch) {
    lines.push(
      'EXPLICIT TASK SWITCH: user started a new task — answer that ask; Conversation focus is background only.',
    );
  }
  if (attentionWork) {
    lines.push(
      'Semantic note: "items due today / overdue items" means Attention tasks and events — NOT the inventory Items product module.',
    );
  }

  // 0) Attention + calendar packs in parallel when both apply
  emit('gathering_context');
  const [attentionResult, calendarResult] = await Promise.all([
    attentionWork
      ? (emit('loading_attention'), buildAttentionInboxContextLines({ organizationId, userId }))
      : Promise.resolve(null),
    calendarSchedule
      ? (emit('loading_calendar'), buildCalendarMeetingsContextLines({ organizationId, userId }))
      : Promise.resolve(null),
  ]);

  let hasAttentionPack = false;
  if (attentionResult?.lines?.length) {
    hasAttentionPack = true;
    lines.push('');
    lines.push(...attentionResult.lines);
    for (const c of attentionResult.citations) {
      citations.push({ ...c, index: citations.length + 1 });
    }
  }

  let hasCalendarPack = false;
  if (calendarResult?.lines?.length) {
    hasCalendarPack = true;
    lines.push('');
    lines.push(...calendarResult.lines);
    for (const c of calendarResult.citations) {
      citations.push({ ...c, index: citations.length + 1 });
    }
  }

  // 1) Entity search — parallel queries
  if (queries.length) {
    emit('searching_workspace', queries.slice(0, 3).join(', '));
    lines.push(`Search queries: ${queries.join(' | ')}`);
    const hitMap = new Map();
    const searchPacks = await Promise.all(
      queries.map(async (q) => {
        try {
          return await searchService.searchAll(organizationId, q, { limitPerModule: 4 });
        } catch (err) {
          console.warn('[AstraWorkspaceContext] search failed:', err?.message || err);
          return null;
        }
      }),
    );
    for (const pack of searchPacks) {
      if (!pack?.results) continue;
      for (const hit of flattenSearchHits(pack.results)) {
        if (attentionWork && hit.moduleKey === 'items') continue;
        const key = `${hit.moduleKey}:${hit.id}`;
        if (!hitMap.has(key)) hitMap.set(key, hit);
      }
    }

    const hitsRaw = [...hitMap.values()];
    const anchorLower = (resolved.anchors || []).map((a) => a.toLowerCase());
    const scoreHit = (hit) => {
      const title = `${hit.title} ${hit.subtitle}`.toLowerCase();
      let score = 0;
      if (hit.moduleKey === 'people') score += 5;
      if (anchorLower.some((a) => title.includes(a) || a.includes(title.slice(0, 40)))) score += 20;
      if (/\bquote\b/.test(qLower) && /quote/i.test(hit.moduleKey + hit.title)) score += 3;
      return score;
    };
    const hits = hitsRaw
      .sort((a, b) => scoreHit(b) - scoreHit(a))
      .slice(0, 12);
    if (hits.length) {
      lines.push(`=== SEARCH HITS (${hits.length}) ===`);
      hits.forEach((hit, idx) => {
        lines.push(
          `${idx + 1}. [${hit.moduleKey}] ${hit.title}`
          + (hit.subtitle ? ` — ${hit.subtitle}` : '')
          + ` (id=${hit.id})`,
        );
        citations.push({
          index: citations.length + 1,
          sourceType: hit.moduleKey,
          sourceId: hit.id,
          excerpt: hit.title.slice(0, 200),
        });
      });

      const expandable = hits
        .filter((h) => ['people', 'organizations', 'deals', 'tasks', 'events', 'cases', 'quotes'].includes(h.moduleKey))
        .sort((a, b) => scoreHit(b) - scoreHit(a))
        .slice(0, 3);

      if (expandable.length) {
        emit('expanding_records', expandable.map((h) => h.title).slice(0, 2).join(', '));
        const expandedPacks = await Promise.all(
          expandable.map(async (hit) => {
            try {
              const pack = await buildWorkGraphContextPack({
                organizationId,
                appKey,
                moduleKey: hit.moduleKey,
                recordId: hit.id,
                mode: contextMode === 'sample' ? 'sample' : contextMode,
              });
              return { hit, pack };
            } catch (err) {
              console.warn('[AstraWorkspaceContext] expand failed:', err?.message || err);
              return { hit, pack: null };
            }
          }),
        );
        for (const { hit, pack } of expandedPacks) {
          if (!pack?.text) continue;
          lines.push('');
          lines.push(`=== EXPANDED RECORD: ${hit.moduleKey} / ${hit.title} ===`);
          lines.push(pack.text);
          for (const c of pack.citations || []) {
            citations.push({
              ...c,
              index: citations.length + 1,
            });
          }
        }
      }
    } else {
      lines.push('No CRM records matched those search queries.');
    }
  } else {
    lines.push('No searchable entity names detected in the question.');
  }

  // 2) Module list / aggregate packs — parallel
  let listModules = (moduleKeys.length
    ? moduleKeys
    : (contextMode === 'complete' || contextMode === 'report' ? ['deals', 'tasks'] : []))
    .filter((key) => !(attentionWork && key === 'items'))
    .filter((key) => !(hasAttentionPack && (key === 'tasks' || key === 'events')))
    .filter((key) => !(hasCalendarPack && key === 'events'));

  if (
    /\b(overview|pipeline|dashboard|summary)\b/.test(qLower)
    && !/\b(task|tasks|event|events|meeting|meetings|contact|contacts|every record|all records|complete data)\b/.test(qLower)
  ) {
    listModules = listModules.includes('deals') ? ['deals'] : listModules.slice(0, 1);
  }

  const listPackMode = contextMode === 'complete' ? 'complete' : (
    contextMode === 'report' ? 'report' : 'sample'
  );

  let visualSeries = [];
  let visualGroupField = '';
  let visualStats = null;
  let visualModuleKey = '';
  let visualTotalRecords = 0;

  if (listModules.length) {
    emit('loading_module_data', listModules.join(', '));
    const modulePacks = await Promise.all(
      listModules.map(async (moduleKey) => {
        try {
          const pack = await buildModuleListContextPack({
            organizationId,
            moduleKey,
            mode: listPackMode,
            question: effectiveQuestion || question,
          });
          return { moduleKey, pack };
        } catch (err) {
          console.warn('[AstraWorkspaceContext] module list failed:', moduleKey, err?.message || err);
          return { moduleKey, pack: null };
        }
      }),
    );
    for (const { moduleKey, pack } of modulePacks) {
      if (pack?.text) {
        lines.push('');
        lines.push(`=== MODULE QUERY: ${moduleKey} ===`);
        lines.push(pack.text);
        for (const c of pack.citations || []) {
          citations.push({
            ...c,
            index: citations.length + 1,
          });
        }
      }
      const series = Array.isArray(pack?.visualSeries) ? pack.visualSeries : [];
      if (
        series.length
        && (!visualSeries.length || moduleKey === 'deals')
      ) {
        visualSeries = series;
        visualGroupField = pack.groupField || '';
        visualStats = pack.stats || null;
        visualModuleKey = moduleKey;
        visualTotalRecords = Number(pack.totalRecords) || 0;
      }
    }
  }

  const charCap = contextMode === 'sample'
    ? MAX_CONTEXT_CHARS
    : (contextMode === 'report' ? MAX_REPORT_CONTEXT_CHARS : MAX_COMPLETE_CONTEXT_CHARS);
  const text = redactText(lines.join('\n').slice(0, charCap), {
    preserveEmails: true,
    ...redactOptions,
  });
  return {
    text,
    citations,
    found: text.length > 80,
    pageKind: 'workspace',
    contextMode,
    visualSeries,
    groupField: visualGroupField,
    stats: visualStats,
    visualModuleKey,
    totalRecords: visualTotalRecords,
  };
}

module.exports = {
  buildWorkGraphContextPack,
  buildModuleListContextPack,
  buildWorkspaceContextPack,
  extractWorkspaceSearchQueries,
  extractConversationEntityAnchors,
  isThinFollowUpQuestion,
  isStickyDeepenerQuestion,
  isExplicitTopicSwitch,
  resolveWorkspaceQuestionWithHistory,
  detectWorkspaceModulesFromQuestion,
  isAttentionWorkQuestion,
  isCalendarScheduleQuestion,
  isContentCreationQuestion,
  resolveAstraContextMode,
  resolveAstraChartType,
  looksLikeChartIntent,
  buildAstraVisualsFromSeries,
  loadDocument,
  resolveAstraTimeZone,
  ymdInTimeZone,
  formatInstantInTimeZone,
  MAX_CONTEXT_CHARS,
  MAX_LIST_CONTEXT_CHARS,
  MAX_COMPLETE_CONTEXT_CHARS,
  MAX_LIST_SAMPLE,
  MAX_COMPLETE_RECORDS,
};
