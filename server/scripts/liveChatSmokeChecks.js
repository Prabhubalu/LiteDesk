/* eslint-disable no-console */
const DEFAULT_BASE_URL = process.env.LIVE_CHAT_BASE_URL || process.env.HELPDESK_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN = process.env.LIVE_CHAT_AUTH_TOKEN || process.env.HELPDESK_AUTH_TOKEN || '';

function requiredEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${DEFAULT_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body,
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { response, json };
}

async function runCheck(name, path, options = {}) {
  const { response, json } = await requestJson(path, options);
  if (!response.ok || !json?.success) {
    const reason = json?.message || `HTTP ${response.status}`;
    throw new Error(`${name} failed: ${reason}`);
  }
  console.log(`PASS ${name}`);
  return json;
}

function assertEnrichedSessionFields(session, label) {
  const required = [
    'status',
    'lifecycleStatus',
    'createdAt',
    'transferCount',
    'visitorMessageCount',
    'agentMessageCount',
  ];
  for (const key of required) {
    if (session[key] === undefined) {
      throw new Error(`${label} missing enriched field: ${key}`);
    }
  }
}

async function main() {
  try {
    requiredEnv('LIVE_CHAT_AUTH_TOKEN (or HELPDESK_AUTH_TOKEN)', AUTH_TOKEN);

    await runCheck('sessions_list', '/api/live-chat/sessions?limit=5');
    await runCheck('sessions_closed', '/api/live-chat/sessions?status=closed&limit=5');
    await runCheck('session_fields', '/api/live-chat/session-fields');
    await runCheck('outcomes_list', '/api/live-chat/outcomes');
    await runCheck('reports_overview', '/api/live-chat/reports/overview');
    await runCheck('reports_agents', '/api/live-chat/reports/agents');
    await runCheck('bots_list', '/api/live-chat/bots');
    await runCheck('website_content_list', '/api/live-chat/website-content');
    await runCheck('visitors_list', '/api/live-chat/visitors?limit=5');

    const overviewRes = await runCheck('reports_overview_enriched', '/api/live-chat/reports/overview');
    const overview = overviewRes?.data || {};
    if (!overview.quality?.csat || !overview.quality?.transfers) {
      throw new Error('reports_overview_enriched missing quality.csat or quality.transfers');
    }
    console.log('PASS reports_overview_enriched_fields');

    const sessionsRes = await runCheck('sessions_open', '/api/live-chat/sessions?status=open&limit=1');
    const openSession = Array.isArray(sessionsRes?.data) ? sessionsRes.data[0] : null;

    if (openSession?._id) {
      const sessionRes = await runCheck('session_get', `/api/live-chat/sessions/${openSession._id}`);
      assertEnrichedSessionFields(sessionRes?.data || {}, 'session_get');
      console.log('PASS session_get_enriched_fields');

      const patchRes = await runCheck('session_patch', `/api/live-chat/sessions/${openSession._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ summary: 'Live Chat smoke test summary' }),
      });
      if (!patchRes?.data?._id) {
        throw new Error('session_patch missing session payload');
      }
      console.log('PASS session_patch_summary');
    } else {
      console.log('SKIP session_get (no open sessions)');
      console.log('SKIP session_patch (no open sessions)');
    }

    const closedRes = await runCheck('sessions_closed_probe', '/api/live-chat/sessions?status=closed&limit=1');
    const closedSession = Array.isArray(closedRes?.data) ? closedRes.data[0] : null;
    if (closedSession?._id) {
      const closedGetRes = await runCheck('closed_session_get', `/api/live-chat/sessions/${closedSession._id}`);
      assertEnrichedSessionFields(closedGetRes?.data || {}, 'closed_session_get');
      console.log('PASS closed_session_get_enriched_fields');
    } else {
      console.log('SKIP closed_session_get (no closed sessions)');
    }

    const visitorsRes = await runCheck('visitors_detail_probe', '/api/live-chat/visitors?limit=1');
    const visitor = Array.isArray(visitorsRes?.data) ? visitorsRes.data[0] : null;
    if (visitor?._id) {
      await runCheck('visitor_get', `/api/live-chat/visitors/${visitor._id}`);
    } else {
      console.log('SKIP visitor_get (no visitors)');
    }

    const personId = process.env.LIVE_CHAT_PERSON_ID || '';
    if (personId) {
      await runCheck('person_live_chat_session', `/api/people/${personId}/live-chat-session`);
    } else {
      console.log('SKIP person_live_chat_session (set LIVE_CHAT_PERSON_ID to probe)');
    }

    console.log('Live Chat smoke checks passed.');
  } catch (error) {
    console.error('Live Chat smoke checks failed:', error.message);
    process.exitCode = 1;
  }
}

main();
