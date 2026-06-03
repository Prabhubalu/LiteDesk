/**
 * Post run summary to Slack incoming webhook.
 */

export async function notifySlack(webhookUrl, payload) {
  if (!webhookUrl) return { sent: false, reason: 'no webhook' };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Slack webhook HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return { sent: true };
}

/**
 * @param {object} run — completed TestRun lean doc
 * @param {string} webhookUrl
 */
export async function notifyRunToSlack(run, webhookUrl) {
  const stats = run.stats || {};
  const emoji = run.status === 'passed' ? ':white_check_mark:' : ':x:';
  const text = [
    `${emoji} *ATP ${run.suiteName || run.suiteKey}* — \`${run.status}\``,
    `Env: \`${run.envKey}\` · Passed: ${stats.passed}/${stats.total} · Failed: ${stats.failed}`,
    run.runId ? `Run: \`${run.runId.slice(0, 8)}\`` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const failed = (run.results || []).filter((r) => r.status === 'failed').slice(0, 5);
  const blocks = failed.length
    ? [
        { type: 'section', text: { type: 'mrkdwn', text } },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Failures:*\n${failed.map((f) => `• \`${f.caseId}\` ${(f.error?.message || '').slice(0, 80)}`).join('\n')}`,
          },
        },
      ]
    : [{ type: 'section', text: { type: 'mrkdwn', text } }];

  return notifySlack(webhookUrl, { text, blocks });
}
