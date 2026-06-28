/**
 * ============================================================================
 * PLATFORM CORE: Approval Approver Resolver (Process Engine Phase 3)
 * ============================================================================
 *
 * Resolves approvers from approval_gate config (role | user | rule).
 * Never bypasses ownership or permissions. Returns user IDs only.
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const { createLogger } = require('./automationLogger');

const log = createLogger('approvalApproverResolver');

/**
 * Resolve approvers from config into user IDs.
 *
 * @param {Object} params
 * @param {Array<{ type: 'role'|'user'|'rule', value: string }>} params.approvers - Config approvers
 * @param {string} params.organizationId - Org scope
 * @param {string} [params.entityType] - Entity type (people|organization|deal)
 * @param {string} [params.entityId] - Entity ID
 * @param {string} [params.assignedTo] - Record owner (for rule: owner)
 * @param {string} [params.triggeredBy] - User who triggered (for rule: triggeredBy)
 * @returns {Promise<{ ok: boolean, userIds?: string[], error?: string }>}
 */
async function resolveApprovers(params) {
  const {
    approvers = [],
    organizationId,
    entityType,
    entityId,
    assignedTo,
    triggeredBy
  } = params;

  if (!organizationId) {
    return { ok: false, error: 'organizationId required to resolve approvers' };
  }

  if (!Array.isArray(approvers) || approvers.length === 0) {
    return { ok: false, error: 'No valid approvers resolved' };
  }

  const userIds = new Set();
  const orgId = new mongoose.Types.ObjectId(organizationId);

  for (const a of approvers) {
    const { type, value } = a || {};
    if (!type || !value) continue;

    try {
      if (type === 'user') {
        const id = mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
        if (id) {
          const u = await User.findOne({ _id: id, organizationId: orgId }).lean();
          if (u) userIds.add(u._id.toString());
        }
      } else if (type === 'role') {
        const role = String(value).toLowerCase();
        const users = await User.find({ organizationId: orgId, role }).select('_id').lean();
        users.forEach(u => userIds.add(u._id.toString()));
      } else if (type === 'rule') {
        const rule = String(value).toLowerCase();
        if (rule === 'owner' && assignedTo) {
          const id = mongoose.Types.ObjectId.isValid(assignedTo) ? new mongoose.Types.ObjectId(assignedTo) : null;
          if (id) {
            const u = await User.findOne({ _id: id, organizationId: orgId }).lean();
            if (u) userIds.add(u._id.toString());
          }
        } else if (rule === 'triggeredby' && triggeredBy) {
          const id = mongoose.Types.ObjectId.isValid(triggeredBy) ? new mongoose.Types.ObjectId(triggeredBy) : null;
          if (id) {
            const u = await User.findOne({ _id: id, organizationId: orgId }).lean();
            if (u) userIds.add(u._id.toString());
          }
        }
        // Other rules (e.g. manager) can be extended later
      }
    } catch (e) {
      log.warn('approver_resolution_error', { type, value, error: e.message });
    }
  }

  const ids = [...userIds];
  if (ids.length === 0) {
    return { ok: false, error: 'No valid approvers resolved' };
  }

  return { ok: true, userIds: ids };
}

module.exports = {
  resolveApprovers
};
