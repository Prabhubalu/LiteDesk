'use strict';

/**
 * Deep related-record expansion for Astra situation grounding.
 * Complements relationship-graph results with canonical CRM links
 * (contactId, dealPeople, accountId, quotes, cases, tasks, etc.).
 */

const mongoose = require('mongoose');

const MAX_RELATED = 48;
const PER_MODULE = 16;

function toObjectId(id) {
  const s = String(id || '').trim();
  if (!s) return null;
  if (!mongoose.Types.ObjectId.isValid(s)) return s;
  return new mongoose.Types.ObjectId(s);
}

function titleOf(row = {}) {
  if (!row || typeof row !== 'object') return '';
  const full = `${row.first_name || ''} ${row.last_name || ''}`.trim();
  return String(
    row.name
    || row.title
    || row.subject
    || row.eventName
    || row.quoteTitle
    || row.quoteNumber
    || full
    || '',
  ).trim();
}

function normalizeModule(mk = '') {
  const k = String(mk || '').toLowerCase();
  if (k === 'organization' || k === 'org' || k === 'account') return 'organizations';
  if (k === 'person' || k === 'contact') return 'people';
  if (k === 'deal') return 'deals';
  if (k === 'case') return 'cases';
  if (k === 'quote') return 'quotes';
  if (k === 'task') return 'tasks';
  if (k === 'event') return 'events';
  return k;
}

function pushRelated(out, seen, moduleKey, id, title, status, subtitle) {
  const mk = normalizeModule(moduleKey);
  const rid = String(id || '').trim();
  if (!mk || !rid) return;
  const key = `${mk}:${rid}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    moduleKey: mk,
    id: rid,
    title: String(title || mk).slice(0, 160),
    status: status || null,
    subtitle: subtitle || null,
  });
}

async function safeFind(model, query, select, limit = PER_MODULE) {
  if (!model || typeof model.find !== 'function') return [];
  // Avoid indefinite buffer wait when mongoose has no active connection (unit tests).
  try {
    const state = mongoose.connection?.readyState;
    if (state !== 1) return [];
  } catch {
    return [];
  }
  try {
    let q = model.find(query).select(select).limit(limit).maxTimeMS(2500);
    if (typeof q.lean === 'function') q = q.lean();
    return (await q) || [];
  } catch {
    return [];
  }
}

function loadModels() {
  const out = {};
  try { out.People = require('../../../models/People'); } catch { /* optional */ }
  try { out.Organization = require('../../../models/Organization'); } catch { /* optional */ }
  try { out.Deal = require('../../../models/Deal'); } catch { /* optional */ }
  try { out.Quote = require('../../../models/Quote'); } catch { /* optional */ }
  try { out.Case = require('../../../models/Case'); } catch { /* optional */ }
  try { out.Task = require('../../../models/Task'); } catch { /* optional */ }
  try { out.Event = require('../../../models/Event'); } catch { /* optional */ }
  return out;
}

async function expandPeopleRelated(organizationId, personId, out, seen, models) {
  const pid = toObjectId(personId);
  const { People, Organization, Deal, Quote, Case, Task } = models;

  const people = await safeFind(
    People,
    { _id: pid, organizationId, deletedAt: null },
    'organization first_name last_name email',
    1,
  );
  const person = people[0];
  if (person?.organization) {
    const orgs = await safeFind(
      Organization,
      { _id: person.organization, deletedAt: null },
      'name industry status',
      1,
    );
    const org = orgs[0];
    if (org) {
      pushRelated(out, seen, 'organizations', org._id, org.name, org.status, org.industry || null);
      // One-hop: account deals/quotes/cases/people matter for meeting prep
      await expandOrganizationRelated(organizationId, org._id, out, seen, models);
    }
  }

  const deals = await safeFind(
    Deal,
    {
      organizationId,
      deletedAt: null,
      $or: [
        { contactId: pid },
        { 'dealPeople.personId': pid },
        { 'dealPeople.personId': String(personId) },
      ],
    },
    'name title stage status amount accountId',
  );
  for (const d of deals) {
    pushRelated(out, seen, 'deals', d._id, d.name || d.title, d.stage || d.status, d.amount != null ? String(d.amount) : null);
    if (d.accountId) {
      const orgs = await safeFind(Organization, { _id: d.accountId, deletedAt: null }, 'name', 1);
      if (orgs[0]) pushRelated(out, seen, 'organizations', orgs[0]._id, orgs[0].name);
    }
  }

  const quotes = await safeFind(
    Quote,
    { organizationId, deletedAt: null, contactId: pid },
    'quoteTitle quoteNumber status amount dealId organizationRefId',
  );
  for (const q of quotes) {
    pushRelated(out, seen, 'quotes', q._id, q.quoteTitle || q.quoteNumber, q.status, q.amount != null ? String(q.amount) : null);
    if (q.dealId) pushRelated(out, seen, 'deals', q.dealId, 'Linked deal');
    if (q.organizationRefId) pushRelated(out, seen, 'organizations', q.organizationRefId, 'Linked account');
  }

  const cases = await safeFind(
    Case,
    { organizationId, deletedAt: null, contactId: pid },
    'subject title status priority organizationRefId',
  );
  for (const c of cases) {
    pushRelated(out, seen, 'cases', c._id, c.subject || c.title, c.status, c.priority || null);
    if (c.organizationRefId) pushRelated(out, seen, 'organizations', c.organizationRefId, 'Linked account');
  }

  const tasks = await safeFind(
    Task,
    {
      organizationId,
      deletedAt: null,
      $or: [
        { 'relatedTo.type': 'contact', 'relatedTo.id': pid },
        { 'relatedTo.type': 'contact', 'relatedTo.id': String(personId) },
      ],
    },
    'title status priority dueDate',
  );
  for (const t of tasks) {
    pushRelated(out, seen, 'tasks', t._id, t.title, t.status, t.priority || null);
  }
}

async function expandOrganizationRelated(organizationId, accountId, out, seen, models) {
  const aid = toObjectId(accountId);
  const { People, Deal, Quote, Case, Task, Event } = models;

  const people = await safeFind(
    People,
    { organizationId, deletedAt: null, organization: aid },
    'first_name last_name email',
  );
  for (const p of people) {
    pushRelated(
      out,
      seen,
      'people',
      p._id,
      `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email,
      null,
      p.email || null,
    );
  }

  const deals = await safeFind(
    Deal,
    {
      organizationId,
      deletedAt: null,
      $or: [
        { accountId: aid },
        { 'dealOrganizations.organizationId': aid },
      ],
    },
    'name title stage status amount contactId',
  );
  for (const d of deals) {
    pushRelated(out, seen, 'deals', d._id, d.name || d.title, d.stage || d.status, d.amount != null ? String(d.amount) : null);
    if (d.contactId) pushRelated(out, seen, 'people', d.contactId, 'Deal contact');
  }

  const quotes = await safeFind(
    Quote,
    { organizationId, deletedAt: null, organizationRefId: aid },
    'quoteTitle quoteNumber status amount dealId contactId',
  );
  for (const q of quotes) {
    pushRelated(out, seen, 'quotes', q._id, q.quoteTitle || q.quoteNumber, q.status);
    if (q.dealId) pushRelated(out, seen, 'deals', q.dealId, 'Linked deal');
    if (q.contactId) pushRelated(out, seen, 'people', q.contactId, 'Quote contact');
  }

  const cases = await safeFind(
    Case,
    { organizationId, deletedAt: null, organizationRefId: aid },
    'subject title status contactId',
  );
  for (const c of cases) {
    pushRelated(out, seen, 'cases', c._id, c.subject || c.title, c.status);
    if (c.contactId) pushRelated(out, seen, 'people', c.contactId, 'Case contact');
  }

  const tasks = await safeFind(
    Task,
    {
      organizationId,
      deletedAt: null,
      $or: [
        { 'relatedTo.type': 'organization', 'relatedTo.id': aid },
        { 'relatedTo.type': 'organization', 'relatedTo.id': String(accountId) },
      ],
    },
    'title status priority',
  );
  for (const t of tasks) {
    pushRelated(out, seen, 'tasks', t._id, t.title, t.status);
  }

  const events = await safeFind(
    Event,
    { organizationId, deletedAt: null, relatedToId: aid },
    'eventName title status startDateTime',
  );
  for (const e of events) {
    pushRelated(out, seen, 'events', e._id, e.eventName || e.title, e.status);
  }
}

async function expandDealRelated(organizationId, dealId, out, seen, models) {
  const did = toObjectId(dealId);
  const { Deal, Quote, Organization, People } = models;

  const deals = await safeFind(
    Deal,
    { _id: did, organizationId, deletedAt: null },
    'name title stage status contactId accountId dealPeople dealOrganizations',
    1,
  );
  const deal = deals[0];
  if (!deal) return;

  if (deal.contactId) {
    const people = await safeFind(People, { _id: deal.contactId, deletedAt: null }, 'first_name last_name email', 1);
    const p = people[0];
    pushRelated(
      out,
      seen,
      'people',
      deal.contactId,
      p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email : 'Primary contact',
    );
  }
  for (const row of deal.dealPeople || []) {
    if (!row?.personId || row.isActive === false) continue;
    pushRelated(out, seen, 'people', row.personId, row.role || 'Deal contact', null, row.role || null);
  }
  if (deal.accountId) {
    const orgs = await safeFind(Organization, { _id: deal.accountId, deletedAt: null }, 'name', 1);
    pushRelated(out, seen, 'organizations', deal.accountId, orgs[0]?.name || 'Account');
  }
  for (const row of deal.dealOrganizations || []) {
    if (!row?.organizationId || row.isActive === false) continue;
    pushRelated(out, seen, 'organizations', row.organizationId, row.role || 'Deal account', null, row.role || null);
  }

  const quotes = await safeFind(
    Quote,
    { organizationId, deletedAt: null, dealId: did },
    'quoteTitle quoteNumber status amount contactId',
  );
  for (const q of quotes) {
    pushRelated(out, seen, 'quotes', q._id, q.quoteTitle || q.quoteNumber, q.status);
    if (q.contactId) pushRelated(out, seen, 'people', q.contactId, 'Quote contact');
  }

  const { Task } = models;
  const tasks = await safeFind(
    Task,
    {
      organizationId,
      deletedAt: null,
      $or: [
        { 'relatedTo.type': 'deal', 'relatedTo.id': did },
        { 'relatedTo.type': 'deal', 'relatedTo.id': String(dealId) },
      ],
    },
    'title status priority',
  );
  for (const t of tasks) {
    pushRelated(out, seen, 'tasks', t._id, t.title, t.status);
  }
}

/**
 * @param {{ organizationId: string, moduleKey: string, recordId: string, related?: Array }} input
 * @returns {Promise<Array>}
 */
async function expandRelatedRecords(input = {}) {
  const organizationId = input.organizationId;
  const moduleKey = normalizeModule(input.moduleKey);
  const recordId = String(input.recordId || '').trim();
  const out = Array.isArray(input.related) ? [...input.related] : [];
  const seen = new Set(out.map((r) => `${normalizeModule(r.moduleKey)}:${r.id}`));

  if (!organizationId || !moduleKey || !recordId) return out.slice(0, MAX_RELATED);

  const models = loadModels();
  try {
    if (moduleKey === 'people') {
      await expandPeopleRelated(organizationId, recordId, out, seen, models);
    } else if (moduleKey === 'organizations') {
      await expandOrganizationRelated(organizationId, recordId, out, seen, models);
    } else if (moduleKey === 'deals') {
      await expandDealRelated(organizationId, recordId, out, seen, models);
    }
  } catch (err) {
    console.warn('[expandRelatedRecords] failed:', err?.message || err);
  }

  return out.slice(0, MAX_RELATED);
}

module.exports = {
  expandRelatedRecords,
  normalizeModule,
  MAX_RELATED,
  PER_MODULE,
  titleOf,
};
