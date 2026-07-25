'use strict';

const { getTallyConnectorAdapter } = require('./tallyConnectorAdapterRegistry');
const tallyConnectionService = require('./tallyConnectionService');

/**
 * Handle agent RPC messages from the Windows Connector Agent.
 * Supported methods: discover, executeXml, ackJob, heartbeat
 */
async function handleAgentRpc(message = {}) {
  const method = String(message.method || message.type || '').trim();
  const params = message.params || message.payload || {};
  const organizationId = message.organizationId || params.organizationId;
  const connectionId = message.connectionId || params.connectionId;

  if (!method) {
    return { ok: false, error: 'method required' };
  }

  switch (method) {
    case 'discover': {
      const adapter = getTallyConnectorAdapter();
      const result = await adapter.discoverCompanies({ organizationId });
      return { ok: true, method, result };
    }
    case 'executeXml': {
      const adapter = getTallyConnectorAdapter();
      // Stub: live path would forward XML to agent-local Tally; mock returns envelope ack.
      const xml = params.xml || '';
      if (String(process.env.TALLY_CONNECTOR_MODE || 'mock').toLowerCase() === 'mock') {
        return {
          ok: true,
          method,
          result: {
            mode: 'mock',
            accepted: true,
            bytes: Buffer.byteLength(String(xml), 'utf8'),
            responseXml: '<ENVELOPE><BODY><DATA>OK</DATA></BODY></ENVELOPE>',
          },
        };
      }
      const push = await adapter.pushVoucher({
        organizationId,
        companyGuid: params.companyGuid,
        voucher: params.voucher || { xml },
      });
      return { ok: Boolean(push?.ok), method, result: push };
    }
    case 'ackJob': {
      return {
        ok: true,
        method,
        result: {
          jobId: params.jobId || null,
          status: params.status || 'acked',
          stub: true,
        },
      };
    }
    case 'heartbeat': {
      if (!organizationId) {
        return { ok: false, error: 'organizationId required for heartbeat' };
      }
      const connection = await tallyConnectionService.recordHeartbeat({
        organizationId,
        connectionId,
        agentDeviceId: params.agentDeviceId,
        agentVersion: params.agentVersion,
        metadata: params.metadata || {},
      });
      return {
        ok: true,
        method,
        result: {
          connectionId: String(connection._id),
          status: connection.status,
          heartbeatAt: connection.heartbeatAt,
        },
      };
    }
    default:
      return { ok: false, error: `Unknown agent RPC method: ${method}` };
  }
}

module.exports = {
  handleAgentRpc,
};
