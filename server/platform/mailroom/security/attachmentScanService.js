'use strict';

const MailroomAttachment = require('../../../models/MailroomAttachment');

async function isScanEnabledForOrganization(organizationId) {
  if (process.env.MAILROOM_ATTACHMENT_SCAN_ENABLED === 'true') return true;
  if (!organizationId) return false;
  try {
    const mailroomConfigService = require('../../../services/mailroomConfigService');
    const config = await mailroomConfigService.getOrCreateConfig(organizationId);
    return config.security?.attachments?.scanEnabled === true;
  } catch {
    return false;
  }
}

/**
 * Scan provider — noop by default; webhook when MAILROOM_SCAN_WEBHOOK_URL is set.
 */
async function scanBuffer({ buffer, mimeType, fileName }) {
  const webhookUrl = String(process.env.MAILROOM_SCAN_WEBHOOK_URL || '').trim();
  if (!webhookUrl) {
    return { status: 'clean', provider: 'noop', detail: 'scan_disabled' };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: fileName || 'attachment',
      mimeType: mimeType || 'application/octet-stream',
      sizeBytes: buffer?.length || 0,
      sha256: buffer ? require('crypto').createHash('sha256').update(buffer).digest('hex') : null
    })
  });

  if (!response.ok) {
    return { status: 'failed', provider: 'webhook', detail: `HTTP ${response.status}` };
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  const verdict = String(json?.status || json?.verdict || '').toLowerCase();
  if (verdict === 'infected' || verdict === 'malware' || json?.infected === true) {
    return { status: 'infected', provider: 'webhook', detail: json?.detail || 'infected' };
  }
  if (verdict === 'clean' || verdict === 'ok' || json?.clean === true) {
    return { status: 'clean', provider: 'webhook', detail: json?.detail || 'clean' };
  }
  return { status: 'failed', provider: 'webhook', detail: 'unrecognized_verdict' };
}

async function runAttachmentScan(attachmentId, { organizationId, buffer, mimeType, fileName }) {
  if (!attachmentId || !organizationId) return null;

  await MailroomAttachment.updateOne(
    { _id: attachmentId, organizationId },
    {
      $set: {
        status: 'scan_pending',
        scanMeta: { startedAt: new Date(), provider: null }
      }
    }
  );

  try {
    const result = await scanBuffer({ buffer, mimeType, fileName });
    const nextStatus = result.status === 'infected'
      ? 'scan_infected'
      : result.status === 'clean'
        ? 'scan_clean'
        : 'scan_failed';

    await MailroomAttachment.updateOne(
      { _id: attachmentId, organizationId },
      {
        $set: {
          status: nextStatus,
          scanMeta: {
            finishedAt: new Date(),
            provider: result.provider,
            detail: result.detail,
            verdict: result.status
          }
        }
      }
    );
    return { attachmentId, status: nextStatus, ...result };
  } catch (err) {
    await MailroomAttachment.updateOne(
      { _id: attachmentId, organizationId },
      {
        $set: {
          status: 'scan_failed',
          scanMeta: {
            finishedAt: new Date(),
            error: String(err.message || err).slice(0, 500)
          }
        }
      }
    );
    return { attachmentId, status: 'scan_failed', error: err.message };
  }
}

async function enqueueAttachmentScan({
  organizationId,
  attachmentId,
  buffer,
  mimeType,
  fileName
}) {
  if (!attachmentId || !(await isScanEnabledForOrganization(organizationId))) {
    return Promise.resolve(null);
  }

  setImmediate(() => {
    runAttachmentScan(attachmentId, {
      organizationId,
      buffer,
      mimeType,
      fileName
    }).catch((err) => {
      console.error('[mailroomAttachmentScan] async scan failed:', err.message);
    });
  });

  return Promise.resolve({ queued: true, attachmentId });
}

async function assertAttachmentsSafeForLink(organizationId, attachmentIds = []) {
  if (!(await isScanEnabledForOrganization(organizationId)) || !attachmentIds.length) return;

  const rows = await MailroomAttachment.find({
    organizationId,
    _id: { $in: attachmentIds }
  })
    .select('status originalFileName')
    .lean();

  const blocked = rows.filter((r) => r.status === 'scan_infected' || r.status === 'scan_pending');
  if (blocked.length) {
    const err = new Error('One or more attachments failed malware scan or scan is pending');
    err.statusCode = 422;
    err.code = 'MAILROOM_ATTACHMENT_SCAN_BLOCKED';
    err.blockedIds = blocked.map((r) => String(r._id));
    throw err;
  }
}

module.exports = {
  isScanEnabledForOrganization,
  scanBuffer,
  runAttachmentScan,
  enqueueAttachmentScan,
  assertAttachmentsSafeForLink
};
