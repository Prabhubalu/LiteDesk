'use strict';

const dns = require('dns').promises;
const net = require('net');

const MAX_CSS_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

const STYLESHEET_LINK_REGEX = /<link\b[^>]*rel=["']stylesheet["'][^>]*\/?>/gi;
const HREF_REGEX = /\shref\s*=\s*["']([^"']+)["']/i;

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeCssAllowlist(value) {
  if (!Array.isArray(value)) return [];
  const output = new Set();
  for (const entry of value) {
    const host = String(entry || '').trim().toLowerCase();
    if (!host) continue;
    output.add(host.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
  }
  return [...output];
}

/**
 * @param {string} hostname
 * @param {string[]} allowlist
 * @returns {boolean}
 */
function isHostAllowlisted(hostname, allowlist) {
  const host = String(hostname || '').trim().toLowerCase();
  if (!host || !allowlist.length) return false;

  return allowlist.some((allowed) => {
    const normalized = String(allowed || '').trim().toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

/**
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateOrReservedIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] >= 224) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe80')) return true;
  }

  return false;
}

/**
 * @param {string} urlString
 * @returns {Promise<boolean>}
 */
async function isSafeExternalUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) return false;

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) return false;

  return addresses.every((entry) => !isPrivateOrReservedIp(entry.address));
}

/**
 * @param {string} urlString
 * @returns {Promise<{ css: string, finalUrl: string }>}
 */
async function fetchStylesheetCss(urlString) {
  let currentUrl = urlString;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const safe = await isSafeExternalUrl(currentUrl);
    if (!safe) {
      throw new Error('URL failed SSRF safety checks');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'text/css,*/*;q=0.1' }
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirectCount >= MAX_REDIRECTS) {
          throw new Error('Too many redirects');
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_CSS_BYTES) {
        throw new Error('Stylesheet exceeds 512 KB limit');
      }

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (contentType && !contentType.includes('text/css') && !contentType.includes('text/plain')) {
        throw new Error('Response is not CSS');
      }

      return {
        css: buffer.toString('utf8'),
        finalUrl: currentUrl
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Could not fetch stylesheet');
}

/**
 * @param {string} html
 * @param {string[]} allowlist
 * @returns {Promise<{ html: string, css: string, fetched: Array<{ url: string }>, warnings: Array<{ type: string, detail: string }> }>}
 */
async function inlineAllowlistedStylesheets(html, allowlist) {
  const source = String(html || '');
  const normalizedAllowlist = normalizeCssAllowlist(allowlist);
  const fetchedCss = [];
  const fetched = [];
  const warnings = [];

  if (!normalizedAllowlist.length) {
    return { html: source, css: '', fetched, warnings };
  }

  const tagMatches = [...source.matchAll(STYLESHEET_LINK_REGEX)];
  let outputHtml = source;

  for (const tagMatch of tagMatches) {
    const tag = tagMatch[0];
    const href = tag.match(HREF_REGEX)?.[1]?.trim();
    if (!href) {
      warnings.push({ type: 'external-css-ignored', detail: tag.trim() });
      outputHtml = outputHtml.replace(tag, '');
      continue;
    }

    let resolvedUrl;
    try {
      if (href.startsWith('//')) {
        resolvedUrl = new URL(`https:${href}`).toString();
      } else if (/^https?:\/\//i.test(href)) {
        resolvedUrl = new URL(href).toString();
      } else {
        warnings.push({ type: 'external-css-ignored', detail: href });
        outputHtml = outputHtml.replace(tag, '');
        continue;
      }
    } catch {
      warnings.push({ type: 'external-css-ignored', detail: href });
      outputHtml = outputHtml.replace(tag, '');
      continue;
    }

    const hostname = new URL(resolvedUrl).hostname;
    if (!isHostAllowlisted(hostname, normalizedAllowlist)) {
      warnings.push({ type: 'external-css-ignored', detail: resolvedUrl });
      outputHtml = outputHtml.replace(tag, '');
      continue;
    }

    outputHtml = outputHtml.replace(tag, '');
    try {
      const result = await fetchStylesheetCss(resolvedUrl);
      fetchedCss.push(`/* ${resolvedUrl} */\n${result.css}`);
      fetched.push({ url: resolvedUrl });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Fetch failed';
      warnings.push({ type: 'external-css-failed', detail: `${resolvedUrl} — ${detail}` });
    }
  }

  return {
    html: outputHtml,
    css: fetchedCss.join('\n\n'),
    fetched,
    warnings
  };
}

module.exports = {
  normalizeCssAllowlist,
  isHostAllowlisted,
  isSafeExternalUrl,
  inlineAllowlistedStylesheets
};
