const Organization = require('../models/Organization');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const { buildChatSessionScopeFilter } = require('../utils/liveChatSessionQueryUtils');

function buildLinkedRecordsFilter(organizationId) {
  const scope = buildChatSessionScopeFilter(organizationId);
  return {
    ...scope,
    $or: [
      { linkedRecords: { $elemMatch: {} } },
      { caseRecordId: { $exists: true, $ne: null } },
    ],
  };
}

/**
 * Block live_chat uninstall when sessions still reference business records (LC4).
 */
async function countSessionsWithLinkedRecords(organizationId) {
  return runWithOrganizationTenantContext(organizationId, async () => {
    const ChatSession = require('../models/ChatSession');
    return ChatSession.countDocuments(buildLinkedRecordsFilter(organizationId));
  });
}

async function assertLiveChatUninstallAllowed(organizationId) {
  const linkedCount = await countSessionsWithLinkedRecords(organizationId);
  if (linkedCount > 0) {
    const err = new Error(
      `Cannot uninstall Live Chat while ${linkedCount} session(s) still link to business records. Unlink or archive sessions first.`,
    );
    err.statusCode = 409;
    err.code = 'LIVE_CHAT_LINKED_RECORDS';
    err.linkedSessionCount = linkedCount;
    throw err;
  }
}

module.exports = {
  countSessionsWithLinkedRecords,
  assertLiveChatUninstallAllowed,
  buildLinkedRecordsFilter,
};
