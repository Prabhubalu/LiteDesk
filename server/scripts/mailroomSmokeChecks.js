/* eslint-disable no-console */
/**
 * Mailroom smoke checks — requires a running API and HELPDESK_AUTH_TOKEN (same as smoke:helpdesk).
 *
 * Usage:
 *   HELPDESK_AUTH_TOKEN=... npm run smoke:mailroom
 *   HELPDESK_BASE_URL=https://staging.example.com HELPDESK_AUTH_TOKEN=... npm run smoke:mailroom
 */
const DEFAULT_BASE_URL = process.env.HELPDESK_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN = process.env.HELPDESK_AUTH_TOKEN || '';

function requiredEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
}

async function requestJson(path, { method = 'GET', body = null } = {}) {
  const headers = {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  };
  const response = await fetch(`${DEFAULT_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { response, json };
}

async function runGetCheck(name, path) {
  const { response, json } = await requestJson(path);
  if (!response.ok || !json?.success) {
    const reason = json?.message || `HTTP ${response.status}`;
    throw new Error(`${name} failed: ${reason}`);
  }
  console.log(`PASS ${name}`);
  return json;
}

async function runEvaluateCheck() {
  const { response, json } = await requestJson('/api/settings/automation/mailroom/evaluate', {
    method: 'POST',
    body: {
      message: {
        channel: 'email',
        direction: 'inbound',
        subject: 'Smoke test inbound',
        body: 'Mailroom policy evaluation smoke',
        participants: {
          from: 'smoke-test@example.com',
          to: ['support@example.com']
        }
      },
      candidates: {
        conversations: [],
        messages: [],
        openCases: [],
        recentCases: []
      }
    }
  });
  if (!response.ok || !json?.success || !json?.data) {
    const reason = json?.message || `HTTP ${response.status}`;
    throw new Error(`mailroom_evaluate failed: ${reason}`);
  }
  if (!json.data.ingest || !json.data.threading || !json.data.caseLink) {
    throw new Error('mailroom_evaluate failed: missing policy evaluation payload');
  }
  console.log('PASS mailroom_evaluate');
}

async function main() {
  try {
    requiredEnv('HELPDESK_AUTH_TOKEN', AUTH_TOKEN);

    await runGetCheck('health_ready', '/health/ready');
    await runGetCheck('mailroom_settings', '/api/settings/automation/mailroom');
    await runGetCheck('mailroom_templates', '/api/settings/automation/mailroom/templates');
    await runGetCheck('mailroom_failures', '/api/settings/automation/mailroom/failures?limit=5');
    await runGetCheck('mailroom_threading_logs', '/api/settings/automation/mailroom/threading-logs?limit=5');
    await runGetCheck('mailroom_metrics', '/api/settings/automation/mailroom/metrics');
    await runGetCheck('mailroom_routing_logs', '/api/settings/automation/mailroom/routing-logs?limit=5');
    await runEvaluateCheck();

    console.log('Mailroom smoke checks passed.');
  } catch (error) {
    console.error('Mailroom smoke checks failed:', error.message);
    process.exitCode = 1;
  }
}

main();
