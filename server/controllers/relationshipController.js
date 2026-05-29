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
const { getOutgoingRelationships, getIncomingRelationships } = require('../utils/relationshipRegistry');

// Map targetModuleKey → appKey for link API (used when building linkable from Settings relationships)
const TARGET_APP_BY_MODULE_KEY = {
  organizations: 'sales',
  people: 'sales',
  deals: 'sales',
  tasks: 'platform',
  events: 'platform',
  forms: 'platform',
  projects: 'projects',
  cases: 'helpdesk'
};

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
      source: { appKey: 'sales', moduleKey: 'items' },
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
      source: { appKey: 'sales', moduleKey: 'items' },
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
      source: { appKey: 'sales', moduleKey: 'items' },
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
      source: { appKey: 'sales', moduleKey: 'items' },
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

  // eslint-disable-next-line no-await-in-loop
  for (const def of defs) {
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
 * Reads from ModuleDefinition.relationships (tenant config). Does NOT derive relationshipKey:
 * only includes entries that have relationshipKey set and that exist in RelationshipDefinition.
 * Entries with missing or unknown relationshipKey are excluded from the list.
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
      // Refresh cache so relationshipRegistry.has() recognizes new keys
      await relationshipRegistry.refreshRelationshipKeyCache();
    }
    if (normalizedModuleKey === 'quotes') {
      await ensureQuoteRelationshipDefinitions();
      await relationshipRegistry.refreshRelationshipKeyCache();
    }

    // Load module: tenant override first (organizationId + key or moduleKey), then platform (organizationId null + appKey + moduleKey).
    // If the tenant module exists, use its relationships as-is (even if empty) so clearing relationships in Settings
    // actually hides link targets. Only fall back to platform when no tenant module exists.
    let mod = await ModuleDefinition.findOne({
      organizationId,
      $or: [
        { key: normalizedModuleKey },
        { moduleKey: normalizedModuleKey }
      ]
    })
      .select('relationships key moduleKey organizationId')
      .lean();

    if (!mod) {
      mod = await ModuleDefinition.findOne({
        organizationId: null,
        appKey: normalizedAppKey,
        moduleKey: normalizedModuleKey
      })
        .select('relationships')
        .lean();
    }

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
    // Resolve missing relationshipKey from platform (so Settings relationships show even if saved before relationshipKey was set)
    const outgoing = await getOutgoingRelationships(normalizedAppKey, normalizedModuleKey);
    const incoming = getIncomingRelationships(normalizedAppKey, normalizedModuleKey);
    const toTargetKey = (r) => {
      const raw = r.targetModuleKey ?? r.targetModule;
      if (raw == null) return '';
      if (typeof raw === 'object') return String(raw.key ?? raw.moduleKey ?? '').toLowerCase().trim();
      return String(raw).toLowerCase().trim();
    };
    function buildLinkableFromRelationships() {
      for (const r of relationships) {
        const targetKey = toTargetKey(r);
        const relKey = r.relationshipKey && String(r.relationshipKey).trim();
        if (targetKey && (!relKey || !relationshipRegistry.has(relKey))) {
          const outgoingMatches = outgoing.filter((def) => def.target && (String(def.target.moduleKey || '').toLowerCase() === targetKey));
          if (outgoingMatches.length === 1) {
            r.relationshipKey = outgoingMatches[0].relationshipKey;
            continue;
          }
          // Some modules (e.g. organizations) are represented by incoming definitions where
          // the current module is the target and the selectable module is the source.
          const incomingMatches = (incoming || []).filter(
            (def) => def.source && (String(def.source.moduleKey || '').toLowerCase() === targetKey)
          );
          if (incomingMatches.length === 1) {
            r.relationshipKey = incomingMatches[0].relationshipKey;
          }
        }
      }

      return relationships
        .filter((r) => {
          const relKey = r.relationshipKey && String(r.relationshipKey).trim();
          if (!relKey || !relationshipRegistry.has(relKey)) return false;
          const target = toTargetKey(r);
          if (!target) return false;
          if (r.userLinkable === false) return false;
          if (r.display && r.display.linkRecord === false) return false;
          return true;
        })
        .map((r) => {
          const targetModuleKey = toTargetKey(r);
          const label = (r.label || r.name || targetModuleKey).toString().trim() || targetModuleKey;
          const relationshipKey = String(r.relationshipKey).trim().toLowerCase();
          const targetAppKey = (TARGET_APP_BY_MODULE_KEY[targetModuleKey] || 'platform').toUpperCase();
          const relDef = relationshipRegistry.get(relationshipKey);
          const sourceIsCurrent = !!(
            relDef &&
            String(relDef.source?.appKey || '').toLowerCase() === normalizedAppKey &&
            String(relDef.source?.moduleKey || '').toLowerCase() === normalizedModuleKey
          );
          return {
            key: targetModuleKey,
            label,
            relationshipKey,
            targetAppKey,
            sourceIsCurrent
          };
        });
    }

    // First pass uses in-memory cache (fast path)
    let linkable = buildLinkableFromRelationships();

    // Stale-cache safeguard: if module has relationship keys but none are recognized,
    // refresh registry cache once and retry (covers newly seeded definitions at runtime).
    const hasAnyRelationshipKeys = relationships.some((r) => String(r?.relationshipKey || '').trim());
    if (linkable.length === 0 && hasAnyRelationshipKeys) {
      await relationshipRegistry.refreshRelationshipKeyCache();
      linkable = buildLinkableFromRelationships();
    }

    const usedTenantModule = mod && mod.organizationId != null;
    const allowSystemDefaultFallback =
      usedTenantModule &&
      linkable.length === 0 &&
      (!Array.isArray(relationships) || relationships.length === 0) &&
      (normalizedModuleKey === 'people' || normalizedModuleKey === 'deals' || normalizedModuleKey === 'events' || normalizedModuleKey === 'cases');
    const linkableFromFallback = linkable.length === 0 && (!usedTenantModule || allowSystemDefaultFallback);
    // Fallback to platform registry when no tenant module exists.
    // Also allow fallback for core Sales system modules when tenant module exists but has empty relationships,
    // which indicates an uninitialized/legacy module definition rather than an intentional customization.
    if ((!usedTenantModule || allowSystemDefaultFallback) && linkable.length === 0 && ((Array.isArray(outgoing) && outgoing.length > 0) || (Array.isArray(incoming) && incoming.length > 0))) {
      const outgoingFallback = (outgoing || [])
        .filter((def) => def.relationshipKey && def.target && relationshipRegistry.has(String(def.relationshipKey).trim().toLowerCase()))
        .map((def) => {
          const targetModuleKey = String(def.target.moduleKey || '').toLowerCase().trim();
          const label = targetModuleKey ? (targetModuleKey.charAt(0).toUpperCase() + targetModuleKey.slice(1)) : targetModuleKey;
          const relationshipKey = String(def.relationshipKey).trim().toLowerCase();
          const targetAppKey = (TARGET_APP_BY_MODULE_KEY[targetModuleKey] || 'platform').toUpperCase();
          return { key: targetModuleKey, label, relationshipKey, targetAppKey, sourceIsCurrent: true };
        });

      const incomingFallback = (incoming || [])
        .filter((def) => def.relationshipKey && def.source && relationshipRegistry.has(String(def.relationshipKey).trim().toLowerCase()))
        .map((def) => {
          const sourceModuleKey = String(def.source.moduleKey || '').toLowerCase().trim();
          const label = sourceModuleKey ? (sourceModuleKey.charAt(0).toUpperCase() + sourceModuleKey.slice(1)) : sourceModuleKey;
          const relationshipKey = String(def.relationshipKey).trim().toLowerCase();
          const targetAppKey = (TARGET_APP_BY_MODULE_KEY[sourceModuleKey] || 'platform').toUpperCase();
          return { key: sourceModuleKey, label, relationshipKey, targetAppKey, sourceIsCurrent: false };
        });

      const deduped = new Map();
      for (const item of [...outgoingFallback, ...incomingFallback]) {
        const dedupeKey = `${item.relationshipKey}:${item.key}:${item.sourceIsCurrent ? 'src' : 'tgt'}`;
        if (!deduped.has(dedupeKey)) deduped.set(dedupeKey, item);
      }
      linkable = Array.from(deduped.values());
    }

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
        outgoingFromRegistryCount: Array.isArray(outgoing) ? outgoing.length : 0,
        outgoingKeys: Array.isArray(outgoing) ? outgoing.map((d) => d.relationshipKey) : [],
        linkableFromFallback: linkableFromFallback,
        linkableCount: linkable.length
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
