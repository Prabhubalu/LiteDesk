/* eslint-disable no-console */
/**
 * Quotes module smoke checks (authenticated API + optional public portal).
 *
 * Usage:
 *   QUOTES_AUTH_TOKEN=<jwt> node scripts/quotesSmokeChecks.js
 *   QUOTES_PUBLIC_TOKEN=<share-token> node scripts/quotesSmokeChecks.js
 *
 * Env:
 *   QUOTES_BASE_URL — default http://localhost:5000
 *   QUOTES_AUTH_TOKEN — required for /api/quotes and /api/settings/quotes
 *   QUOTES_PUBLIC_TOKEN — optional; runs GET public view + comments
 */

const BASE_URL = String(process.env.QUOTES_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const AUTH_TOKEN = process.env.QUOTES_AUTH_TOKEN || '';
const PUBLIC_TOKEN = process.env.QUOTES_PUBLIC_TOKEN || '';

async function request(method, path, { auth = true, body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && AUTH_TOKEN) headers.Authorization = `Bearer ${AUTH_TOKEN}`;

  const init = { method, headers };
  if (body != null) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, init);
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { response, json };
}

async function runAuthCheck(name, path) {
  if (!AUTH_TOKEN) {
    console.log(`SKIP ${name} (QUOTES_AUTH_TOKEN not set)`);
    return null;
  }
  const { response, json } = await request('GET', path);
  if (!response.ok || json?.success === false) {
    const reason = json?.message || `HTTP ${response.status}`;
    throw new Error(`${name} failed: ${reason}`);
  }
  console.log(`PASS ${name}`);
  return json;
}

async function runPublicCheck(name, path) {
  const { response, json } = await request('GET', path, { auth: false });
  if (!response.ok || json?.success === false) {
    const reason = json?.message || `HTTP ${response.status}`;
    throw new Error(`${name} failed: ${reason}`);
  }
  console.log(`PASS ${name}`);
  return json;
}

async function main() {
  try {
    if (!AUTH_TOKEN && !PUBLIC_TOKEN) {
      throw new Error('Set QUOTES_AUTH_TOKEN and/or QUOTES_PUBLIC_TOKEN');
    }

    const list = await runAuthCheck('quotes_list', '/api/quotes?limit=5');
    await runAuthCheck('quotes_settings', '/api/settings/quotes');

    if (list?.data?.length) {
      const id = list.data[0]._id;
      if (id) {
        await runAuthCheck('quote_by_id', `/api/quotes/${id}`);
        await runAuthCheck('quote_revisions', `/api/quotes/${id}/revisions`);
        await runAuthCheck('quote_conversion', `/api/quotes/${id}/conversion`);
        await runAuthCheck('quote_documents', `/api/quotes/${id}/documents`);
      }
    } else {
      console.log('SKIP quote detail checks (no quotes in list)');
    }

    if (PUBLIC_TOKEN) {
      await runPublicCheck('public_view', `/api/public/quotes/${PUBLIC_TOKEN}/view`);
      await runPublicCheck('public_comments', `/api/public/quotes/${PUBLIC_TOKEN}/comments`);
    } else {
      console.log('SKIP public portal checks (QUOTES_PUBLIC_TOKEN not set)');
    }

    console.log('Quotes smoke checks passed.');
  } catch (error) {
    console.error('Quotes smoke checks failed:', error.message);
    process.exitCode = 1;
  }
}

main();
