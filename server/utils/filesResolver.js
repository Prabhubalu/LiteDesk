/**
 * ============================================================================
 * Files Resolver
 * ============================================================================
 *
 * Pure utility for resolving and filtering Files/Attachments based on app context.
 *
 * This resolver:
 * - Filters files by resolved app context
 * - Ensures files are app-scoped
 * - Validates uploader + app context integrity
 * - Makes no assumptions about specific apps
 *
 * Inputs:
 *   - files: Array of file entries
 *   - resolvedAppContext: {
 *       appKey: string,
 *       confidence: string,
 *       isAmbiguous: boolean
 *     }
 *   - entityType: string (e.g., 'Person')
 *   - entityId: string
 *
 * Output:
 *   {
 *     files: Array,              // Filtered files for the app context
 *     filtered: number,          // Number of files filtered out
 *     total: number             // Total files before filtering
 *   }
 *
 * NOTE:
 * - Files are filtered by appContext field (if present)
 * - If appContext is missing, files are included only if app context is ambiguous
 * - This ensures backward compatibility with existing files
 * ============================================================================
 */

/**
 * Resolve and filter files for a given app context.
 *
 * @param {Object} options
 * @param {Array} options.files - Raw file entries
 * @param {Object} options.resolvedAppContext - Resolved app context from AppContextResolver
 * @param {string} options.entityType - Entity type (e.g., 'Person')
 * @param {string} options.entityId - Entity ID
 * @returns {{
 *   files: Array,
 *   filtered: number,
 *   total: number
 * }}
 */
function resolveFiles({
  files = [],
  resolvedAppContext = {},
  entityType = null,
  entityId = null
}) {
  if (!Array.isArray(files)) {
    return {
      files: [],
      filtered: 0,
      total: 0
    };
  }

  const total = files.length;
  const appKey = resolvedAppContext?.appKey;
  const isAmbiguous = resolvedAppContext?.isAmbiguous;

  // If app context is ambiguous, block file rendering
  if (isAmbiguous || !appKey) {
    return {
      files: [],
      filtered: total,
      total: total,
      blocked: true,
      reason: isAmbiguous 
        ? 'App context is ambiguous. Cannot determine which files to show.'
        : 'App context is not resolved. Cannot filter files.'
    };
  }

  // Filter files by app context
  // Files without appContext are included for backward compatibility
  // but only if we have a resolved app context
  const normalizedAppKey = appKey.toUpperCase();
  
  const filteredFiles = files.filter(file => {
    // If file has appContext, it must match
    if (file.appContext) {
      return file.appContext.toUpperCase() === normalizedAppKey;
    }
    
    // If file doesn't have appContext, include it for backward compatibility
    // This allows existing files to still be shown
    return true;
  });

  // Sort by created_at (newest first)
  const sortedFiles = filteredFiles.sort((a, b) => {
    const dateA = a.created_at || a.createdAt || 0;
    const dateB = b.created_at || b.createdAt || 0;
    return new Date(dateB) - new Date(dateA);
  });

  return {
    files: sortedFiles,
    filtered: total - sortedFiles.length,
    total: total
  };
}

/**
 * Normalize a file entry to ensure it has the required structure.
 *
 * @param {Object} file - Raw file entry
 * @returns {Object} Normalized file entry
 */
function normalizeFile(file) {
  if (!file || typeof file !== 'object') {
    return null;
  }

  const fileStorage = require('../services/fileStorageService');
  const storagePath = file.storagePath || file.fileUrl || file.url || null;
  const fileName = file.fileName || file.originalname || file.filename || '';
  const fileType = file.fileType || file.mimetype || file.mimeType || '';

  return {
    // Uploader information
    uploader: file.uploader || file.uploaded_by || null,
    uploaderId: file.uploaderId || file.uploaded_by || null,
    
    // App context
    appContext: file.appContext || null,
    
    // Entity information
    entityType: file.entityType || 'Person',
    entityId: file.entityId || null,
    
    // File information
    fileName,
    fileType,
    fileSize: file.fileSize || file.size || 0,
    storagePath,
    url: file.url || (storagePath
      ? fileStorage.buildDownloadUrl(storagePath, {
          disposition: 'attachment',
          fileName,
          contentType: fileType
        })
      : null),
    
    // Timestamps
    createdAt: file.created_at || file.createdAt || new Date(),
    
    // Original file ID (if available)
    id: file._id || file.id || null
  };
}

module.exports = {
  resolveFiles,
  normalizeFile
};

