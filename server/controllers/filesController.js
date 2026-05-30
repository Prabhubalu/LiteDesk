/**
 * ============================================================================
 * Files Controller
 * ============================================================================
 *
 * Handles Files/Attachments-related API endpoints.
 * Files are app-aware, entity-attached, and immutable once uploaded.
 *
 * ============================================================================
 */

const { resolvePeopleAppContext } = require('../utils/peopleAppContextResolver');
const { resolveFiles, normalizeFile } = require('../utils/filesResolver');
const People = require('../models/People');
const PersonFileAttachment = require('../models/PersonFileAttachment');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { persistMulterUpload } = require('../middleware/uploadMiddleware');

/**
 * Get files for a specific entity (e.g., Person).
 * 
 * GET /api/files/:entityType/:entityId
 */
exports.getEntityFiles = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        message: 'Entity type and ID are required.'
      });
    }

    // Only support 'Person' entity type for now
    if (entityType.toLowerCase() !== 'person') {
      return res.status(400).json({
        success: false,
        message: `Entity type '${entityType}' is not supported. Only 'Person' is supported.`
      });
    }

    const person = await People.findOne({
      _id: entityId,
      organizationId: req.user.organizationId,
      deletedAt: null
    }).lean();

    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person not found.'
      });
    }

    // Get enabled apps for the organization
    let enabledApps = [];
    if (req.user?.organizationId) {
      const organization = await Organization.findById(req.user.organizationId).select('enabledApps').lean();
      if (organization?.enabledApps) {
        enabledApps = organization.enabledApps.map(app => {
          return typeof app === 'object' && app.appKey ? app.appKey : app;
        });
      }
    }

    // If no enabledApps found, fall back to user's allowedApps
    if (!enabledApps.length && req.user?.allowedApps) {
      enabledApps = Array.isArray(req.user.allowedApps) ? req.user.allowedApps : [];
    }

    // Build route info from request for app context resolution
    const fullPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
    const routePath = req.query.routePath || fullPath;
    
    const routeInfo = {
      path: routePath,
      name: req.query.routeName || null,
      params: { entityType, entityId },
      query: req.query,
      meta: {}
    };

    // Resolve app context
    const userAppAccess = req.user?.allowedApps || [];
    const appContextResult = resolvePeopleAppContext({
      routeInfo,
      navigationIntent: req.query.appKey ? { sourceAppKey: req.query.appKey } : null,
      enabledApps: enabledApps,
      userAppAccess: userAppAccess
    });

    // Get raw files from person record
    const rawFiles = person.attachments || person.files || [];

    // Resolve and filter files
    const filesResult = resolveFiles({
      files: rawFiles,
      resolvedAppContext: appContextResult,
      entityType: 'Person',
      entityId: entityId
    });

    // Normalize files and populate uploader information
    const normalizedFiles = [];
    for (const file of filesResult.files) {
      const normalized = normalizeFile(file);
      if (normalized && normalized.uploaderId) {
        // Populate uploader name
        const uploader = await User.findById(normalized.uploaderId).select('firstName lastName username').lean();
        if (uploader) {
          normalized.uploaderName = uploader.firstName || uploader.lastName 
            ? `${uploader.firstName || ''} ${uploader.lastName || ''}`.trim() 
            : uploader.username || 'User';
        } else {
          normalized.uploaderName = 'User';
        }
      } else if (normalized) {
        normalized.uploaderName = 'User';
      }
      if (normalized) {
        normalizedFiles.push(normalized);
      }
    }

    res.json({
      success: true,
      data: {
        files: normalizedFiles,
        appContext: appContextResult,
        stats: {
          total: filesResult.total,
          filtered: filesResult.filtered,
          shown: normalizedFiles.length
        },
        blocked: filesResult.blocked || false,
        reason: filesResult.reason || null
      }
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching files',
      error: error.message
    });
  }
};

/**
 * Upload a new file for a specific entity.
 * 
 * POST /api/files/:entityType/:entityId
 * Requires: multipart/form-data with 'file' field
 */
exports.uploadFile = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        message: 'Entity type and ID are required.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required.'
      });
    }

    // Only support 'Person' entity type for now
    if (entityType.toLowerCase() !== 'person') {
      return res.status(400).json({
        success: false,
        message: `Entity type '${entityType}' is not supported. Only 'Person' is supported.`
      });
    }

    const personExists = await People.exists({
      _id: entityId,
      organizationId: req.user.organizationId,
      deletedAt: null
    });

    if (!personExists) {
      return res.status(404).json({
        success: false,
        message: 'Person not found.'
      });
    }

    // Get enabled apps for the organization
    let enabledApps = [];
    if (req.user?.organizationId) {
      const organization = await Organization.findById(req.user.organizationId).select('enabledApps').lean();
      if (organization?.enabledApps) {
        enabledApps = organization.enabledApps.map(app => {
          return typeof app === 'object' && app.appKey ? app.appKey : app;
        });
      }
    }

    // If no enabledApps found, fall back to user's allowedApps
    if (!enabledApps.length && req.user?.allowedApps) {
      enabledApps = Array.isArray(req.user.allowedApps) ? req.user.allowedApps : [];
    }

    // Build route info from request for app context resolution
    const fullPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
    const routePath = req.query.routePath || fullPath;
    
    const routeInfo = {
      path: routePath,
      name: req.query.routeName || null,
      params: { entityType, entityId },
      query: req.query,
      meta: {}
    };

    // Resolve app context
    const userAppAccess = req.user?.allowedApps || [];
    const appContextResult = resolvePeopleAppContext({
      routeInfo,
      navigationIntent: req.query.appKey ? { sourceAppKey: req.query.appKey } : null,
      enabledApps: enabledApps,
      userAppAccess: userAppAccess
    });

    // Block file upload if app context is ambiguous
    if (appContextResult.isAmbiguous || !appContextResult.appKey) {
      return res.status(400).json({
        success: false,
        message: appContextResult.isAmbiguous 
          ? 'App context is ambiguous. Cannot upload file without explicit app context.'
          : 'App context is not resolved. Cannot upload file.',
        code: 'AMBIGUOUS_APP_CONTEXT'
      });
    }

    // Get user information for uploader
    const user = await User.findById(req.user._id).select('firstName lastName username');
    const userName = user ? (user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.username) || 'User' : 'System';

    const uploadResult = await persistMulterUpload(req, 'files');

    const doc = await PersonFileAttachment.create({
      organizationId: req.user.organizationId,
      personId: entityId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      storagePath: uploadResult.storagePath,
      uploaded_by: req.user._id,
      created_at: new Date(),
      appContext: appContextResult.appKey
    });

    await People.updateOne(
      { _id: entityId, organizationId: req.user.organizationId, deletedAt: null },
      {
        $push: {
          activityLogs: {
            user: userName,
            userId: req.user._id,
            action: 'uploaded a file',
            details: {
              appKey: appContextResult.appKey,
              fileName: req.file.originalname,
              fileSize: req.file.size,
              fileType: req.file.mimetype
            },
            appContext: appContextResult.appKey,
            timestamp: new Date()
          }
        }
      }
    );

    const newFile = doc.toObject ? doc.toObject() : doc;
    const normalizedFile = normalizeFile(newFile);
    if (normalizedFile) {
      normalizedFile.uploaderName = userName;
      normalizedFile.id = doc._id || null;
    }

    res.json({
      success: true,
      message: 'File uploaded successfully.',
      data: normalizedFile
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    if (error.name === 'ValidationError') {
      const errors = {};
      for (const field in error.errors) {
        errors[field] = error.errors[field].message;
      }
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message
    });
  }
};

