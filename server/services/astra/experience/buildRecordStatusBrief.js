'use strict';

/**
 * Grounded "status / about" brief for a single CRM record.
 * Pulls related deals / cases / people / tasks so Astra answers with
 * synthesis — not just a list hit of the record itself.
 */

const mongoose = require('mongoose');
const DealModel = require('../../../models/Deal');
const CaseModel = require('../../../models/Case');
const PeopleModel = require('../../../models/People');
const TaskModel = require('../../../models/Task');
const OrganizationModel = require('../../../models/Organization');
const { DEAL_STATUS } = require('../../../constants/dealStatus');
const { CASE_OPEN, TASK_DONE, recordPathFor, getModule } = require('../tools/moduleCatalog');
const { synthesizeOrgStatusNarrative } = require('./coworkerSynthesis');

const BRIEF_WORDS = /\b(status|health|overview|summary|details|about|tell me about|how is|how'?s|what'?s going on|pulse)\b/i;

function wantsRecordBrief(query) {
  return BRIEF_WORDS.test(String(query || ''));
}

function toOrgId(organizationId) {
  const raw = String(organizationId || '');
  if (mongoose.Types.ObjectId.isValid(raw)) {
    return new mongoose.Types.ObjectId(raw);
  }
  return raw;
}

function toId(value) {
  const raw = String(value || '');
  if (mongoose.Types.ObjectId.isValid(raw)) {
    return new mongoose.Types.ObjectId(raw);
  }
  return raw;
}

async function runList(model, filter, { limit = 8, sort = { updatedAt: -1 } } = {}) {
  if (!model || typeof model.find !== 'function') return [];
  let q = model.find(filter);
  if (q && typeof q.sort === 'function') q = q.sort(sort);
  if (q && typeof q.limit === 'function') q = q.limit(limit);
  if (q && typeof q.lean === 'function') q = q.lean();
  const rows = await q;
  return Array.isArray(rows) ? rows : [];
}

async function runCount(model, filter) {
  if (!model || typeof model.countDocuments !== 'function') return 0;
  return Number(await model.countDocuments(filter)) || 0;
}

function money(amount) {
  if (amount == null || amount === '') return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * @returns {Promise<{
 *   lead: string,
 *   draft: string,
 *   blocks: object[],
 *   claims: object[],
 *   related: object,
 * }|null>}
 */
async function buildRecordStatusBrief({
  entity,
  hit,
  organizationId,
  deps = {},
} = {}) {
  if (!hit?.id || !organizationId) return null;
  const models = deps.models || {};
  const Deal = models.Deal || DealModel;
  const Case = models.Case || CaseModel;
  const People = models.People || PeopleModel;
  const Task = models.Task || TaskModel;
  const Organization = models.Organization || OrganizationModel;
  const tenantId = toOrgId(organizationId);
  const recordId = toId(hit.id);
  const title = String(hit.title || 'this record');

  const related = {
    openDeals: { total: 0, amount: 0, items: [] },
    openCases: { total: 0, items: [] },
    people: { total: 0, items: [] },
    openTasks: { total: 0, overdue: 0, items: [] },
    recentClosed: { total: 0, items: [] },
    record: {
      status: hit.status || null,
      subtitle: hit.subtitle || '',
      derivedStatus: null,
      customerStatus: null,
      industry: null,
      types: [],
    },
  };

  if (entity === 'organizations') {
    const orgDoc = await Organization.findOne({
      _id: recordId,
      isTenant: false,
      deletedAt: null,
    }).select('name derivedStatus customerStatus industry types isActive').lean().catch(() => null);

    if (orgDoc) {
      related.record.derivedStatus = orgDoc.derivedStatus || null;
      related.record.customerStatus = orgDoc.customerStatus || null;
      related.record.industry = orgDoc.industry || null;
      related.record.types = Array.isArray(orgDoc.types) ? orgDoc.types : [];
      related.record.status = orgDoc.derivedStatus || orgDoc.customerStatus || related.record.status;
    }

    const dealFilter = {
      organizationId: tenantId,
      deletedAt: null,
      status: DEAL_STATUS.OPEN,
      $or: [
        { accountId: recordId },
        { 'dealOrganizations.organizationId': recordId },
      ],
    };
    const caseFilter = {
      organizationId: tenantId,
      deletedAt: null,
      status: { $in: CASE_OPEN },
      organizationRefId: recordId,
    };
    const peopleFilter = {
      organizationId: tenantId,
      deletedAt: null,
      organization: recordId,
    };
    const taskFilter = {
      organizationId: tenantId,
      deletedAt: null,
      status: { $nin: TASK_DONE },
      'relatedTo.type': 'organization',
      'relatedTo.id': recordId,
    };
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const overdueFilter = { ...taskFilter, dueDate: { $lt: dayStart, $ne: null } };

    const [dealRows, dealTotal, caseRows, caseTotal, peopleRows, peopleTotal, taskRows, taskTotal, overdueTotal] = await Promise.all([
      runList(Deal, dealFilter, { limit: 5, sort: { amount: -1 } }),
      runCount(Deal, dealFilter),
      runList(Case, caseFilter, { limit: 5 }),
      runCount(Case, caseFilter),
      runList(People, peopleFilter, { limit: 5 }),
      runCount(People, peopleFilter),
      runList(Task, taskFilter, { limit: 5, sort: { dueDate: 1 } }),
      runCount(Task, taskFilter),
      runCount(Task, overdueFilter),
    ]);

    related.openDeals = {
      total: dealTotal,
      amount: dealRows.reduce((sum, d) => sum + (money(d.amount) || 0), 0),
      items: dealRows.map((d) => ({
        id: String(d._id),
        title: d.name || '(untitled deal)',
        subtitle: [d.stage, d.status].filter(Boolean).join(' · '),
        status: d.status || null,
        amount: money(d.amount),
        stage: d.stage || null,
        expectedCloseDate: d.expectedCloseDate || null,
        lastActivityDate: d.lastActivityDate || d.updatedAt || null,
        href: recordPathFor('deals', d._id),
      })),
    };
    related.openCases = {
      total: caseTotal,
      items: caseRows.map((c) => ({
        id: String(c._id),
        title: c.title || '(untitled case)',
        subtitle: [c.status, c.priority].filter(Boolean).join(' · '),
        status: c.status || null,
        href: recordPathFor('cases', c._id),
      })),
    };
    related.people = {
      total: peopleTotal,
      items: peopleRows.map((p) => ({
        id: String(p._id),
        title: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || '(unnamed)',
        subtitle: p.email || '',
        href: recordPathFor('people', p._id),
      })),
    };
    related.openTasks = {
      total: taskTotal,
      overdue: overdueTotal,
      items: taskRows.map((t) => ({
        id: String(t._id),
        title: t.title || '(untitled task)',
        subtitle: [t.status, t.priority].filter(Boolean).join(' · '),
        status: t.status || null,
        href: recordPathFor('tasks', t._id),
      })),
    };

    const closedFilter = {
      organizationId: tenantId,
      deletedAt: null,
      status: { $in: [DEAL_STATUS.WON, DEAL_STATUS.LOST] },
      $or: [
        { accountId: recordId },
        { 'dealOrganizations.organizationId': recordId },
      ],
    };
    const closedRows = await runList(Deal, closedFilter, { limit: 3, sort: { updatedAt: -1 } });
    related.recentClosed = {
      total: closedRows.length,
      items: closedRows.map((d) => ({
        id: String(d._id),
        title: d.name || '(untitled deal)',
        subtitle: [d.stage, d.status].filter(Boolean).join(' · '),
        status: d.status || null,
        amount: money(d.amount),
        href: recordPathFor('deals', d._id),
      })),
    };
  } else if (entity === 'deals') {
    const deal = await Deal.findOne({ _id: recordId, organizationId: tenantId, deletedAt: null })
      .select('name stage status amount expectedCloseDate lastActivityDate')
      .lean()
      .catch(() => null);
    if (deal) {
      related.record.status = deal.status || null;
      related.record.subtitle = [deal.stage, deal.status].filter(Boolean).join(' · ');
      related.openDeals = {
        total: 1,
        amount: money(deal.amount) || 0,
        items: [{
          id: String(deal._id),
          title: deal.name || title,
          subtitle: related.record.subtitle,
          status: deal.status,
          amount: money(deal.amount),
          href: recordPathFor('deals', deal._id),
        }],
      };
    }
  } else if (entity === 'people') {
    const personFilter = { _id: recordId, organizationId: tenantId, deletedAt: null };
    const person = await People.findOne(personFilter).select('first_name last_name email organization').lean().catch(() => null);
    if (person?.organization) {
      // light: open deals via account is harder; count tasks related to contact
      const taskFilter = {
        organizationId: tenantId,
        deletedAt: null,
        status: { $nin: TASK_DONE },
        'relatedTo.type': 'contact',
        'relatedTo.id': recordId,
      };
      const [taskRows, taskTotal] = await Promise.all([
        runList(Task, taskFilter, { limit: 5 }),
        runCount(Task, taskFilter),
      ]);
      related.openTasks = {
        total: taskTotal,
        overdue: 0,
        items: taskRows.map((t) => ({
          id: String(t._id),
          title: t.title || '(untitled task)',
          subtitle: t.status || '',
          href: recordPathFor('tasks', t._id),
        })),
      };
    }
  }

  const narrative = entity === 'organizations'
    ? synthesizeOrgStatusNarrative({ title, related })
    : null;

  const lead = narrative?.lead || (() => {
    const bits = [];
    if (related.record.derivedStatus) bits.push(related.record.derivedStatus);
    else if (related.record.customerStatus) bits.push(related.record.customerStatus);
    else if (related.record.status) bits.push(related.record.status);
    if (related.record.industry) bits.push(related.record.industry);
    return `${title}${bits.length ? ` — ${bits.join(', ')}` : ''}.`;
  })();

  const draft = narrative?.draft || lead;
  const suggestions = narrative?.suggestions || [];

  const hasSignal = related.openDeals.total
    || related.openCases.total
    || related.openTasks.total
    || related.openDeals.amount > 0;

  const blocks = [];
  const mod = getModule(entity);
  blocks.push({
    type: 'record_list',
    entity,
    title: mod?.label ? mod.label.charAt(0).toUpperCase() + mod.label.slice(1) : 'Record',
    total: 1,
    items: [{
      id: hit.id,
      title,
      subtitle: [related.record.status, related.record.industry, hit.subtitle].filter(Boolean).join(' · '),
      status: related.record.status,
      href: recordPathFor(entity, hit.id),
    }],
  });

  if (hasSignal) {
    blocks.push({
      type: 'metrics',
      items: [
        { id: 'deals', label: 'Open deals', value: related.openDeals.total, tone: 'primary' },
        {
          id: 'pipeline',
          label: 'Open pipeline',
          value: related.openDeals.amount > 0 ? `$${Math.round(related.openDeals.amount).toLocaleString()}` : '—',
          tone: 'neutral',
        },
        { id: 'cases', label: 'Open cases', value: related.openCases.total, tone: related.openCases.total ? 'warning' : 'neutral' },
        { id: 'tasks', label: 'Open tasks', value: related.openTasks.total, tone: related.openTasks.overdue ? 'warning' : 'neutral' },
      ],
    });
  }

  if (related.openDeals.items.length) {
    blocks.push({
      type: 'record_list',
      entity: 'deals',
      title: 'Open deals to focus',
      total: related.openDeals.total,
      items: related.openDeals.items.slice(0, 5),
    });
  }
  if (related.people.items.length && !related.openDeals.items.length) {
    blocks.push({
      type: 'record_list',
      entity: 'people',
      title: 'People to re-engage',
      total: related.people.total,
      items: related.people.items.slice(0, 5),
    });
  }
  if (related.openCases.items.length) {
    blocks.push({
      type: 'record_list',
      entity: 'cases',
      title: 'Open cases',
      total: related.openCases.total,
      items: related.openCases.items.slice(0, 5),
    });
  }
  if (related.openTasks.items.length) {
    blocks.push({
      type: 'record_list',
      entity: 'tasks',
      title: 'Open tasks',
      total: related.openTasks.total,
      items: related.openTasks.items.slice(0, 5),
    });
  }

  const claims = [
    { type: 'count', entity: 'deals', value: related.openDeals.total },
    { type: 'count', entity: 'cases', value: related.openCases.total },
    { type: 'count', entity: 'tasks', value: related.openTasks.total },
    { type: 'record', id: hit.id, title },
    ...related.people.items.slice(0, 2).map((p) => ({ type: 'record', id: p.id, title: p.title })),
    ...related.openDeals.items.slice(0, 2).map((d) => ({ type: 'record', id: d.id, title: d.title })),
  ];

  return {
    lead,
    draft,
    blocks,
    claims,
    related,
    suggestions,
  };
}

module.exports = {
  wantsRecordBrief,
  buildRecordStatusBrief,
};
