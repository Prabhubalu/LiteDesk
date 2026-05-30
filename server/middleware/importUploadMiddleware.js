const multer = require('multer');
const { IMPORT_MAX_FILE_BYTES } = require('../services/import/importConstants');

const csvMimeTypes = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

function csvFileFilter(req, file, cb) {
  const name = String(file.originalname || '').toLowerCase();
  const isCsvName = name.endsWith('.csv');
  const isCsvMime = csvMimeTypes.has(file.mimetype);
  if (isCsvName || isCsvMime) {
    cb(null, true);
    return;
  }
  cb(new Error('Only CSV files are allowed for import'), false);
}

const importUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: csvFileFilter,
  limits: {
    fileSize: IMPORT_MAX_FILE_BYTES,
  },
});

function wrapMulter(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();
      const status = err.name === 'MulterError' || err.message?.includes('CSV') ? 400 : 500;
      return res.status(status).json({
        success: false,
        code: err.code || 'IMPORT_UPLOAD_FAILED',
        message: err.message || 'CSV upload failed',
      });
    });
  };
}

module.exports = {
  importUploadSingle: wrapMulter(importUpload.single('file')),
  importUploadOptional: wrapMulter(importUpload.single('file')),
};
