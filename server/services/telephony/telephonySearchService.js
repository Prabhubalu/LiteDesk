'use strict';

const TelephonyCall = require('../../models/TelephonyCall');

/**
 * Search calls by phone, provider SID, disposition, or agent.
 */
async function searchCalls(
  organizationId,
  {
    q = '',
    phone = '',
    providerCallSid = '',
    disposition = '',
    agentUserId = null,
    status = null,
    limit = 50,
    skip = 0,
  } = {}
) {
  const filter = { organizationId };
  const query = String(q || '').trim();

  if (providerCallSid) {
    filter.providerCallSid = String(providerCallSid).trim();
  }
  if (disposition) {
    filter.disposition = String(disposition).trim();
  }
  if (agentUserId) {
    filter.agentUserId = agentUserId;
  }
  if (status) {
    filter.status = status;
  }

  const phoneQ = String(phone || query || '').trim();
  if (phoneQ && !providerCallSid) {
    const escaped = phoneQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { from: new RegExp(escaped, 'i') },
      { to: new RegExp(escaped, 'i') },
      { providerCallSid: new RegExp(escaped, 'i') },
      { disposition: new RegExp(escaped, 'i') },
    ];
  }

  const rows = await TelephonyCall.find(filter)
    .sort({ createdAt: -1 })
    .skip(Number(skip) || 0)
    .limit(Math.min(Number(limit) || 50, 200))
    .lean();
  const total = await TelephonyCall.countDocuments(filter);
  return { rows, total };
}

module.exports = {
  searchCalls,
};
