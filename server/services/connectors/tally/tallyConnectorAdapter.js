'use strict';

const MOCK_COMPANIES = Object.freeze([
  {
    companyGuid: 'mock-tally-company-001',
    companyName: 'ABC Traders',
    financialYear: '2026-27',
    port: 9000,
    xmlEnabled: true,
  },
  {
    companyGuid: 'mock-tally-company-002',
    companyName: 'Demo Manufacturing Pvt Ltd',
    financialYear: '2026-27',
    port: 9000,
    xmlEnabled: true,
  },
]);

function useMock() {
  return String(process.env.TALLY_CONNECTOR_MODE || 'mock').toLowerCase() !== 'live';
}

async function verifyConnection({ organizationId, companyGuid = null } = {}) {
  if (useMock()) {
    return {
      ok: true,
      mode: 'mock',
      organizationId: organizationId ? String(organizationId) : null,
      companyGuid,
      tallyVersion: 'TallyPrime 4.0 (mock)',
      xmlEnabled: true,
      checks: {
        internet: true,
        tallyRunning: true,
        xmlEnabled: true,
        companyAvailable: true,
        financialYear: true,
      },
    };
  }

  // Live path reserved for agent-mediated XML verify.
  return {
    ok: false,
    mode: 'live',
    message: 'Live verifyConnection requires agent RPC (not implemented in cloud adapter)',
  };
}

async function discoverCompanies({ organizationId } = {}) {
  if (useMock()) {
    return {
      ok: true,
      mode: 'mock',
      organizationId: organizationId ? String(organizationId) : null,
      companies: MOCK_COMPANIES.map((c) => ({ ...c })),
    };
  }

  return {
    ok: false,
    mode: 'live',
    companies: [],
    message: 'Live discoverCompanies requires agent RPC',
  };
}

async function pushVoucher({ organizationId, companyGuid, voucher } = {}) {
  if (useMock()) {
    return {
      ok: true,
      mode: 'mock',
      organizationId: organizationId ? String(organizationId) : null,
      companyGuid,
      externalId: `mock-voucher-${Date.now()}`,
      voucherType: voucher?.voucherType || 'Sales',
    };
  }

  return {
    ok: false,
    mode: 'live',
    message: 'Live pushVoucher requires agent executeXml',
  };
}

async function pullChanges({ organizationId, companyGuid, jobType = 'incremental', payload = {} } = {}) {
  if (useMock()) {
    return {
      ok: true,
      mode: 'mock',
      organizationId: organizationId ? String(organizationId) : null,
      companyGuid,
      jobType,
      stats: {
        parties: 0,
        items: 0,
        vouchers: 0,
        stub: true,
      },
      changes: [],
      payloadEcho: payload,
    };
  }

  return {
    ok: false,
    mode: 'live',
    stats: {},
    changes: [],
    message: 'Live pullChanges requires agent poll',
  };
}

const tallyConnectorAdapter = {
  verifyConnection,
  discoverCompanies,
  pushVoucher,
  pullChanges,
};

module.exports = {
  tallyConnectorAdapter,
  verifyConnection,
  discoverCompanies,
  pushVoucher,
  pullChanges,
  MOCK_COMPANIES,
};
