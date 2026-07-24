'use strict';

/**
 * Real confirm executors for Astra write tools (no fake success).
 */

const mongoose = require('mongoose');

function oid(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (mongoose.Types.ObjectId.isValid(raw)) return new mongoose.Types.ObjectId(raw);
  return null;
}

function fail(code, guidance) {
  return { ok: false, sent: false, created: false, updated: false, error: code, guidance };
}

function relatedParts(relatedTo) {
  const moduleKey = String(relatedTo?.moduleKey || relatedTo?.kind || '').trim().toLowerCase();
  const recordId = String(relatedTo?.id || relatedTo?.recordId || '').trim();
  return { moduleKey, recordId };
}

async function executeDealUpdate(input = {}, ctx = {}) {
  const dealId = String(input.dealId || input.id || '').trim();
  if (!dealId) return fail('ASTRA_DEAL_ID_REQUIRED', 'Cannot update deal — dealId is required.');

  const patch = {};
  if (input.stage !== undefined) patch.stage = input.stage;
  if (input.status !== undefined) patch.status = input.status;
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.name !== undefined) patch.name = String(input.name).trim();
  if (!Object.keys(patch).length) {
    return fail('ASTRA_DEAL_PATCH_EMPTY', 'Cannot update deal — provide at least one field (stage, status, amount, or name).');
  }

  const Deal = ctx.deps?.models?.Deal || require('../../../models/Deal');
  const filter = { _id: dealId, deletedAt: null };
  if (ctx.organizationId) filter.organizationId = oid(ctx.organizationId) || ctx.organizationId;

  const doc = await Deal.findOneAndUpdate(
    filter,
    {
      $set: {
        ...patch,
        ...(ctx.userId ? { modifiedBy: oid(ctx.userId) } : {}),
        lastActivityDate: new Date(),
      },
    },
    { new: true },
  ).lean();

  if (!doc) return fail('ASTRA_DEAL_NOT_FOUND', 'Deal not found or access denied.');
  return {
    ok: true,
    updated: true,
    dealId: String(doc._id),
    patch,
    guidance: `Deal updated${patch.stage ? ` → ${patch.stage}` : ''}${patch.status ? ` (${patch.status})` : ''}.`,
  };
}

async function executeNotesCreate(input = {}, ctx = {}) {
  const body = String(input.body || input.text || input.content || '').trim();
  if (!body) return fail('ASTRA_NOTE_EMPTY', 'Cannot add note — note text is required.');
  if (!ctx.organizationId) return fail('ASTRA_ORG_REQUIRED', 'Cannot add note — organization context is required.');

  const { moduleKey, recordId } = relatedParts(input.relatedTo || input.focus || {});
  if (!moduleKey || !recordId) {
    return fail('ASTRA_NOTE_TARGET_REQUIRED', 'Cannot add note — relate it to a record (module + id).');
  }

  // Deals: native embedded notes
  if (moduleKey === 'deals') {
    const Deal = ctx.deps?.models?.Deal || require('../../../models/Deal');
    const filter = { _id: recordId, deletedAt: null, organizationId: oid(ctx.organizationId) || ctx.organizationId };
    const update = {
      $push: {
        notes: {
          text: body,
          createdBy: oid(ctx.userId),
          createdAt: new Date(),
        },
      },
      $set: {
        lastActivityDate: new Date(),
        ...(ctx.userId ? { modifiedBy: oid(ctx.userId) } : {}),
      },
    };
    const doc = await Deal.findOneAndUpdate(filter, update, { new: true });
    if (!doc) return fail('ASTRA_NOTE_TARGET_NOT_FOUND', 'Deal not found — note was not added.');
    return { ok: true, created: true, id: String(doc._id), guidance: 'Note added to deal.' };
  }

  const RecordActivity = require('../../../models/RecordActivity');
  const row = await RecordActivity.create({
    organizationId: oid(ctx.organizationId) || ctx.organizationId,
    moduleKey,
    recordId: String(recordId),
    type: 'comment',
    content: body,
    author: oid(ctx.userId),
  });
  return {
    ok: true,
    created: true,
    id: String(row._id),
    guidance: `Note added on ${moduleKey}.`,
  };
}

async function executeActivityLog(input = {}, ctx = {}) {
  const summary = String(input.summary || input.title || input.message || '').trim();
  if (!summary) return fail('ASTRA_ACTIVITY_EMPTY', 'Cannot log activity — summary is required.');
  if (!ctx.organizationId) return fail('ASTRA_ORG_REQUIRED', 'Cannot log activity — organization context is required.');

  const { moduleKey, recordId } = relatedParts(input.relatedTo || input.focus || {});
  if (!moduleKey || !recordId) {
    return fail('ASTRA_ACTIVITY_TARGET_REQUIRED', 'Cannot log activity — relate it to a record (module + id).');
  }

  const RecordActivity = require('../../../models/RecordActivity');
  const row = await RecordActivity.create({
    organizationId: oid(ctx.organizationId) || ctx.organizationId,
    moduleKey,
    recordId: String(recordId),
    type: 'activity',
    action: String(input.type || 'logged'),
    message: summary,
    details: input.details && typeof input.details === 'object' ? input.details : {},
    author: oid(ctx.userId),
  });
  return {
    ok: true,
    logged: true,
    id: String(row._id),
    guidance: `Activity logged on ${moduleKey}.`,
  };
}

async function executeCaseAssign(input = {}, ctx = {}) {
  const caseId = String(input.caseId || input.id || '').trim();
  const assigneeId = String(input.assigneeId || input.assignedTo || input.userId || '').trim();
  if (!caseId) return fail('ASTRA_CASE_ID_REQUIRED', 'Cannot assign case — caseId is required.');
  if (!assigneeId) return fail('ASTRA_CASE_ASSIGNEE_REQUIRED', 'Cannot assign case — assignee is required.');

  const Case = ctx.deps?.models?.Case || require('../../../models/Case');
  const filter = { _id: caseId, deletedAt: null };
  if (ctx.organizationId) filter.organizationId = oid(ctx.organizationId) || ctx.organizationId;

  const doc = await Case.findOneAndUpdate(
    filter,
    {
      $set: {
        assignedTo: oid(assigneeId) || assigneeId,
        status: input.status || 'Assigned',
        ...(ctx.userId ? { modifiedBy: oid(ctx.userId) } : {}),
      },
    },
    { new: true },
  ).lean();

  if (!doc) return fail('ASTRA_CASE_NOT_FOUND', 'Case not found or access denied.');
  return { ok: true, updated: true, caseId: String(doc._id), guidance: 'Case assigned.' };
}

async function executeCaseResolve(input = {}, ctx = {}) {
  const caseId = String(input.caseId || input.id || '').trim();
  if (!caseId) return fail('ASTRA_CASE_ID_REQUIRED', 'Cannot resolve case — caseId is required.');

  const Case = ctx.deps?.models?.Case || require('../../../models/Case');
  const filter = { _id: caseId, deletedAt: null };
  if (ctx.organizationId) filter.organizationId = oid(ctx.organizationId) || ctx.organizationId;

  const doc = await Case.findOneAndUpdate(
    filter,
    {
      $set: {
        status: 'Resolved',
        resolvedAt: new Date(),
        resolvedBy: oid(ctx.userId),
        ...(ctx.userId ? { modifiedBy: oid(ctx.userId) } : {}),
      },
    },
    { new: true },
  ).lean();

  if (!doc) return fail('ASTRA_CASE_NOT_FOUND', 'Case not found or access denied.');
  return { ok: true, updated: true, caseId: String(doc._id), guidance: 'Case marked resolved.' };
}

async function executeQuotesSend(input = {}, ctx = {}) {
  const quoteId = String(input.quoteId || input.id || '').trim();
  if (!quoteId) return fail('ASTRA_QUOTE_ID_REQUIRED', 'Cannot send quote — quoteId is required.');
  if (!ctx.organizationId) return fail('ASTRA_ORG_REQUIRED', 'Organization context required.');

  try {
    const { sendQuoteEmail } = require('../../quoteEmailService');
    const result = await sendQuoteEmail({
      organizationId: ctx.organizationId,
      quoteId,
      userId: ctx.userId,
      body: {
        to: input.to || undefined,
        subject: input.subject || undefined,
        message: input.message || input.body || undefined,
        sendMode: input.sendMode || 'formal',
      },
    });
    const to = result?.email?.to;
    return {
      ok: true,
      sent: true,
      quoteId,
      to: to || null,
      guidance: to ? `Quote emailed to ${to}.` : 'Quote emailed.',
    };
  } catch (err) {
    return fail(err?.code || 'ASTRA_QUOTE_SEND_FAILED', err?.message || 'Quote email failed.');
  }
}

async function executeInvoiceSend(input = {}, ctx = {}) {
  const invoiceId = String(input.invoiceId || input.id || '').trim();
  if (!invoiceId) return fail('ASTRA_INVOICE_ID_REQUIRED', 'Cannot send invoice — invoiceId is required.');
  if (!ctx.organizationId) return fail('ASTRA_ORG_REQUIRED', 'Organization context required.');

  try {
    const { sendInvoiceEmail } = require('../../invoiceEmailService');
    const result = await sendInvoiceEmail({
      organizationId: ctx.organizationId,
      invoiceRef: invoiceId,
      userId: ctx.userId,
      body: {
        to: input.to || undefined,
        subject: input.subject || undefined,
        message: input.message || input.body || undefined,
      },
    });
    if (result?.ok === false || result?.success === false) {
      return fail('ASTRA_INVOICE_SEND_FAILED', result?.error || result?.message || 'Invoice email failed.');
    }
    return {
      ok: true,
      sent: true,
      invoiceId,
      guidance: result?.guidance || 'Invoice emailed.',
    };
  } catch (err) {
    return fail('ASTRA_INVOICE_SEND_FAILED', err?.message || 'Invoice email failed.');
  }
}

async function executeInvoiceVoid(input = {}, ctx = {}) {
  const invoiceId = String(input.invoiceId || input.id || '').trim();
  const reason = String(input.reversalReason || input.reason || '').trim();
  if (!invoiceId) return fail('ASTRA_INVOICE_ID_REQUIRED', 'Cannot void invoice — invoiceId is required.');
  if (!reason) return fail('ASTRA_VOID_REASON_REQUIRED', 'Cannot void invoice — reversal reason is required.');
  if (!ctx.organizationId) return fail('ASTRA_ORG_REQUIRED', 'Organization context required.');

  try {
    const { voidInvoice } = require('../../invoiceVoidService');
    const result = await voidInvoice({
      organizationId: ctx.organizationId,
      invoiceMongoId: invoiceId,
      userId: ctx.userId,
      reversalReason: reason,
    });
    return {
      ok: true,
      updated: true,
      invoiceId,
      guidance: result?.guidance || 'Invoice voided.',
    };
  } catch (err) {
    return fail(err?.code || 'ASTRA_INVOICE_VOID_FAILED', err?.message || 'Invoice void failed.');
  }
}

async function executePaymentRecord(input = {}, ctx = {}) {
  const amount = Number(input.amount);
  const organizationRefId = String(input.organizationRefId || input.accountId || input.orgId || '').trim();
  if (!ctx.organizationId) return fail('ASTRA_ORG_REQUIRED', 'Organization context required.');
  if (!organizationRefId) {
    return fail('ASTRA_PAYMENT_ACCOUNT_REQUIRED', 'Cannot record payment — customer account (organizationRefId) is required.');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail('ASTRA_PAYMENT_AMOUNT_REQUIRED', 'Cannot record payment — amount must be greater than zero.');
  }

  try {
    const { recordPayment } = require('../../paymentRecordService');
    const result = await recordPayment({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      organizationRefId,
      contactId: input.contactId || null,
      amount,
      paymentCurrency: input.currency || input.paymentCurrency || null,
      paymentDate: input.paymentDate || new Date(),
      paymentPurpose: input.paymentPurpose || 'invoice_payment',
      notes: input.notes || null,
      autoApply: input.autoApply !== false,
      allocations: input.allocations || null,
      sourceContext: 'astra',
    });
    return {
      ok: true,
      created: true,
      paymentId: String(result?.payment?._id || result?._id || ''),
      guidance: 'Payment recorded.',
    };
  } catch (err) {
    return fail(err?.code || 'ASTRA_PAYMENT_FAILED', err?.message || 'Payment recording failed.');
  }
}

async function executePaymentLinkCreate(input = {}, ctx = {}) {
  if (!ctx.organizationId) return fail('ASTRA_ORG_REQUIRED', 'Organization context required.');
  const organizationRefId = String(input.organizationRefId || input.accountId || '').trim();
  const invoiceIds = Array.isArray(input.invoiceIds)
    ? input.invoiceIds
    : (input.invoiceId ? [input.invoiceId] : []);
  if (!organizationRefId && !invoiceIds.length) {
    return fail(
      'ASTRA_PAYMENT_LINK_TARGET_REQUIRED',
      'Cannot create payment link — provide invoiceId(s) or organizationRefId.',
    );
  }

  try {
    const { createPaymentLink } = require('../../paymentLinkService');
    const link = await createPaymentLink({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      organizationRefId: organizationRefId || null,
      contactId: input.contactId || null,
      invoiceIds,
      expiresAt: input.expiresAt || null,
      maxUses: input.maxUses || 1,
      notes: input.notes || null,
      sourceContext: 'astra',
    });
    return {
      ok: true,
      created: true,
      paymentLinkId: String(link?._id || link?.id || ''),
      publicUrl: link?.publicUrl || null,
      guidance: link?.publicUrl ? `Payment link created: ${link.publicUrl}` : 'Payment link created.',
    };
  } catch (err) {
    return fail(err?.code || 'ASTRA_PAYMENT_LINK_FAILED', err?.message || 'Payment link creation failed.');
  }
}

async function executeNotImplemented(toolName, summary) {
  return fail(
    'ASTRA_ACTION_NOT_IMPLEMENTED',
    `${summary || toolName} cannot be completed from Astra yet — open the record in Arivu to finish this action.`,
  );
}

module.exports = {
  executeDealUpdate,
  executeNotesCreate,
  executeActivityLog,
  executeCaseAssign,
  executeCaseResolve,
  executeQuotesSend,
  executeInvoiceSend,
  executeInvoiceVoid,
  executePaymentRecord,
  executePaymentLinkCreate,
  executeNotImplemented,
};
