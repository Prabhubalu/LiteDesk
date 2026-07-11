const Case = require('../models/Case');
const Event = require('../models/Event');
const FormResponse = require('../models/FormResponse');
const mailroomConfigService = require('../services/mailroomConfigService');
const {
  buildPortalCaseAccessQuery,
  shapePortalCaseSummary
} = require('../services/portalCaseAccessService');
const { listPortalPayableInvoices } = require('../services/portalInvoicePayService');
const documentService = require('../services/documentService');
const portalKnowledgeService = require('../services/portalKnowledgeService');
const { listPortalAccessibleForms } = require('../services/portalFormAccessService');
const { buildPortalResponseAccessQuery } = require('../services/portalResponseService');
const { buildPortalDealAccessQuery } = require('../services/portalDealService');
const Deal = require('../models/Deal');
const {
  userModuleView,
  hasHydratedPermissionEnvelope,
  isExternalPortalUser
} = require('../utils/portalModuleAccess');

const {
  buildPortalAuditAccessQuery,
  countOpenCorrectiveActionsForUser
} = require('./portalAuditAccessService');

const CLOSED_CASE_STATUSES = ['Resolved', 'Closed'];
const OPEN_DEAL_STATUSES = ['Open'];
const IN_PROGRESS_RESPONSE_STATUSES = ['In Progress', 'Not Started'];

/**
 * Role-aware dashboard widgets from hydrated session permissions.
 */
function resolvePortalDashboardWidgets(user) {
  const widgets = {
    cases: userModuleView(user, 'cases'),
    knowledge: userModuleView(user, 'documents'),
    invoices: userModuleView(user, 'invoices'),
    deals: userModuleView(user, 'deals'),
    forms: userModuleView(user, 'forms'),
    responses: userModuleView(user, 'responses') || userModuleView(user, 'forms'),
    organization: userModuleView(user, 'organizations'),
    people: userModuleView(user, 'people'),
    audits: userModuleView(user, 'audits') || userModuleView(user, 'events'),
    actions: userModuleView(user, 'audits') || userModuleView(user, 'events')
  };

  const anyEnabled = Object.values(widgets).some(Boolean);
  if (!anyEnabled && isExternalPortalUser(user) && !hasHydratedPermissionEnvelope(user)) {
    widgets.cases = true;
    widgets.knowledge = true;
    widgets.invoices = true;
  }

  return widgets;
}

function shapePortalInvoiceSummary(row) {
  return {
    _id: row._id,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    dueDate: row.dueDate,
    currency: row.currency || 'USD',
    amountDue: row.amountDue,
    status: row.status
  };
}

async function loadCaseDashboardMetrics(organizationId, user, portalConfig) {
  const query = await buildPortalCaseAccessQuery(organizationId, user, { portalConfig });
  const openCaseQuery = {
    ...query,
    status: { $nin: CLOSED_CASE_STATUSES }
  };
  const awaitingReplyQuery = {
    ...query,
    status: 'Waiting for Customer'
  };

  const [totalCases, openCases, awaitingCustomerReply, recentRows] = await Promise.all([
    Case.countDocuments(query),
    Case.countDocuments(openCaseQuery),
    Case.countDocuments(awaitingReplyQuery),
    Case.find(query)
      .select('caseId title description status priority channel createdAt updatedAt requesterEmail')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean()
  ]);

  return {
    openCases,
    totalCases,
    awaitingCustomerReply,
    recentCases: recentRows.map((row) => ({
      ...shapePortalCaseSummary(row),
      awaitingReply: row.status === 'Waiting for Customer'
    }))
  };
}

async function loadInvoiceDashboardMetrics(organizationId, user) {
  try {
    const invoiceResult = await listPortalPayableInvoices(organizationId, user, { limit: 3, skip: 0 });
    return {
      openInvoices: invoiceResult.total || 0,
      recentInvoices: (invoiceResult.rows || []).map(shapePortalInvoiceSummary)
    };
  } catch (invoiceErr) {
    console.warn('[portalDashboardService] invoice summary skipped:', invoiceErr.message);
    return { openInvoices: 0, recentInvoices: [] };
  }
}

async function countOpenCorrectiveActions(organizationId, user) {
  return countOpenCorrectiveActionsForUser(organizationId, user);
}

function shapePortalKnowledgeSummary(doc) {
  return portalKnowledgeService.shapePortalKnowledgeSummary(doc);
}

async function loadSuggestedArticles(organizationId) {
  try {
    const result = await portalKnowledgeService.listPortalKnowledgeArticles({
      organizationId,
      page: 1,
      limit: 3,
    });
    return (result.data || []).map(shapePortalKnowledgeSummary);
  } catch (err) {
    console.warn('[portalDashboardService] suggested articles skipped:', err.message);
    return [];
  }
}

async function loadDealDashboardMetrics(organizationId, user) {
  try {
    const query = await buildPortalDealAccessQuery(organizationId, user);
    const openQuery = { ...query, status: { $in: OPEN_DEAL_STATUSES } };
    const [totalDeals, openDeals] = await Promise.all([
      Deal.countDocuments(query),
      Deal.countDocuments(openQuery)
    ]);
    return { totalDeals, openDeals };
  } catch (err) {
    console.warn('[portalDashboardService] deal summary skipped:', err.message);
    return { totalDeals: 0, openDeals: 0 };
  }
}

async function loadFormDashboardMetrics(organizationId) {
  try {
    const { total } = await listPortalAccessibleForms(organizationId, { limit: 1, skip: 0 });
    return { availableForms: total || 0 };
  } catch (err) {
    console.warn('[portalDashboardService] form summary skipped:', err.message);
    return { availableForms: 0 };
  }
}

async function loadResponseDashboardMetrics(organizationId, user) {
  try {
    const query = await buildPortalResponseAccessQuery(organizationId, user);
    const inProgressQuery = {
      ...query,
      executionStatus: { $in: IN_PROGRESS_RESPONSE_STATUSES }
    };
    const [totalResponses, inProgressResponses] = await Promise.all([
      FormResponse.countDocuments(query),
      FormResponse.countDocuments(inProgressQuery)
    ]);
    return { totalResponses, inProgressResponses };
  } catch (err) {
    console.warn('[portalDashboardService] response summary skipped:', err.message);
    return { totalResponses: 0, inProgressResponses: 0 };
  }
}

async function loadAuditDashboardMetrics(organizationId, user) {
  const auditQuery = await buildPortalAuditAccessQuery(organizationId, user);

  const [totalAudits, openActions, recentRows] = await Promise.all([
    Event.countDocuments(auditQuery),
    countOpenCorrectiveActions(organizationId, user),
    Event.find(auditQuery)
      .select('eventId eventName eventType auditState createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean()
  ]);

  const openAudits = await Event.countDocuments({
    ...auditQuery,
    auditState: { $ne: 'closed' }
  });

  return {
    totalAudits,
    openAudits,
    openActions,
    recentAudits: recentRows.map((event) => ({
      _id: event._id,
      eventId: event.eventId,
      title: event.eventName || 'Untitled Audit',
      status: event.auditState,
      auditState: event.auditState,
      updatedAt: event.updatedAt,
      createdAt: event.createdAt
    }))
  };
}

async function buildPortalDashboardPayload(organizationId, user) {
  const mailroomConfig = await mailroomConfigService.getOrCreateConfig(organizationId);
  const portalConfig = mailroomConfig?.connectors?.portal;
  const widgets = resolvePortalDashboardWidgets(user);

  const payload = {
    widgets,
    openCases: 0,
    totalCases: 0,
    awaitingCustomerReply: 0,
    openInvoices: 0,
    recentCases: [],
    recentInvoices: [],
    totalAudits: 0,
    openAudits: 0,
    openActions: 0,
    recentAudits: [],
    suggestedArticles: [],
    openDeals: 0,
    totalDeals: 0,
    availableForms: 0,
    totalResponses: 0,
    inProgressResponses: 0
  };

  const tasks = [];

  if (widgets.cases) {
    tasks.push(
      loadCaseDashboardMetrics(organizationId, user, portalConfig).then((metrics) => {
        Object.assign(payload, metrics);
      })
    );
  }

  if (widgets.invoices) {
    tasks.push(
      loadInvoiceDashboardMetrics(organizationId, user).then(({ openInvoices, recentInvoices }) => {
        payload.openInvoices = openInvoices;
        payload.recentInvoices = recentInvoices;
      })
    );
  }

  if (widgets.audits || widgets.actions) {
    tasks.push(
      loadAuditDashboardMetrics(organizationId, user).then((metrics) => {
        payload.totalAudits = metrics.totalAudits;
        payload.openAudits = metrics.openAudits;
        payload.openActions = metrics.openActions;
        payload.recentAudits = metrics.recentAudits;
      })
    );
  }

  if (widgets.knowledge) {
    tasks.push(
      loadSuggestedArticles(organizationId).then((articles) => {
        payload.suggestedArticles = articles;
      })
    );
  }

  if (widgets.deals) {
    tasks.push(
      loadDealDashboardMetrics(organizationId, user).then(({ openDeals, totalDeals }) => {
        payload.openDeals = openDeals;
        payload.totalDeals = totalDeals;
      })
    );
  }

  if (widgets.forms) {
    tasks.push(
      loadFormDashboardMetrics(organizationId).then(({ availableForms }) => {
        payload.availableForms = availableForms;
      })
    );
  }

  if (widgets.responses) {
    tasks.push(
      loadResponseDashboardMetrics(organizationId, user).then(
        ({ totalResponses, inProgressResponses }) => {
          payload.totalResponses = totalResponses;
          payload.inProgressResponses = inProgressResponses;
        }
      )
    );
  }

  await Promise.all(tasks);
  return payload;
}

module.exports = {
  resolvePortalDashboardWidgets,
  buildPortalDashboardPayload,
  shapePortalInvoiceSummary,
  userModuleView
};
