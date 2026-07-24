'use strict';

/**
 * Assign a module-numbered Record ID onto a mongoose document when empty.
 * @param {import('mongoose').Document} doc
 * @param {{ moduleKey: string, fieldKey: string, organizationId?: import('mongoose').Types.ObjectId|string }} opts
 */
async function assignModuleRecordNumber(doc, opts) {
  const fieldKey = opts.fieldKey;
  if (!doc || !fieldKey || doc[fieldKey]) return null;

  const organizationId = opts.organizationId || doc.organizationId;
  if (!organizationId) return null;

  const { allocate } = require('../services/moduleNumberingService');
  const result = await allocate({
    organizationId,
    moduleKey: opts.moduleKey,
  });
  if (result?.recordId) {
    doc[fieldKey] = result.recordId;
  }
  return result;
}

module.exports = {
  assignModuleRecordNumber,
};
