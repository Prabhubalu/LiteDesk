'use strict';

/**
 * Phase 4 Commercial + Collection agents (proposal mode).
 * Extends Phase 2 quote/coverage + overdue invoice context.
 * Never creates quotes, sends email, or issues payment links.
 */

const mongoose = require('mongoose');
const { convertDealToQuoteDraft } = require('../commercialConversionService');
const {
  buildCoverageGaps,
  listOverdueInvoices,
} = require('./aiCommercialService');
const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactMessages, redactText } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');

const COMMERCIAL_ACTIONS = new Set([
  'create_quote',
  'fix_coverage_gaps',
  'review_catalog_lines',
  'request_pricing_review',
  'manual_review',
  'none',
]);

const COLLECTION_ACTIONS = new Set([
  'draft_follow_up',
  'propose_payment_link',
  'prioritize_invoice',
  'escalate_to_finance',
  'manual_review',
  'none',
]);

function parseCommercialProposalsJson(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { summary: '', proposals: [] };
  try {
    const parsed = JSON.parse(match[0]);
    const proposals = Array.isArray(parsed?.proposals) ? parsed.proposals : [];
    return {
      summary: String(parsed?.summary || '').slice(0, 500),
      proposals: proposals
        .filter((p) => p && typeof p === 'object')
        .slice(0, 8)
        .map((p) => {
          const action = String(p.action || 'none').trim().toLowerCase();
          return {
            action: COMMERCIAL_ACTIONS.has(action) ? action : 'manual_review',
            label: String(p.label || action).slice(0, 120),
            rationale: String(p.rationale || '').slice(0, 240),
            confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0)),
            params: p.params && typeof p.params === 'object' ? p.params : {},
            confirmRequired: true,
          };
        }),
    };
  } catch {
    return { summary: '', proposals: [] };
  }
}

/**
 * Collection proposals: invoiceId in params must be in the overdue allow-list when present.
 */
function parseCollectionProposalsJson(text, invoiceAllowList) {
  const allowedIds = new Set((invoiceAllowList || []).map((id) => String(id)));
  const raw = String(text || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { summary: '', proposals: [] };
  try {
    const parsed = JSON.parse(match[0]);
    const proposals = Array.isArray(parsed?.proposals) ? parsed.proposals : [];
    const out = [];
    for (const p of proposals) {
      if (!p || typeof p !== 'object') continue;
      const action = String(p.action || 'none').trim().toLowerCase();
      const safeAction = COLLECTION_ACTIONS.has(action) ? action : 'manual_review';
      const params = p.params && typeof p.params === 'object' ? { ...p.params } : {};
      if (params.invoiceId != null) {
        const invoiceId = String(params.invoiceId).trim();
        if (!allowedIds.has(invoiceId)) continue;
        params.invoiceId = invoiceId;
      }
      out.push({
        action: safeAction,
        label: String(p.label || safeAction).slice(0, 120),
        rationale: String(p.rationale || '').slice(0, 240),
        confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0)),
        params,
        confirmRequired: true,
      });
      if (out.length >= 8) break;
    }
    return {
      summary: String(parsed?.summary || '').slice(0, 500),
      proposals: out,
    };
  } catch {
    return { summary: '', proposals: [] };
  }
}

async function runAgentCompletion({
  organizationId,
  userId,
  abilityKey,
  promptKey,
  userContent,
  contextRefs = [],
  parseFn,
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
      temperature: 0.2,
      maxTokens: 800,
      providerOptions: config.providerOptions,
    });

    const parsed = parseFn(completion.text);
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
      summary: parsed.summary,
      proposals: parsed.proposals,
      confirmRequired: true,
      autoApply: false,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_COMMERCIAL_AGENT_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

async function proposeCommercialNextSteps({ organizationId, userId, dealId }) {
  const id = String(dealId || '').trim();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AiConfigurationError('dealId is required', 'AI_DEAL_ID_REQUIRED');
  }

  const { snapshot, quoteDraft } = await convertDealToQuoteDraft({ organizationId, dealId: id });
  const coverageGaps = buildCoverageGaps(quoteDraft);
  const convertibleLineCount = (quoteDraft.lines || []).filter((line) => line.variantId).length;
  const blockingGaps = coverageGaps.filter((g) => g.severity === 'blocking');

  const context = {
    deal: snapshot.source,
    totals: snapshot.totals,
    lineCount: quoteDraft.lines.length,
    convertibleLineCount,
    canApplyCatalogLines: convertibleLineCount > 0 && blockingGaps.length === 0,
    coverageGaps,
    sampleLines: quoteDraft.lines.slice(0, 12).map((line) => ({
      lineOrder: line.lineOrder,
      name: line.itemNameSnapshot,
      qty: line.quantity,
      unitPrice: line.unitPriceSnapshot,
      hasVariant: Boolean(line.variantId),
      variantId: line.variantId ? String(line.variantId) : null,
    })),
  };

  const result = await runAgentCompletion({
    organizationId,
    userId,
    abilityKey: 'commercial_agent',
    promptKey: 'commercial_agent_system',
    userContent: [
      'Propose next commercial steps for this deal→quote conversion.',
      'JSON only: {"summary":"...","proposals":[{"action":"...","label":"...","rationale":"...","confidence":0-1,"params":{}}]}.',
      `Allowed actions: ${[...COMMERCIAL_ACTIONS].join(', ')}.`,
      'Do not invent catalog variants or prices. Propose create_quote only when canApplyCatalogLines is true.',
      'Propose-only — never claim a quote was created.',
      '',
      redactText(JSON.stringify(context, null, 2)),
    ].join('\n'),
    contextRefs: [{ sourceType: 'deal', sourceId: id, appKey: 'SALES', moduleKey: 'deals' }],
    parseFn: parseCommercialProposalsJson,
  });

  return {
    ...result,
    coverageGaps,
    canApplyCatalogLines: context.canApplyCatalogLines,
    convertibleLineCount,
    quoteDraftPreview: {
      lineCount: quoteDraft.lines.length,
      convertibleLineCount,
    },
  };
}

async function proposeCollectionNextSteps({ organizationId, userId, limit = 25 }) {
  const invoices = await listOverdueInvoices({ organizationId, limit });
  const invoiceIds = invoices.map((row) => row.invoiceId);

  if (!invoices.length) {
    return {
      summary: 'No overdue invoices found.',
      proposals: [],
      invoices: [],
      confirmRequired: true,
      autoApply: false,
      empty: true,
    };
  }

  const result = await runAgentCompletion({
    organizationId,
    userId,
    abilityKey: 'collection_agent',
    promptKey: 'collection_agent_system',
    userContent: [
      'Propose collection next steps for these overdue invoices.',
      'JSON only: {"summary":"...","proposals":[{"action":"...","label":"...","rationale":"...","confidence":0-1,"params":{"invoiceId":"..."}}]}.',
      `Allowed actions: ${[...COLLECTION_ACTIONS].join(', ')}.`,
      'Only use invoiceIds from the list. Do not invent balances or due dates.',
      'Propose-only — never claim a payment link was sent or email delivered.',
      '',
      redactText(JSON.stringify(invoices, null, 2)),
    ].join('\n'),
    contextRefs: invoices.slice(0, 20).map((row) => ({
      sourceType: 'invoice',
      sourceId: row.invoiceId,
      appKey: 'SALES',
      moduleKey: 'invoices',
    })),
    parseFn: (text) => parseCollectionProposalsJson(text, invoiceIds),
  });

  return {
    ...result,
    invoices,
    proposedPaymentLinkInvoiceIds: invoiceIds,
    empty: false,
  };
}

module.exports = {
  COMMERCIAL_ACTIONS,
  COLLECTION_ACTIONS,
  parseCommercialProposalsJson,
  parseCollectionProposalsJson,
  proposeCommercialNextSteps,
  proposeCollectionNextSteps,
};
