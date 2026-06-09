const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { uploadSingle, persistMulterUpload } = require('../middleware/uploadMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);
router.use(resolveAppContext); // After auth, resolve appKey from URL
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(lazySalesInitialization); // Lazy initialize CRM if needed
router.use(requireSalesApp); // Enforce CRM-only access

// @desc    Upload a file (image, document, etc.)
// @route   POST /api/upload
// @access  Private
router.post('/', uploadSingle('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const uploadResult = await persistMulterUpload(req, 'general');

        res.json({
            success: true,
            url: uploadResult.url,
            storagePath: uploadResult.storagePath,
            filename: uploadResult.storedFileName,
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading file',
            error: error.message
        });
    }
});

// @desc    Delete an inline upload from object storage
// @route   DELETE /api/upload
// @access  Private
router.delete('/', async (req, res) => {
    try {
        const fileStorage = require('../services/fileStorageService');
        const storagePath = fileStorage.resolveStoragePathFromClientRef(
            req.body?.storagePath || req.body?.url
        );

        if (!storagePath) {
            return res.status(400).json({
                success: false,
                message: 'storagePath or url is required'
            });
        }

        const result = await fileStorage.deleteStoredUpload({
            storagePath,
            organizationId: req.user?.organizationId
        });

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        const status = error.statusCode || 500;
        if (status !== 500) {
            return res.status(status).json({
                success: false,
                message: error.message
            });
        }
        console.error('Upload delete error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting file',
            error: error.message
        });
    }
});

module.exports = router;
