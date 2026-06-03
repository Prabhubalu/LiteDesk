/**
 * Poll async jobs (imports, workers) until terminal state or timeout.
 */

const TERMINAL = new Set(['completed', 'failed', 'partial', 'cancelled']);

/**
 * @param {() => Promise<{ status: string, body?: object }>} fetchStatus
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=90000]
 * @param {number} [opts.intervalMs=1000]
 * @param {Set<string>} [opts.terminalStatuses]
 */
export async function pollUntilTerminal(fetchStatus, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 1000;
  const terminal = opts.terminalStatuses ?? TERMINAL;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const { status, body } = await fetchStatus();
    if (terminal.has(status)) {
      return { status, body, elapsedMs: Date.now() - started };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Async poll timed out after ${timeoutMs}ms`);
}

export function extractImportStatus(body) {
  const job = body?.data ?? body?.import ?? body;
  return job?.status ?? job?.state ?? 'unknown';
}

export function extractImportId(body) {
  const data = body?.data ?? body;
  return data?.importId ?? data?._id ?? data?.id ?? null;
}
