'use strict';

const Organization = require('../models/Organization');
const Process = require('../models/Process');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { startProcess } = require('./processInvocation');
const {
  parseOrganizationIdFromWebhookKey,
  applyPayloadMapping,
  verifyWebhookRequest
} = require('../utils/processWebhookUtils');
const { createLogger } = require('./automationLogger');

const log = createLogger('processWebhook');

/**
 * Resolve active webhook process in tenant DB.
 */
async function findWebhookProcess(webhookKey) {
  return Process.findOne({
    status: 'active',
    'trigger.type': 'webhook',
    'trigger.webhookKey': webhookKey
  }).lean();
}

/**
 * Handle inbound process webhook POST.
 */
async function invokeProcessWebhook({ webhookKey, req, body }) {
  const orgId = parseOrganizationIdFromWebhookKey(webhookKey);
  if (!orgId) {
    return { ok: false, status: 404, error: 'Webhook not found' };
  }

  const tenant = await Organization.findOne({
    _id: orgId,
    isTenant: true,
    isActive: true,
    'database.name': { $exists: true, $nin: [null, ''] }
  })
    .select('_id database.name')
    .lean();

  if (!tenant?.database?.name) {
    return { ok: false, status: 404, error: 'Webhook not found' };
  }

  let conn;
  try {
    conn = await dbConnectionManager.getOrganizationConnection(tenant.database.name);
    if (conn.readyState !== 1) await conn.asPromise();
  } catch (err) {
    log.error('webhook_db_connect_failed', { orgId: orgId.toString(), error: err.message });
    return { ok: false, status: 503, error: 'Tenant unavailable' };
  }

  return runWithTenantContext(
    { organizationId: tenant._id, connection: conn, databaseName: tenant.database.name },
    async () => {
      const process = await findWebhookProcess(webhookKey);
      if (!process) {
        return { ok: false, status: 404, error: 'Webhook not found' };
      }

      const auth = await verifyWebhookRequest(req, process.trigger.secretHash);
      if (!auth.ok) {
        return { ok: false, status: 401, error: auth.error };
      }

      const deliveryId =
        req.headers['x-process-webhook-id'] ||
        req.headers['x-webhook-id'] ||
        body?.deliveryId ||
        body?.id ||
        null;

      const payload = body && typeof body === 'object' ? body : {};
      const inputMapping = applyPayloadMapping(payload, process.trigger.payloadMapping || {});

      const entityType = payload.entityType || payload.entity_type || process.entityType;
      const entityId = payload.entityId || payload.entity_id || payload.recordId || payload.record_id || null;

      const result = await startProcess({
        processId: process._id.toString(),
        webhookInvocation: true,
        webhookDeliveryId: deliveryId ? String(deliveryId) : null,
        manualParams: {
          entityType,
          entityId,
          organizationId: orgId.toString(),
          triggeredBy: 'system'
        },
        inputMapping: {
          ...inputMapping,
          webhookPayload: payload
        }
      });

      if (!result.ok) {
        return { ok: false, status: 400, error: result.error || 'Process start failed' };
      }

      log.info('webhook_invoked', {
        webhookKey,
        processId: process._id.toString(),
        executionId: result.executionId,
        skipped: !!result.skipped,
        paused: !!result.paused
      });

      return {
        ok: true,
        status: 202,
        executionId: result.executionId,
        skipped: !!result.skipped,
        paused: !!result.paused
      };
    }
  );
}

module.exports = {
  invokeProcessWebhook,
  findWebhookProcess
};
