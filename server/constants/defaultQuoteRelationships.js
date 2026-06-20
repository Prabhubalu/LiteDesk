/**
 * Bootstrap relationship defaults for platform.quotes.
 *
 * ModuleDefinition.relationships (Settings UI) reference stable relationshipKeys
 * defined in RelationshipDefinition (seeded via ensureQuoteRelationshipDefinitions).
 *
 * Aligns with Quote schema lookups: contactId, organizationRefId, dealId, caseId.
 */

const RelationshipDefinition = require('../models/RelationshipDefinition');

/** Platform RelationshipDefinition rows (source: platform.quotes). */
const PLATFORM_QUOTE_RELATIONSHIP_DEFINITIONS = [
  {
    relationshipKey: 'quote_people',
    source: { appKey: 'platform', moduleKey: 'quotes' },
    target: { appKey: 'sales', moduleKey: 'people' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Contact' },
      target: { showAs: 'TAB', label: 'Related Quotes' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'quote_organizations',
    source: { appKey: 'platform', moduleKey: 'quotes' },
    target: { appKey: 'sales', moduleKey: 'organizations' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Organization' },
      target: { showAs: 'TAB', label: 'Related Quotes' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'quote_deals',
    source: { appKey: 'platform', moduleKey: 'quotes' },
    target: { appKey: 'sales', moduleKey: 'deals' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Deal' },
      target: { showAs: 'TAB', label: 'Related Quotes' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  {
    relationshipKey: 'quote_cases',
    source: { appKey: 'platform', moduleKey: 'quotes' },
    target: { appKey: 'helpdesk', moduleKey: 'cases' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Case' },
      target: { showAs: 'TAB', label: 'Related Quotes' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  }
];

/** Default relationships on Quotes module (Settings → Relationships). */
const INITIAL_QUOTE_MODULE_RELATIONSHIPS = Object.freeze([
  {
    name: 'Related Contact',
    type: 'many_to_one',
    isLookup: true,
    targetModuleKey: 'people',
    relationshipKey: 'quote_people'
  },
  {
    name: 'Related Organization',
    type: 'many_to_one',
    isLookup: true,
    targetModuleKey: 'organizations',
    relationshipKey: 'quote_organizations'
  },
  {
    name: 'Related Deal',
    type: 'many_to_one',
    isLookup: true,
    targetModuleKey: 'deals',
    relationshipKey: 'quote_deals'
  },
  {
    name: 'Related Case',
    type: 'many_to_one',
    isLookup: true,
    targetModuleKey: 'cases',
    relationshipKey: 'quote_cases'
  },
  {
    name: 'Related Documents',
    type: 'many_to_many',
    isLookup: false,
    targetModuleKey: 'documents',
    relationshipKey: 'quote_documents'
  }
]);

/** Inverse entries for related modules (quote list tabs on their record pages). */
const QUOTE_INVERSE_MODULE_RELATIONSHIPS = Object.freeze({
  deals: {
    name: 'Related Quotes',
    type: 'one_to_many',
    isLookup: false,
    targetModuleKey: 'quotes',
    relationshipKey: 'quote_deals'
  },
  people: {
    name: 'Related Quotes',
    type: 'one_to_many',
    isLookup: false,
    targetModuleKey: 'quotes',
    relationshipKey: 'quote_people'
  },
  organizations: {
    name: 'Related Quotes',
    type: 'one_to_many',
    isLookup: false,
    targetModuleKey: 'quotes',
    relationshipKey: 'quote_organizations'
  },
  cases: {
    name: 'Related Quotes',
    type: 'one_to_many',
    isLookup: false,
    targetModuleKey: 'quotes',
    relationshipKey: 'quote_cases'
  }
});

function cloneQuoteDefaultRelationships() {
  return JSON.parse(JSON.stringify(INITIAL_QUOTE_MODULE_RELATIONSHIPS));
}

function cloneQuoteInverseRelationship(moduleKey) {
  const entry = QUOTE_INVERSE_MODULE_RELATIONSHIPS[String(moduleKey || '').toLowerCase()];
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
}

/**
 * Idempotent: create platform quote RelationshipDefinition rows when missing.
 */
async function ensureQuoteRelationshipDefinitions() {
  for (const def of PLATFORM_QUOTE_RELATIONSHIP_DEFINITIONS) {
    const key = String(def.relationshipKey || '').toLowerCase();
    if (!key) continue;
    // eslint-disable-next-line no-await-in-loop
    const exists = await RelationshipDefinition.exists({ relationshipKey: key });
    if (!exists) {
      // eslint-disable-next-line no-await-in-loop
      await RelationshipDefinition.create({ ...def, relationshipKey: key });
    }
  }
}

module.exports = {
  PLATFORM_QUOTE_RELATIONSHIP_DEFINITIONS,
  INITIAL_QUOTE_MODULE_RELATIONSHIPS,
  QUOTE_INVERSE_MODULE_RELATIONSHIPS,
  cloneQuoteDefaultRelationships,
  cloneQuoteInverseRelationship,
  ensureQuoteRelationshipDefinitions
};
