'use strict';

/**
 * Webform submission processing — separate from Audit formProcessingService.
 * WF2: validate, persist submission, ingest CRM record.
 * WF3: dedup policy, assignment outcome, post-processing hooks.
 */

const Webform = require('../models/Webform');
const WebformSubmission = require('../models/WebformSubmission');
const { ingestCrmRecord, resolveActorUserId } = require('./webformCrmIngestionService');
const { evaluateSubmissionDedup } = require('./webformDedupService');
const { runWebformPostProcessing } = require('./webformPostProcessingService');
const {
  normalizeWebformFieldType
} = require('../constants/moduleFieldTypes');
const { sanitizeWebformFieldValues } = require('../utils/webformInputSanitizer');
const {
  filterVisibleWebformFields,
  stripHiddenWebformFieldValues
} = require('../constants/webformConditionalLogic');
const {
  isWebformFileFieldType,
  isFileFieldValueEmpty
} = require('../constants/webformFileFields');
const {
  resolveWebformFileFieldValues,
  consumeWebformUploads
} = require('./webformFileUploadService');
const { appendWebformAuditEntry } = require('./webformAuditService');

function normalizeFieldValues(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CRM_KEY_PATTERN = /(^|_)(phone|mobile|tel)(_|$)/i;

function isEmailField(field) {
  const type = normalizeWebformFieldType(field?.type);
  if (type === 'Email') return true;
  const key = String(field?.crmFieldKey || '').toLowerCase();
  return key === 'email' || key.endsWith('_email') || key === 'requesteremail';
}

function isPhoneField(field) {
  const type = normalizeWebformFieldType(field?.type);
  if (type === 'Phone') return true;
  const key = String(field?.crmFieldKey || '').toLowerCase();
  return key === 'phone' || key === 'mobile' || PHONE_CRM_KEY_PATTERN.test(key);
}

function isValueEmpty(type, value) {
  if (type === 'Checkbox') return value !== true;
  if (type === 'Multi-Picklist') {
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null || String(value).trim() === '';
  }
  if (isWebformFileFieldType(type)) return isFileFieldValueEmpty(value);
  if (value === undefined || value === null) return true;
  return String(value).trim() === '';
}

function isValidPhoneValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return true;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return false;
  if (raw.startsWith('+')) {
    return digits.length >= 8 && digits.length <= 15;
  }
  return digits.length >= 7 && digits.length <= 15;
}

function validateSubmission(webform, fieldValues) {
  const values = normalizeFieldValues(fieldValues);
  const fields = Array.isArray(webform?.fields) ? webform.fields : [];
  const visibleFields = filterVisibleWebformFields(fields, values);
  const allowedIds = new Set(fields.map((field) => String(field.fieldId)));

  for (const field of visibleFields) {
    const value = values[field.fieldId];
    const type = normalizeWebformFieldType(field.type);

    if (field.required) {
      if (isValueEmpty(type, value)) {
        return {
          valid: false,
          error: `Required field "${field.label}" is missing.`,
          fieldId: field.fieldId
        };
      }
    }

    if (!isValueEmpty(type, value)) {
      if (isEmailField(field) && !EMAIL_PATTERN.test(String(value).trim())) {
        return {
          valid: false,
          error: `Enter a valid email address for "${field.label}".`,
          fieldId: field.fieldId
        };
      }
      if (isPhoneField(field) && !isValidPhoneValue(value)) {
        return {
          valid: false,
          error: `Enter a valid phone number for "${field.label}".`,
          fieldId: field.fieldId
        };
      }
    }
  }

  const visibleValues = stripHiddenWebformFieldValues(fields, values);

  for (const [key, value] of Object.entries(visibleValues)) {
    if (!allowedIds.has(String(key))) {
      return { valid: false, error: `Unknown field "${key}".`, fieldId: key };
    }
    if (typeof value === 'string' && value.length > 10000) {
      return { valid: false, error: `Field "${key}" exceeds maximum length.`, fieldId: key };
    }
  }

  return { valid: true, values: visibleValues };
}

async function updateWebformAnalytics(webformId, organizationId) {
  const stats = await WebformSubmission.aggregate([
    {
      $match: {
        webformId,
        organizationId
      }
    },
    {
      $group: {
        _id: null,
        totalSubmissions: { $sum: 1 },
        lastSubmissionAt: { $max: '$createdAt' }
      }
    }
  ]);

  if (!stats.length) return;

  await Webform.updateOne(
    { _id: webformId, organizationId },
    {
      $set: {
        totalSubmissions: stats[0].totalSubmissions,
        lastSubmissionAt: stats[0].lastSubmissionAt
      }
    }
  );
}

function normalizeIdempotencyKey(value) {
  const key = String(value || '').trim();
  if (!key || key.length > 128) return '';
  return key;
}

async function findIdempotentSubmission({ webformId, organizationId, idempotencyKey }) {
  if (!idempotencyKey) return null;
  return WebformSubmission.findOne({
    webformId,
    organizationId,
    idempotencyKey
  });
}

/**
 * @param {object} params
 * @param {import('mongoose').Document} params.webform
 * @param {Record<string, unknown>} params.fieldValues
 * @param {import('mongoose').Types.ObjectId|string} params.organizationId
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 * @param {string} [params.idempotencyKey]
 */
async function processSubmission(params) {
  const {
    webform,
    fieldValues,
    organizationId,
    ipAddress,
    userAgent,
    idempotencyKey: rawIdempotencyKey
  } = params;

  if (!webform || !webform._id) {
    throw new Error('Webform is required');
  }
  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  const idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
  if (idempotencyKey) {
    const existing = await findIdempotentSubmission({
      webformId: webform._id,
      organizationId,
      idempotencyKey
    });
    if (existing) {
      if (existing.status === 'duplicate_rejected') {
        const error = new Error(existing.errorMessage || 'A matching record already exists.');
        error.statusCode = 409;
        error.dedupOutcome = existing.dedupOutcome;
        error.idempotentReplay = true;
        throw error;
      }
      if (existing.status === 'processed') {
        existing.idempotentReplay = true;
        return existing;
      }
    }
  }

  const resolvedFieldValues = await resolveWebformFileFieldValues(
    webform,
    fieldValues,
    organizationId
  );

  const validation = validateSubmission(webform, resolvedFieldValues);
  if (!validation.valid) {
    const error = new Error(validation.error);
    error.fieldId = validation.fieldId;
    error.statusCode = 400;
    throw error;
  }

  validation.values = sanitizeWebformFieldValues(webform.fields, validation.values);

  let submission;
  try {
    submission = await WebformSubmission.create({
      organizationId,
      webformId: webform._id,
      fieldValues: validation.values,
      status: 'pending',
      ipAddress: ipAddress || '',
      userAgent: userAgent || '',
      idempotencyKey: idempotencyKey || ''
    });
  } catch (createErr) {
    if (createErr?.code === 11000 && idempotencyKey) {
      const existing = await findIdempotentSubmission({
        webformId: webform._id,
        organizationId,
        idempotencyKey
      });
      if (existing) {
        if (existing.status === 'duplicate_rejected') {
          const error = new Error(existing.errorMessage || 'A matching record already exists.');
          error.statusCode = 409;
          error.dedupOutcome = existing.dedupOutcome;
          error.idempotentReplay = true;
          throw error;
        }
        if (existing.status === 'processed') {
          existing.idempotentReplay = true;
          return existing;
        }
      }
    }
    throw createErr;
  }

  try {
    const dedupEval = await evaluateSubmissionDedup({
      webform,
      fieldValues: validation.values,
      organizationId
    });

    submission.dedupOutcome = {
      matched: dedupEval.matched,
      matchedRecordId: dedupEval.matchedRecordId,
      action: dedupEval.shouldReject ? 'reject' : dedupEval.matched ? dedupEval.recordAction : null
    };

    if (dedupEval.shouldReject) {
      submission.status = 'duplicate_rejected';
      submission.errorMessage = 'A matching record already exists.';
      await submission.save();
      await updateWebformAnalytics(webform._id, organizationId);
      void appendWebformAuditEntry({
        webformId: webform._id,
        organizationId,
        type: 'dedup_hit',
        message: 'Duplicate submission rejected.',
        metadata: { submissionId: submission._id, dedupOutcome: submission.dedupOutcome }
      });

      const error = new Error('A matching record already exists.');
      error.statusCode = 409;
      error.dedupOutcome = submission.dedupOutcome;
      throw error;
    }

    const recordActionOverride =
      webform?.dedup?.enabled && dedupEval.matched
        ? dedupEval.recordAction
        : null;

    const crmOutcome = await ingestCrmRecord({
      webform,
      fieldValues: validation.values,
      organizationId,
      existingRecord: dedupEval.existingRecord,
      recordActionOverride
    });

    submission.status = 'processed';
    submission.crmOutcome = {
      moduleKey: crmOutcome.moduleKey,
      recordId: crmOutcome.recordId,
      action: crmOutcome.action
    };

    if (crmOutcome.assignmentResult) {
      submission.assignmentOutcome = {
        executed: crmOutcome.assignmentResult.executed === true,
        reason: crmOutcome.assignmentResult.reason || null,
        ownerChanged: crmOutcome.assignmentResult.ownerChanged === true,
        newOwnerId: crmOutcome.assignmentResult.newOwnerId || null,
        ruleId: crmOutcome.assignmentResult.ruleId || null
      };
    }

    await submission.save();

    await consumeWebformUploads({
      webformId: webform._id,
      organizationId,
      fieldValues: validation.values,
      submissionId: submission._id
    });

    const actorUserId = await resolveActorUserId(organizationId, webform);
    await runWebformPostProcessing({
      webform,
      submission,
      crmOutcome: submission.crmOutcome,
      record: crmOutcome.record,
      actorUserId,
      organizationId
    });

    void appendWebformAuditEntry({
      webformId: webform._id,
      organizationId,
      type: 'submission_processed',
      message: `Submission processed (${submission.crmOutcome?.action || 'skipped'}).`,
      actorUserId,
      metadata: {
        submissionId: submission._id,
        crmOutcome: submission.crmOutcome,
        dedupMatched: submission.dedupOutcome?.matched === true
      }
    });
    if (submission.dedupOutcome?.matched) {
      void appendWebformAuditEntry({
        webformId: webform._id,
        organizationId,
        type: 'dedup_hit',
        message: 'Dedup matched an existing record.',
        actorUserId,
        metadata: { submissionId: submission._id, dedupOutcome: submission.dedupOutcome }
      });
    }
  } catch (crmError) {
    if (crmError.statusCode === 409) {
      throw crmError;
    }

    if (submission.status === 'pending') {
      submission.status = 'failed';
      submission.errorMessage = crmError.message || 'CRM ingestion failed';
      await submission.save();
      void appendWebformAuditEntry({
        webformId: webform._id,
        organizationId,
        type: 'crm_failed',
        message: submission.errorMessage,
        metadata: { submissionId: submission._id }
      });
    }

    const error = new Error(crmError.message || 'Unable to process submission.');
    error.statusCode = crmError.statusCode || 500;
    error.fieldId = crmError.fieldId;
    throw error;
  }

  await updateWebformAnalytics(webform._id, organizationId);

  return submission;
}

module.exports = {
  processSubmission,
  validateSubmission,
  normalizeIdempotencyKey
};
