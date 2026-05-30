const fs = require('fs');
const fileStorage = require('../services/fileStorageService');
const objectStorage = require('../services/objectStorageService');

function resolveContentDisposition(req, safeName) {
  const mode = String(req.query.disposition || '').trim().toLowerCase();
  const inline = mode === 'inline' || mode === '1' || mode === 'true';
  if (inline) {
    return `inline; filename="${safeName}"`;
  }
  return `attachment; filename="${safeName}"`;
}

exports.downloadFile = async (req, res) => {
  try {
    const storagePath = String(req.query.storagePath || '').trim();
    if (!storagePath) {
      return res.status(400).json({ success: false, message: 'storagePath is required' });
    }

    const fileName = String(req.query.fileName || 'file').replace(/[\r\n"]/g, '_');
    const contentType = String(req.query.contentType || '').trim();
    const disposition = resolveContentDisposition(req, fileName);

    if (fileStorage.isOciStoragePath(storagePath)) {
      const key = storagePath.slice(fileStorage.OCI_PREFIX.length);
      if (req.user?.organizationId) {
        fileStorage.assertOrgAccessToKey(key, req.user.organizationId);
      }

      const { stream } = await objectStorage.getObjectStream({ key });
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', disposition);
      if (disposition.startsWith('inline')) {
        res.setHeader('Cache-Control', 'private, max-age=300');
      }
      return stream.pipe(res);
    }

    const localPath = fileStorage.resolveLegacyLocalPath(storagePath);
    if (!localPath) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', disposition);
    if (disposition.startsWith('inline')) {
      res.setHeader('Cache-Control', 'private, max-age=300');
    }
    return fs.createReadStream(localPath).pipe(res);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status !== 500) {
      return res.status(status).json({ success: false, message: error.message });
    }
    console.error('[fileDownloadController] downloadFile', error);
    return res.status(500).json({ success: false, message: 'Failed to download file' });
  }
};
