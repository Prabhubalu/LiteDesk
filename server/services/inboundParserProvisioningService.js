'use strict';

const Organization = require('../models/Organization');
const Mailbox = require('../models/Mailbox');
const ParserMailboxRegistry = require('../models/ParserMailboxRegistry');
const {
  toParserTenantId,
  toParserMailboxId,
  parseParserTenantId,
  parseParserMailboxId,
  routingLocalPartFromMailbox
} = require('../utils/parserIdCodec');
const { getEffectiveInboundParserConfig } = require('./inboundParserConfigService');

const SKIPPED_REASON_MESSAGES = {
  inbound_parser_not_configured:
    'Inbound parser is not enabled or the Parser API URL is missing. Enable it in Control Plane → Inbound Parser.',
  parser_api_key_missing:
    'Parser API key is not set on the CRM server. Add it in Control Plane → Inbound Parser (same value as CRM_API_KEY on the parser).'
};

function skippedReasonMessage(reason) {
  return SKIPPED_REASON_MESSAGES[reason] || null;
}

async function provisionMailboxWithParser({ organizationId, mailbox }) {
  const cfg = await getEffectiveInboundParserConfig();
  if (!cfg.enabled || !cfg.parserApiBaseUrl) {
    const reason = 'inbound_parser_not_configured';
    console.warn('[inboundParserProvisioning] skipped:', reason, {
      enabled: cfg.enabled,
      hasParserUrl: Boolean(cfg.parserApiBaseUrl)
    });
    return {
      skipped: true,
      reason,
      message: skippedReasonMessage(reason)
    };
  }
  if (!cfg.parserApiKey) {
    const reason = 'parser_api_key_missing';
    console.warn('[inboundParserProvisioning] skipped:', reason);
    return {
      skipped: true,
      reason,
      message: skippedReasonMessage(reason)
    };
  }

  const org = await Organization.findById(organizationId).select('name').lean();
  let tenantId = String(mailbox.parserTenantId || '').trim();
  let mailboxId = String(mailbox.parserMailboxId || '').trim();
  // Regenerate when missing or legacy full-ObjectId ids (shorten plus-address).
  if (!tenantId || parseParserTenantId(tenantId)) {
    tenantId = toParserTenantId(organizationId);
  }
  if (!mailboxId || parseParserMailboxId(mailboxId)) {
    mailboxId = toParserMailboxId(mailbox._id);
  }
  const mailboxName = String(mailbox.label || 'Inbox').trim();
  const routingLocalPart = routingLocalPartFromMailbox({
    label: mailbox.label,
    emailAddress: mailbox.emailAddress,
    kind: mailbox.kind
  });
  const type = mailbox.kind === 'personal' ? 'private' : 'shared';

  const url = `${cfg.parserApiBaseUrl}/integrations/v1/mailboxes`;
  const body = {
    tenantId,
    tenantName: org?.name || tenantId,
    mailboxId,
    mailboxName,
    routingLocalPart,
    type
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.parserApiKey}`,
        'X-Arivu-Api-Key': cfg.parserApiKey
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    const message =
      err?.name === 'AbortError'
        ? 'Parser provisioning timed out (15s)'
        : err?.message || String(err);
    await Mailbox.updateOne(
      { _id: mailbox._id },
      {
        $set: {
          parserProvisionStatus: 'failed',
          parserProvisioningError: message.slice(0, 500)
        }
      }
    );
    return { ok: false, error: message };
  }
  clearTimeout(timeout);

  let payload = {};
  try {
    payload = await res.json();
  } catch {
    payload = {};
  }

  if (!res.ok) {
    const errText = payload?.message || payload?.error || JSON.stringify(payload).slice(0, 200);
    let message = `Parser provision HTTP ${res.status}: ${errText}`;
    if (res.status === 404) {
      message =
        `Integrations API not found (404) at ${url}. `
        + 'Check Control Plane → Inbound Parser → Parser API base URL: it must be the prefix '
        + 'before /integrations/v1/mailboxes (e.g. https://parser.example.com/api if routes use /api). '
        + 'Also confirm the parser server includes the CRM provisioning API.';
    }
    await Mailbox.updateOne(
      { _id: mailbox._id },
      {
        $set: {
          parserProvisionStatus: 'failed',
          parserProvisioningError: message.slice(0, 500)
        }
      }
    );
    return { ok: false, error: message, status: res.status };
  }

  const routingAddress = String(payload.routingAddress || '').trim();
  const forwardingHint = String(payload.forwardingHint || '').trim();

  await Mailbox.updateOne(
    { _id: mailbox._id },
    {
      $set: {
        parserTenantId: tenantId,
        parserMailboxId: mailboxId,
        routingAddress,
        parserForwardingHint: forwardingHint,
        parserProvisionedAt: new Date(),
        parserProvisionStatus: 'provisioned',
        parserProvisioningError: ''
      }
    }
  );

  await ParserMailboxRegistry.findOneAndUpdate(
    { parserTenantId: tenantId, parserMailboxId: mailboxId },
    {
      $set: {
        organizationId,
        mailboxObjectId: mailbox._id,
        mailboxKind: mailbox.kind,
        ownerUserId: mailbox.ownerUserId || null
      }
    },
    { upsert: true, new: true }
  );

  return {
    ok: true,
    routingAddress,
    forwardingHint
  };
}

async function deprovisionMailboxFromParser({ organizationId, mailbox }) {
  const cfg = await getEffectiveInboundParserConfig();
  if (!cfg.enabled || !cfg.parserApiBaseUrl || !cfg.parserApiKey) {
    return { skipped: true, reason: 'inbound_parser_not_configured' };
  }

  const tenantId =
    String(mailbox.parserTenantId || '').trim() || toParserTenantId(organizationId);
  const parserMailboxId =
    String(mailbox.parserMailboxId || '').trim() || toParserMailboxId(mailbox._id);
  if (!tenantId || !parserMailboxId) {
    return { skipped: true, reason: 'missing_parser_ids' };
  }

  const url = `${cfg.parserApiBaseUrl}/integrations/v1/mailboxes/${encodeURIComponent(parserMailboxId)}?tenantId=${encodeURIComponent(tenantId)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${cfg.parserApiKey}`,
        'X-Arivu-Api-Key': cfg.parserApiKey
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok || res.status === 404) {
      return { ok: true, status: res.status };
    }
    let payload = {};
    try {
      payload = await res.json();
    } catch {
      payload = {};
    }
    const errText = payload?.message || payload?.error || '';
    return {
      ok: false,
      status: res.status,
      error: errText || `Parser deprovision HTTP ${res.status}`,
      messagesExist: res.status === 409
    };
  } catch (err) {
    clearTimeout(timeout);
    const message =
      err?.name === 'AbortError'
        ? 'Parser deprovision timed out (15s)'
        : err?.message || String(err);
    return { ok: false, error: message };
  }
}

module.exports = {
  provisionMailboxWithParser,
  deprovisionMailboxFromParser,
  skippedReasonMessage
};
