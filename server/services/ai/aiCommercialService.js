'use strict';

/**
 * Phase 2 Commercial Copilot abilities (propose-only; engines stay authoritative).
 */

const Invoice = require('../../models/Invoice');
const { convertDealToQuoteDraft } = require('../commercialConversionService');
const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactMessages, redactText } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');

function buildCoverageGaps(quoteDraft) {
  const gaps = [];
  const lines = Array.isArray(quoteDraft?.lines) ? quoteDraft.lines : [];
  if (!lines.length) {
    gaps.push({
      code: 'NO_LINES',
      severity: 'blocking',
      message: 'Deal has no active commercial lines to convert.',
    });
  }

  lines.forEach((line, index) => {
    if (!line.variantId) {
      gaps.push({
        code: 'MISSING_CATALOG_VARIANT',
        severity: 'blocking',
        lineOrder: line.lineOrder ?? index + 1,
        sourceDealLineId: line.sourceDealLineId || null,
        itemName: line.itemNameSnapshot || null,
        message: `Line ${line.lineOrder ?? index + 1} (${line.itemNameSnapshot || 'untitled'}) has no catalog variant and cannot be written via Quote line API.`,
      });
    }
  });

  const convertible = lines.filter((line) => line.variantId).length;
  if (lines.length && convertible === 0) {
    gaps.push({
      code: 'NO_CONVERTIBLE_LINES',
      severity: 'blocking',
      message: 'No lines have catalog variants; Quote header can be created but no lines can be applied yet.',
    });
  }

  return gaps;
}

async function draftDealQuote({ organizationId, userId, dealId }) {
  const startedAt = Date.now();
  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'deal_quote_draft',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const { snapshot, quoteDraft } = await convertDealToQuoteDraft({ organizationId, dealId });
    const coverageGaps = buildCoverageGaps(quoteDraft);
    const convertibleLineCount = quoteDraft.lines.filter((line) => line.variantId).length;

    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'deal_quote_draft' });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const systemPrompt = getPrompt('deal_quote_draft_system');
    const context = redactText(JSON.stringify({
      deal: snapshot.source,
      totals: snapshot.totals,
      lineCount: quoteDraft.lines.length,
      convertibleLineCount,
      coverageGaps,
      sampleLines: quoteDraft.lines.slice(0, 12).map((line) => ({
        lineOrder: line.lineOrder,
        name: line.itemNameSnapshot,
        qty: line.quantity,
        unitPrice: line.unitPriceSnapshot,
        hasVariant: Boolean(line.variantId),
      })),
    }, null, 2));

    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        {
          role: 'user',
          content: `Explain readiness to convert this deal to a quote. Highlight gaps and next steps for a sales user.\n\n${context}`,
        },
      ]),
      temperature: 0.2,
      maxTokens: 700,
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
      contextRefs: [{ sourceType: 'deal', sourceId: String(dealId), appKey: 'SALES', moduleKey: 'deals' }],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      text: String(completion.text || '').trim(),
      snapshot,
      quoteDraft,
      coverageGaps,
      convertibleLineCount,
      canApplyCatalogLines: convertibleLineCount > 0,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
      dealId: String(dealId),
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      contextRefs: [{ sourceType: 'deal', sourceId: String(dealId), appKey: 'SALES', moduleKey: 'deals' }],
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_DEAL_QUOTE_DRAFT_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

async function listOverdueInvoices({ organizationId, limit = 25 }) {
  const now = new Date();
  const rows = await Invoice.find({
    organizationId,
    deletedAt: null,
    status: { $in: ['Posted', 'Partially Paid'] },
    amountDue: { $gt: 0 },
    dueDate: { $ne: null, $lt: now },
  })
    .select('_id invoiceNumber status dueDate amountDue currency organizationRefId contactId')
    .sort({ dueDate: 1 })
    .limit(Math.min(Math.max(Number(limit) || 25, 1), 50))
    .lean();

  return rows.map((row) => ({
    invoiceId: String(row._id),
    invoiceNumber: row.invoiceNumber,
    status: row.status,
    dueDate: row.dueDate,
    amountDue: row.amountDue,
    currency: row.currency,
    organizationRefId: row.organizationRefId ? String(row.organizationRefId) : null,
    contactId: row.contactId ? String(row.contactId) : null,
  }));
}

async function briefOverdueInvoices({ organizationId, userId, limit = 25 }) {
  const startedAt = Date.now();
  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'invoice_collection_brief',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const invoices = await listOverdueInvoices({ organizationId, limit });
    const config = await resolveAiRequestConfig({
      organizationId,
      abilityKey: 'invoice_collection_brief',
    });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const systemPrompt = getPrompt('invoice_collection_system');
    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        {
          role: 'user',
          content: `Create (1) a short overdue receivables brief and (2) a follow-up email body a human can edit before send.\n\nInvoices JSON:\n${redactText(JSON.stringify(invoices, null, 2))}`,
        },
      ]),
      temperature: 0.3,
      maxTokens: 900,
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
      contextRefs: invoices.slice(0, 20).map((row) => ({
        sourceType: 'invoice',
        sourceId: row.invoiceId,
        appKey: 'SALES',
        moduleKey: 'invoices',
      })),
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      text: String(completion.text || '').trim(),
      invoices,
      proposedPaymentLinkInvoiceIds: invoices.map((row) => row.invoiceId),
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
      errorCode: error.code || 'AI_INVOICE_BRIEF_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  buildCoverageGaps,
  draftDealQuote,
  listOverdueInvoices,
  briefOverdueInvoices,
};
