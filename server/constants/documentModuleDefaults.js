const {
  DOCUMENT_ATTACHMENT_MODULES,
  RELATIONSHIP_KEY_BY_MODULE,
  SOURCE_LABEL_BY_MODULE
} = require('./defaultDocumentRelationships');
const { DOCUMENT_TYPES, DOCUMENT_STATUSES } = require('../models/Document');

const INITIAL_DOCUMENT_QUICK_CREATE = [
  'title',
  'documentType',
  'folderId',
  'tags',
  'description'
];

const INITIAL_DOCUMENT_MODULE_RELATIONSHIPS = DOCUMENT_ATTACHMENT_MODULES.map((sourceModule) => ({
  name: `Related ${SOURCE_LABEL_BY_MODULE[sourceModule] || sourceModule}`,
  type: 'many_to_many',
  isLookup: false,
  targetModuleKey: sourceModule,
  relationshipKey: RELATIONSHIP_KEY_BY_MODULE[sourceModule]
}));

function cloneDocumentDefaultRelationships() {
  return JSON.parse(JSON.stringify(INITIAL_DOCUMENT_MODULE_RELATIONSHIPS));
}

function applyDocumentModuleFieldDefaults(fields) {
  if (!Array.isArray(fields)) return fields;
  return fields.map((field) => ({
    visible: true,
    editable: !field.system,
    ...field
  }));
}

const INITIAL_DOCUMENT_FIELDS = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'documentNumber', label: 'Document Number', type: 'text', system: true },
  { key: 'documentType', label: 'Document Type', type: 'select', options: DOCUMENT_TYPES },
  { key: 'status', label: 'Status', type: 'select', options: DOCUMENT_STATUSES.filter((s) => s !== 'deleted') },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'folderId', label: 'Folder', type: 'lookup', lookupModule: 'document_folders' },
  { key: 'tags', label: 'Tags', type: 'multi-select' },
  { key: 'ownerId', label: 'Owner', type: 'lookup', lookupModule: 'users', required: true },
  { key: 'versionNumber', label: 'Version', type: 'number', system: true },
  { key: 'fileType', label: 'File Type', type: 'text', system: true },
  { key: 'effectiveDate', label: 'Effective Date', type: 'date' },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
  { key: 'renewalDate', label: 'Renewal Date', type: 'date' },
  { key: 'retentionPolicy', label: 'Retention Policy', type: 'text' },
  { key: 'createdBy', label: 'Created By', type: 'lookup', lookupModule: 'users', system: true },
  { key: 'modifiedBy', label: 'Modified By', type: 'lookup', lookupModule: 'users', system: true }
];

module.exports = {
  INITIAL_DOCUMENT_QUICK_CREATE,
  INITIAL_DOCUMENT_MODULE_RELATIONSHIPS,
  INITIAL_DOCUMENT_FIELDS,
  cloneDocumentDefaultRelationships,
  applyDocumentModuleFieldDefaults
};
