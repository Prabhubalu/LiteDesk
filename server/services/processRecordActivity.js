/**
 * Append process run entries to a record's activity timeline.
 * Only when execution is bound to entityType + entityId (not dry-run / idempotent skip).
 */

const mongoose = require('mongoose');
const Deal = require('../models/Deal');
const People = require('../models/People');
const Organization = require('../models/Organization');
const { appendRecordActivityLog } = require('../utils/recordActivityLogger');
const { createLogger } = require('./automationLogger');

const log = createLogger('processRecordActivity');

const PROCESS_ACTIVITY_USER = 'Process automation';

const ENTITY_TYPE_TO_MODULE = {
  deal: { moduleKey: 'deals', model: Deal },
  people: { moduleKey: 'people', model: People },
  organization: { moduleKey: 'organizations', model: Organization }
};

function resolveAuthorId(context = {}) {
  for (const id of [context.triggeredBy, context.ownerId]) {
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      return new mongoose.Types.ObjectId(id);
    }
  }
  return null;
}

function actionForStatus(status) {
  switch (status) {
    case 'failed':
      return 'process_failed';
    case 'waiting_for_approval':
      return 'process_waiting_approval';
    case 'waiting_until':
      return 'process_waiting';
    default:
      return 'process_completed';
  }
}

function buildMessage(processName, status, error) {
  const name = (processName || 'Process').trim() || 'Process';
  switch (status) {
    case 'completed':
      return `Process "${name}" completed`;
    case 'failed':
      return error
        ? `Process "${name}" failed: ${String(error).slice(0, 200)}`
        : `Process "${name}" failed`;
    case 'waiting_for_approval':
      return `Process "${name}" is waiting for approval`;
    case 'waiting_until':
      return `Process "${name}" is paused until a scheduled time`;
    default:
      return `Process "${name}" (${status})`;
  }
}

function buildDetails(process, execution, context, status, error) {
  return {
    processId: process?._id?.toString?.() || process?.id || null,
    processName: process?.name || null,
    executionId: context?.executionId || execution?.executionId || null,
    executionMongoId: execution?._id?.toString?.() || null,
    status,
    error: error ? String(error).slice(0, 500) : null,
    appKey: process?.appKey || context?.appKey || null
  };
}

/**
 * @param {{
 *   process: { _id?: unknown, name?: string, appKey?: string },
 *   execution?: { _id?: unknown, executionId?: string, entityType?: string, entityId?: string, organizationId?: unknown },
 *   context: { entityType?: string, entityId?: string, organizationId?: string, executionId?: string, triggeredBy?: string, ownerId?: string, appKey?: string },
 *   status: 'completed' | 'failed' | 'waiting_for_approval' | 'waiting_until',
 *   error?: string | null
 * }} params
 */
async function appendProcessRecordActivity({ process, execution, context, status, error = null }) {
  try {
    const entityType = context?.entityType || execution?.entityType;
    const entityId = context?.entityId || execution?.entityId;
    const organizationId = context?.organizationId || execution?.organizationId;

    if (!entityType || !entityId || !organizationId) return;
    if (!mongoose.Types.ObjectId.isValid(entityId) || !mongoose.Types.ObjectId.isValid(organizationId)) {
      return;
    }

    const mapping = ENTITY_TYPE_TO_MODULE[entityType];
    if (!mapping) return;

    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const recordOid = new mongoose.Types.ObjectId(entityId);
    const action = actionForStatus(status);
    const message = buildMessage(process?.name, status, error);
    const details = buildDetails(process, execution, context, status, error);
    const authorId = resolveAuthorId(context);

    const entry = {
      user: PROCESS_ACTIVITY_USER,
      userId: authorId,
      action,
      message,
      details,
      timestamp: new Date()
    };

    const query = { _id: recordOid, organizationId: orgOid, deletedAt: null };
    if (entityType === 'organization') {
      query.isTenant = false;
    }

    const updated = await mapping.model.findOneAndUpdate(
      query,
      { $push: { activityLogs: entry } },
      { runValidators: false }
    );

    if (updated) {
      log.info('process_record_activity_logged', {
        moduleKey: mapping.moduleKey,
        recordId: entityId,
        status,
        executionId: details.executionId
      });
      return;
    }

    if (!authorId) {
      log.warn('process_record_activity_skipped_no_author', {
        entityType,
        entityId,
        status
      });
      return;
    }

    await appendRecordActivityLog({
      organizationId: orgOid,
      moduleKey: mapping.moduleKey,
      recordId: recordOid,
      authorId,
      action,
      message,
      details
    });

    log.info('process_record_activity_logged', {
      moduleKey: mapping.moduleKey,
      recordId: entityId,
      status,
      executionId: details.executionId,
      via: 'RecordActivity'
    });
  } catch (err) {
    log.error('process_record_activity_error', {
      error: err.message,
      status
    });
  }
}

module.exports = {
  appendProcessRecordActivity,
  buildMessage,
  actionForStatus
};
