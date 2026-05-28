'use strict';

/**
 * Inbound email authentication signals from MIME headers (SPF / DKIM / DMARC).
 * Does not perform live DNS lookups — relies on gateway-injected Authentication-Results.
 */

const AUTH_RESULT = ['pass', 'fail', 'neutral', 'none', 'softfail', 'temperror', 'permerror', 'unknown'];

function normalizeAuthResult(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'unknown';
  if (AUTH_RESULT.includes(raw)) return raw;
  if (raw.includes('pass')) return 'pass';
  if (raw.includes('fail')) return 'fail';
  if (raw.includes('softfail')) return 'softfail';
  if (raw.includes('neutral')) return 'neutral';
  if (raw.includes('none')) return 'none';
  return 'unknown';
}

function extractHeaderSection(rawBuffer) {
  const max = Math.min(Buffer.isBuffer(rawBuffer) ? rawBuffer.length : 0, 512 * 1024);
  if (!max) return '';
  const text = rawBuffer.toString('utf8', 0, max);
  const end = text.indexOf('\r\n\r\n');
  return end >= 0 ? text.slice(0, end) : text;
}

function unfoldHeaders(headerSection) {
  const lines = String(headerSection || '').split(/\r?\n/);
  const unfolded = [];
  for (const line of lines) {
    if (/^[\t ]/.test(line) && unfolded.length) {
      unfolded[unfolded.length - 1] += ` ${line.trim()}`;
    } else if (line.trim()) {
      unfolded.push(line.trim());
    }
  }
  return unfolded;
}

function collectHeaderValues(headerSection, headerName) {
  const name = String(headerName || '').toLowerCase();
  const out = [];
  for (const line of unfoldHeaders(headerSection)) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    if (key === name) {
      out.push(line.slice(idx + 1).trim());
    }
  }
  return out;
}

function parseAuthResultsLine(line) {
  const spf = line.match(/\bspf=(\w+)/i);
  const dkim = line.match(/\bdkim=(\w+)/i);
  const dmarc = line.match(/\bdmarc=(\w+)/i);
  return {
    spf: spf ? normalizeAuthResult(spf[1]) : null,
    dkim: dkim ? normalizeAuthResult(dkim[1]) : null,
    dmarc: dmarc ? normalizeAuthResult(dmarc[1]) : null
  };
}

function mergeBest(current, next) {
  if (!next) return current || 'unknown';
  if (!current || current === 'unknown') return next;
  if (current === 'pass') return current;
  if (next === 'pass') return 'pass';
  if (current === 'fail' || next === 'fail') return 'fail';
  return next;
}

function extractEmailAuthentication(rawBuffer) {
  const headerSection = extractHeaderSection(rawBuffer);
  const authLines = collectHeaderValues(headerSection, 'authentication-results');
  const receivedSpfLines = collectHeaderValues(headerSection, 'received-spf');

  let spf = 'unknown';
  let dkim = 'unknown';
  let dmarc = 'unknown';

  for (const line of authLines) {
    const parsed = parseAuthResultsLine(line);
    spf = mergeBest(spf, parsed.spf);
    dkim = mergeBest(dkim, parsed.dkim);
    dmarc = mergeBest(dmarc, parsed.dmarc);
  }

  for (const line of receivedSpfLines) {
    const m = line.match(/\b(Pass|Fail|Neutral|Softfail|None|Temperror|Permerror)\b/i);
    if (m) {
      spf = mergeBest(spf, normalizeAuthResult(m[1]));
    }
  }

  const results = { spf, dkim, dmarc };
  const passCount = [spf, dkim, dmarc].filter((r) => r === 'pass').length;
  const failCount = [spf, dkim, dmarc].filter((r) => r === 'fail' || r === 'softfail').length;

  let composite = 'unknown';
  if (passCount === 3) composite = 'pass';
  else if (failCount > 0) composite = 'fail';
  else if (passCount > 0) composite = 'partial';
  else if ([spf, dkim, dmarc].every((r) => r === 'none' || r === 'neutral')) composite = 'none';

  return {
    ...results,
    composite,
    headerCount: authLines.length + receivedSpfLines.length
  };
}

function resolveSecurityPolicy(securityConfig = {}) {
  const email = securityConfig?.email || {};
  return {
    enabled: email.enabled !== false,
    requireSpf: email.requireSpf === true,
    requireDkim: email.requireDkim === true,
    requireDmarc: email.requireDmarc === true,
    onFailure: ['monitor', 'quarantine', 'reject'].includes(email.onFailure)
      ? email.onFailure
      : 'monitor'
  };
}

function evaluateEmailAuthentication(emailAuth, policy = {}) {
  const resolved = resolveSecurityPolicy({ email: policy });
  if (!resolved.enabled) {
    return { ok: true, action: 'allow', policy: resolved, reasons: [] };
  }

  const reasons = [];
  const check = (key, required) => {
    const result = emailAuth?.[key] || 'unknown';
    if (required && result !== 'pass') {
      reasons.push(`${key}_not_pass:${result}`);
    }
    if (!required && (result === 'fail' || result === 'softfail')) {
      reasons.push(`${key}_failed:${result}`);
    }
  };

  check('spf', resolved.requireSpf);
  check('dkim', resolved.requireDkim);
  check('dmarc', resolved.requireDmarc);

  if (!reasons.length && emailAuth?.composite === 'fail') {
    reasons.push('composite_fail');
  }

  if (!reasons.length) {
    return { ok: true, action: 'allow', policy: resolved, reasons: [] };
  }

  if (resolved.onFailure === 'reject') {
    return { ok: false, action: 'reject', policy: resolved, reasons };
  }
  if (resolved.onFailure === 'quarantine') {
    return { ok: true, action: 'quarantine', policy: resolved, reasons };
  }
  return { ok: true, action: 'monitor', policy: resolved, reasons };
}

function applyInboundEmailSecurity({ rawMime, normalizedMessage, securityConfig }) {
  const emailAuth = extractEmailAuthentication(rawMime);
  const decision = evaluateEmailAuthentication(emailAuth, securityConfig?.email || securityConfig);

  const metadata = {
    ...(normalizedMessage?.metadata || {}),
    emailAuth,
    emailAuthDecision: {
      action: decision.action,
      reasons: decision.reasons
    }
  };

  if (!decision.ok) {
    const err = new Error(`Inbound email failed authentication (${decision.reasons.join(', ')})`);
    err.code = 'MAILROOM_EMAIL_AUTH_FAILED';
    err.emailAuth = emailAuth;
    throw err;
  }

  return {
    emailAuth,
    decision,
    normalizedMessage: {
      ...normalizedMessage,
      metadata
    },
    forceIngestAction: decision.action === 'quarantine' ? 'manual_review' : null
  };
}

module.exports = {
  extractEmailAuthentication,
  evaluateEmailAuthentication,
  applyInboundEmailSecurity,
  resolveSecurityPolicy
};
