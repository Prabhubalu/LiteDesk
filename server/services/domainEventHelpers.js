/**
 * ============================================================================
 * PLATFORM CORE: Domain Event Helpers
 * ============================================================================
 *
 * Build and emit domain events only when real changes occur. Used by
 * People, Organization, and Deal controllers.
 *
 * ============================================================================
 */

const { emit } = require('./domainEvents');
const { getStageConfig } = require('./configRegistry');

function toId(v) {
  if (v == null) return null;
  return v.toString ? v.toString() : String(v);
}

function eq(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => eq(x, b[i]));
  }
  return false;
}

/** Keys to compare for generic record.updated changedFields */
function diffFieldKeys(previous, current, keys) {
  if (!current) return [];
  if (!previous) return keys.filter((k) => current[k] !== undefined);
  const changed = [];
  for (const k of keys) {
    if (!eq(previous[k], current[k])) changed.push(k);
  }
  return changed;
}

function emitRecordLifecycle(opts) {
  const {
    entityType,
    entityId,
    previous,
    current,
    snapshotKeys,
    appKey,
    triggeredBy,
    organizationId,
    ownerId
  } = opts;
  const prevSnap = previous
    ? Object.fromEntries(snapshotKeys.map((k) => [k, previous[k]]))
    : null;
  const currSnap = Object.fromEntries(snapshotKeys.map((k) => [k, current[k]]));

  if (!previous) {
    emit({
      entityType,
      entityId,
      eventType: `${entityType}.created`,
      previousState: null,
      currentState: currSnap,
      changedFields: [],
      appKey,
      triggeredBy,
      organizationId,
      ownerId
    });
    return;
  }

  const changedFields = diffFieldKeys(prevSnap, currSnap, snapshotKeys);
  if (changedFields.length === 0) return;

  emit({
    entityType,
    entityId,
    eventType: `${entityType}.updated`,
    previousState: prevSnap,
    currentState: currSnap,
    changedFields,
    appKey,
    triggeredBy,
    organizationId,
    ownerId
  });
}

function resolveOwner(entityType, current) {
  if (!current) return null;
  let ref = null;
  if (entityType === 'people') ref = current.assignedTo || current.lead_owner || null;
  else if (entityType === 'organization') ref = current.assignedTo || null;
  else if (entityType === 'deal') ref = current.ownerId || null;
  else if (entityType === 'quote') ref = current.ownerId || null;
  if (!ref) return null;
  return toId(ref && ref._id ? ref._id : ref);
}

function quoteSnapshot(quote) {
  if (!quote) return null;
  return {
    status: quote.status,
    grandTotal: Number(quote.grandTotal) || 0,
    subtotal: Number(quote.subtotal) || 0,
    globalDiscountTotal: Number(quote.globalDiscountTotal) || 0,
    ownerId: toId(quote.ownerId),
    approvalRequired: quote.approvalRequired === true,
    approvalStatus: quote.approvalStatus || null
  };
}

const QUOTE_SNAPSHOT_KEYS = [
  'status',
  'grandTotal',
  'subtotal',
  'globalDiscountTotal',
  'ownerId',
  'approvalRequired',
  'approvalStatus'
];

/**
 * Emit Quote domain events for Process Designer / automation.
 *
 * @param {Object} opts
 * @param {Object|null} opts.previous - Quote before change (plain object or null on create)
 * @param {Object} opts.current - Quote after change
 * @param {string} [opts.appKey]
 * @param {string|Object|null} [opts.triggeredBy]
 * @param {string|Object|null} [opts.organizationId]
 * @param {boolean} [opts.submittedForApproval] - Also emit quote.submitted_for_approval
 */
function emitQuoteEvents({
  previous,
  current,
  appKey = 'SALES',
  triggeredBy = null,
  organizationId = null,
  submittedForApproval = false
}) {
  if (!current) return;

  const entityId = toId(current._id);
  const orgId = organizationId ? toId(organizationId) : toId(current.organizationId);
  const ownerId = resolveOwner('quote', current);
  const prevSnap = previous ? quoteSnapshot(previous) : null;
  const currSnap = quoteSnapshot(current);

  emitRecordLifecycle({
    entityType: 'quote',
    entityId,
    previous: prevSnap,
    current: currSnap,
    snapshotKeys: QUOTE_SNAPSHOT_KEYS,
    appKey,
    triggeredBy,
    organizationId: orgId,
    ownerId
  });

  if (submittedForApproval) {
    emit({
      entityType: 'quote',
      entityId,
      eventType: 'quote.submitted_for_approval',
      previousState: prevSnap,
      currentState: currSnap,
      changedFields: ['status', 'approvalRequired', 'approvalStatus'],
      appKey,
      triggeredBy,
      organizationId: orgId,
      ownerId
    });
  }
}

/**
 * Emit People events: lifecycle change, type change. Only when actually changed.
 *
 * @param {Object} opts
 * @param {Object|null} opts.previous - Record before update
 * @param {Object} opts.current - Record after update
 * @param {string} [opts.appKey] - App context
 * @param {string|Object|null} [opts.triggeredBy] - User ID or 'system'
 * @param {string|Object|null} [opts.organizationId] - Tenant org ID
 */
function emitPeopleEvents({ previous, current, appKey = 'SALES', triggeredBy = null, organizationId = null }) {
  if (!current) return;
  const entityId = toId(current._id);
  const orgId = organizationId ? toId(organizationId) : null;
  const ownerId = resolveOwner('people', current);

  const { getSalesParticipationValues } = require('../utils/getSalesParticipationValues');
  const prevSales = previous ? getSalesParticipationValues(previous) : {};
  const currSales = getSalesParticipationValues(current);
  const prevType = prevSales.role;
  const currType = currSales.role;
  const prevLead = prevSales.lead_status;
  const currLead = currSales.lead_status;
  const prevContact = prevSales.contact_status;
  const currContact = currSales.contact_status;

  const peopleSnap = (p) => {
    if (!p) return null;
    const s = getSalesParticipationValues(p);
    return {
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      organization: toId(p.organization),
      assignedTo: toId(p.assignedTo),
      lifecycle: p.lifecycle,
      sales_type: s.role,
      lead_status: s.lead_status,
      contact_status: s.contact_status
    };
  };
  emitRecordLifecycle({
    entityType: 'people',
    entityId,
    previous: previous ? peopleSnap(previous) : null,
    current: peopleSnap(current),
    snapshotKeys: [
      'first_name',
      'last_name',
      'email',
      'organization',
      'assignedTo',
      'lifecycle',
      'sales_type',
      'lead_status',
      'contact_status'
    ],
    appKey,
    triggeredBy,
    organizationId: orgId,
    ownerId
  });

  if (prevType !== undefined && !eq(prevType, currType)) {
    emit({
      entityType: 'people',
      entityId,
      eventType: 'people.sales_type.changed',
      previousState: previous
        ? { sales_type: prevType, lead_status: prevLead, contact_status: prevContact }
        : null,
      currentState: { sales_type: currType, lead_status: currLead, contact_status: currContact },
      appKey,
      triggeredBy,
      organizationId: orgId,
      ownerId
    });
  }

  const lifecycleChanged = !eq(prevLead, currLead) || !eq(prevContact, currContact);
  if (lifecycleChanged) {
    emit({
      entityType: 'people',
      entityId,
      eventType: 'people.lifecycle.changed',
      previousState: previous
        ? { sales_type: prevType, lead_status: prevLead, contact_status: prevContact }
        : null,
      currentState: { sales_type: currType, lead_status: currLead, contact_status: currContact },
      appKey,
      triggeredBy,
      organizationId: orgId,
      ownerId
    });
  }
}

/**
 * Emit Organization events: lifecycle change, type change. Only when actually changed.
 *
 * @param {Object} opts
 * @param {Object|null} opts.previous - Record before update
 * @param {Object} opts.current - Record after update
 * @param {string} [opts.appKey]
 * @param {string|Object|null} [opts.triggeredBy]
 * @param {string|Object|null} [opts.organizationId] - Tenant org ID (context)
 */
function emitOrganizationEvents({ previous, current, appKey = 'SALES', triggeredBy = null, organizationId = null }) {
  if (!current) return;
  const entityId = toId(current._id);
  const orgId = organizationId ? toId(organizationId) : null;

  const prevTypes = previous?.types;
  const currTypes = current?.types;
  const prevCustomer = previous?.customerStatus;
  const currCustomer = current?.customerStatus;
  const prevPartner = previous?.partnerStatus;
  const currPartner = current?.partnerStatus;
  const prevVendor = previous?.vendorStatus;
  const currVendor = current?.vendorStatus;

  const ownerId = resolveOwner('organization', current);

  const orgSnap = (o) => {
    if (!o) return null;
    return {
      name: o.name,
      assignedTo: toId(o.assignedTo),
      types: o.types,
      customerStatus: o.customerStatus,
      partnerStatus: o.partnerStatus,
      vendorStatus: o.vendorStatus
    };
  };
  emitRecordLifecycle({
    entityType: 'organization',
    entityId,
    previous: previous ? orgSnap(previous) : null,
    current: orgSnap(current),
    snapshotKeys: ['name', 'assignedTo', 'types', 'customerStatus', 'partnerStatus', 'vendorStatus'],
    appKey,
    triggeredBy,
    organizationId: orgId,
    ownerId
  });

  if (!eq(prevTypes, currTypes)) {
    emit({
      entityType: 'organization',
      entityId,
      eventType: 'organization.type.changed',
      previousState: previous ? { types: prevTypes, customerStatus: prevCustomer, partnerStatus: prevPartner, vendorStatus: prevVendor } : null,
      currentState: { types: currTypes, customerStatus: currCustomer, partnerStatus: currPartner, vendorStatus: currVendor },
      appKey,
      triggeredBy,
      organizationId: orgId,
      ownerId
    });
  }

  const lifecycleChanged = !eq(prevCustomer, currCustomer) || !eq(prevPartner, currPartner) || !eq(prevVendor, currVendor);
  if (lifecycleChanged) {
    emit({
      entityType: 'organization',
      entityId,
      eventType: 'organization.lifecycle.changed',
      previousState: previous ? { types: prevTypes, customerStatus: prevCustomer, partnerStatus: prevPartner, vendorStatus: prevVendor } : null,
      currentState: { types: currTypes, customerStatus: currCustomer, partnerStatus: currPartner, vendorStatus: currVendor },
      appKey,
      triggeredBy,
      organizationId: orgId,
      ownerId
    });
  }
}

/**
 * Resolve deal won/lost from stage or derivedStatus. Uses config when available.
 *
 * @param {Object} record - Deal record
 * @param {string} [appKey]
 * @returns {Promise<'won'|'lost'|null>}
 */
async function resolveDealWonLost(record, appKey = 'SALES') {
  const stage = (record?.stage || '').toString().trim();
  const derived = (record?.derivedStatus || record?.status || '').toString().trim().toLowerCase();
  if (derived === 'won') return 'won';
  if (derived === 'lost') return 'lost';
  const legacyWon = ['Closed Won', 'Won'].some((s) => stage === s || derived === s.toLowerCase());
  const legacyLost = ['Closed Lost', 'Lost'].some((s) => stage === s || derived === s.toLowerCase());
  if (legacyWon) return 'won';
  if (legacyLost) return 'lost';
  try {
    const pipeline = record?.pipeline;
    const cfg = await getStageConfig(pipeline, stage, appKey);
    const ds = (cfg?.derivedStatus || '').toString().trim().toLowerCase();
    if (ds === 'won') return 'won';
    if (ds === 'lost') return 'lost';
  } catch (_) {}
  return null;
}

/**
 * Emit Deal events: stage change, pipeline change, deal won/lost. Only when actually changed.
 *
 * @param {Object} opts
 * @param {Object|null} opts.previous - Record before update (null for create)
 * @param {Object} opts.current - Record after update
 * @param {string} [opts.appKey]
 * @param {string|Object|null} [opts.triggeredBy]
 * @param {string|Object|null} [opts.organizationId] - Tenant org ID (deal.organizationId)
 */
async function emitDealEvents({ previous, current, appKey = 'SALES', triggeredBy = null, organizationId = null }) {
  if (!current) return;
  const entityId = toId(current._id);
  const orgId = organizationId ? toId(organizationId) : (current.organizationId ? toId(current.organizationId) : null);
  const ownerId = resolveOwner('deal', current);

  const prevStage = previous?.stage;
  const currStage = current?.stage;
  const prevPipeline = previous?.pipeline;
  const currPipeline = current?.pipeline;
  const prevOwner = toId(previous?.ownerId);
  const currOwner = toId(current?.ownerId);

  emitRecordLifecycle({
    entityType: 'deal',
    entityId,
    previous: previous
      ? {
          name: previous?.name,
          stage: prevStage,
          pipeline: prevPipeline,
          amount: previous?.amount,
          ownerId: prevOwner
        }
      : null,
    current: {
      name: current?.name,
      stage: currStage,
      pipeline: currPipeline,
      amount: current?.amount,
      ownerId: currOwner
    },
    snapshotKeys: ['name', 'stage', 'pipeline', 'amount', 'ownerId'],
    appKey,
    triggeredBy,
    organizationId: orgId,
    ownerId
  });

  if (prevStage !== undefined && prevStage !== currStage) {
    emit({
      entityType: 'deal',
      entityId,
      eventType: 'deal.stage.changed',
      previousState: previous ? { stage: prevStage, pipeline: prevPipeline } : null,
      currentState: { stage: currStage, pipeline: currPipeline },
      appKey,
      triggeredBy,
      organizationId: orgId,
      ownerId
    });
  }

  if (prevPipeline !== undefined && !eq(prevPipeline, currPipeline)) {
    emit({
      entityType: 'deal',
      entityId,
      eventType: 'deal.pipeline.changed',
      previousState: previous ? { stage: prevStage, pipeline: prevPipeline } : null,
      currentState: { stage: currStage, pipeline: currPipeline },
      appKey,
      triggeredBy,
      organizationId: orgId,
      ownerId
    });
  }

  const prevWonLost = await resolveDealWonLost(previous, appKey);
  const currWonLost = await resolveDealWonLost(current, appKey);
  if (currWonLost === 'won' && prevWonLost !== 'won') {
    emit({
      entityType: 'deal',
      entityId,
      eventType: 'deal.deal.won',
      previousState: previous ? { stage: prevStage, pipeline: prevPipeline } : null,
      currentState: { stage: currStage, pipeline: currPipeline },
      appKey,
      triggeredBy,
      organizationId: orgId,
      ownerId
    });
  }
  if (currWonLost === 'lost' && prevWonLost !== 'lost') {
    emit({
      entityType: 'deal',
      entityId,
      eventType: 'deal.deal.lost',
      previousState: previous ? { stage: prevStage, pipeline: prevPipeline } : null,
      currentState: { stage: currStage, pipeline: currPipeline },
      appKey,
      triggeredBy,
      organizationId: orgId,
      ownerId
    });
  }
}

module.exports = {
  emitPeopleEvents,
  emitOrganizationEvents,
  emitDealEvents,
  emitQuoteEvents,
  resolveDealWonLost
};
