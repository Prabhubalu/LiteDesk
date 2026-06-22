const mongoose = require('mongoose');
const Case = require('../models/Case');
const Deal = require('../models/Deal');
const Task = require('../models/Task');
const Event = require('../models/Event');
const Form = require('../models/Form');
const Item = require('../models/Item');
const Quote = require('../models/Quote');
const Document = require('../models/Document');
const People = require('../models/People');
const ChatSession = require('../models/ChatSession');
const LiveChatVisitor = require('../models/LiveChatVisitor');
const CrmOrganization = require('../models/Organization');
const { buildChatSessionScopeFilter } = require('../utils/liveChatSessionQueryUtils');
const { loadSessionForOrg } = require('./liveChatRecordLinkService');
const { resolveExistingPersonForSession } = require('./liveChatCrmAdapter');
const { getRecordContext } = require('./recordContextService');

const MAX_CRM_LINKS = 80;

function normalizeModuleKey(moduleKey) {
  return String(moduleKey || '').trim().toLowerCase();
}

function linkKey(moduleKey, recordId) {
  return `${normalizeModuleKey(moduleKey)}:${String(recordId || '')}`;
}

function pushLink(map, entry) {
  if (map.size >= MAX_CRM_LINKS) return;

  const moduleKey = normalizeModuleKey(entry.moduleKey);
  const recordId = String(entry.recordId || '').trim();
  if (!moduleKey || !recordId || !mongoose.Types.ObjectId.isValid(recordId)) return;

  const key = linkKey(moduleKey, recordId);
  if (map.has(key)) return;

  map.set(key, {
    moduleKey,
    recordId,
    linkType: entry.linkType === 'created' ? 'created' : 'linked',
    source: entry.source || 'session',
    ...(entry.label ? { label: entry.label } : {}),
    ...(entry.status ? { status: entry.status } : {}),
    ...(entry.relationshipKey ? { relationshipKey: entry.relationshipKey } : {}),
  });
}

function collectLinksFromRows(map, rows, source) {
  for (const row of rows || []) {
    for (const entry of row?.linkedRecords || []) {
      pushLink(map, { ...entry, source });
    }
  }
}

function pickRecordLabel(rec) {
  return String(
    rec?.label
    || rec?.title
    || rec?.name
    || rec?.quoteTitle
    || rec?.eventName
    || rec?.item_name
    || rec?.documentNumber
    || '',
  ).trim() || null;
}

function pickRecordStatus(rec) {
  return String(rec?.status || rec?.stage || rec?.secondaryText || '').trim() || null;
}

async function findPersonIdsForSessionContext({ organizationId, sessionLean }) {
  const personIds = new Set();

  for (const entry of sessionLean?.linkedRecords || []) {
    if (normalizeModuleKey(entry?.moduleKey) === 'people' && entry?.recordId) {
      personIds.add(String(entry.recordId));
    }
  }

  if (sessionLean?.visitorId) {
    const visitor = await LiveChatVisitor.findOne({
      _id: sessionLean.visitorId,
      organizationId,
    }).lean();

    for (const entry of visitor?.linkedRecords || []) {
      if (normalizeModuleKey(entry?.moduleKey) === 'people' && entry?.recordId) {
        personIds.add(String(entry.recordId));
      }
    }
  }

  const resolvedPerson = await resolveExistingPersonForSession({
    organizationId,
    sessionLean,
    visitorId: sessionLean?.visitorId || null,
  });
  if (resolvedPerson?._id) {
    personIds.add(String(resolvedPerson._id));
  }

  return [...personIds];
}

async function findOrganizationIdsForSessionContext({ organizationId, linkMap, personIds }) {
  const orgIds = new Set();

  for (const link of linkMap.values()) {
    if (link.moduleKey === 'organizations') {
      orgIds.add(String(link.recordId));
    }
  }

  if (personIds.length) {
    const objectIds = personIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(String(id)));

    if (objectIds.length) {
      const rows = await People.find({
        organizationId,
        _id: { $in: objectIds },
        deletedAt: null,
      })
        .select('organization')
        .lean();

      for (const row of rows) {
        if (row.organization) {
          orgIds.add(String(row.organization));
        }
      }
    }
  }

  return [...orgIds];
}

async function appendRelatedRecordsFromContext({
  organizationId,
  linkMap,
  appKey,
  moduleKey,
  recordId,
}) {
  if (linkMap.size >= MAX_CRM_LINKS) return;

  try {
    const ctx = await getRecordContext(organizationId, appKey, moduleKey, recordId);
    for (const rel of ctx?.relationships || []) {
      for (const rec of rel.records || []) {
        if (rec?._isBroken) continue;

        const mod = normalizeModuleKey(rec?.moduleKey);
        const rid = String(rec?.recordId || rec?._id || '');
        if (!mod || !rid) continue;
        if (mod === normalizeModuleKey(moduleKey) && rid === String(recordId)) continue;

        pushLink(linkMap, {
          moduleKey: mod,
          recordId: rid,
          linkType: 'linked',
          source: 'crm',
          label: pickRecordLabel(rec),
          status: pickRecordStatus(rec),
          relationshipKey: rel.relationshipKey,
        });
      }
    }
  } catch (err) {
    console.error(
      '[liveChatContextService] appendRelatedRecordsFromContext',
      appKey,
      moduleKey,
      recordId,
      err,
    );
  }
}

function buildLabel(moduleKey, doc) {
  const key = normalizeModuleKey(moduleKey);
  switch (key) {
    case 'organizations':
      return String(doc?.name || '').trim() || null;
    case 'deals':
      return String(doc?.name || '').trim() || null;
    case 'quotes':
      return String(doc?.quoteTitle || doc?.quoteNumber || '').trim() || null;
    case 'documents':
      return String(doc?.title || doc?.documentNumber || '').trim() || null;
    case 'cases':
      return String(doc?.title || '').trim() || null;
    case 'tasks':
      return String(doc?.title || '').trim() || null;
    case 'events':
      return String(doc?.eventName || '').trim() || null;
    case 'forms':
      return String(doc?.name || '').trim() || null;
    case 'items':
      return String(doc?.item_name || doc?.item_code || '').trim() || null;
    case 'people': {
      const personName = [doc?.first_name, doc?.last_name].filter(Boolean).join(' ').trim();
      return personName || String(doc?.email || '').trim() || null;
    }
    default:
      return String(doc?.name || doc?.title || '').trim() || null;
  }
}

function buildStatus(moduleKey, doc) {
  const key = normalizeModuleKey(moduleKey);
  switch (key) {
    case 'deals':
      return String(doc?.stage || doc?.status || '').trim() || null;
    case 'organizations':
      return String(doc?.status || doc?.industry || '').trim() || null;
    default:
      return String(doc?.status || '').trim() || null;
  }
}

async function enrichLinksMissingLabels(organizationId, links) {
  const byModule = new Map();
  for (const row of links) {
    if (row.label) continue;
    const moduleKey = normalizeModuleKey(row.moduleKey);
    if (!byModule.has(moduleKey)) byModule.set(moduleKey, []);
    byModule.get(moduleKey).push(String(row.recordId));
  }

  const labelByKey = new Map();

  for (const [moduleKey, ids] of byModule.entries()) {
    const uniqueIds = [...new Set(ids)].filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!uniqueIds.length) continue;

    const objectIds = uniqueIds.map((id) => new mongoose.Types.ObjectId(String(id)));

    let rows = [];
    if (moduleKey === 'cases') {
      rows = await Case.find({ organizationId, _id: { $in: objectIds }, deletedAt: null })
        .select('_id title status')
        .lean();
    } else if (moduleKey === 'people') {
      rows = await People.find({ organizationId, _id: { $in: objectIds }, deletedAt: null })
        .select('_id first_name last_name name email')
        .lean();
    } else if (moduleKey === 'deals') {
      rows = await Deal.find({ organizationId, _id: { $in: objectIds }, deletedAt: null })
        .select('_id name stage status')
        .lean();
    } else if (moduleKey === 'tasks') {
      rows = await Task.find({ organizationId, _id: { $in: objectIds }, deletedAt: null })
        .select('_id title status')
        .lean();
    } else if (moduleKey === 'events') {
      rows = await Event.find({ organizationId, _id: { $in: objectIds }, deletedAt: null })
        .select('_id eventName eventType status')
        .lean();
    } else if (moduleKey === 'quotes') {
      rows = await Quote.find({ organizationId, _id: { $in: objectIds }, deletedAt: null })
        .select('_id quoteTitle quoteNumber status')
        .lean();
    } else if (moduleKey === 'documents') {
      rows = await Document.find({ organizationId, _id: { $in: objectIds }, deletedAt: null })
        .select('_id title documentNumber status')
        .lean();
    } else if (moduleKey === 'items') {
      rows = await Item.find({ organizationId, _id: { $in: objectIds }, deletedAt: null })
        .select('_id item_name item_code status')
        .lean();
    } else if (moduleKey === 'forms') {
      rows = await Form.find({ organizationId, _id: { $in: objectIds }, deletedAt: null })
        .select('_id name formType status')
        .lean();
    } else if (moduleKey === 'organizations') {
      const { buildTenantAccessibleCrmOrganizationQuery } = require('../utils/crmOrganizationAccess');
      const query = await buildTenantAccessibleCrmOrganizationQuery(organizationId, {
        recordIds: uniqueIds,
      });
      rows = await CrmOrganization.find(query)
        .select('_id name status industry')
        .lean();
    }

    for (const doc of rows) {
      labelByKey.set(linkKey(moduleKey, doc._id), {
        label: buildLabel(moduleKey, doc),
        status: buildStatus(moduleKey, doc),
      });
    }
  }

  return links.map((row) => {
    if (row.label) return row;
    const patch = labelByKey.get(linkKey(row.moduleKey, row.recordId));
    if (!patch) return row;
    return { ...row, ...patch };
  });
}

/**
 * Resolve all business records relevant to a live chat session context panel:
 * explicit session/visitor links plus CRM relationships across modules.
 */
async function resolveLinkedRecordsForSessionContext({ organizationId, sessionId }) {
  const session = await loadSessionForOrg(sessionId, organizationId);
  if (!session) {
    const err = new Error('Chat session not found');
    err.statusCode = 404;
    throw err;
  }

  const sessionLean = session.toObject ? session.toObject() : session;
  const linkMap = new Map();

  for (const entry of sessionLean.linkedRecords || []) {
    pushLink(linkMap, { ...entry, source: 'session' });
  }

  if (sessionLean.visitorId) {
    const visitor = await LiveChatVisitor.findOne({
      _id: sessionLean.visitorId,
      organizationId,
    }).lean();

    for (const entry of visitor?.linkedRecords || []) {
      pushLink(linkMap, { ...entry, source: 'visitor' });
    }

    const scope = buildChatSessionScopeFilter(organizationId);
    const visitorSessions = await ChatSession.find({
      visitorId: sessionLean.visitorId,
      ...scope,
      _id: { $ne: sessionLean._id },
    })
      .select('linkedRecords')
      .limit(20)
      .lean();

    collectLinksFromRows(linkMap, visitorSessions, 'visitor_session');
  }

  const personIds = await findPersonIdsForSessionContext({ organizationId, sessionLean });
  for (const personId of personIds) {
    await appendRelatedRecordsFromContext({
      organizationId,
      linkMap,
      appKey: 'sales',
      moduleKey: 'people',
      recordId: personId,
    });
  }

  const organizationIds = await findOrganizationIdsForSessionContext({
    organizationId,
    linkMap,
    personIds,
  });
  for (const orgRecordId of organizationIds) {
    await appendRelatedRecordsFromContext({
      organizationId,
      linkMap,
      appKey: 'sales',
      moduleKey: 'organizations',
      recordId: orgRecordId,
    });
  }

  let links = [...linkMap.values()];
  links = await enrichLinksMissingLabels(organizationId, links);

  links.sort((a, b) => {
    const sourceRank = { session: 0, visitor: 1, visitor_session: 2, crm: 3 };
    const aRank = sourceRank[a.source] ?? 9;
    const bRank = sourceRank[b.source] ?? 9;
    if (aRank !== bRank) return aRank - bRank;

    const moduleRank = {
      people: 0,
      organizations: 1,
      cases: 2,
      deals: 3,
      tasks: 4,
      events: 5,
      quotes: 6,
      documents: 7,
      items: 8,
      forms: 9,
    };
    const aModule = moduleRank[a.moduleKey] ?? 99;
    const bModule = moduleRank[b.moduleKey] ?? 99;
    if (aModule !== bModule) return aModule - bModule;

    return String(a.label || a.recordId).localeCompare(String(b.label || b.recordId));
  });

  return links;
}

module.exports = {
  resolveLinkedRecordsForSessionContext,
};
