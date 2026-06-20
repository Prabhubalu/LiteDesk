/**
 * Helpers for description version history across modules.
 * - getRecordDescription: read description from a record (top-level or customFields)
 * - setRecordDescription: set description on a record doc (for restore)
 * - pushDescriptionVersion: append a version to RecordDescriptionVersion (for generic modules)
 */

const RecordDescriptionVersion = require('../models/RecordDescriptionVersion');

function buildVersionDocQuery(organizationId, moduleKey, recordId, contentField = 'description') {
  const key = (moduleKey || '').toLowerCase();
  const recordKey = String(recordId || '');
  if (contentField === 'description') {
    return {
      organizationId,
      moduleKey: key,
      recordId: recordKey,
      $or: [{ contentField: 'description' }, { contentField: { $exists: false } }]
    };
  }
  return {
    organizationId,
    moduleKey: key,
    recordId: recordKey,
    contentField
  };
}

/**
 * Get description from a record. Handles top-level description or customFields.description.
 * @param {Object} record - Mongoose doc or plain object
 * @returns {string}
 */
function getRecordDescription(record) {
  if (!record) return '';
  const top = record.description;
  if (typeof top === 'string') return top;
  const custom = record.customFields && record.customFields.description;
  if (typeof custom === 'string') return custom;
  return '';
}

/**
 * Set description on a record document. Uses top-level if model has schema.paths.description, else customFields.
 * @param {Object} doc - Mongoose document (will be modified)
 * @param {string} value - New description value
 * @param {Object} model - Mongoose model (to check schema paths)
 */
function setRecordDescription(doc, value, model) {
  const str = typeof value === 'string' ? value : '';
  if (model && model.schema && model.schema.paths && model.schema.paths.description) {
    doc.description = str;
  } else {
    if (!doc.customFields) doc.customFields = {};
    doc.customFields.description = str;
    doc.markModified('customFields');
  }
}

/**
 * Push a previous description as a new version for a generic module record.
 * Call this before updating the record's description.
 * @param {Object} params
 * @param {Object} params.organizationId - Organization id
 * @param {string} params.moduleKey - e.g. 'people', 'organizations'
 * @param {string} params.recordId - Record id
 * @param {string} params.previousContent - Previous description content
 * @param {Object} params.userId - User id (createdBy)
 * @param {string} [params.contentField='description'] - Field being versioned (e.g. richContent)
 */
async function pushDescriptionVersion({
  organizationId,
  moduleKey,
  recordId,
  previousContent,
  userId,
  contentField = 'description'
}) {
  if (typeof previousContent !== 'string') return;

  const RetentionDays = RecordDescriptionVersion.statics.RETENTION_DAYS || 365;
  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - RetentionDays);

  const key = (moduleKey || '').toLowerCase();
  const recordKey = String(recordId || '');
  const query = buildVersionDocQuery(organizationId, key, recordKey, contentField);
  const versionEntry = {
    content: previousContent,
    createdAt: new Date(),
    createdBy: userId
  };

  await RecordDescriptionVersion.findOneAndUpdate(
    query,
    {
      $push: { versions: versionEntry },
      $setOnInsert: {
        organizationId,
        moduleKey: key,
        recordId: recordKey,
        contentField
      }
    },
    { upsert: true }
  );

  await RecordDescriptionVersion.updateOne(query, {
    $pull: { versions: { createdAt: { $lt: retentionCutoff } } }
  });
}

async function listContentVersions({ organizationId, moduleKey, recordId, contentField = 'description' }) {
  const doc = await RecordDescriptionVersion.findOne(
    buildVersionDocQuery(organizationId, moduleKey, recordId, contentField)
  ).lean();
  return Array.isArray(doc?.versions) ? doc.versions : [];
}

async function restoreContentVersion({
  organizationId,
  moduleKey,
  recordId,
  contentField,
  versionIndex,
  userId,
  getCurrentContent,
  setCurrentContent
}) {
  const versions = (await listContentVersions({ organizationId, moduleKey, recordId, contentField }))
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const version = versions[versionIndex];
  if (!version) {
    throw new Error('Version not found');
  }

  const previousContent = getCurrentContent();
  await pushDescriptionVersion({
    organizationId,
    moduleKey,
    recordId,
    previousContent: typeof previousContent === 'string' ? previousContent : '',
    userId,
    contentField
  });

  setCurrentContent(version.content || '');
}

/**
 * Push previous description version only when description value actually changes.
 * @param {Object} params
 * @param {Object} params.organizationId
 * @param {string} params.moduleKey
 * @param {string} params.recordId
 * @param {Object} params.previousRecord - Existing record (plain object or doc)
 * @param {*} params.nextDescription - Incoming description value from request payload
 * @param {Object} params.userId
 * @returns {Promise<boolean>} true when a snapshot was pushed
 */
async function pushPreviousDescriptionVersionIfChanged({
  organizationId,
  moduleKey,
  recordId,
  previousRecord,
  nextDescription,
  userId
}) {
  const previousContent = getRecordDescription(previousRecord);
  const nextContent = nextDescription == null ? '' : String(nextDescription);
  if (previousContent === nextContent) return false;

  await pushDescriptionVersion({
    organizationId,
    moduleKey,
    recordId,
    previousContent,
    userId
  });
  return true;
}

module.exports = {
  getRecordDescription,
  setRecordDescription,
  pushDescriptionVersion,
  pushPreviousDescriptionVersionIfChanged,
  listContentVersions,
  restoreContentVersion,
  buildVersionDocQuery
};
