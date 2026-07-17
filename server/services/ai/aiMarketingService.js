'use strict';

/**
 * Phase 4 Marketing AI — subject/body assist + campaign summary.
 * Propose-only: never sends campaigns or mutates Campaign records.
 */

const Campaign = require('../../models/Campaign');
const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactText, redactMessages } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');

function parseJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const balanced = raw.match(/\{[\s\S]*\}/);
  if (balanced) {
    try {
      return JSON.parse(balanced[0]);
    } catch {
      const repaired = parseJsonObjectLenient(balanced[0]);
      if (repaired) return repaired;
    }
  }

  // Truncated responses may never include a closing brace.
  const start = raw.indexOf('{');
  if (start >= 0) {
    return parseJsonObjectLenient(raw.slice(start));
  }
  return null;
}

/**
 * Salvage truncated model JSON (common when maxTokens cuts mid-object).
 */
function parseJsonObjectLenient(fragment) {
  let s = String(fragment || '').trim();
  if (!s.startsWith('{')) {
    const start = s.indexOf('{');
    if (start < 0) return null;
    s = s.slice(start);
  }

  // Drop incomplete trailing property / open string / open object.
  s = s.replace(/,\s*"[^"]*"\s*:\s*"(?:[^"\\]|\\.)*$/s, '');
  s = s.replace(/,\s*"[^"]*"\s*:\s*\{[^}]*$/s, '');
  s = s.replace(/,\s*\{[^}]*$/s, '');
  s = s.replace(/,\s*"[^"]*"\s*:\s*$/s, '');
  s = s.replace(/,\s*$/s, '');

  // Close an odd number of unescaped quotes.
  const quotes = s.match(/(?<!\\)"/g);
  if (quotes && quotes.length % 2 === 1) s += '"';

  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') stack.push(ch);
    if (ch === '}' || ch === ']') stack.pop();
  }
  if (inString) s += '"';
  while (stack.length) {
    s += stack.pop() === '{' ? '}' : ']';
  }

  try {
    return JSON.parse(s);
  } catch {
    // Last resort: pull headline + bullets even if actions were truncated.
    const headline = s.match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const bulletsBlock = s.match(/"bullets"\s*:\s*\[([\s\S]*?)\]/);
    if (!headline && !bulletsBlock) return null;
    const bullets = [];
    if (bulletsBlock) {
      const itemRe = /"((?:[^"\\]|\\.)*)"/g;
      let m;
      while ((m = itemRe.exec(bulletsBlock[1]))) {
        bullets.push(m[1].replace(/\\"/g, '"'));
      }
    }
    return {
      headline: headline ? headline[1].replace(/\\"/g, '"') : '',
      bullets,
      actions: [],
      talkToAgent: false,
    };
  }
}

async function runMarketingCompletion({
  organizationId,
  userId,
  abilityKey,
  promptKey,
  userContent,
  contextRefs = [],
  maxTokens = 600,
}) {
  const startedAt = Date.now();
  let auditBase = {
    organizationId,
    userId,
    abilityKey,
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const config = await resolveAiRequestConfig({ organizationId, abilityKey });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const systemPrompt = getPrompt(promptKey);
    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        { role: 'user', content: userContent },
      ]),
      temperature: 0.4,
      maxTokens,
      providerOptions: config.providerOptions,
    });

    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs,
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      text: String(completion.text || '').trim(),
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
      confirmRequired: true,
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_MARKETING_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

async function assistCampaignSubject({
  organizationId,
  userId,
  campaignName = '',
  audienceHint = '',
  tone = 'professional',
  existingSubject = '',
  count = 3,
}) {
  const n = Math.min(5, Math.max(1, Number(count) || 3));
  const result = await runMarketingCompletion({
    organizationId,
    userId,
    abilityKey: 'marketing_subject',
    promptKey: 'marketing_subject_system',
    userContent: [
      `Campaign name: ${redactText(campaignName).slice(0, 200)}`,
      `Audience hint: ${redactText(audienceHint).slice(0, 200)}`,
      `Tone: ${String(tone || 'professional').slice(0, 40)}`,
      `Existing subject: ${redactText(existingSubject).slice(0, 200)}`,
      `Return JSON only: {"subjects":["..."]} with exactly ${n} subject line options. No spammy ALL CAPS. Do not invent discounts or legal claims.`,
    ].join('\n'),
    maxTokens: 300,
  });

  const parsed = parseJsonObject(result.text);
  const subjects = Array.isArray(parsed?.subjects)
    ? parsed.subjects.map((s) => String(s || '').trim()).filter(Boolean).slice(0, n)
    : [];

  return {
    ...result,
    subjects,
    autoApply: false,
  };
}

async function assistCampaignBody({
  organizationId,
  userId,
  campaignName = '',
  subject = '',
  goal = '',
  tone = 'professional',
  existingBody = '',
}) {
  const result = await runMarketingCompletion({
    organizationId,
    userId,
    abilityKey: 'marketing_body',
    promptKey: 'marketing_body_system',
    userContent: [
      `Campaign name: ${redactText(campaignName).slice(0, 200)}`,
      `Subject: ${redactText(subject).slice(0, 200)}`,
      `Goal: ${redactText(goal).slice(0, 300)}`,
      `Tone: ${String(tone || 'professional').slice(0, 40)}`,
      `Existing body (may be empty):\n${redactText(existingBody).slice(0, 3000)}`,
      'Return JSON only: {"bodyHtml":"<p>...</p>","bodyText":"...","notes":"..."}. Use simple HTML paragraphs only. Do not invent offers, prices, or unsubscribe language beyond a short placeholder.',
    ].join('\n'),
    maxTokens: 900,
  });

  const parsed = parseJsonObject(result.text);
  return {
    ...result,
    bodyHtml: String(parsed?.bodyHtml || '').trim(),
    bodyText: String(parsed?.bodyText || '').trim(),
    notes: String(parsed?.notes || '').trim().slice(0, 300),
    autoApply: false,
  };
}

async function summarizeCampaign({ organizationId, userId, campaignId }) {
  const id = String(campaignId || '').trim();
  if (!id) throw new AiConfigurationError('campaignId is required', 'AI_CAMPAIGN_ID_REQUIRED');

  const campaign = await Campaign.findOne({ _id: id, organizationId })
    .select('name subject status approvalStatus fromEmail fromName bodyHtml audienceId updatedAt createdAt')
    .lean();
  if (!campaign) throw new AiConfigurationError('Campaign not found', 'AI_CAMPAIGN_NOT_FOUND');

  const result = await runMarketingCompletion({
    organizationId,
    userId,
    abilityKey: 'marketing_summary',
    promptKey: 'marketing_summary_system',
    userContent: [
      'Summarize this marketing campaign for a marketer. Be factual. Do not invent send metrics.',
      JSON.stringify({
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        approvalStatus: campaign.approvalStatus,
        fromEmail: campaign.fromEmail,
        fromName: campaign.fromName,
        bodyPreview: redactText(String(campaign.bodyHtml || '').replace(/<[^>]+>/g, ' ')).slice(0, 1500),
      }, null, 2),
    ].join('\n'),
    contextRefs: [{ sourceType: 'campaigns', sourceId: id, moduleKey: 'campaigns', appKey: 'MARKETING' }],
    maxTokens: 500,
  });

  return {
    ...result,
    campaignId: id,
    autoApply: false,
  };
}

module.exports = {
  assistCampaignSubject,
  assistCampaignBody,
  summarizeCampaign,
  parseJsonObject,
  parseJsonObjectLenient,
};
