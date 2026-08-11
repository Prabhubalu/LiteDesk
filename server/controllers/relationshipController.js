/**
 * ============================================================================
 * PLATFORM CORE: Relationship Controller
 * ============================================================================
 *
 * Implementation decision - relationships:
 *
 * - RelationshipDefinition: platform canonical schema. Only created/updated by
 *   system seeds, migrations, or platform-level modules (organizationId: null).
 *   Tenant settings must NOT create or modify RelationshipDefinition.
 *
 * - ModuleDefinition.relationships: tenant configuration only (enable/disable,
 *   labels, display options). Tenant edits in Settings → Relationships update
 *   only this; they do not write to RelationshipDefinition.
 *
 * - Link API: validates relationshipKey against RelationshipDefinition only.
 *   If the relationship does not exist there, linking is not allowed until it
 *   is defined at platform level (seed/migration).
 *
 * - Use stable relationshipKeys (e.g. deal_events, deal_contacts, task_events).
 * ============================================================================
 */

const RelationshipInstance = require('../models/RelationshipInstance');
const RelationshipDefinition = require('../models/RelationshipDefinition');
const TenantRelationshipConfiguration = require('../models/TenantRelationshipConfiguration');
const Task = require('../models/Task');
const Deal = require('../models/Deal');
const Event = require('../models/Event');
const Form = require('../models/Form');
const People = require('../models/People');
const Organization = require('../models/Organization');
const { validateCardinality } = require('../services/relationshipEnforcement');
const mongoose = require('mongoose');
const { getRecordContextForUI } = require('../services/recordContextService');
const ModuleDefinition = require('../models/ModuleDefinition');
const relationshipRegistry = require('../utils/relationshipRegistry');
const { getRelationshipsForModule } = require('../utils/relationshipRegistry');
const { getEffectiveRelationships } = require('../utils/tenantMetadata');

// Map targetModuleKey → appKey for link API (used when building linkable from Settings relationships)
const TARGET_APP_BY_MODULE_KEY = {
  organizations: 'sales',
  people: 'sales',
  deals: 'sales',
  tasks: 'platform',
  events: 'platform',
  forms: 'platform',
  projects: 'projects',
  cases: 'helpdesk',
  documents: 'platform',
  items: 'platform',
  quotes: 'platform'
};

function toRelationshipConfigTargetKey(r) {
  const raw = r?.targetModuleKey ?? r?.targetModule;
  if (raw == null) return '';
  if (typeof raw === 'object') return String(raw.key ?? raw.moduleKey ?? '').toLowerCase().trim();
  return String(raw).toLowerCase().trim();
}

function isConfigRelationshipLinkable(r) {
  if (r?.userLinkable === false) return false;
  if (r?.display && r.display.linkRecord === false) return false;
  return true;
}

function isRegistryRelationshipLinkable(def) {
  if (!def) return false;
  if (def.userLinkable === false) return false;
  if (def.display && def.display.linkRecord === false) return false;
  return true;
}

function buildLinkableEntryFromRegistry({
  relationshipKey,
  registryDef,
  normalizedAppKey,
  normalizedModuleKey,
  labelOverride
}) {
  const relKey = String(relationshipKey || '').trim().toLowerCase();
  if (!relKey || !registryDef) return null;

  const sourceIsCurrent =
    String(registryDef.source?.appKey || '').toLowerCase() === normalizedAppKey &&
    String(registryDef.source?.moduleKey || '').toLowerCase() === normalizedModuleKey;

  const linkedModuleKey = sourceIsCurrent
    ? String(registryDef.target?.moduleKey || '').toLowerCase().trim()
    : String(registryDef.source?.moduleKey || '').toLowerCase().trim();
  if (!linkedModuleKey) return null;

  const linkedModuleAppKey = sourceIsCurrent
    ? String(registryDef.target?.appKey || TARGET_APP_BY_MODULE_KEY[linkedModuleKey] || 'platform').toUpperCase()
    : String(registryDef.source?.appKey || TARGET_APP_BY_MODULE_KEY[linkedModuleKey] || 'platform').toUpperCase();

  const defaultLabel = linkedModuleKey.charAt(0).toUpperCase() + linkedModuleKey.slice(1);
  const label = String(labelOverride || '').trim() || defaultLabel;

  return {
    key: linkedModuleKey,
    label,
    relationshipKey: relKey,
    targetAppKey: linkedModuleAppKey,
    sourceIsCurrent
  };
}

function mergeLinkableByRelationshipKey(existing, additions) {
  const byKey = new Map();
  for (const item of existing || []) {
    if (item?.relationshipKey) byKey.set(String(item.relationshipKey).toLowerCase(), item);
  }
  for (const item of additions || []) {
    if (!item?.relationshipKey) continue;
    const relKey = String(item.relationshipKey).toLowerCase();
    const prev = byKey.get(relKey);
    byKey.set(relKey, prev ? { ...item, label: prev.label || item.label } : item);
  }
  return Array.from(byKey.values());
}

function buildRegistryLinkableTargets(outgoing, incoming, normalizedAppKey, normalizedModuleKey) {
  const items = [];

  for (const def of outgoing || []) {
    const relKey = String(def?.relationshipKey || '').trim().toLowerCase();
    if (!relKey || !relationshipRegistry.has(relKey) || !isRegistryRelationshipLinkable(def)) continue;
    const entry = buildLinkableEntryFromRegistry({
      relationshipKey: relKey,
      registryDef: relationshipRegistry.get(relKey),
      normalizedAppKey,
      normalizedModuleKey,
      labelOverride: def?.ui?.source?.label
    });
    if (entry) items.push(entry);
  }

  for (const def of incoming || []) {
    const relKey = String(def?.relationshipKey || '').trim().toLowerCase();
    if (!relKey || !relationshipRegistry.has(relKey)) continue;
    const fullDef = relationshipRegistry.get(relKey);
    if (!fullDef) continue;
    const entry = buildLinkableEntryFromRegistry({
      relationshipKey: relKey,
      registryDef: fullDef,
      normalizedAppKey,
      normalizedModuleKey,
      labelOverride: def?.ui?.target?.label
    });
    if (entry) items.push(entry);
  }

  return items;
}

function supplementLinkableFromConfiguredRelationships(
  linkable,
  relationships,
  normalizedAppKey,
  normalizedModuleKey
) {
  const additions = [];
  const presentKeys = new Set(
    (linkable || []).map((item) => String(item?.relationshipKey || '').toLowerCase()).filter(Boolean)
  );

  for (const r of relationships || []) {
    if (!isConfigRelationshipLinkable(r)) continue;
    const relKey = String(r.relationshipKey || '').trim().toLowerCase();
    if (!relKey || presentKeys.has(relKey) || !relationshipRegistry.has(relKey)) continue;

    const label = (r.label || r.name || '').toString().trim();
    const entry = buildLinkableEntryFromRegistry({
      relationshipKey: relKey,
      registryDef: relationshipRegistry.get(relKey),
      normalizedAppKey,
      normalizedModuleKey,
      labelOverride: label
    });
    if (entry) {
      additions.push(entry);
      presentKeys.add(relKey);
    }
  }

  return mergeLinkableByRelationshipKey(linkable, additions);
}

function findModuleDefsForConfigTarget(moduleDefs, targetKey, normalizedAppKey, normalizedModuleKey) {
  const normalizedTarget = String(targetKey || '').toLowerCase().trim();
  if (!normalizedTarget) return [];

  return (moduleDefs || []).filter((def) => {
    if (!def?.relationshipKey || !isRegistryRelationshipLinkable(def)) return false;
    const relKey = String(def.relationshipKey).toLowerCase();
    const reg = relationshipRegistry.get(relKey);
    if (!reg) return false;
    const sourceIsCurrent =
      reg.source.appKey === normalizedAppKey &&
      reg.source.moduleKey === normalizedModuleKey;
    const linkedKey = sourceIsCurrent ? reg.target.moduleKey : reg.source.moduleKey;
    return linkedKey === normalizedTarget;
  });
}

function resolveRelationshipKeysOnConfig(configRows, moduleDefs, normalizedAppKey, normalizedModuleKey) {
  for (const row of configRows || []) {
    if (!row || typeof row !== 'object') continue;
    const existingKey = String(row.relationshipKey || '').trim();
    if (existingKey && relationshipRegistry.has(existingKey)) continue;

    const targetKey = toRelationshipConfigTargetKey(row);
    if (!targetKey) continue;

    const matches = findModuleDefsForConfigTarget(
      moduleDefs,
      targetKey,
      normalizedAppKey,
      normalizedModuleKey
    );
    if (matches.length === 1) {
      row.relationshipKey = matches[0].relationshipKey;
      continue;
    }
    if (matches.length > 1 && existingKey) {
      const keyed = matches.find(
        (def) => String(def.relationshipKey || '').toLowerCase() === existingKey.toLowerCase()
      );
      if (keyed) row.relationshipKey = keyed.relationshipKey;
    }
  }
}

function buildLinkableFromModuleDefs(moduleDefs, normalizedAppKey, normalizedModuleKey) {
  const items = [];
  const seen = new Set();

  for (const def of moduleDefs || []) {
    const relKey = String(def?.relationshipKey || '').trim().toLowerCase();
    if (!relKey || seen.has(relKey) || !relationshipRegistry.has(relKey)) continue;
    if (!isRegistryRelationshipLinkable(def)) continue;

    const registryDef = relationshipRegistry.get(relKey);
    if (!registryDef) continue;

    const sourceIsCurrent =
      registryDef.source.appKey === normalizedAppKey &&
      registryDef.source.moduleKey === normalizedModuleKey;
    const labelOverride = sourceIsCurrent ? def?.ui?.source?.label : def?.ui?.target?.label;

    const entry = buildLinkableEntryFromRegistry({
      relationshipKey: relKey,
      registryDef,
      normalizedAppKey,
      normalizedModuleKey,
      labelOverride
    });
    if (entry) {
      items.push(entry);
      seen.add(relKey);
    }
  }

  return items;
}

function applyConfigFilterAndLabels(
  linkable,
  configRows,
  moduleDefs,
  normalizedAppKey,
  normalizedModuleKey,
  { usedTenantModule }
) {
  const rows = Array.isArray(configRows) ? configRows : [];

  // Tenant explicitly cleared relationships in Settings — hide all link targets.
  if (usedTenantModule && rows.length === 0) {
    return [];
  }

  const labelByKey = new Map();
  const disabledKeys = new Set();

  for (const row of rows) {
    let relKey = String(row.relationshipKey || '').trim().toLowerCase();
    if (!relKey || !relationshipRegistry.has(relKey)) {
      const targetKey = toRelationshipConfigTargetKey(row);
      const matches = findModuleDefsForConfigTarget(
        moduleDefs,
        targetKey,
        normalizedAppKey,
        normalizedModuleKey
      );
      if (matches.length === 1) {
        relKey = String(matches[0].relationshipKey).toLowerCase();
      }
    }
    if (!relKey) continue;

    if (!isConfigRelationshipLinkable(row)) {
      disabledKeys.add(relKey);
      continue;
    }
    const label = String(row.label || row.name || '').trim();
    if (label) labelByKey.set(relKey, label);
  }

  // Registry-first: show all platform linkables unless explicitly disabled in tenant config.
  // Tenant config supplies labels and opt-outs only (matches record-context related groups).
  return (linkable || [])
    .filter((item) => !disabledKeys.has(String(item.relationshipKey || '').toLowerCase()))
    .map((item) => {
      const relKey = String(item.relationshipKey || '').toLowerCase();
      return {
        ...item,
        label: labelByKey.get(relKey) || item.label
      };
    });
}

async function findModuleDefinitionForLinkable(organizationId, normalizedAppKey, normalizedModuleKey) {
  if (organizationId) {
    const tenantMod = await ModuleDefinition.findOne({
      organizationId,
      $or: [{ key: normalizedModuleKey }, { moduleKey: normalizedModuleKey }]
    })
      .select('relationships key moduleKey organizationId')
      .lean();
    if (tenantMod) return tenantMod;
  }

  return ModuleDefinition.findOne({
    appKey: normalizedAppKey,
    $or: [{ key: normalizedModuleKey }, { moduleKey: normalizedModuleKey }],
    $and: [
      {
        $or: [
          { organizationId: null },
          { organizationId: { $exists: false } }
        ]
      }
    ]
  })
    .select('relationships key moduleKey organizationId')
    .lean();
}

function buildLinkableFromEffectiveRelationship(rel, normalizedAppKey, normalizedModuleKey, labelOverride) {
  const relKey = String(rel?.relationshipKey || '').trim().toLowerCase();
  if (!relKey) return null;

  const isSource =
    String(rel.source?.appKey || '').toLowerCase() === normalizedAppKey &&
    String(rel.source?.moduleKey || '').toLowerCase() === normalizedModuleKey;

  const linkedModuleKey = isSource
    ? String(rel.target?.moduleKey || '').toLowerCase().trim()
    : String(rel.source?.moduleKey || '').toLowerCase().trim();
  if (!linkedModuleKey) return null;

  const linkedModuleAppKey = isSource
    ? String(rel.target?.appKey || TARGET_APP_BY_MODULE_KEY[linkedModuleKey] || 'platform').toUpperCase()
    : String(rel.source?.appKey || TARGET_APP_BY_MODULE_KEY[linkedModuleKey] || 'platform').toUpperCase();

  const defaultLabel = linkedModuleKey.charAt(0).toUpperCase() + linkedModuleKey.slice(1);
  const label = String(labelOverride || '').trim() || defaultLabel;

  return {
    key: linkedModuleKey,
    label,
    relationshipKey: relKey,
    targetAppKey: linkedModuleAppKey,
    sourceIsCurrent: isSource
  };
}

function buildLinkableFromEffectiveRelationships(
  effectiveRelationships,
  configRows,
  normalizedAppKey,
  normalizedModuleKey,
  { usedTenantModule }
) {
  const rows = Array.isArray(configRows) ? configRows : [];

  if (usedTenantModule && rows.length === 0) {
    return [];
  }

  const disabledKeys = new Set();
  const labelByKey = new Map();

  for (const row of rows) {
    let relKey = String(row.relationshipKey || '').trim().toLowerCase();
    if (!relKey) {
      const targetKey = toRelationshipConfigTargetKey(row);
      if (targetKey) {
        const match = (effectiveRelationships || []).find((rel) => {
          const isSource =
            String(rel.source?.appKey || '').toLowerCase() === normalizedAppKey &&
            String(rel.source?.moduleKey || '').toLowerCase() === normalizedModuleKey;
          const linkedKey = isSource ? rel.target?.moduleKey : rel.source?.moduleKey;
          return String(linkedKey || '').toLowerCase() === targetKey;
        });
        if (match) relKey = String(match.relationshipKey || '').toLowerCase();
      }
    }
    if (!relKey) continue;
    if (!isConfigRelationshipLinkable(row)) {
      disabledKeys.add(relKey);
      continue;
    }
    const label = String(row.label || row.name || '').trim();
    if (label) labelByKey.set(relKey, label);
  }

  const linkable = [];
  const seen = new Set();

  for (const rel of effectiveRelationships || []) {
    const relKey = String(rel.relationshipKey || '').trim().toLowerCase();
    if (!relKey || seen.has(relKey)) continue;
    if (disabledKeys.has(relKey)) continue;
    if (rel.userLinkable === false) continue;
    if (rel.display && rel.display.linkRecord === false) continue;

    const isSource =
      String(rel.source?.appKey || '').toLowerCase() === normalizedAppKey &&
      String(rel.source?.moduleKey || '').toLowerCase() === normalizedModuleKey;
    const defaultLabel = isSource ? rel.ui?.source?.label : rel.ui?.target?.label;

    const entry = buildLinkableFromEffectiveRelationship(
      rel,
      normalizedAppKey,
      normalizedModuleKey,
      labelByKey.get(relKey) || defaultLabel
    );
    if (entry) {
      linkable.push(entry);
      seen.add(relKey);
    }
  }

  return linkable;
}

function mergeMissingPlatformRelationships(tenantRelationships, platformRelationships) {
  const merged = (tenantRelationships || []).map((row) => ({ ...row }));
  const presentKeys = new Set(
    merged.map((row) => String(row.relationshipKey || '').toLowerCase()).filter(Boolean)
  );
  const presentTargets = new Set(
    merged.map((row) => toRelationshipConfigTargetKey(row)).filter(Boolean)
  );

  for (const row of platformRelationships || []) {
    if (!isConfigRelationshipLinkable(row)) continue;
    const key = String(row.relationshipKey || '').toLowerCase();
    const target = toRelationshipConfigTargetKey(row);
    if (key && presentKeys.has(key)) continue;
    if (target && presentTargets.has(target)) continue;
    merged.push({ ...row });
    if (key) presentKeys.add(key);
    if (target) presentTargets.add(target);
  }

  return merged;
}

const EVENTS_LINKABLE_DEFAULT_RELATIONSHIPS = Object.freeze([
  { name: 'Related Deal', type: 'many_to_one', isLookup: true, targetModuleKey: 'deals', relationshipKey: 'deal_events' },
  { name: 'Related Contacts', type: 'many_to_many', isLookup: false, targetModuleKey: 'people', relationshipKey: 'people_events' },
  { name: 'Related Tasks', type: 'many_to_many', isLookup: false, targetModuleKey: 'tasks', relationshipKey: 'task_events' }
]);

function cloneEventsLinkableDefaultRelationships() {
  return JSON.parse(JSON.stringify(EVENTS_LINKABLE_DEFAULT_RELATIONSHIPS));
}

const CASES_LINKABLE_DEFAULT_RELATIONSHIPS = Object.freeze([
  { name: 'Related Contact', type: 'many_to_one', isLookup: true, targetModuleKey: 'people', relationshipKey: 'case_people' },
  { name: 'Related Organization', type: 'many_to_one', isLookup: true, targetModuleKey: 'organizations', relationshipKey: 'case_organizations' },
  { name: 'Related Tasks', type: 'many_to_many', isLookup: false, targetModuleKey: 'tasks', relationshipKey: 'task_cases' }
]);

function cloneCasesLinkableDefaultRelationships() {
  return JSON.parse(JSON.stringify(CASES_LINKABLE_DEFAULT_RELATIONSHIPS));
}

const QUOTES_LINKABLE_DEFAULT_RELATIONSHIPS = Object.freeze([
  { name: 'Related Contact', type: 'many_to_one', isLookup: true, targetModuleKey: 'people', relationshipKey: 'quote_people' },
  { name: 'Related Organization', type: 'many_to_one', isLookup: true, targetModuleKey: 'organizations', relationshipKey: 'quote_organizations' },
  { name: 'Related Deal', type: 'many_to_one', isLookup: true, targetModuleKey: 'deals', relationshipKey: 'quote_deals' },
  { name: 'Related Case', type: 'many_to_one', isLookup: true, targetModuleKey: 'cases', relationshipKey: 'quote_cases' }
]);

function cloneQuotesLinkableDefaultRelationships() {
  return JSON.parse(JSON.stringify(QUOTES_LINKABLE_DEFAULT_RELATIONSHIPS));
}

const ITEMS_LINKABLE_DEFAULT_RELATIONSHIPS = Object.freeze([
  { name: 'Vendor', type: 'many_to_one', isLookup: true, targetModuleKey: 'organizations', relationshipKey: 'item_vendor' },
  { name: 'Linked Deals', type: 'many_to_many', isLookup: false, targetModuleKey: 'deals', relationshipKey: 'item_deals' },
  { name: 'Linked Contacts', type: 'many_to_many', isLookup: false, targetModuleKey: 'people', relationshipKey: 'item_people' },
  { name: 'Linked Forms', type: 'many_to_many', isLookup: false, targetModuleKey: 'forms', relationshipKey: 'item_forms' }
]);

function cloneItemsLinkableDefaultRelationships() {
  return JSON.parse(JSON.stringify(ITEMS_LINKABLE_DEFAULT_RELATIONSHIPS));
}

const { ensureQuoteRelationshipDefinitions } = require('../constants/defaultQuoteRelationships');

async function ensureItemsRelationshipDefinitions() {
  // Create minimal RelationshipDefinition rows if missing, so Items can use Link Record drawer.
  // This is safe + idempotent; records are only created when absent.
  const defs = [
    {
      relationshipKey: 'item_vendor',
      source: { appKey: 'platform', moduleKey: 'items' },
      target: { appKey: 'sales', moduleKey: 'organizations' },
      cardinality: 'MANY_TO_ONE',
      ownership: 'TARGET',
      required: false,
      cascade: { onDelete: 'DETACH' },
      ui: {
        source: { showAs: 'TAB', label: 'Vendor' },
        target: { showAs: 'TAB', label: 'Items (as Vendor)' },
        picker: { enabled: true, searchable: true }
      },
      automation: { allowed: true },
      enabled: true
    },
    {
      relationshipKey: 'item_deals',
      source: { appKey: 'platform', moduleKey: 'items' },
      target: { appKey: 'sales', moduleKey: 'deals' },
      cardinality: 'MANY_TO_MANY',
      ownership: 'SOURCE',
      required: false,
      cascade: { onDelete: 'DETACH' },
      ui: {
        source: { showAs: 'TAB', label: 'Linked Deals' },
        target: { showAs: 'TAB', label: 'Linked Items' },
        picker: { enabled: true, searchable: true }
      },
      automation: { allowed: true },
      enabled: true
    },
    {
      relationshipKey: 'item_people',
      source: { appKey: 'platform', moduleKey: 'items' },
      target: { appKey: 'sales', moduleKey: 'people' },
      cardinality: 'MANY_TO_MANY',
      ownership: 'SOURCE',
      required: false,
      cascade: { onDelete: 'DETACH' },
      ui: {
        source: { showAs: 'TAB', label: 'Linked Contacts' },
        target: { showAs: 'TAB', label: 'Linked Items' },
        picker: { enabled: true, searchable: true }
      },
      automation: { allowed: true },
      enabled: true
    },
    {
      relationshipKey: 'item_forms',
      source: { appKey: 'platform', moduleKey: 'items' },
      target: { appKey: 'platform', moduleKey: 'forms' },
      cardinality: 'MANY_TO_MANY',
      ownership: 'SOURCE',
      required: false,
      cascade: { onDelete: 'DETACH' },
      ui: {
        source: { showAs: 'TAB', label: 'Linked Forms' },
        target: { showAs: 'TAB', label: 'Linked Items' },
        picker: { enabled: true, searchable: true }
      },
      automation: { allowed: true },
      enabled: true
    }
  ];

  for (const def of defs) {
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
  }
}

/**
 * Idempotent: upsert platform RelationshipDefinition rows touching the requested module.
 * Ensures linkable-targets works even when seedPlatformRelationships.js was never run.
 */
async function ensurePlatformRelationshipDefinitionsForModule(normalizedAppKey, normalizedModuleKey) {
  const { RELATIONSHIP_DEFINITIONS } = require('../scripts/seedPlatformRelationships');
  const defs = Array.isArray(RELATIONSHIP_DEFINITIONS) ? RELATIONSHIP_DEFINITIONS : [];
  const normApp = String(normalizedAppKey || '').toLowerCase();
  const normMod = String(normalizedModuleKey || '').toLowerCase();
  if (!normApp || !normMod) return;

  const relevant = defs.filter((def) => {
    const src = def?.source || {};
    const tgt = def?.target || {};
    const sourceMatches =
      String(src.appKey || '').toLowerCase() === normApp &&
      String(src.moduleKey || '').toLowerCase() === normMod;
    const targetMatches =
      String(tgt.appKey || '').toLowerCase() === normApp &&
      String(tgt.moduleKey || '').toLowerCase() === normMod;
    return sourceMatches || targetMatches;
  });

  for (const def of relevant) {
    const key = String(def.relationshipKey || '').toLowerCase();
    if (!key) continue;
    // eslint-disable-next-line no-await-in-loop
    await RelationshipDefinition.updateOne(
      { relationshipKey: key },
      {
        $set: {
          ...def,
          relationshipKey: key,
          enabled: def.enabled !== false
        },
        $setOnInsert: {
          createdBy: 'system'
        }
      },
      { upsert: true }
    );
  }
}

async function syncPeopleOrganizationLink({ organizationId, relationshipKey, source, target }) {
  if (relationshipKey !== 'people_organizations') return;
  if (!source?.recordId || !target?.recordId) return;

  await People.updateOne(
    {
      _id: source.recordId,
      organizationId
    },
    {
      $set: { organization: target.recordId }
    }
  );
}

async function syncPeopleOrganizationUnlink({ organizationId, relationshipKey, source, target }) {
  if (relationshipKey !== 'people_organizations') return;
  if (!source?.recordId || !target?.recordId) return;

  await People.updateOne(
    {
      _id: source.recordId,
      organizationId,
      organization: target.recordId
    },
    {
      $set: { organization: null }
    }
  );
}

/**
 * Get linkable target modules for a source module (for Link Record drawer).
 * Uses the same effective-relationship source as record context / Related Records.
 * Tenant ModuleDefinition.relationships supplies labels and explicit opt-outs only.
 * GET /api/relationships/linkable-targets?appKey=&moduleKey=
 */
exports.getLinkableTargets = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { appKey, moduleKey } = req.query;

    if (!appKey || !moduleKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required query parameters: appKey, moduleKey'
      });
    }

    const normalizedAppKey = String(appKey).toLowerCase();
    const normalizedModuleKey = String(moduleKey).toLowerCase();

    if (normalizedModuleKey === 'items') {
      await ensureItemsRelationshipDefinitions();
    }
    if (normalizedModuleKey === 'quotes') {
      await ensureQuoteRelationshipDefinitions();
    }
    if (normalizedModuleKey === 'documents') {
      const { ensureDocumentRelationshipDefinitions } = require('../constants/defaultDocumentRelationships');
      await ensureDocumentRelationshipDefinitions();
    }
    const { DOCUMENT_ATTACHMENT_MODULES } = require('../constants/defaultDocumentRelationships');
    if (DOCUMENT_ATTACHMENT_MODULES.includes(normalizedModuleKey)) {
      const { registerDefaultDocumentRelationships } = require('../services/documentRelationshipInitializer');
      await registerDefaultDocumentRelationships();
    }
    if (['people', 'deals', 'organizations'].includes(normalizedModuleKey)) {
      await ensureQuoteRelationshipDefinitions();
      const { ensureDocumentRelationshipDefinitions } = require('../constants/defaultDocumentRelationships');
      await ensureDocumentRelationshipDefinitions();
    }

    await ensurePlatformRelationshipDefinitionsForModule(normalizedAppKey, normalizedModuleKey);
    await relationshipRegistry.refreshRelationshipKeyCache();

    const mod = await findModuleDefinitionForLinkable(
      organizationId,
      normalizedAppKey,
      normalizedModuleKey
    );

    let relationships = Array.isArray(mod?.relationships) ? [...mod.relationships] : [];
    if (normalizedModuleKey === 'events' && relationships.length === 0) {
      relationships = cloneEventsLinkableDefaultRelationships();
    }
    if (normalizedModuleKey === 'cases' && relationships.length === 0) {
      relationships = cloneCasesLinkableDefaultRelationships();
    }
    if (normalizedModuleKey === 'items' && relationships.length === 0) {
      relationships = cloneItemsLinkableDefaultRelationships();
    }
    if (normalizedModuleKey === 'quotes' && relationships.length === 0) {
      relationships = cloneQuotesLinkableDefaultRelationships();
    }
    if (normalizedModuleKey === 'documents' && relationships.length === 0) {
      const { cloneDocumentDefaultRelationships } = require('../constants/documentModuleDefaults');
      relationships = cloneDocumentDefaultRelationships();
    }

    const usedTenantModule = mod && mod.organizationId != null;

    let effectiveRelationships = await getEffectiveRelationships(
      organizationId,
      normalizedAppKey,
      normalizedModuleKey
    );

    if (effectiveRelationships.length === 0) {
      await ensurePlatformRelationshipDefinitionsForModule(normalizedAppKey, normalizedModuleKey);
      await relationshipRegistry.refreshRelationshipKeyCache();
      effectiveRelationships = await getEffectiveRelationships(
        organizationId,
        normalizedAppKey,
        normalizedModuleKey
      );
    }

    let linkable = buildLinkableFromEffectiveRelationships(
      effectiveRelationships,
      relationships,
      normalizedAppKey,
      normalizedModuleKey,
      { usedTenantModule }
    );

    const payload = { success: true, data: linkable };
    // Optional debug for verifying relationship creation (e.g. ?debug=1)
    if (req.query.debug === '1' || req.query.debug === 'true') {
      const tenantMod = await ModuleDefinition.findOne({
        organizationId,
        key: normalizedModuleKey
      })
        .select('relationships')
        .lean();
      const platformMod = await ModuleDefinition.findOne({
        organizationId: null,
        appKey: normalizedAppKey,
        moduleKey: normalizedModuleKey
      })
        .select('relationships')
        .lean();
      payload.debug = {
        appKey: normalizedAppKey,
        moduleKey: normalizedModuleKey,
        tenantModuleFound: !!tenantMod,
        tenantRelationshipsCount: (tenantMod?.relationships && Array.isArray(tenantMod.relationships)) ? tenantMod.relationships.length : 0,
        tenantRelationshipsSample: (tenantMod?.relationships && Array.isArray(tenantMod.relationships))
          ? tenantMod.relationships.slice(0, 5).map((r) => ({
              targetModuleKey: (r.targetModuleKey ?? (r.targetModule && (typeof r.targetModule === 'object' ? (r.targetModule.key ?? r.targetModule.moduleKey) : r.targetModule))) ?? '',
              relationshipKey: r.relationshipKey || null
            }))
          : [],
        platformModuleFound: !!platformMod,
        platformRelationshipsCount: (platformMod?.relationships && Array.isArray(platformMod.relationships)) ? platformMod.relationships.length : 0,
        effectiveRelationshipsCount: Array.isArray(effectiveRelationships) ? effectiveRelationships.length : 0,
        effectiveRelationshipKeys: Array.isArray(effectiveRelationships)
          ? effectiveRelationships.map((d) => d.relationshipKey)
          : [],
        linkableCount: linkable.length,
        linkableKeys: linkable.map((item) => item.relationshipKey)
      };
    }
    return res.status(200).json(payload);
  } catch (error) {
    console.error('[relationshipController] Error getting linkable targets:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting linkable targets',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getActorName = (user) => {
  if (!user) return 'System';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.username || user.email || 'System';
};

/**
 * Resolve display label for a related record (for activity log). Returns null on error or missing record.
 */
async function getRelatedRecordLabel(organizationId, moduleKey, recordId) {
  if (!recordId || !mongoose.Types.ObjectId.isValid(recordId)) return null;
  const mod = (moduleKey || '').toLowerCase();
  try {
    let doc = null;
    const orgId = organizationId;
    if (mod === 'deals') {
      doc = await Deal.findOne({ _id: recordId, organizationId: orgId }).select('name').lean();
      return doc?.name || null;
    }
    if (mod === 'events') {
      doc = await Event.findOne({ _id: recordId, organizationId: orgId }).select('eventName').lean();
      return doc?.eventName || null;
    }
    if (mod === 'forms') {
      doc = await Form.findOne({ _id: recordId, organizationId: orgId }).select('name title').lean();
      return doc?.name || doc?.title || null;
    }
    if (mod === 'tasks') {
      doc = await Task.findOne({ _id: recordId, organizationId: orgId }).select('title').lean();
      return doc?.title || null;
    }
    if (mod === 'people') {
      doc = await People.findOne({ _id: recordId, organizationId: orgId }).select('first_name last_name email').lean();
      if (!doc) return null;
      const name = [doc.first_name, doc.last_name].filter(Boolean).join(' ').trim();
      return name || doc.email || null;
    }
    if (mod === 'organizations') {
      doc = await Organization.findOne({ _id: recordId, organizationId: orgId }).select('name').lean();
      return doc?.name || null;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Link two records with a relationship
 * POST /api/relationships/link
 */
exports.linkRecords = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { relationshipKey, source, target } = req.body;

    // Validate required fields
    if (!relationshipKey || !source || !target) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: relationshipKey, source, target'
      });
    }

    if (!source.appKey || !source.moduleKey || !source.recordId) {
      return res.status(400).json({
        success: false,
        message: 'Source must have appKey, moduleKey, and recordId'
      });
    }

    if (!target.appKey || !target.moduleKey || !target.recordId) {
      return res.status(400).json({
        success: false,
        message: 'Target must have appKey, moduleKey, and recordId'
      });
    }

    // Normalize keys
    const normalizedRelKey = relationshipKey.toLowerCase();
    const normalizedSource = {
      appKey: source.appKey.toLowerCase(),
      moduleKey: source.moduleKey.toLowerCase(),
      recordId: source.recordId
    };
    const normalizedTarget = {
      appKey: target.appKey.toLowerCase(),
      moduleKey: target.moduleKey.toLowerCase(),
      recordId: target.recordId
    };

    if (
      normalizedTarget.moduleKey === 'documents' ||
      normalizedSource.moduleKey === 'documents' ||
      normalizedRelKey.endsWith('_documents')
    ) {
      const { registerDefaultDocumentRelationships } = require('../services/documentRelationshipInitializer');
      await registerDefaultDocumentRelationships();
      await relationshipRegistry.refreshRelationshipKeyCache();
    }

    // Get relationship definition
    const relDef = await RelationshipDefinition.findOne({
      relationshipKey: normalizedRelKey,
      enabled: true
    });

    if (!relDef) {
      return res.status(404).json({
        success: false,
        message: `Relationship '${relationshipKey}' not found or disabled`
      });
    }

    // Enforce linkability (PRIMARY/SYSTEM relationships are not user-linkable)
    if (relDef.userLinkable === false || relDef.display?.linkRecord === false) {
      return res.status(403).json({
        success: false,
        message: `Relationship '${relationshipKey}' is not user-linkable`
      });
    }

    // Validate source/target match relationship definition
    const sourceMatches = 
      relDef.source.appKey === normalizedSource.appKey &&
      relDef.source.moduleKey === normalizedSource.moduleKey;
    
    const targetMatches = 
      relDef.target.appKey === normalizedTarget.appKey &&
      relDef.target.moduleKey === normalizedTarget.moduleKey;

    if (!sourceMatches || !targetMatches) {
      return res.status(400).json({
        success: false,
        message: `Source/Target does not match relationship definition. Expected: ${relDef.source.appKey}.${relDef.source.moduleKey} → ${relDef.target.appKey}.${relDef.target.moduleKey}`
      });
    }

    // Check tenant configuration
    const tenantConfig = await TenantRelationshipConfiguration.findOne({
      organizationId,
      relationshipKey: normalizedRelKey
    });

    if (tenantConfig && !tenantConfig.enabled) {
      return res.status(403).json({
        success: false,
        message: `Relationship '${relationshipKey}' is disabled for this organization`
      });
    }

    // Validate cardinality
    const cardinalityValidation = await validateCardinality(
      organizationId,
      normalizedRelKey,
      normalizedSource,
      normalizedTarget
    );

    if (!cardinalityValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Cardinality validation failed',
        errors: cardinalityValidation.errors
      });
    }

    // Check for duplicate relationship
    const existing = await RelationshipInstance.findOne({
      organizationId,
      relationshipKey: normalizedRelKey,
      'source.appKey': normalizedSource.appKey,
      'source.moduleKey': normalizedSource.moduleKey,
      'source.recordId': normalizedSource.recordId,
      'target.appKey': normalizedTarget.appKey,
      'target.moduleKey': normalizedTarget.moduleKey,
      'target.recordId': normalizedTarget.recordId
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Relationship already exists'
      });
    }

    // TODO: Permission check (stub for now)
    // await checkRelationshipPermission(req.user, relationshipKey, source, target, 'link');

    // Create relationship instance
    const relationshipInstance = await RelationshipInstance.create({
      organizationId,
      relationshipKey: normalizedRelKey,
      source: normalizedSource,
      target: normalizedTarget,
      createdBy: req.user._id
    });

    try {
      await syncPeopleOrganizationLink({
        organizationId,
        relationshipKey: normalizedRelKey,
        source: normalizedSource,
        target: normalizedTarget
      });
    } catch (syncError) {
      await RelationshipInstance.deleteOne({ _id: relationshipInstance._id });
      return res.status(500).json({
        success: false,
        message: 'Error linking records',
        error: process.env.NODE_ENV === 'development' ? syncError.message : undefined
      });
    }

    const taskLinkTargets = [];
    if (normalizedSource.moduleKey === 'tasks') {
      taskLinkTargets.push({
        taskId: normalizedSource.recordId,
        relatedModuleKey: normalizedTarget.moduleKey,
        relatedRecordId: normalizedTarget.recordId
      });
    }
    if (normalizedTarget.moduleKey === 'tasks') {
      taskLinkTargets.push({
        taskId: normalizedTarget.recordId,
        relatedModuleKey: normalizedSource.moduleKey,
        relatedRecordId: normalizedSource.recordId
      });
    }

    const actorName = getActorName(req.user);

    if (taskLinkTargets.length > 0) {
      const seenTaskIds = new Set();

      for (const item of taskLinkTargets) {
        const taskId = String(item.taskId || '');
        if (!taskId || seenTaskIds.has(taskId)) continue;
        seenTaskIds.add(taskId);

        const relatedRecordIdStr = String(item.relatedRecordId || '');
        const relatedRecordLabel = await getRelatedRecordLabel(organizationId, item.relatedModuleKey, relatedRecordIdStr);

        try {
          await Task.updateOne(
            { _id: taskId, organizationId },
            {
              $push: {
                activityLogs: {
                  user: actorName,
                  userId: req.user._id,
                  action: 'record_linked',
                  details: {
                    relationshipKey: normalizedRelKey,
                    relatedModuleKey: item.relatedModuleKey,
                    relatedRecordId: relatedRecordIdStr,
                    ...(relatedRecordLabel ? { relatedRecordLabel } : {})
                  },
                  timestamp: new Date()
                }
              }
            }
          );
        } catch (activityErr) {
          console.warn('[relationshipController] Failed to append task link activity log:', activityErr?.message || activityErr);
        }
      }
    }

    const dealLinkTargets = [];
    if (normalizedSource.moduleKey === 'deals') {
      dealLinkTargets.push({
        dealId: normalizedSource.recordId,
        relatedModuleKey: normalizedTarget.moduleKey,
        relatedRecordId: normalizedTarget.recordId
      });
    }
    if (normalizedTarget.moduleKey === 'deals') {
      dealLinkTargets.push({
        dealId: normalizedTarget.recordId,
        relatedModuleKey: normalizedSource.moduleKey,
        relatedRecordId: normalizedSource.recordId
      });
    }

    if (dealLinkTargets.length > 0) {
      const seenDealIds = new Set();

      for (const item of dealLinkTargets) {
        const dealId = String(item.dealId || '');
        if (!dealId || seenDealIds.has(dealId)) continue;
        seenDealIds.add(dealId);

        const relatedRecordIdStr = String(item.relatedRecordId || '');
        const relatedRecordLabel = await getRelatedRecordLabel(organizationId, item.relatedModuleKey, relatedRecordIdStr);

        try {
          await Deal.updateOne(
            { _id: dealId, organizationId },
            {
              $push: {
                activityLogs: {
                  user: actorName,
                  userId: req.user._id,
                  action: 'record_linked',
                  details: {
                    relationshipKey: normalizedRelKey,
                    relatedModuleKey: item.relatedModuleKey,
                    relatedRecordId: relatedRecordIdStr,
                    ...(relatedRecordLabel ? { relatedRecordLabel } : {})
                  },
                  timestamp: new Date()
                }
              }
            }
          );
        } catch (activityErr) {
          console.warn('[relationshipController] Failed to append deal link activity log:', activityErr?.message || activityErr);
        }
      }
    }

    res.status(201).json({
      success: true,
      data: relationshipInstance
    });
  } catch (error) {
    console.error('[relationshipController] Error linking records:', error);
    
    // Handle duplicate key error (unique index violation)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Relationship already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error linking records',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get raw relationship links for a record (metadata-agnostic)
 * GET /api/relationships/links
 */
exports.getRecordLinks = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { appKey, moduleKey, recordId } = req.query;

    if (!appKey || !moduleKey || !recordId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required query parameters: appKey, moduleKey, recordId'
      });
    }

    const normalizedAppKey = String(appKey).toLowerCase();
    const normalizedModuleKey = String(moduleKey).toLowerCase();
    const normalizedRecordId =
      recordId != null && mongoose.Types.ObjectId.isValid(recordId) && String(recordId).length === 24
        ? new mongoose.Types.ObjectId(String(recordId))
        : recordId;

    const links = await RelationshipInstance.find({
      organizationId,
      $or: [
        {
          'source.appKey': normalizedAppKey,
          'source.moduleKey': normalizedModuleKey,
          'source.recordId': normalizedRecordId
        },
        {
          'target.appKey': normalizedAppKey,
          'target.moduleKey': normalizedModuleKey,
          'target.recordId': normalizedRecordId
        }
      ]
    }).lean();

    const data = (links || []).map((link) => {
      const isSource =
        link?.source?.appKey === normalizedAppKey &&
        link?.source?.moduleKey === normalizedModuleKey &&
        String(link?.source?.recordId) === String(recordId);

      const relatedRecord = isSource ? link?.target : link?.source;

      return {
        relationshipKey: link?.relationshipKey,
        direction: isSource ? 'SOURCE' : 'TARGET',
        source: link?.source,
        target: link?.target,
        relatedRecord: relatedRecord
          ? {
              appKey: relatedRecord.appKey,
              moduleKey: relatedRecord.moduleKey,
              recordId: relatedRecord.recordId
            }
          : null
      };
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[relationshipController] Error getting record links:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting record links',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Unlink two records (remove relationship)
 * POST /api/relationships/unlink
 */
exports.unlinkRecords = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { relationshipKey, source, target } = req.body;

    // Validate required fields
    if (!relationshipKey || !source || !target) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: relationshipKey, source, target'
      });
    }

    // Normalize keys and recordIds (DB stores recordId as ObjectId)
    const normalizedRelKey = relationshipKey.toLowerCase();
    const toRecordId = (v) => {
      if (v == null) return v;
      if (mongoose.Types.ObjectId.isValid(v) && String(v).length === 24) {
        return new mongoose.Types.ObjectId(String(v));
      }
      return v;
    };
    const normalizedSource = {
      appKey: source.appKey.toLowerCase(),
      moduleKey: source.moduleKey.toLowerCase(),
      recordId: toRecordId(source.recordId)
    };
    const normalizedTarget = {
      appKey: target.appKey.toLowerCase(),
      moduleKey: target.moduleKey.toLowerCase(),
      recordId: toRecordId(target.recordId)
    };

    // Find relationship instance
    const relationshipInstance = await RelationshipInstance.findOne({
      organizationId,
      relationshipKey: normalizedRelKey,
      'source.appKey': normalizedSource.appKey,
      'source.moduleKey': normalizedSource.moduleKey,
      'source.recordId': normalizedSource.recordId,
      'target.appKey': normalizedTarget.appKey,
      'target.moduleKey': normalizedTarget.moduleKey,
      'target.recordId': normalizedTarget.recordId
    });

    if (!relationshipInstance) {
      if (normalizedRelKey === 'people_organizations') {
        let personId = null;
        let orgId = null;
        if (normalizedSource.moduleKey === 'people' && normalizedTarget.moduleKey === 'organizations') {
          personId = normalizedSource.recordId;
          orgId = normalizedTarget.recordId;
        } else if (normalizedSource.moduleKey === 'organizations' && normalizedTarget.moduleKey === 'people') {
          personId = normalizedTarget.recordId;
          orgId = normalizedSource.recordId;
        }
        if (personId && orgId) {
          const cleared = await People.updateOne(
            {
              _id: personId,
              organizationId,
              organization: orgId
            },
            { $set: { organization: null } }
          );
          if (cleared.modifiedCount > 0) {
            return res.status(200).json({
              success: true,
              message: 'Relationship removed successfully'
            });
          }
        }
      }
      return res.status(404).json({
        success: false,
        message: 'Relationship not found'
      });
    }

    // TODO: Permission check (stub for now)
    // await checkRelationshipPermission(req.user, relationshipKey, source, target, 'unlink');

    const actorName = getActorName(req.user);
    const src = relationshipInstance.source;
    const tgt = relationshipInstance.target;

    const appendUnlinkActivity = async (moduleKey, recordId, otherModuleKey, otherRecordId) => {
      const mod = (moduleKey || '').toLowerCase();
      const otherLabel = await getRelatedRecordLabel(organizationId, otherModuleKey, otherRecordId);
      const logEntry = {
        user: actorName,
        userId: req.user._id,
        action: 'record_unlinked',
        details: {
          relationshipKey: normalizedRelKey,
          relatedModuleKey: otherModuleKey,
          relatedRecordId: String(otherRecordId || ''),
          ...(otherLabel ? { relatedRecordLabel: otherLabel } : {})
        },
        timestamp: new Date()
      };
      if (mod === 'tasks') {
        try {
          await Task.updateOne(
            { _id: recordId, organizationId },
            { $push: { activityLogs: logEntry } }
          );
        } catch (e) {
          console.warn('[relationshipController] Failed to append task unlink activity log:', e?.message || e);
        }
      } else if (mod === 'deals') {
        try {
          await Deal.updateOne(
            { _id: recordId, organizationId },
            { $push: { activityLogs: logEntry } }
          );
        } catch (e) {
          console.warn('[relationshipController] Failed to append deal unlink activity log:', e?.message || e);
        }
      }
    };

    await appendUnlinkActivity(
      src?.moduleKey,
      src?.recordId,
      tgt?.moduleKey,
      tgt?.recordId
    );
    await appendUnlinkActivity(
      tgt?.moduleKey,
      tgt?.recordId,
      src?.moduleKey,
      src?.recordId
    );

    await syncPeopleOrganizationUnlink({
      organizationId,
      relationshipKey: normalizedRelKey,
      source: src,
      target: tgt
    });

    // Delete relationship instance
    await RelationshipInstance.deleteOne({ _id: relationshipInstance._id });

    res.status(200).json({
      success: true,
      message: 'Relationship removed successfully'
    });
  } catch (error) {
    console.error('[relationshipController] Error unlinking records:', error);
    res.status(500).json({
      success: false,
      message: 'Error unlinking records',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get record context (relationships for a record)
 * GET /api/relationships/record-context
 */
exports.getRecordContext = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { appKey, moduleKey, recordId } = req.query;

    // Validate required fields
    if (!appKey || !moduleKey || !recordId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required query parameters: appKey, moduleKey, recordId'
      });
    }

    // Phase 1C: Get full record context with execution feedback
    const { getRecordContext } = require('../services/recordContextService');
    const Organization = require('../models/Organization');
    
    // Get organization for execution feedback resolution
    const organization = await Organization.findById(organizationId);
    
    // Get full record context with user and organization for feedback resolution
    const context = await getRecordContext(organizationId, appKey, moduleKey, recordId, {
      requestingAppKey: req.appContext?.appKey || appKey,
      user: req.user,
      organization: organization
    });

    res.status(200).json({
      success: true,
      data: context
    });
  } catch (error) {
    console.error('[relationshipController] Error getting record context:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting record context',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
