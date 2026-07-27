'use strict';

/**
 * ATIP AI Sync Assistant — business-language Q&A over sync audit/jobs.
 */

const auditEngine = require('./auditEngine');
const monitoringEngine = require('./monitoringEngine');
const conflictEngine = require('./conflictEngine');
const ConnectorSyncJob = require('../../../../models/ConnectorSyncJob');
const { CONNECTOR_KEYS } = require('../../connectorConstants');

function normalizeQuestion(q) {
  return String(q || '').trim().toLowerCase();
}

async function ask({ organizationId, question, companyGuid = null }) {
  const q = normalizeQuestion(question);
  if (!q) {
    return {
      answer: 'Ask about failed syncs, pending ledgers, GST errors, duplicates, or mapping improvements.',
      citations: [],
    };
  }

  const dashboard = await monitoringEngine.getDashboard({ organizationId });
  const citations = [];

  if (/why.*(didn'?t|did not|failed).*sync|failed.*(invoice|voucher|ledger)/i.test(q) || /inv[- ]?\d+/i.test(question)) {
    const recordHint = (question.match(/INV[- ]?\d+/i) || question.match(/\b[A-Z]{2,}-?\d+\b/))?.[0] || null;
    const { items } = await auditEngine.searchEvents({
      organizationId,
      q: recordHint || 'failed',
      level: 'error',
      limit: 10,
    });
    citations.push(...items.slice(0, 5).map((e) => ({ type: 'event', id: String(e._id), message: e.message })));
    if (!items.length) {
      return {
        answer: recordHint
          ? `I could not find sync errors for ${recordHint}. Check Sync Logs or confirm the document was posted and within the date window.`
          : 'No recent sync errors found. Queue health looks ' + (dashboard.queueHealth || 'ok') + '.',
        citations,
        dashboardHint: { failed: dashboard.queue?.failed, pending: dashboard.queue?.pending },
      };
    }
    const top = items[0];
    const intel = top.payload?.problem
      ? top.payload
      : {
          problem: top.message,
          cause: top.causeCode || 'See audit event',
          resolution: top.resolutionCode || 'Open the failed job and retry after fixing the cause.',
        };
    return {
      answer: `${intel.problem || top.message}\n\nCause: ${intel.cause || top.causeCode || 'n/a'}\n\nResolution: ${intel.resolution || 'Retry from Integration Center.'}`,
      citations,
      codes: { problem: top.problemCode, cause: top.causeCode, resolution: top.resolutionCode },
    };
  }

  if (/pending|42 ledgers|how many.*pending/i.test(q)) {
    const pendingJobs = dashboard.queue?.pending || 0;
    const { items } = await auditEngine.searchEvents({
      organizationId,
      q: 'pending',
      limit: 5,
    });
    citations.push(...items.map((e) => ({ type: 'event', id: String(e._id), message: e.message })));
    return {
      answer: `There are ${pendingJobs} pending sync jobs and ${dashboard.queue?.retryQueue || 0} in the retry queue. Open Activity or Sync Jobs to drain them. Connection health: ${dashboard.healthState}.`,
      citations,
    };
  }

  if (/gst|failed gst/i.test(q)) {
    const { items } = await auditEngine.searchEvents({
      organizationId,
      q: 'GST',
      limit: 10,
    });
    citations.push(...items.slice(0, 5).map((e) => ({ type: 'event', id: String(e._id), message: e.message })));
    return {
      answer: items.length
        ? `Found ${items.length} GST-related events. Top issue: ${items[0].message}. Fix GSTIN / tax ledger mappings, then retry.`
        : 'No GST-specific failures in recent audit. Confirm tax mappings under Sync settings.',
      citations,
    };
  }

  if (/duplicat/i.test(q)) {
    const { items } = await auditEngine.searchEvents({
      organizationId,
      q: 'duplicate',
      limit: 10,
    });
    citations.push(...items.slice(0, 5).map((e) => ({ type: 'event', id: String(e._id), message: e.message })));
    return {
      answer: items.length
        ? `Possible duplicates detected (${items.length} events). Prefer Link to existing records or switch Create to Update.`
        : 'No duplicate errors in recent audit. Mapping Center can still show name collisions on pending objects.',
      citations,
    };
  }

  if (/mapping|suggest|improve/i.test(q)) {
    return {
      answer:
        'Open the wizard step “AI field mappings” or Advanced → Field maps. Accept high-confidence suggestions (≥95%), then activate the mapping version so the next sync applies them.',
      citations: [],
      wizard: dashboard.wizard,
    };
  }

  if (/conflict/i.test(q)) {
    const conflicts = await conflictEngine.listConflicts({ organizationId, limit: 10 });
    citations.push(...conflicts.map((c) => ({ type: 'conflict', id: String(c._id), entityType: c.entityType })));
    return {
      answer: conflicts.length
        ? `There are ${conflicts.length} open conflicts. Resolve with CRM wins, Tally wins, or merge from the Conflicts panel.`
        : 'No open conflicts.',
      citations,
    };
  }

  const jobs = await ConnectorSyncJob.find({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    ...(companyGuid ? { companyGuid } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return {
    answer: `Health is ${dashboard.healthState}. Queue: ${dashboard.queue?.pending || 0} pending, ${dashboard.queue?.failed || 0} failed, ${dashboard.conflicts?.open || 0} conflicts. Ask specifically about a voucher number, GST, duplicates, or mappings for a deeper answer.`,
    citations: jobs.map((j) => ({ type: 'job', id: String(j._id), jobType: j.jobType, status: j.status })),
  };
}

module.exports = { ask };
