'use strict';

const multer = require('multer');

const ASSET_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

const FONT_MIMES = [
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
  'application/x-font-ttf',
  'application/x-font-opentype',
  'application/font-woff',
  'application/font-woff2',
  'application/octet-stream'
];

const MAX_ASSET_SIZE = parseInt(process.env.CONTENT_ASSET_MAX_BYTES || '5242880', 10);
const MAX_FONT_SIZE = parseInt(process.env.CONTENT_FONT_MAX_BYTES || '2097152', 10);

function wrapMulter(mw) {
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (!err) return next();

      const message = err.message || (err.code ? `Upload error (${err.code})` : 'Upload failed');
      const status = err.name === 'MulterError' || message.includes('not allowed') ? 400 : 500;

      return res.status(status).json({
        success: false,
        code: 'CONTENT_VALIDATION_FAILED',
        message: 'File upload failed.',
        details: [{ path: 'file', message }],
        traceId: null
      });
    });
  };
}

function createUpload({ allowedMimes, maxSize }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize },
    fileFilter: (_req, file, cb) => {
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  });
}

const assetUpload = createUpload({ allowedMimes: ASSET_MIMES, maxSize: MAX_ASSET_SIZE });
const fontUpload = createUpload({ allowedMimes: FONT_MIMES, maxSize: MAX_FONT_SIZE });

exports.uploadContentAsset = wrapMulter(assetUpload.single('file'));
exports.uploadContentFont = wrapMulter(fontUpload.single('file'));
