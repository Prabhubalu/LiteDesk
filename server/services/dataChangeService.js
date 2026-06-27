/**
 * Publish tenant-scoped data change events for client cache invalidation.
 */

const hub = require('./dataChangeSSEHub');

/**
 * @param {object} params
 * @param {string|import('mongoose').Types.ObjectId} params.organizationId
 * @param {string} params.moduleKey
 * @param {string} [params.recordId]
 * @param {string} [params.op] - create | update | delete | bulk | import
 */
function publishDataChange({ organizationId, moduleKey, recordId, op = 'update' }) {
  if (!organizationId || !moduleKey) return;

  try {
    hub.publish({
      organizationId: String(organizationId),
      payload: {
        type: 'data-change',
        moduleKey: String(moduleKey).toLowerCase(),
        recordId: recordId ? String(recordId) : undefined,
        op,
        at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.warn('[dataChangeService] publish failed:', err?.message || err);
  }
}

function publishFromRequest(req, moduleKey, recordId, op = 'update') {
  if (!req?.user?.organizationId) return;
  publishDataChange({
    organizationId: req.user.organizationId,
    moduleKey,
    recordId,
    op,
  });
}

module.exports = {
  publishDataChange,
  publishFromRequest,
};
