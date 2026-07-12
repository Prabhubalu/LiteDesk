/**
 * ============================================================================
 * PLATFORM CORE: Automation Action Handlers
 * ============================================================================
 *
 * Minimal action implementations: create_task, notify_user.
 * No email, SMS, or external integrations.
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { createLogger } = require('./automationLogger');
const { startProcess } = require('./processInvocation');
const { runAnalyticsReportForAutomation } = require('./analytics/analyticsAutomationService');
const { getModelForModuleKey } = require('../utils/assignmentRecordLoader');
const deletionService = require('./deletionService');
const emailService = require('./emailService');
const smsService = require('./smsService');
const whatsappService = require('./whatsappService');
const pushService = require('./pushService');
const ProcessExecution = require('../models/ProcessExecution');

const log = createLogger('automationActionHandlers');

const ENTITY_TO_RELATED_TO = {
  people: 'contact',
  organization: 'organization',
  deal: 'deal'
};

const ENTITY_TO_MODULE_KEY = {
  people: 'people',
  organization: 'organizations',
  deal: 'deals',
  quote: 'quotes',
  task: 'tasks',
  event: 'events',
  case: 'cases',
  live_chat_session: 'live_chat_sessions'
};

function normalizeModuleKey(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return '';
  return ENTITY_TO_MODULE_KEY[key] || key;
}

function plainFieldValues(params, ctx = {}) {
  const { resolveFieldValues } = require('../utils/processFieldValueResolver');
  return resolveFieldValues(params?.fieldValues, ctx);
}

/**
 * create_record — generic module create via field map.
 */
async function createRecord(ctx, params) {
  const moduleKey = normalizeModuleKey(params?.moduleKey);
  if (!moduleKey) return { ok: false, error: 'create_record requires moduleKey' };
  const orgId = ctx.organizationId;
  if (!orgId) return { ok: false, error: 'create_record requires organizationId' };

  const Model = getModelForModuleKey(moduleKey);
  if (!Model) {
    return { ok: false, error: `create_record: unsupported module "${moduleKey}"` };
  }

  const fieldValues = plainFieldValues(params, ctx);
  if (!Object.keys(fieldValues).length) {
    return { ok: false, error: 'create_record requires at least one field value' };
  }

  try {
    const { assignResolvedSource } = require('./sourceResolver');
    const payload = {
      ...fieldValues,
      organizationId: new mongoose.Types.ObjectId(orgId)
    };
    if (ctx.triggeredBy && Model.schema?.paths?.createdBy) {
      payload.createdBy = new mongoose.Types.ObjectId(ctx.triggeredBy);
    }
    assignResolvedSource(payload, 'automation');
    const doc = await Model.create(payload);
    try {
      const { publishDataChange } = require('./dataChangeService');
      publishDataChange({
        organizationId: orgId,
        moduleKey,
        recordId: doc._id,
        op: 'create'
      });
    } catch (_) {
      /* non-blocking */
    }
    return { ok: true, recordId: doc._id.toString(), moduleKey };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * update_record — current or related record field updates.
 */
async function updateRecord(ctx, params) {
  const target = params?.target === 'related' ? 'related' : 'current';
  const moduleKey = normalizeModuleKey(
    params?.moduleKey || (target === 'current' ? ctx.entityType : '')
  );
  if (!moduleKey) return { ok: false, error: 'update_record requires moduleKey' };
  const orgId = ctx.organizationId;
  if (!orgId) return { ok: false, error: 'update_record requires organizationId' };

  const Model = getModelForModuleKey(moduleKey);
  if (!Model) {
    return { ok: false, error: `update_record: unsupported module "${moduleKey}"` };
  }

  const fieldValues = plainFieldValues(params, ctx);
  if (!Object.keys(fieldValues).length) {
    return { ok: false, error: 'update_record requires at least one field value' };
  }

  let recordId =
    target === 'current'
      ? ctx.entityId
      : params?.recordId != null
        ? String(params.recordId).trim()
        : '';
  if (!recordId || recordId === '{{trigger.id}}') {
    recordId = ctx.entityId;
  }
  if (!recordId) return { ok: false, error: 'update_record requires recordId' };

  try {
    const query = {
      _id: new mongoose.Types.ObjectId(recordId),
      organizationId: new mongoose.Types.ObjectId(orgId)
    };
    if (Model.schema?.paths?.deletedAt) query.deletedAt = null;

    const updated = await Model.findOneAndUpdate(
      query,
      { $set: fieldValues },
      { new: true }
    ).lean();
    if (!updated) return { ok: false, error: 'update_record: record not found' };
    try {
      const { publishDataChange } = require('./dataChangeService');
      publishDataChange({
        organizationId: orgId,
        moduleKey,
        recordId: updated._id,
        op: 'update'
      });
    } catch (_) {
      /* non-blocking */
    }
    return { ok: true, recordId: String(updated._id), moduleKey };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * delete_record — trash via deletionService when supported.
 */
async function deleteRecord(ctx, params) {
  const target = params?.target === 'related' ? 'related' : 'current';
  const moduleKey = normalizeModuleKey(
    params?.moduleKey || (target === 'current' ? ctx.entityType : '')
  );
  if (!moduleKey) return { ok: false, error: 'delete_record requires moduleKey' };
  const orgId = ctx.organizationId;
  if (!orgId) return { ok: false, error: 'delete_record requires organizationId' };

  let recordId =
    target === 'current'
      ? ctx.entityId
      : params?.recordId != null
        ? String(params.recordId).trim()
        : '';
  if (!recordId) recordId = ctx.entityId;
  if (!recordId) return { ok: false, error: 'delete_record requires recordId' };

  const userId = ctx.triggeredBy || null;
  try {
    const result = await deletionService.moveToTrash({
      moduleKey,
      recordId,
      organizationId: orgId,
      userId,
      appKey: ctx.appKey,
      reason: 'process_automation'
    });
    if (!result?.ok) {
      return {
        ok: false,
        error: result?.message || 'delete_record failed',
        blocked: result?.blocked,
        dependencies: result?.dependencies
      };
    }
    return { ok: true, recordId: String(recordId), moduleKey };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function resolveUserEmail(ctx, kind) {
  const userId = await resolveAssignee(ctx, kind === 'owner' ? 'owner' : 'triggeredBy');
  if (!userId) return null;
  try {
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(userId),
      organizationId: new mongoose.Types.ObjectId(ctx.organizationId)
    })
      .select('email')
      .lean();
    const email = user?.email != null ? String(user.email).trim() : '';
    return email || null;
  } catch {
    return null;
  }
}

/**
 * Email on the process trigger record (people / org / deal / …).
 */
async function resolveRecordEmail(ctx) {
  const state = ctx?.event?.currentState;
  const fromState =
    (state && (state.email ?? state.Email ?? state.workEmail ?? state.primaryEmail)) ||
    ctx?.dataBag?.currentRecord?.email ||
    null;
  if (fromState != null && String(fromState).trim().includes('@')) {
    return String(fromState).trim();
  }

  const moduleKey = normalizeModuleKey(ctx?.entityType);
  const orgId = ctx?.organizationId;
  const entityId = ctx?.entityId;
  if (!moduleKey || !orgId || !entityId || !mongoose.Types.ObjectId.isValid(entityId)) {
    return null;
  }
  try {
    const Model = getModelForModuleKey(moduleKey);
    if (!Model) return null;
    const doc = await Model.findOne({
      _id: new mongoose.Types.ObjectId(entityId),
      organizationId: new mongoose.Types.ObjectId(orgId)
    })
      .select('email Email workEmail primaryEmail')
      .lean();
    if (!doc) return null;
    const email = doc.email ?? doc.Email ?? doc.workEmail ?? doc.primaryEmail;
    return email != null && String(email).trim().includes('@') ? String(email).trim() : null;
  } catch {
    return null;
  }
}

/**
 * Render Content Studio email template HTML for the bound record.
 */
async function resolveEmailTemplateContent(ctx, templateId) {
  const orgId = ctx.organizationId;
  if (!orgId || !templateId) {
    return { ok: false, error: 'send_email: templateId required' };
  }
  if (!mongoose.Types.ObjectId.isValid(String(templateId))) {
    return { ok: false, error: 'send_email: invalid templateId' };
  }

  const ContentTemplate = require('../models/ContentTemplate');
  const { renderTemplate } = require('./contentPlatform/contentRenderService');
  const { ContentPlatformError } = require('../utils/contentPlatformErrors');

  const template = await ContentTemplate.findOne({
    _id: templateId,
    organizationId: orgId,
    deletedAt: null
  })
    .select('name outputFormat moduleScope')
    .lean();

  if (!template) {
    return { ok: false, error: 'send_email: email template not found' };
  }
  if (String(template.outputFormat || '').toLowerCase() !== 'email') {
    return { ok: false, error: 'send_email: selected template is not an email template' };
  }

  const moduleKey = normalizeModuleKey(
    ctx.entityType || template.moduleScope || ''
  );
  const recordId = ctx.entityId ? String(ctx.entityId) : null;

  try {
    const rendered = await renderTemplate({
      organizationId: orgId,
      templateId: String(templateId),
      userId: ctx.triggeredBy || null,
      outputFormat: 'html',
      preview: !recordId,
      persistOutput: false,
      runtimeContext: {
        recordId,
        recordModuleKey: moduleKey || undefined,
        ...(ctx.event?.currentState && typeof ctx.event.currentState === 'object'
          ? { record: ctx.event.currentState }
          : {})
      }
    });

    const html = String(rendered?.html || '').trim();
    if (!html) {
      return { ok: false, error: 'send_email: email template rendered empty body' };
    }

    return {
      ok: true,
      subject: String(template.name || '').trim() || 'Email',
      body: html
    };
  } catch (err) {
    const msg =
      err instanceof ContentPlatformError
        ? err.message
        : err?.message || String(err);
    return { ok: false, error: `send_email: template render failed — ${msg}` };
  }
}

/**
 * send_email — CRM transactional email via tenant provider.
 */
async function sendEmailAction(ctx, params) {
  const orgId = ctx.organizationId;
  if (!orgId) return { ok: false, error: 'send_email requires organizationId' };

  const bodyMode = String(params?.bodyMode || 'custom').toLowerCase() === 'template'
    ? 'template'
    : 'custom';

  let subject = params?.subject != null ? String(params.subject).trim() : '';
  let body = params?.body != null ? String(params.body).trim() : '';

  if (bodyMode === 'template') {
    const templateId = params?.templateId != null ? String(params.templateId).trim() : '';
    if (!templateId) return { ok: false, error: 'send_email requires templateId when using Email template' };
    const rendered = await resolveEmailTemplateContent(ctx, templateId);
    if (!rendered.ok) return rendered;
    body = rendered.body;
    if (!subject) subject = rendered.subject;
  }

  if (!subject) return { ok: false, error: 'send_email requires subject' };
  if (!body) return { ok: false, error: 'send_email requires body' };

  const rawTo = String(params?.to || 'record').trim();
  const toKind =
    rawTo === 'custom' || rawTo === 'triggeredBy' || rawTo === 'owner' || rawTo === 'record'
      ? rawTo
      : 'record';
  let toEmail = null;
  if (toKind === 'custom') {
    toEmail = params?.customEmail != null ? String(params.customEmail).trim() : '';
  } else if (toKind === 'record') {
    toEmail = await resolveRecordEmail(ctx);
  } else {
    toEmail = await resolveUserEmail(ctx, toKind);
  }
  if (!toEmail || !toEmail.includes('@')) {
    return { ok: false, error: `send_email: could not resolve recipient (${toKind})` };
  }

  if (!(await emailService.isConfiguredForOrganization(orgId))) {
    return { ok: false, error: 'send_email: email provider not configured for organization' };
  }

  try {
    const result = await emailService.sendCrmEmail({
      organizationId: orgId,
      to: toEmail,
      subject,
      text: body.replace(/<[^>]+>/g, ''),
      html: body.includes('<') ? body : undefined
    });
    if (!result?.success) {
      return { ok: false, error: result?.error || 'send_email failed' };
    }
    return { ok: true, messageId: result.messageId, to: toEmail };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function assertOutboundUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(String(urlStr || '').trim());
  } catch {
    const err = new Error('Invalid URL');
    err.code = 'INVALID_URL';
    throw err;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    const err = new Error('Only http(s) URLs are allowed');
    err.code = 'INVALID_URL';
    throw err;
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    const err = new Error('URL host not allowed');
    err.code = 'BLOCKED_HOST';
    throw err;
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(host)) {
    const err = new Error('Private network URLs are not allowed');
    err.code = 'BLOCKED_HOST';
    throw err;
  }
  return parsed;
}

function buildContextPayload(ctx) {
  return {
    source: 'arivu_process',
    organizationId: ctx.organizationId ? String(ctx.organizationId) : null,
    entityType: ctx.entityType || null,
    entityId: ctx.entityId ? String(ctx.entityId) : null,
    appKey: ctx.appKey || null,
    triggeredBy: ctx.triggeredBy ? String(ctx.triggeredBy) : null,
    eventId: ctx.eventId ? String(ctx.eventId) : null,
    timestamp: new Date().toISOString()
  };
}

function parseJsonObject(raw, label) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return parsed;
  } catch (err) {
    throw new Error(err.message || `Invalid ${label}`);
  }
}

async function executeHttpAction(ctx, params, { defaultMethod, defaultBodyMode, actionLabel }) {
  const urlRaw = params?.url != null ? String(params.url).trim() : '';
  if (!urlRaw) return { ok: false, error: `${actionLabel} requires url` };

  let url;
  try {
    url = assertOutboundUrl(urlRaw);
  } catch (err) {
    return { ok: false, error: `${actionLabel}: ${err.message}` };
  }

  const method = String(params?.method || defaultMethod || 'POST')
    .trim()
    .toUpperCase();
  const allowed = ['GET', 'POST', 'PUT', 'PATCH'];
  if (!allowed.includes(method)) {
    return { ok: false, error: `${actionLabel}: unsupported method ${method}` };
  }

  const bodyMode = params?.bodyMode || defaultBodyMode || 'context';
  let body = undefined;
  if (bodyMode === 'context') {
    body = buildContextPayload(ctx);
  } else if (bodyMode === 'custom') {
    try {
      body = parseJsonObject(params?.customBody, 'customBody');
    } catch (err) {
      return { ok: false, error: `${actionLabel}: ${err.message}` };
    }
  }

  let extraHeaders = {};
  if (params?.headersJson) {
    try {
      extraHeaders = parseJsonObject(params.headersJson, 'headersJson') || {};
    } catch (err) {
      return { ok: false, error: `${actionLabel}: ${err.message}` };
    }
  }

  const headers = {
    Accept: 'application/json',
    'User-Agent': 'Arivu-ProcessAutomation/1.0',
    ...extraHeaders
  };

  const init = {
    method,
    headers,
    signal: AbortSignal.timeout(15000)
  };

  if (body != null && method !== 'GET') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    init.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url.toString(), init);
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      return {
        ok: false,
        error: `${actionLabel}: HTTP ${response.status}`,
        status: response.status,
        bodyPreview: String(text).slice(0, 500)
      };
    }
    return {
      ok: true,
      status: response.status,
      bodyPreview: String(text).slice(0, 500)
    };
  } catch (err) {
    return { ok: false, error: `${actionLabel}: ${err.message || String(err)}` };
  }
}

async function webhookAction(ctx, params) {
  return executeHttpAction(ctx, params, {
    defaultMethod: 'POST',
    defaultBodyMode: 'context',
    actionLabel: 'webhook'
  });
}

async function restApiAction(ctx, params) {
  return executeHttpAction(ctx, params, {
    defaultMethod: 'GET',
    defaultBodyMode: 'none',
    actionLabel: 'rest_api'
  });
}

async function resolveUserPhone(ctx, kind) {
  const userId = await resolveAssignee(ctx, kind === 'owner' ? 'owner' : 'triggeredBy');
  if (!userId) return null;
  try {
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(userId),
      organizationId: new mongoose.Types.ObjectId(ctx.organizationId)
    })
      .select('phoneNumber phone mobile')
      .lean();
    const phone =
      user?.phoneNumber || user?.phone || user?.mobile || null;
    return phone != null ? String(phone).trim() : null;
  } catch {
    return null;
  }
}

async function resolvePhoneRecipient(ctx, params) {
  const toKind = params?.to === 'custom' || params?.to === 'triggeredBy' ? params.to : 'owner';
  if (toKind === 'custom') {
    return params?.customPhone != null ? String(params.customPhone).trim() : '';
  }
  return (await resolveUserPhone(ctx, toKind)) || '';
}

async function sendSmsAction(ctx, params) {
  const message = params?.message != null ? String(params.message).trim() : '';
  if (!message) return { ok: false, error: 'send_sms requires message' };
  if (!smsService.enabled()) {
    return { ok: false, error: 'send_sms: SMS provider disabled (ENABLE_SMS_NOTIFICATIONS)' };
  }
  const to = await resolvePhoneRecipient(ctx, params);
  if (!to || !smsService.isValidPhoneNumber(to)) {
    return { ok: false, error: 'send_sms: invalid or unresolved phone (E.164 required)' };
  }
  const result = await smsService.sendSMS({ to, message });
  if (!result?.success) {
    return { ok: false, error: result?.error || result?.reason || 'send_sms failed' };
  }
  return { ok: true, messageId: result.messageId, to };
}

async function sendWhatsappAction(ctx, params) {
  const message = params?.message != null ? String(params.message).trim() : '';
  if (!message) return { ok: false, error: 'send_whatsapp requires message' };
  if (!whatsappService.enabled()) {
    return { ok: false, error: 'send_whatsapp: WhatsApp provider disabled (ENABLE_WHATSAPP_NOTIFICATIONS)' };
  }
  const to = await resolvePhoneRecipient(ctx, params);
  if (!to || !whatsappService.isValidPhoneNumber(to)) {
    return { ok: false, error: 'send_whatsapp: invalid or unresolved phone (E.164 required)' };
  }
  const templateId = params?.templateId != null ? String(params.templateId).trim() : null;
  const result = await whatsappService.sendWhatsAppMessage({
    to,
    message,
    templateId: templateId || null
  });
  if (!result?.success) {
    return { ok: false, error: result?.error || result?.reason || 'send_whatsapp failed' };
  }
  return { ok: true, messageId: result.messageId, to };
}

async function mobilePushAction(ctx, params) {
  const title = params?.title != null ? String(params.title).trim() : '';
  const message = params?.message != null ? String(params.message).trim() : '';
  if (!title) return { ok: false, error: 'mobile_push requires title' };
  if (!message) return { ok: false, error: 'mobile_push requires message' };

  const recipientKind = params?.recipient === 'triggeredBy' ? 'triggeredBy' : 'owner';
  const userId = await resolveAssignee(ctx, recipientKind);
  if (!userId) {
    return { ok: false, error: `mobile_push: could not resolve recipient (${recipientKind})` };
  }
  if (!pushService.initialized()) {
    return { ok: false, error: 'mobile_push: push service not configured (VAPID keys)' };
  }

  const appKey = ctx.appKey || 'SALES';
  const subscriptions = await pushService.getActiveSubscriptions(userId, appKey);
  if (!subscriptions?.length) {
    return { ok: false, error: 'mobile_push: no active push subscriptions for recipient' };
  }

  const payload = {
    title,
    body: message,
    icon: '/favicon.ico',
    data: {
      entityType: ctx.entityType || null,
      entityId: ctx.entityId ? String(ctx.entityId) : null,
      appKey,
      source: 'process_automation'
    }
  };

  let sent = 0;
  let lastError = null;
  for (const sub of subscriptions) {
    const result = await pushService.sendPushNotification(sub, payload);
    if (result?.success) sent += 1;
    else lastError = result?.error || lastError;
  }
  if (!sent) {
    return { ok: false, error: lastError || 'mobile_push: failed to deliver' };
  }
  return { ok: true, sent, recipientId: userId };
}

async function slackNotificationAction(ctx, params) {
  const webhookUrl = params?.webhookUrl != null ? String(params.webhookUrl).trim() : '';
  const message = params?.message != null ? String(params.message).trim() : '';
  if (!webhookUrl) return { ok: false, error: 'slack_notification requires webhookUrl' };
  if (!message) return { ok: false, error: 'slack_notification requires message' };

  let url;
  try {
    url = assertOutboundUrl(webhookUrl);
  } catch (err) {
    return { ok: false, error: `slack_notification: ${err.message}` };
  }
  if (!url.hostname.includes('slack.com') && !url.hostname.includes('hooks.slack.com')) {
    // Still allow if host passes SSRF checks — Slack hooks are preferred
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Arivu-ProcessAutomation/1.0'
      },
      body: JSON.stringify({
        text: message,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: message }
          }
        ]
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        ok: false,
        error: `slack_notification: HTTP ${response.status}`,
        bodyPreview: String(text).slice(0, 300)
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `slack_notification: ${err.message || String(err)}` };
  }
}

function ensureDataBag(ctx) {
  if (!ctx.dataBag || typeof ctx.dataBag !== 'object') {
    ctx.dataBag = {};
  }
  return ctx.dataBag;
}

async function fetchRecordsAction(ctx, params) {
  const moduleKey = normalizeModuleKey(params?.moduleKey);
  if (!moduleKey) return { ok: false, error: 'fetch_records requires moduleKey' };
  const variableName =
    params?.variableName != null ? String(params.variableName).trim() : 'records';
  if (!variableName) return { ok: false, error: 'fetch_records requires variableName' };
  const orgId = ctx.organizationId;
  if (!orgId) return { ok: false, error: 'fetch_records requires organizationId' };

  const Model = getModelForModuleKey(moduleKey);
  if (!Model) {
    return { ok: false, error: `fetch_records: unsupported module "${moduleKey}"` };
  }

  let filter = {};
  if (params?.filterGroup && typeof params.filterGroup === 'object') {
    try {
      const { conditionGroupToMongoFilter } = require('../utils/processConditionEvaluator');
      filter = conditionGroupToMongoFilter(params.filterGroup, {
        event: ctx.event || {},
        dataBag: ctx.dataBag || {}
      });
    } catch (err) {
      return { ok: false, error: `fetch_records: invalid filter — ${err.message}` };
    }
  } else if (params?.filterJson) {
    try {
      filter = parseJsonObject(params.filterJson, 'filterJson') || {};
    } catch (err) {
      return { ok: false, error: `fetch_records: ${err.message}` };
    }
  }

  const limitMode = String(params?.limitMode || 'count').toLowerCase() === 'all' ? 'all' : 'count';
  const ALL_CAP = 1000;
  const COUNT_CAP = 500;
  let limit = 50;
  if (limitMode === 'all') {
    limit = ALL_CAP;
  } else {
    const limitRaw = Number(params?.limit);
    limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), COUNT_CAP)
        : 50;
  }

  const query = {
    ...filter,
    organizationId: new mongoose.Types.ObjectId(orgId)
  };
  if (Model.schema?.paths?.deletedAt) query.deletedAt = null;

  try {
    const docs = await Model.find(query).limit(limit).lean();
    const bag = ensureDataBag(ctx);
    bag[variableName] = docs;
    bag[`${variableName}__meta`] = {
      moduleKey,
      count: docs.length,
      limitMode,
      limit,
      fetchedAt: new Date().toISOString()
    };
    return { ok: true, count: docs.length, variableName, moduleKey, limitMode, limit };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function fetchRelatedRecordsAction(ctx, params) {
  const orgId = ctx.organizationId;
  if (!orgId) return { ok: false, error: 'fetch_related_records requires organizationId' };

  const moduleKey = normalizeModuleKey(params?.moduleKey || ctx.entityType);
  const recordId =
    params?.recordId != null && String(params.recordId).trim()
      ? String(params.recordId).trim()
      : ctx.entityId
        ? String(ctx.entityId)
        : '';
  if (!moduleKey || !recordId) {
    return { ok: false, error: 'fetch_related_records requires moduleKey and recordId' };
  }

  const variableName =
    params?.variableName != null ? String(params.variableName).trim() : 'related';
  if (!variableName) return { ok: false, error: 'fetch_related_records requires variableName' };

  const relationshipKey =
    params?.relationshipKey != null ? String(params.relationshipKey).trim().toLowerCase() : '';

  try {
    const { getRelatedRecords } = require('./relationshipResolver');
    const appKey = ctx.appKey || 'SALES';
    let groups = await getRelatedRecords(orgId, appKey, moduleKey, recordId);
    if (!Array.isArray(groups)) groups = [];

    if (relationshipKey) {
      groups = groups.filter(
        (g) => String(g.relationshipKey || '').toLowerCase() === relationshipKey
      );
    }

    const flat = [];
    for (const g of groups) {
      for (const rec of g.records || []) {
        flat.push({
          relationshipKey: g.relationshipKey,
          direction: g.direction,
          appKey: rec.appKey,
          moduleKey: rec.moduleKey,
          recordId: rec.recordId != null ? String(rec.recordId) : null
        });
      }
    }

    const bag = ensureDataBag(ctx);
    bag[variableName] = flat;
    bag[`${variableName}__groups`] = groups.map((g) => ({
      relationshipKey: g.relationshipKey,
      direction: g.direction,
      count: (g.records || []).length
    }));
    bag[`${variableName}__meta`] = {
      moduleKey,
      recordId,
      count: flat.length,
      fetchedAt: new Date().toISOString()
    };

    return { ok: true, count: flat.length, variableName, moduleKey, recordId };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function setVariableAction(ctx, params) {
  const name = params?.name != null ? String(params.name).trim() : '';
  if (!name) return { ok: false, error: 'set_variable requires name' };
  const bag = ensureDataBag(ctx);
  bag[name] = params?.value;
  return { ok: true, name, value: params?.value };
}

async function createAuditEntryAction(ctx, params) {
  const message = params?.message != null ? String(params.message).trim() : '';
  if (!message) return { ok: false, error: 'create_audit_entry requires message' };

  const entry = {
    message,
    at: new Date().toISOString(),
    entityType: ctx.entityType || null,
    entityId: ctx.entityId ? String(ctx.entityId) : null,
    triggeredBy: ctx.triggeredBy ? String(ctx.triggeredBy) : null,
    executionId: ctx.executionId || null
  };

  const bag = ensureDataBag(ctx);
  if (!Array.isArray(bag.__auditLog)) bag.__auditLog = [];
  bag.__auditLog.push(entry);

  log.info('process_audit_entry', entry);

  if (ctx.executionId) {
    try {
      await ProcessExecution.updateOne(
        { executionId: ctx.executionId },
        { $set: { dataBag: bag } }
      );
    } catch (err) {
      log.info('process_audit_persist_failed', { error: err.message });
    }
  }

  return { ok: true, entry };
}

async function customFunctionAction(ctx, params) {
  const { runCustomFunction } = require('./processCustomFunctions');
  const functionKey = params?.functionKey != null ? String(params.functionKey).trim() : '';
  let args = {};
  if (params?.argsJson) {
    try {
      const parsed =
        typeof params.argsJson === 'object'
          ? params.argsJson
          : JSON.parse(String(params.argsJson));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        args = parsed;
      } else {
        return { ok: false, error: 'custom_function argsJson must be a JSON object' };
      }
    } catch (err) {
      return { ok: false, error: `custom_function: invalid argsJson (${err.message})` };
    }
  }
  return runCustomFunction(functionKey, ctx, args);
}

/**
 * Resolve assignee/recipient: 'owner' | 'triggeredBy' -> User id.
 * Returns null if unresolved (log and caller should skip).
 *
 * @param {Object} ctx - { assignedTo, triggeredBy, organizationId }
 * @param {string} kind - 'owner' | 'triggeredBy'
 * @returns {Promise<string|null>} User id string or null
 */
async function resolveAssignee(ctx, kind) {
  const orgId = ctx.organizationId;
  if (!orgId) return null;
  const raw = kind === 'owner' ? ctx.assignedTo : ctx.triggeredBy;
  const id = raw != null ? (raw.toString ? raw.toString() : String(raw)) : null;
  if (!id || id === 'system') return null;
  try {
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: new mongoose.Types.ObjectId(orgId)
    })
      .select('_id')
      .lean();
    return user ? user._id.toString() : null;
  } catch {
    return null;
  }
}

/**
 * create_task handler.
 * Params: title (required), description?, dueInDays?, assignee ('owner'|'triggeredBy'),
 *         relatedEntity: { entityType, entityId }.
 *
 * @param {Object} ctx - Event context { eventId, entityType, entityId, organizationId, triggeredBy, assignedTo, appKey }
 * @param {Object} params - Action params
 * @returns {Promise<{ ok: boolean, taskId?: string, error?: string }>}
 */
async function createTask(ctx, params) {
  const title = params?.title;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return { ok: false, error: 'create_task requires non-empty title' };
  }
  const orgId = ctx.organizationId;
  if (!orgId) return { ok: false, error: 'create_task requires organizationId' };

  const assigneeKind = params?.assignee === 'owner' ? 'owner' : 'triggeredBy';
  const assigneeId = await resolveAssignee(ctx, assigneeKind);
  if (!assigneeId) {
    return { ok: false, error: `create_task: could not resolve assignee (${assigneeKind})` };
  }

  let dueDate = null;
  const dueInDays = params?.dueInDays;
  if (typeof dueInDays === 'number' && dueInDays >= 0) {
    const d = new Date();
    d.setDate(d.getDate() + dueInDays);
    dueDate = d;
  }

  let relatedTo = { type: 'none', id: null };
  const re = params?.relatedEntity;
  const useTrigger = re && (re.entityId === '__trigger__' || re.entityId === '');
  const entityType = useTrigger ? ctx.entityType : (re?.entityType ?? null);
  const entityId = useTrigger ? ctx.entityId : (re?.entityId ?? null);
  if (entityType && entityId) {
    const type = ENTITY_TO_RELATED_TO[String(entityType).toLowerCase()] || 'none';
    if (type !== 'none') {
      try {
        relatedTo = { type, id: new mongoose.Types.ObjectId(entityId) };
      } catch {
        relatedTo = { type: 'none', id: null };
      }
    }
  }

  try {
    const { assignResolvedSource } = require('./sourceResolver');
    const taskPayload = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      title: title.trim(),
      description: params?.description && typeof params.description === 'string' ? params.description.trim() : undefined,
      dueDate,
      relatedTo,
      assignedTo: new mongoose.Types.ObjectId(assigneeId),
      assignedBy: ctx.triggeredBy ? new mongoose.Types.ObjectId(ctx.triggeredBy) : undefined,
      status: 'todo',
      priority: 'medium',
      createdBy: ctx.triggeredBy ? new mongoose.Types.ObjectId(ctx.triggeredBy) : undefined
    };
    assignResolvedSource(taskPayload, 'automation');
    const task = await Task.create(taskPayload);
    return { ok: true, taskId: task._id.toString() };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * notify_user handler.
 * Params: message (required), recipient ('owner'|'triggeredBy').
 * Creates IN_APP notification only.
 *
 * @param {Object} ctx - Event context
 * @param {Object} params - Action params
 * @returns {Promise<{ ok: boolean, notificationId?: string, error?: string }>}
 */
async function notifyUser(ctx, params) {
  const message = params?.message;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return { ok: false, error: 'notify_user requires non-empty message' };
  }
  const orgId = ctx.organizationId;
  if (!orgId) return { ok: false, error: 'notify_user requires organizationId' };

  const recipientKind = params?.recipient === 'owner' ? 'owner' : 'triggeredBy';
  const userId = await resolveAssignee(ctx, recipientKind);
  if (!userId) {
    return { ok: false, error: `notify_user: could not resolve recipient (${recipientKind})` };
  }

  const appKey = (ctx.appKey || 'SALES').toUpperCase();
  const title = 'Automation';
  const body = message.trim();

  try {
    let entity = undefined;
    const entityType = ctx.entityType || null;
    const entityId = ctx.entityId || null;
    if (entityType && entityId && mongoose.Types.ObjectId.isValid(entityId)) {
      entity = { type: entityType, id: new mongoose.Types.ObjectId(entityId) };
    }
    const doc = {
      userId: new mongoose.Types.ObjectId(userId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      appKey,
      eventType: 'AUTOMATION_NOTIFY',
      title,
      body,
      channel: 'IN_APP',
      source: 'SYSTEM',
      ...(entity && { entity })
    };
    const notification = await Notification.create(doc);
    return { ok: true, notificationId: notification._id.toString() };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * start_process handler.
 * Starts a Process Execution from an Automation Rule.
 * Params: processId (required), inputMapping (optional).
 *
 * @param {Object} ctx - Event context { eventId, entityType, entityId, organizationId, triggeredBy, assignedTo, appKey }
 * @param {Object} params - Action params { processId, inputMapping? }
 * @param {string} [automationExecutionId] - Automation execution ID (for linking)
 * @returns {Promise<{ ok: boolean, processExecutionId?: string, error?: string }>}
 */
async function startProcessAction(ctx, params, automationExecutionId = null) {
  const processId = params?.processId;
  if (!processId || typeof processId !== 'string') {
    return { ok: false, error: 'start_process requires processId' };
  }

  const orgId = ctx.organizationId;
  if (!orgId) {
    return { ok: false, error: 'start_process requires organizationId' };
  }

  // Build input mapping (optional key-value mapping to populate process dataBag)
  const inputMapping = params?.inputMapping || {};

  // Start process using the formal invocation service
  // Pass the domain event if available (from context)
  const event = ctx.eventId ? {
    eventId: ctx.eventId,
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    eventType: ctx.eventType || null,
    organizationId: ctx.organizationId,
    triggeredBy: ctx.triggeredBy,
    assignedTo: ctx.assignedTo,
    appKey: ctx.appKey
  } : null;

  try {
    const result = await startProcess({
      processId,
      event,
      manualParams: event ? null : {
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        organizationId: ctx.organizationId,
        triggeredBy: ctx.triggeredBy,
        assignedTo: ctx.assignedTo
      },
      inputMapping,
      automationExecutionId
    });

    if (result.ok) {
      return {
        ok: true,
        processExecutionId: result.executionId
      };
    } else {
      return { ok: false, error: result.error || 'Process start failed' };
    }
  } catch (err) {
    return { ok: false, error: `start_process error: ${err.message}` };
  }
}

async function liveChatCreateCase(ctx, params) {
  if (String(ctx.entityType || '').toLowerCase() !== 'live_chat_session') {
    return { ok: false, error: 'live_chat_create_case requires live_chat_session trigger' };
  }
  if (!ctx.organizationId || !ctx.entityId) {
    return { ok: false, error: 'live_chat_create_case requires organizationId and session entityId' };
  }

  try {
    const { createCaseFromLiveChatSession } = require('./liveChatCaseAdapter');
    const result = await createCaseFromLiveChatSession({
      organizationId: ctx.organizationId,
      sessionId: ctx.entityId,
      actorId: ctx.triggeredBy,
      title: params?.title,
    });
    return { ok: true, caseId: result.caseId };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function liveChatLinkCase(ctx, params) {
  if (String(ctx.entityType || '').toLowerCase() !== 'live_chat_session') {
    return { ok: false, error: 'live_chat_link_case requires live_chat_session trigger' };
  }
  const caseId = params?.caseId;
  if (!caseId) {
    return { ok: false, error: 'live_chat_link_case requires caseId' };
  }

  try {
    const { linkExistingCaseToSession } = require('./liveChatCaseAdapter');
    const result = await linkExistingCaseToSession({
      organizationId: ctx.organizationId,
      sessionId: ctx.entityId,
      caseId,
      actorId: ctx.triggeredBy,
    });
    return { ok: true, caseId: result.caseId };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function liveChatCreateLead(ctx) {
  if (String(ctx.entityType || '').toLowerCase() !== 'live_chat_session') {
    return { ok: false, error: 'live_chat_create_lead requires live_chat_session trigger' };
  }
  if (!ctx.organizationId || !ctx.entityId) {
    return { ok: false, error: 'live_chat_create_lead requires organizationId and session entityId' };
  }

  try {
    const { createLeadFromLiveChatSession } = require('./liveChatCrmAdapter');
    const result = await createLeadFromLiveChatSession({
      organizationId: ctx.organizationId,
      sessionId: ctx.entityId,
      actorId: ctx.triggeredBy,
    });
    return { ok: true, personId: result.personId, created: result.created };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function liveChatLinkPerson(ctx, params) {
  if (String(ctx.entityType || '').toLowerCase() !== 'live_chat_session') {
    return { ok: false, error: 'live_chat_link_person requires live_chat_session trigger' };
  }
  const personId = params?.personId;
  if (!personId) {
    return { ok: false, error: 'live_chat_link_person requires personId' };
  }

  try {
    const { linkExistingPersonToSession } = require('./liveChatCrmAdapter');
    const result = await linkExistingPersonToSession({
      organizationId: ctx.organizationId,
      sessionId: ctx.entityId,
      personId,
      actorId: ctx.triggeredBy,
    });
    return { ok: true, personId: result.personId };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

async function runAnalyticsReportAction(ctx, params) {
  const reportId = params?.reportId != null ? String(params.reportId).trim() : '';
  if (!reportId) {
    return { ok: false, error: 'run_analytics_report requires reportId' };
  }

  const orgId = ctx.organizationId;
  if (!orgId) {
    return { ok: false, error: 'run_analytics_report requires organizationId' };
  }

  const attachRaw = params?.attachToRecord;
  const attachToRecord = attachRaw === false || attachRaw === 'false' ? false : true;

  const userId =
    (await resolveAssignee(ctx, 'triggeredBy')) || (await resolveAssignee(ctx, 'owner'));
  if (!userId) {
    return { ok: false, error: 'run_analytics_report: could not resolve executing user' };
  }

  try {
    return await runAnalyticsReportForAutomation({
      organizationId: orgId,
      userId,
      reportId,
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      appKey: ctx.appKey,
      attachToRecord,
    });
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

const handlers = {
  create_record: createRecord,
  update_record: updateRecord,
  delete_record: deleteRecord,
  create_task: createTask,
  notify_user: notifyUser,
  send_email: sendEmailAction,
  send_sms: sendSmsAction,
  send_whatsapp: sendWhatsappAction,
  mobile_push: mobilePushAction,
  slack_notification: slackNotificationAction,
  webhook: webhookAction,
  rest_api: restApiAction,
  fetch_records: fetchRecordsAction,
  fetch_related_records: fetchRelatedRecordsAction,
  set_variable: setVariableAction,
  create_audit_entry: createAuditEntryAction,
  custom_function: customFunctionAction,
  start_process: startProcessAction,
  run_analytics_report: runAnalyticsReportAction,
  live_chat_create_case: liveChatCreateCase,
  live_chat_link_case: liveChatLinkCase,
  live_chat_create_lead: liveChatCreateLead,
  live_chat_link_person: liveChatLinkPerson,
};

/**
 * Execute an action by type. Handlers are wrapped in try/catch by the engine.
 *
 * @param {string} actionType
 * @param {Object} ctx - Event context
 * @param {Object} params - Action params
 * @param {string} [automationExecutionId] - Automation execution ID (for linking with processes)
 * @returns {Promise<{ ok: boolean, taskId?: string, notificationId?: string, processExecutionId?: string, error?: string }>}
 */
async function execute(actionType, ctx, params, automationExecutionId = null) {
  const fn = handlers[actionType];
  if (!fn) {
    return { ok: false, error: `Unknown action type: ${actionType}` };
  }
  
  // For start_process action, pass automationExecutionId
  if (actionType === 'start_process') {
    return fn(ctx, params || {}, automationExecutionId);
  }
  
  return fn(ctx, params || {});
}

module.exports = {
  execute,
  handlers
};
