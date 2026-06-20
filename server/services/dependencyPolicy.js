/**
 * ============================================================================
 * PLATFORM CORE: Dependency Policy for Trash
 * ============================================================================
 *
 * Formal deletion policy layer. Returns structured dependency information
 * for move-to-trash operations. Modes:
 * - STRICT (default): Block if any active children exist
 * - CASCADE_ASK: Return dependencies, require explicit cascade confirmation
 * - CASCADE_AUTO: Trash children with parent (audit trail)
 *
 * See docs/TRASH_IMPLEMENTATION_SPEC.md
 * ============================================================================
 */

const { validateDelete, findActiveReferencesBulk } = require('./systemInvariants');

const MODULE_LABELS = {
  people: 'People',
  organizations: 'Organizations',
  deals: 'Deals',
  tasks: 'Tasks',
  events: 'Events',
  items: 'Items',
  cases: 'Cases',
  documents: 'Documents',
  responses: 'Form Responses'
};

/**
 * Validate move-to-trash. Returns structured dependency response.
 *
 * @param {Object} context
 * @param {string} context.moduleKey - Module key (people, organizations, deals, etc.)
 * @param {string|ObjectId} context.recordId - Record ID
 * @param {string|ObjectId} context.organizationId - Organization ID
 * @returns {Promise<{ blocked: boolean, dependencies: Array<{ module: string, moduleKey: string, count: number }>, message?: string }>}
 */
async function validateMoveToTrash(context) {
  const { moduleKey, recordId, organizationId } = context;

  try {
    const result = await validateDelete({
      moduleKey,
      recordId,
      organizationId
    });

    if (result.valid) {
      return {
        blocked: false,
        dependencies: []
      };
    }

    // Transform errors to structured dependencies
    const dependencies = (result.errors || []).map((err) => ({
      module: MODULE_LABELS[err.moduleKey] || err.moduleKey,
      moduleKey: err.moduleKey,
      count: err.count || (err.recordIds && err.recordIds.length) || 0
    }));

    return {
      blocked: true,
      dependencies,
      message: result.message
    };
  } catch (error) {
    console.error('[dependencyPolicy] validateMoveToTrash error:', error);
    return {
      blocked: false,
      dependencies: [],
      message: 'Dependency validation failed, proceeding'
    };
  }
}

/**
 * Batch validate move-to-trash for bulk delete (people/organizations).
 *
 * @returns {Promise<Map<string, { blocked: boolean, dependencies: Array, message: string }>>}
 */
async function validateMoveToTrashBulk(context) {
  const { moduleKey, recordIds, organizationId } = context;
  const blockedMap = new Map();

  if (moduleKey !== 'people' && moduleKey !== 'organizations') {
    return blockedMap;
  }

  const ids = [...new Set((recordIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!ids.length) {
    return blockedMap;
  }

  try {
    const referencesByRecord = await findActiveReferencesBulk(moduleKey, ids, organizationId);
    for (const [recordId, { errors, message }] of referencesByRecord) {
      blockedMap.set(recordId, {
        blocked: true,
        dependencies: (errors || []).map((err) => ({
          module: MODULE_LABELS[err.moduleKey] || err.moduleKey,
          moduleKey: err.moduleKey,
          count: err.count || (err.recordIds && err.recordIds.length) || 0
        })),
        message
      });
    }
    return blockedMap;
  } catch (error) {
    console.error('[dependencyPolicy] validateMoveToTrashBulk error:', error);
    return blockedMap;
  }
}

module.exports = {
  validateMoveToTrash,
  validateMoveToTrashBulk,
  MODULE_LABELS
};
