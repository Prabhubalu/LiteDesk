import { getConfig } from '../../shared/config.mjs';

/**
 * Abort suite when SUT is unreachable or not ready (roadmap health gate).
 * @returns {{ ok: boolean, reason?: string }}
 */
export async function assertSutReady() {
  if (process.env.ATP_SKIP_HEALTH_GATE === '1') {
    return { ok: true };
  }

  const { sutApiUrl } = getConfig();
  try {
    const res = await fetch(`${sutApiUrl}/health/ready`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { ok: false, reason: `SUT /health/ready returned HTTP ${res.status}` };
    }
    const body = await res.json().catch(() => ({}));
    if (body?.ok === false) {
      return { ok: false, reason: body?.message || 'SUT reported not ready' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message || 'SUT health check failed' };
  }
}
