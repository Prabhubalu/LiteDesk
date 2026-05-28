const MailroomAttachment = require('../models/MailroomAttachment');
const objectStorage = require('../services/objectStorageService');
const { assertPortalUserCanAccessAttachment } = require('../platform/mailroom/connectors/portal/portalSafety');

function resolveContentDisposition(req, safeName) {
  const mode = String(req.query.disposition || req.query.inline || '').trim().toLowerCase();
  const inline = mode === 'inline' || mode === '1' || mode === 'true';
  if (inline) {
    return `inline; filename="${safeName}"`;
  }
  return `attachment; filename="${safeName}"`;
}

async function downloadMailroomAttachment(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const attachmentId = req.params.id;
    const row = await MailroomAttachment.findOne({
      _id: attachmentId,
      organizationId,
      status: { $ne: 'deleted' }
    }).lean();

    if (!row) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const { stream } = await objectStorage.getObjectStream({ key: row.objectKey });
    const mimeType = row.mimeType || 'application/octet-stream';
    const safeName = String(row.originalFileName || 'attachment').replace(/[\r\n"]/g, '_');
    const disposition = resolveContentDisposition(req, safeName);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', disposition);
    if (disposition.startsWith('inline')) {
      res.setHeader('Cache-Control', 'private, max-age=300');
    }
    return stream.pipe(res);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[mailroomAttachmentController] downloadMailroomAttachment', error);
    return res.status(500).json({ success: false, message: 'Failed to download attachment' });
  }
}

async function downloadMailroomAttachmentForPortal(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    await assertPortalUserCanAccessAttachment({
      organizationId,
      attachmentId: req.params.id,
      user: req.user
    });

    return downloadMailroomAttachment(req, res);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[mailroomAttachmentController] downloadMailroomAttachmentForPortal', error);
    return res.status(500).json({ success: false, message: 'Failed to download attachment' });
  }
}

module.exports = {
  downloadMailroomAttachment,
  downloadMailroomAttachmentForPortal
};

