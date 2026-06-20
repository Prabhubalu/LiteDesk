/**
 * Default document attachment relationships (record → documents).
 * Stable keys: deal_documents, people_documents, task_documents, etc.
 */

const DOCUMENT_ATTACHMENT_MODULES = [
  'people',
  'organizations',
  'deals',
  'tasks',
  'events',
  'forms',
  'cases',
  'quotes',
  'items'
];

const SOURCE_APP_BY_MODULE = {
  people: 'sales',
  organizations: 'sales',
  deals: 'sales',
  items: 'sales',
  tasks: 'platform',
  events: 'platform',
  forms: 'platform',
  quotes: 'platform',
  cases: 'helpdesk',
  documents: 'platform'
};

const MODULE_APP_FALLBACKS = {
  people: ['sales', 'platform'],
  organizations: ['sales', 'platform'],
  deals: ['sales', 'platform'],
  items: ['sales', 'platform'],
  cases: ['helpdesk', 'platform'],
  tasks: ['platform'],
  events: ['platform'],
  forms: ['platform'],
  quotes: ['platform'],
  documents: ['platform']
};

const RELATIONSHIP_KEY_BY_MODULE = {
  people: 'people_documents',
  organizations: 'organizations_documents',
  deals: 'deal_documents',
  tasks: 'task_documents',
  events: 'event_documents',
  forms: 'form_documents',
  cases: 'case_documents',
  quotes: 'quote_documents',
  items: 'item_documents'
};

const SOURCE_LABEL_BY_MODULE = {
  people: 'People',
  organizations: 'Organizations',
  deals: 'Deals',
  tasks: 'Tasks',
  events: 'Events',
  forms: 'Forms',
  cases: 'Cases',
  quotes: 'Quotes',
  items: 'Items'
};

const DEFAULT_DOCUMENT_RELATIONSHIPS = DOCUMENT_ATTACHMENT_MODULES.map((sourceModule) => ({
  relationshipKey: RELATIONSHIP_KEY_BY_MODULE[sourceModule],
  sourceModule,
  targetModule: 'documents',
  relationshipType: 'MANY_TO_MANY',
  userLinkable: true,
  display: {
    relatedSummary: false,
    relatedExplorer: false,
    linkRecord: true
  },
  isDefault: true,
  activateWhenModuleExists: true
}));

const DOCUMENT_RELATED_RELATIONSHIP_KEY = 'document_related_to';
const DOCUMENT_CHILD_RELATIONSHIP_KEY = 'document_child_documents';

const DOCUMENT_INVERSE_MODULE_RELATIONSHIPS = Object.freeze(
  Object.fromEntries(
    DOCUMENT_ATTACHMENT_MODULES.map((sourceModule) => [
      sourceModule,
      {
        name: 'Related Documents',
        type: 'many_to_many',
        isLookup: false,
        targetModuleKey: 'documents',
        relationshipKey: RELATIONSHIP_KEY_BY_MODULE[sourceModule]
      }
    ])
  )
);

const ALL_DOCUMENT_RELATIONSHIP_KEYS = new Set([
  ...Object.values(RELATIONSHIP_KEY_BY_MODULE),
  DOCUMENT_RELATED_RELATIONSHIP_KEY,
  DOCUMENT_CHILD_RELATIONSHIP_KEY
].map((key) => String(key).toLowerCase()));

function cloneDocumentInverseRelationship(moduleKey) {
  const entry = DOCUMENT_INVERSE_MODULE_RELATIONSHIPS[String(moduleKey || '').toLowerCase()];
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
}

function isDocumentRelationshipKey(key) {
  return ALL_DOCUMENT_RELATIONSHIP_KEYS.has(String(key || '').trim().toLowerCase());
}

function buildAttachmentRelationshipDefinition(defaultRel) {
  const sourceModuleKey = defaultRel.sourceModule.toLowerCase();
  const sourceAppKey = SOURCE_APP_BY_MODULE[sourceModuleKey] || 'platform';
  const sourceLabel = SOURCE_LABEL_BY_MODULE[sourceModuleKey] || sourceModuleKey;

  return {
    relationshipKey: defaultRel.relationshipKey.toLowerCase(),
    source: {
      appKey: sourceAppKey,
      moduleKey: sourceModuleKey
    },
    target: {
      appKey: 'platform',
      moduleKey: 'documents'
    },
    cardinality: defaultRel.relationshipType,
    relationshipType: defaultRel.relationshipType,
    ownership: 'SOURCE',
    required: false,
    userLinkable: !!defaultRel.userLinkable,
    display: defaultRel.display || {},
    isDefault: !!defaultRel.isDefault,
    activateWhenModuleExists: !!defaultRel.activateWhenModuleExists,
    ui: {
      source: {
        showAs: 'TAB',
        label: 'Related Documents'
      },
      target: {
        showAs: 'TAB',
        label: sourceLabel
      },
      picker: {
        enabled: true,
        searchable: true
      }
    },
    automation: {
      allowed: true
    },
    cascade: {
      onDelete: 'DETACH'
    },
    enabled: true
  };
}

const PLATFORM_DOCUMENT_RELATED_RELATIONSHIP_DEFINITION = {
  relationshipKey: DOCUMENT_RELATED_RELATIONSHIP_KEY,
  source: {
    appKey: 'platform',
    moduleKey: 'documents'
  },
  target: {
    appKey: 'platform',
    moduleKey: 'documents'
  },
  cardinality: 'MANY_TO_MANY',
  relationshipType: 'MANY_TO_MANY',
  ownership: 'SOURCE',
  required: false,
  userLinkable: true,
  display: {
    relatedSummary: false,
    relatedExplorer: true,
    linkRecord: true
  },
  isDefault: true,
  activateWhenModuleExists: true,
  ui: {
    source: {
      showAs: 'TAB',
      label: 'Related Documents'
    },
    target: {
      showAs: 'TAB',
      label: 'Related Documents'
    },
    picker: {
      enabled: true,
      searchable: true
    }
  },
  automation: {
    allowed: true
  },
  cascade: {
    onDelete: 'DETACH'
  },
  enabled: true
};

const PLATFORM_DOCUMENT_CHILD_RELATIONSHIP_DEFINITION = {
  relationshipKey: DOCUMENT_CHILD_RELATIONSHIP_KEY,
  source: {
    appKey: 'platform',
    moduleKey: 'documents'
  },
  target: {
    appKey: 'platform',
    moduleKey: 'documents'
  },
  cardinality: 'ONE_TO_MANY',
  relationshipType: 'ONE_TO_MANY',
  ownership: 'SOURCE',
  required: false,
  userLinkable: true,
  display: {
    relatedSummary: false,
    relatedExplorer: true,
    linkRecord: true
  },
  isDefault: true,
  activateWhenModuleExists: true,
  constraints: {
    preventCircular: true,
    maxDepth: null
  },
  ui: {
    source: {
      showAs: 'TAB',
      label: 'Child Documents'
    },
    target: {
      showAs: 'TAB',
      label: 'Parent Document'
    },
    picker: {
      enabled: true,
      searchable: true
    }
  },
  automation: {
    allowed: true
  },
  cascade: {
    onDelete: 'DETACH'
  },
  enabled: true
};

const PLATFORM_DOCUMENT_RELATIONSHIP_DEFINITIONS = [
  ...DEFAULT_DOCUMENT_RELATIONSHIPS.map(buildAttachmentRelationshipDefinition),
  PLATFORM_DOCUMENT_RELATED_RELATIONSHIP_DEFINITION,
  PLATFORM_DOCUMENT_CHILD_RELATIONSHIP_DEFINITION
];

/**
 * Idempotent: upsert platform document RelationshipDefinition rows.
 */
async function ensureDocumentRelationshipDefinitions() {
  const RelationshipDefinition = require('../models/RelationshipDefinition');

  let ensured = 0;
  for (const def of PLATFORM_DOCUMENT_RELATIONSHIP_DEFINITIONS) {
    const key = String(def.relationshipKey || '').toLowerCase();
    if (!key) continue;
    // eslint-disable-next-line no-await-in-loop
    await RelationshipDefinition.updateOne(
      { relationshipKey: key },
      {
        $set: {
          ...def,
          relationshipKey: key,
          enabled: true,
          status: 'ACTIVE'
        },
        $setOnInsert: {
          createdBy: 'system'
        }
      },
      { upsert: true }
    );
    ensured += 1;
  }

  return { ensured };
}

module.exports = {
  DOCUMENT_ATTACHMENT_MODULES,
  SOURCE_APP_BY_MODULE,
  MODULE_APP_FALLBACKS,
  RELATIONSHIP_KEY_BY_MODULE,
  SOURCE_LABEL_BY_MODULE,
  DEFAULT_DOCUMENT_RELATIONSHIPS,
  DOCUMENT_RELATED_RELATIONSHIP_KEY,
  DOCUMENT_CHILD_RELATIONSHIP_KEY,
  DOCUMENT_INVERSE_MODULE_RELATIONSHIPS,
  PLATFORM_DOCUMENT_RELATIONSHIP_DEFINITIONS,
  ALL_DOCUMENT_RELATIONSHIP_KEYS,
  cloneDocumentInverseRelationship,
  isDocumentRelationshipKey,
  ensureDocumentRelationshipDefinitions
};
