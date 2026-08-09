'use strict';

const Organization = require('../models/Organization');
const Mailbox = require('../models/Mailbox');
const ParserMailboxRegistry = require('../models/ParserMailboxRegistry');
const {
  resolveParserIdsForMailbox,
  routingLocalPartFromMailbox
} = require('../utils/parserIdCodec');
const { getEffectiveInboundParserConfig } = require('./inboundParserConfigService');
const { provisionMailboxLocally } = require('./localParserProvisioningService');

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
  const localProvision = String(process.env.LOCAL_PARSER_PROVISION || '').trim().toLowerCase() === 'true';
  if (localProvision) {
    return provisionMailboxLocally({ organizationId, mailbox });
  }

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
  const { parserTenantId: tenantId, parserMailboxId: mailboxId } = resolveParserIdsForMailbox({
    organizationId,
    mailbox
  });
  const existingRegistry = await ParserMailboxRegistry.findOne({
    parserTenantId: tenantId,
    parserMailboxId: mailboxId
  })
    .select('mailboxObjectId')
    .lean();
  if (
    existingRegistry
    && String(existingRegistry.mailboxObjectId) !== String(mailbox._id)
  ) {
    const message = 'Parser mailbox id already assigned to another mailbox in this tenant';
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
  const mailboxName = String(mailbox.label || 'Inbox').trim();
  const routingLocalPart = routingLocalPartFromMailbox({
    label: mailbox.label,
    emailAddress: mailbox.emailAddress,
    kind: mailbox.kind,
    ownerUserId: mailbox.ownerUserId,
    mailboxObjectId: mailbox._id
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
    let message =
      err?.name === 'AbortError'
        ? 'Parser provisioning timed out (15s)'
        : err?.message || String(err);
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(message)) {
      message =
        `Cannot reach inbound parser at ${url} (${message}). `
        + 'For local/dev set LOCAL_PARSER_PROVISION=true in server/.env, '
        + 'or fix Control Plane → Inbound Parser → Parser API base URL.';
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

  const { parserTenantId: tenantId, parserMailboxId } = resolveParserIdsForMailbox({
    organizationId,
    mailbox
  });
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
