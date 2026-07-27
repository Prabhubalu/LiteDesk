'use strict';

/**
 * ATIP Error Intelligence Engine — business-friendly errors + recovery hints.
 */

const PATTERNS = [
  {
    match: /already exists|duplicate/i,
    problemCode: 'DUPLICATE_LEDGER',
    problem: 'A record with this name already exists in Tally.',
    causeCode: 'NAME_COLLISION',
    cause: 'Tally rejected create because another master uses the same name.',
    resolutionCode: 'USE_UPDATE',
    resolution: 'Use Update instead of Create, or link to the existing record.',
    docPath: '/docs/tally/errors/duplicate-ledger',
  },
  {
    match: /unknown.*ledger|ledger.*not found|party.*not found/i,
    problemCode: 'LEDGER_MISSING',
    problem: 'Required ledger was not found in Tally.',
    causeCode: 'DEPENDENCY_MISSING',
    cause: 'The voucher references a party or account that is not synced yet.',
    resolutionCode: 'SYNC_MASTERS_FIRST',
    resolution: 'Sync ledgers/parties first, then retry this voucher.',
    docPath: '/docs/tally/errors/missing-ledger',
  },
  {
    match: /gstin|gst\s*in/i,
    problemCode: 'GST_INVALID',
    problem: 'GST details failed validation.',
    causeCode: 'GST_DATA',
    cause: 'GSTIN, place of supply, or tax ledgers are missing or invalid.',
    resolutionCode: 'FIX_GST_MAP',
    resolution: 'Fix GSTIN on the party and confirm tax ledger mappings, then retry.',
    docPath: '/docs/tally/errors/gst',
  },
  {
    match: /financial year|fy\s*locked|period locked/i,
    problemCode: 'FY_LOCKED',
    problem: 'The financial year or period is locked in Tally.',
    causeCode: 'PERIOD_CLOSED',
    cause: 'Tally does not allow posting into a closed period.',
    resolutionCode: 'OPEN_FY_OR_CHANGE_DATE',
    resolution: 'Open the period in Tally or change the document date, then retry.',
    docPath: '/docs/tally/errors/fy-locked',
  },
  {
    match: /connection|econnrefused|timeout|offline/i,
    problemCode: 'TALLY_UNREACHABLE',
    problem: 'Could not reach Tally from the connector agent.',
    causeCode: 'AGENT_OR_PORT',
    cause: 'Tally is not running, XML port is closed, or the agent is offline.',
    resolutionCode: 'RESTART_TALLY_AGENT',
    resolution: 'Open Tally, confirm XML port 9000–9010, ensure the agent is online, then retry.',
    docPath: '/docs/tally/errors/connection',
  },
  {
    match: /unbalanced|dr\s*.*\s*cr/i,
    problemCode: 'VOUCHER_UNBALANCED',
    problem: 'The voucher does not balance (Debit ≠ Credit).',
    causeCode: 'LINE_AMOUNTS',
    cause: 'Line amounts or tax lines do not sum to a balanced voucher.',
    resolutionCode: 'FIX_AMOUNTS',
    resolution: 'Correct line amounts and tax configuration, then retry.',
    docPath: '/docs/tally/errors/unbalanced',
  },
];

function enrichError(rawError, context = {}) {
  const message = typeof rawError === 'string' ? rawError : rawError?.message || String(rawError || 'Unknown error');
  const matched = PATTERNS.find((p) => p.match.test(message));

  if (!matched) {
    return {
      problemCode: 'SYNC_FAILED',
      problem: 'Synchronisation failed.',
      causeCode: 'UNKNOWN',
      cause: message,
      resolutionCode: 'RETRY_OR_SUPPORT',
      resolution: 'Retry the job. If it keeps failing, contact support with the correlation ID.',
      docPath: '/docs/tally/errors/general',
      retryable: true,
      rawMessage: message,
      context,
    };
  }

  return {
    ...matched,
    retryable: matched.problemCode !== 'FY_LOCKED',
    rawMessage: message,
    context,
  };
}

function toUserPayload(enriched) {
  return {
    problem: enriched.problem,
    cause: enriched.cause,
    resolution: enriched.resolution,
    documentationLink: enriched.docPath,
    retryOption: enriched.retryable,
    codes: {
      problem: enriched.problemCode,
      cause: enriched.causeCode,
      resolution: enriched.resolutionCode,
    },
    rawMessage: enriched.rawMessage,
  };
}

module.exports = {
  PATTERNS,
  enrichError,
  toUserPayload,
};
