const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { optionalAuth } = require('../middleware/optionalAuthMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const filesController = require('../controllers/filesController');
const fileDownloadController = require('../controllers/fileDownloadController');

// OCI / legacy file download (public URL; optional auth enforces org scope for OCI keys)
router.get('/download', optionalAuth, fileDownloadController.downloadFile);

// Files endpoints (view and upload)
router.get('/:entityType/:entityId', protect, filesController.getEntityFiles);
router.post('/:entityType/:entityId', protect, uploadSingle('file'), filesController.uploadFile);

module.exports = router;

