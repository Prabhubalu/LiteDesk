'use strict';

/**
 * Astra searchable module catalog — aligned to platform ModuleDefinition seeds.
 *
 * Coverage contract:
 * - Record list/search by module (primary title fields + common status filters)
 * - NOT full custom-field NL query (tenant field configs are unbounded)
 *
 * Apps (seed): sales, audit, helpdesk, marketing, inventory, portal, control_plane
 * + platform core modules shared across apps.
 */

const DealModel = require('../../../models/Deal');
const CaseModel = require('../../../models/Case');
const PeopleModel = require('../../../models/People');
const TaskModel = require('../../../models/Task');
const EventModel = require('../../../models/Event');
const OrganizationModel = require('../../../models/Organization');
const QuoteModel = require('../../../models/Quote');
const SalesOrderModel = require('../../../models/SalesOrder');
const ItemModel = require('../../../models/Item');
const DocumentModel = require('../../../models/Document');
const FormModel = require('../../../models/Form');
const CampaignModel = require('../../../models/Campaign');
const ContentAssetModel = require('../../../models/ContentAsset');
const FormResponseModel = require('../../../models/FormResponse');
const ImportHistoryModel = require('../../../models/ImportHistory');
const { DEAL_STATUS } = require('../../../constants/dealStatus');

const CASE_OPEN = ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer'];
const TASK_DONE = ['completed', 'cancelled', 'done'];

/** @typedef {'ready'|'unsupported'} ModuleSupport */

/**
 * @type {Array<{
 *   moduleKey: string,
 *   appKey: string,
 *   label: string,
 *   synonyms: string[],
 *   support: ModuleSupport,
 *   model?: any,
 *   titleFields: string[],
 *   subtitleFields?: string[],
 *   routeBase: string|null,
 *   amountField?: string|null,
 * }>}
 */
const MODULES = [
  {
    moduleKey: 'people',
    appKey: 'platform',
    label: 'people',
    synonyms: ['people', 'person', 'contact', 'contacts', 'lead', 'leads', 'customer', 'customers'],
    support: 'ready',
    model: PeopleModel,
    titleFields: ['first_name', 'last_name', 'email'],
    subtitleFields: ['email'],
    routeBase: '/people',
  },
  {
    moduleKey: 'organizations',
    appKey: 'platform',
    label: 'organizations',
    synonyms: ['organization', 'organizations', 'account', 'accounts', 'company', 'companies', 'vendor', 'vendors', 'partner', 'partners'],
    support: 'ready',
    model: OrganizationModel,
    titleFields: ['name'],
    subtitleFields: ['derivedStatus', 'customerStatus', 'industry'],
    routeBase: '/organizations',
  },
  {
    moduleKey: 'deals',
    appKey: 'sales',
    label: 'deals',
    synonyms: ['deal', 'deals', 'pipeline', 'opportunity', 'opportunities'],
    support: 'ready',
    model: DealModel,
    titleFields: ['name'],
    subtitleFields: ['stage', 'status'],
    routeBase: '/deals',
    amountField: 'amount',
  },
  {
    moduleKey: 'quotes',
    appKey: 'platform',
    label: 'quotes',
    synonyms: ['quote', 'quotes', 'quotation', 'quotations'],
    support: 'ready',
    model: QuoteModel,
    titleFields: ['quoteNumber', 'quoteTitle'],
    subtitleFields: ['status'],
    routeBase: '/quotes',
  },
  {
    moduleKey: 'sales_orders',
    appKey: 'platform',
    label: 'sales orders',
    synonyms: ['sales order', 'sales orders', 'sales_order', 'sales_orders'],
    support: 'ready',
    model: SalesOrderModel,
    titleFields: ['orderTitle', 'salesOrderNumber'],
    subtitleFields: ['status', 'fulfillmentStatus'],
    routeBase: '/sales-orders',
  },
  {
    moduleKey: 'tasks',
    appKey: 'platform',
    label: 'tasks',
    synonyms: ['task', 'tasks', 'todo', 'todos', 'to-do', 'to-dos', 'overdue'],
    support: 'ready',
    model: TaskModel,
    titleFields: ['title'],
    subtitleFields: ['status', 'priority'],
    routeBase: '/tasks',
  },
  {
    moduleKey: 'events',
    appKey: 'platform',
    label: 'events',
    synonyms: ['event', 'events', 'meeting', 'meetings', 'calendar', 'appointment', 'appointments'],
    support: 'ready',
    model: EventModel,
    titleFields: ['eventName'],
    subtitleFields: ['eventType', 'status'],
    routeBase: '/events',
  },
  {
    moduleKey: 'documents',
    appKey: 'platform',
    label: 'documents',
    synonyms: ['document', 'documents', 'file', 'files', 'doc', 'docs'],
    support: 'ready',
    model: DocumentModel,
    titleFields: ['title'],
    subtitleFields: ['status', 'documentType'],
    routeBase: '/documents',
  },
  {
    moduleKey: 'items',
    appKey: 'platform',
    label: 'items',
    synonyms: ['item', 'items', 'product', 'products', 'sku', 'skus', 'catalog'],
    support: 'ready',
    model: ItemModel,
    titleFields: ['item_name', 'item_code'],
    subtitleFields: ['status', 'lifecycleState'],
    routeBase: '/items',
  },
  {
    moduleKey: 'forms',
    appKey: 'platform',
    label: 'forms',
    synonyms: ['form', 'forms', 'webform', 'webforms'],
    support: 'ready',
    model: FormModel,
    titleFields: ['name'],
    subtitleFields: ['status'],
    routeBase: '/forms',
  },
  {
    moduleKey: 'templates',
    appKey: 'platform',
    label: 'templates',
    synonyms: ['template', 'templates'],
    support: 'unsupported',
    titleFields: [],
    routeBase: null,
  },
  {
    moduleKey: 'imports',
    appKey: 'platform',
    label: 'imports',
    synonyms: ['import', 'imports'],
    support: 'ready',
    model: ImportHistoryModel,
    titleFields: ['fileName', 'moduleKey', 'status'],
    subtitleFields: ['status'],
    routeBase: '/imports',
  },
  {
    moduleKey: 'inventory',
    appKey: 'inventory',
    label: 'inventory',
    synonyms: ['inventory', 'stock', 'warehouse', 'warehouses'],
    support: 'unsupported',
    titleFields: [],
    routeBase: '/inventory',
  },
  {
    moduleKey: 'cases',
    appKey: 'helpdesk',
    label: 'cases',
    synonyms: ['case', 'cases', 'ticket', 'tickets', 'complaint', 'complaints', 'helpdesk'],
    support: 'ready',
    model: CaseModel,
    titleFields: ['title'],
    subtitleFields: ['status', 'priority'],
    routeBase: '/helpdesk/cases',
  },
  {
    moduleKey: 'articles',
    appKey: 'helpdesk',
    label: 'articles',
    synonyms: ['article', 'articles', 'knowledge base', 'kb'],
    support: 'ready',
    model: DocumentModel,
    titleFields: ['title'],
    subtitleFields: ['status'],
    routeBase: '/documents',
  },
  {
    moduleKey: 'campaigns',
    appKey: 'marketing',
    label: 'campaigns',
    synonyms: ['campaign', 'campaigns'],
    support: 'ready',
    model: CampaignModel,
    titleFields: ['name', 'subject'],
    subtitleFields: ['status'],
    routeBase: '/marketing/campaigns',
  },
  {
    moduleKey: 'blog',
    appKey: 'marketing',
    label: 'blog',
    synonyms: ['blog', 'blogs', 'post', 'posts'],
    support: 'unsupported',
    titleFields: [],
    routeBase: null,
  },
  {
    moduleKey: 'audiences',
    appKey: 'marketing',
    label: 'audiences',
    synonyms: ['audience', 'audiences'],
    support: 'unsupported',
    titleFields: [],
    routeBase: null,
  },
  {
    moduleKey: 'segments',
    appKey: 'marketing',
    label: 'segments',
    synonyms: ['segment', 'segments'],
    support: 'unsupported',
    titleFields: [],
    routeBase: null,
  },
  {
    moduleKey: 'assets',
    appKey: 'marketing',
    label: 'assets',
    synonyms: ['asset', 'assets', 'creative', 'creatives'],
    support: 'ready',
    model: ContentAssetModel,
    titleFields: ['filename'],
    subtitleFields: ['status', 'type'],
    routeBase: '/marketing/assets',
  },
  {
    moduleKey: 'responses',
    appKey: 'platform',
    label: 'responses',
    synonyms: ['response', 'responses', 'form response', 'form responses', 'submission', 'submissions'],
    support: 'ready',
    model: FormResponseModel,
    titleFields: ['responseId'],
    subtitleFields: ['status'],
    routeBase: '/responses',
  },
];

const APPS = [
  { appKey: 'sales', name: 'Sales' },
  { appKey: 'audit', name: 'Audit' },
  { appKey: 'helpdesk', name: 'Helpdesk' },
  { appKey: 'marketing', name: 'Marketing' },
  { appKey: 'inventory', name: 'Inventory' },
  { appKey: 'portal', name: 'Portal' },
  { appKey: 'control_plane', name: 'Control Plane' },
  { appKey: 'platform', name: 'Platform (shared)' },
];

const BY_KEY = new Map(MODULES.map((m) => [m.moduleKey, m]));

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectModuleKey(lower, entityHint) {
  const hint = String(entityHint || '').toLowerCase().trim();
  if (hint && BY_KEY.has(hint)) return hint;
  if (['deal', 'deals'].includes(hint)) return 'deals';
  if (['case', 'cases'].includes(hint)) return 'cases';
  if (['person', 'people', 'contacts'].includes(hint)) return 'people';
  if (['task', 'tasks'].includes(hint)) return 'tasks';
  if (['event', 'events'].includes(hint)) return 'events';

  // Longer synonyms first (sales orders before orders)
  const ranked = [...MODULES].sort((a, b) => {
    const am = Math.max(...a.synonyms.map((s) => s.length));
    const bm = Math.max(...b.synonyms.map((s) => s.length));
    return bm - am;
  });

  for (const mod of ranked) {
    for (const syn of mod.synonyms) {
      if (new RegExp(`\\b${escapeRegex(syn)}\\b`, 'i').test(lower)) {
        return mod.moduleKey;
      }
    }
  }
  return 'deals';
}

function getModule(moduleKey) {
  return BY_KEY.get(moduleKey) || null;
}

function listModules() {
  return MODULES.map((m) => ({
    moduleKey: m.moduleKey,
    appKey: m.appKey,
    label: m.label,
    support: m.support,
    synonyms: m.synonyms,
    titleFields: m.titleFields,
    routeBase: m.routeBase,
  }));
}

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Build tenant-scoped filter + sort for a module plan.
 */
function buildModuleFilter(moduleKey, {
  organizationId,
  openOnly = false,
  overdueOnly = false,
  wantsToday = false,
  searchTerm = null,
  toOrgId,
} = {}) {
  const mod = getModule(moduleKey);
  const filter = { deletedAt: null };
  let sort = { updatedAt: -1 };
  let effectiveOpenOnly = openOnly;
  let effectiveOverdueOnly = false;

  if (organizationId && typeof toOrgId === 'function') {
    filter.organizationId = toOrgId(organizationId);
  } else if (organizationId) {
    filter.organizationId = organizationId;
  }

  if (!mod || mod.support !== 'ready') {
    return { filter, sort, openOnly: false, overdueOnly: false, unsupported: true };
  }

  if (moduleKey === 'organizations') {
    // CRM orgs are NOT scoped by organizationId (dual-purpose Organization model).
    // Access is via createdBy/assignedTo tenant users — applied async in runCrmSearch.
    delete filter.organizationId;
    filter.isTenant = false;
    return {
      filter,
      sort,
      openOnly: false,
      overdueOnly: false,
      unsupported: false,
      asyncAccess: 'crm_organizations',
    };
  }

  if (moduleKey === 'deals') {
    if (openOnly) filter.status = DEAL_STATUS.OPEN;
  } else if (moduleKey === 'cases') {
    if (openOnly) {
      filter.status = { $in: CASE_OPEN };
      effectiveOpenOnly = true;
    }
  } else if (moduleKey === 'tasks') {
    filter.status = { $nin: TASK_DONE };
    effectiveOpenOnly = true;
    sort = { dueDate: 1 };
    const dayStart = startOfLocalDay();
    const dayEnd = endOfLocalDay();
    if (overdueOnly) {
      filter.dueDate = { $lt: dayStart, $ne: null };
      effectiveOverdueOnly = true;
    } else if (wantsToday) {
      filter.dueDate = { $gte: dayStart, $lte: dayEnd };
    }
  } else if (moduleKey === 'events') {
    sort = { startDateTime: 1 };
    const dayStart = startOfLocalDay();
    const dayEnd = endOfLocalDay();
    if (wantsToday) {
      filter.startDateTime = { $gte: dayStart, $lte: dayEnd };
    } else if (!searchTerm) {
      filter.startDateTime = { $gte: dayStart };
      filter.status = { $in: ['Planned'] };
      effectiveOpenOnly = true;
    }
  } else if (moduleKey === 'articles') {
    filter.documentType = 'knowledge_article';
  }

  if (searchTerm && mod.titleFields?.length) {
    if (moduleKey === 'people') {
      const rx = { $regex: escapeRegex(searchTerm), $options: 'i' };
      filter.$or = [{ first_name: rx }, { last_name: rx }, { email: rx }];
    } else if (mod.titleFields.length === 1) {
      filter[mod.titleFields[0]] = { $regex: escapeRegex(searchTerm), $options: 'i' };
    } else {
      const rx = { $regex: escapeRegex(searchTerm), $options: 'i' };
      filter.$or = mod.titleFields.map((f) => ({ [f]: rx }));
    }
  }

  return {
    filter,
    sort,
    openOnly: effectiveOpenOnly,
    overdueOnly: effectiveOverdueOnly,
    unsupported: false,
  };
}

function pickTitle(mod, row) {
  if (!mod) return '(record)';
  if (mod.moduleKey === 'people') {
    return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email || '(unnamed)';
  }
  for (const field of mod.titleFields || []) {
    const v = row[field];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return `(untitled ${mod.label.slice(0, -1) || 'record'})`;
}

function pickSubtitle(mod, row) {
  if (!mod?.subtitleFields?.length) return '';
  return mod.subtitleFields.map((f) => row[f]).filter(Boolean).join(' · ');
}

function formatShortDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function normalizeModuleHit(moduleKey, row) {
  const mod = getModule(moduleKey);
  const id = String(row._id || row.id || '');
  if (moduleKey === 'deals') {
    return {
      id,
      type: 'deal',
      title: pickTitle(mod, row) || row.name || '(untitled deal)',
      subtitle: pickSubtitle(mod, row) || [row.stage, row.status].filter(Boolean).join(' · '),
      status: row.status || null,
      amount: row.amount ?? null,
      stage: row.stage || null,
      expectedCloseDate: row.expectedCloseDate || null,
      lastActivityDate: row.lastActivityDate || row.updatedAt || null,
    };
  }
  if (moduleKey === 'tasks') {
    const due = formatShortDate(row.dueDate);
    return {
      id,
      type: 'task',
      title: pickTitle(mod, row),
      subtitle: [row.status, row.priority, due ? `due ${due}` : null].filter(Boolean).join(' · '),
      status: row.status || null,
    };
  }
  if (moduleKey === 'events') {
    const when = formatShortDate(row.startDateTime);
    return {
      id,
      type: 'event',
      title: pickTitle(mod, row),
      subtitle: [row.eventType, row.status, when].filter(Boolean).join(' · '),
      status: row.status || null,
    };
  }
  return {
    id,
    type: moduleKey.replace(/s$/, '') || 'record',
    title: pickTitle(mod, row),
    subtitle: pickSubtitle(mod, row),
    status: row.status || null,
    amount: mod?.amountField != null ? (row[mod.amountField] ?? null) : null,
  };
}

function resolveModel(moduleKey, deps = {}) {
  const mod = getModule(moduleKey);
  if (!mod || mod.support !== 'ready') return null;
  const models = deps.models || {};
  const overrides = {
    deals: models.Deal,
    cases: models.Case,
    people: models.People,
    tasks: models.Task,
    events: models.Event,
    organizations: models.Organization,
    quotes: models.Quote,
    sales_orders: models.SalesOrder,
    items: models.Item,
    documents: models.Document,
    forms: models.Form,
    campaigns: models.Campaign,
    assets: models.ContentAsset,
    responses: models.FormResponse,
    imports: models.ImportHistory,
    articles: models.Document,
  };
  return overrides[moduleKey] || mod.model || null;
}

function recordPathFor(moduleKey, id) {
  const mod = getModule(moduleKey);
  if (!id || !mod?.routeBase) return null;
  return `${mod.routeBase}/${id}`;
}

function coverageReport() {
  const ready = MODULES.filter((m) => m.support === 'ready');
  const unsupported = MODULES.filter((m) => m.support === 'unsupported');
  return {
    apps: APPS,
    modulesTotal: MODULES.length,
    modulesReady: ready.length,
    modulesUnsupported: unsupported.length,
    ready: ready.map((m) => m.moduleKey),
    unsupported: unsupported.map((m) => m.moduleKey),
    fieldContract:
      'Primary title/status fields only — tenant custom fields are not NL-queryable in Astra v2',
  };
}

module.exports = {
  APPS,
  MODULES,
  detectModuleKey,
  getModule,
  listModules,
  buildModuleFilter,
  normalizeModuleHit,
  resolveModel,
  recordPathFor,
  coverageReport,
  CASE_OPEN,
  TASK_DONE,
  escapeRegex,
};
