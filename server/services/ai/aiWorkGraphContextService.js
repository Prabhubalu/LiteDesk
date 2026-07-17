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

const MAX_CONTEXT_CHARS = 12000;
const MAX_RELATED_GROUPS = 12;
const MAX_RELATED_PER_GROUP = 5;
const MAX_PRIMARY_ACTIVITIES = 25;
const MAX_RELATED_ACTIVITIES = 10;

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
  return [doc.first_name, doc.last_name].filter(Boolean).join(' ').trim()
    || doc.email
    || String(doc._id || '');
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

function collectRelatedRefs(context) {
  const refs = [];
  const seen = new Set();
  const relationships = Array.isArray(context?.relationships) ? context.relationships : [];
  for (const rel of relationships.slice(0, MAX_RELATED_GROUPS)) {
    const moduleKey = String(rel.target?.moduleKey || rel.moduleKey || '').toLowerCase();
    const records = Array.isArray(rel.records) ? rel.records : [];
    for (const row of records.slice(0, MAX_RELATED_PER_GROUP)) {
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
 * Build rich CRM context for assistant / work-graph Ask.
 */
async function buildWorkGraphContextPack({
  organizationId,
  appKey = 'SALES',
  moduleKey,
  recordId,
}) {
  const citations = [];
  const lines = [];
  const normalizedModule = String(moduleKey || '').toLowerCase();

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
    };
  }

  lines.push(`CRM page context for ${normalizedModule} ${recordId}`);
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

  const relatedRefs = collectRelatedRefs(context);
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

  const text = redactText(lines.join('\n').slice(0, MAX_CONTEXT_CHARS), {
    // Staff work-graph Ask needs real recipient emails for compose drafts.
    preserveEmails: true,
  });
  return {
    text,
    citations,
    found: text.length > 40,
    updatedAt: primaryDoc.updatedAt || primaryDoc.updated_at || null,
  };
}

module.exports = {
  buildWorkGraphContextPack,
  loadDocument,
  MAX_CONTEXT_CHARS,
};
