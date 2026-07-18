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

const MAX_CONTEXT_CHARS = 20000;
const MAX_LIST_CONTEXT_CHARS = 24000;
const MAX_COMPLETE_CONTEXT_CHARS = 120000;
const MAX_LIST_SAMPLE = 50;
const MAX_COMPLETE_RECORDS = 2000;
const MAX_RELATED_GROUPS = 20;
const MAX_RELATED_PER_GROUP = 10;
const MAX_RELATED_PER_GROUP_COMPLETE = 100;
const MAX_PRIMARY_ACTIVITIES = 40;
const MAX_RELATED_ACTIVITIES = 12;

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

async function buildModuleAggregates(Model, match, moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  const lines = [];
  const series = [];
  const total = await Model.countDocuments(match);
  lines.push(`Total accessible records: ${total}`);

  const groupField = key === 'deals'
    ? 'stage'
    : (key === 'tasks' || key === 'events' || key === 'cases' || key === 'organizations'
      ? 'status'
      : null);

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
    if (groups.length) {
      lines.push(`Breakdown by ${groupField}:`);
      for (const row of groups) {
        const label = row._id == null || row._id === '' ? '(empty)' : String(row._id);
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
    query = query.populate('organization', 'name industry status');
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

function buildPrimarySection(moduleKey, doc) {
  const lines = [];
  const key = String(moduleKey || '').toLowerCase();
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

  pushScalarFields(lines, doc, { maxFields: key === 'people' ? 20 : 40 });

  if (Array.isArray(doc.stageHistory) && doc.stageHistory.length) {
    lines.push('Stage history:');
    lines.push(...formatEmbeddedActivities(doc.stageHistory, 12));
  }
  if (Array.isArray(doc.activityLogs) && doc.activityLogs.length) {
    lines.push('Embedded activity log:');
    lines.push(...formatEmbeddedActivities(doc.activityLogs, MAX_PRIMARY_ACTIVITIES));
  }

  return lines;
}

function buildRelatedSection(index, moduleKey, doc, activities) {
  const lines = [];
  const key = String(moduleKey || '').toLowerCase();
  lines.push(`[${index}] RELATED ${key}: ${recordLabel(key, doc)}`);
  if (key === 'people' && doc.email) {
    lines.push(`  Email: ${doc.email}`);
  }
  const assignee = formatUserRef(doc.assignedTo);
  if (assignee) lines.push(`  Assigned to: ${assignee}`);
  pushScalarFields(lines, doc, { prefix: '  ', maxFields: 18 });
  if (Array.isArray(doc.activityLogs) && doc.activityLogs.length) {
    lines.push('  Embedded activity:');
    lines.push(...formatEmbeddedActivities(doc.activityLogs, MAX_RELATED_ACTIVITIES).map((l) => `  ${l}`));
  }
  if (activities.length) {
    lines.push('  Record activity / comments:');
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
 * - complete: full DB coverage for counts/sums/"every record"
 * - report: same as complete + report-oriented framing
 */
function resolveAstraContextMode(question = '') {
  const q = String(question || '').toLowerCase();
  if (!q.trim()) return 'sample';

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
}) {
  const citations = [];
  const lines = [];
  const normalizedModule = String(moduleKey || '').toLowerCase();
  const contextMode = ['complete', 'report'].includes(String(mode || '')) ? String(mode) : 'sample';
  const relatedCap = contextMode === 'sample' ? MAX_RELATED_PER_GROUP : MAX_RELATED_PER_GROUP_COMPLETE;
  const charCap = contextMode === 'sample' ? MAX_CONTEXT_CHARS : MAX_COMPLETE_CONTEXT_CHARS;

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
  lines.push(...buildPrimarySection(normalizedModule, primaryDoc));

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
  }

  const primaryActivities = await loadRecordActivities(
    organizationId,
    normalizedModule,
    primaryDoc._id,
    MAX_PRIMARY_ACTIVITIES,
  );
  if (primaryActivities.length) {
    lines.push('Primary record activity / comments:');
    lines.push(...primaryActivities);
  }

  const relatedRefs = collectRelatedRefs(context, { maxPerGroup: relatedCap });
  lines.push(`=== RELATED RECORDS (${relatedRefs.length}) ===`);

  let citationIndex = 2;
  const relatedDocs = await Promise.all(
    relatedRefs.map(async (ref) => {
      const doc = await loadDocument(organizationId, ref.moduleKey, ref.recordId);
      const activities = doc
        ? await loadRecordActivities(
          organizationId,
          ref.moduleKey,
          doc._id,
          MAX_RELATED_ACTIVITIES,
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
    lines.push(...buildRelatedSection(citationIndex, ref.moduleKey, doc, activities));
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
    // Staff work-graph Ask needs real recipient emails for compose drafts.
    preserveEmails: true,
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
}) {
  const normalizedModule = String(moduleKey || '').toLowerCase();
  const Model = getModel(normalizedModule);
  const match = listMatchQuery(normalizedModule, organizationId);
  const contextMode = ['complete', 'report'].includes(String(mode || '')) ? String(mode) : 'sample';
  if (!Model || !match) {
    return { text: '', citations: [], found: false, pageKind: 'list', contextMode };
  }

  const complete = contextMode !== 'sample';
  const rowLimit = complete ? MAX_COMPLETE_RECORDS : MAX_LIST_SAMPLE;
  const charCap = complete ? MAX_COMPLETE_CONTEXT_CHARS : MAX_LIST_CONTEXT_CHARS;

  const lines = [
    `CRM LIST PAGE CONTEXT for module=${normalizedModule}`,
    'Staff is viewing the module list (All records), not a single record.',
    `Context mode: ${contextMode}`,
    complete
      ? 'COMPLETE DATA MODE: aggregates cover 100% of matching DB records. Detail rows below are loaded from the database for this answer.'
      : 'SAMPLE MODE: use aggregates + sample. Prefer names over ids.',
  ];
  if (contextMode === 'report') {
    lines.push(
      'REPORT MODE: produce a proper staff report (title, summary, sections, markdown tables). Use only DB facts below. Do not invent rows or amounts.',
    );
  }

  const { total, lines: aggLines, series, groupField, stats } = await buildModuleAggregates(Model, match, normalizedModule);
  lines.push(...aggLines);
  lines.push('=== AGGREGATES ARE COMPLETE (100% of matching records in DB) ===');

  const docs = await loadListDocuments(Model, match, normalizedModule, { limit: rowLimit });
  const sectionLabel = complete
    ? `=== DETAIL RECORDS FROM DB (${docs.length} of ${total}; hard cap ${MAX_COMPLETE_RECORDS}) ===`
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
  if (complete) {
    if (notLoaded > 0) {
      lines.push(
        `Memory cap: ${notLoaded} record(s) exist beyond the ${MAX_COMPLETE_RECORDS} row load. Aggregates above still include ALL ${total} records — use aggregates for totals; do not invent missing detail rows.`,
      );
    }
    if (omittedForSize > 0) {
      lines.push(
        `Size cap: ${omittedForSize} loaded row(s) omitted from text to fit context. Aggregates remain complete for all ${total} records.`,
      );
    }
    if (notLoaded === 0 && omittedForSize === 0) {
      lines.push(`All ${total} matching record(s) are included in detail below/above.`);
    }
  } else if (total > docs.length) {
    lines.push(
      `Note: ${total - docs.length} additional record(s) exist but were omitted from the sample. Ask for a report / complete data if you need every row.`,
    );
  }

  const text = redactText(lines.join('\n').slice(0, charCap), {
    preserveEmails: true,
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

module.exports = {
  buildWorkGraphContextPack,
  buildModuleListContextPack,
  resolveAstraContextMode,
  resolveAstraChartType,
  looksLikeChartIntent,
  buildAstraVisualsFromSeries,
  loadDocument,
  MAX_CONTEXT_CHARS,
  MAX_LIST_CONTEXT_CHARS,
  MAX_COMPLETE_CONTEXT_CHARS,
  MAX_LIST_SAMPLE,
  MAX_COMPLETE_RECORDS,
};
