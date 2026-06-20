/**
 * ============================================================================
 * Phase 0G: Record Context Composable
 * ============================================================================
 * 
 * Platform-level composable for fetching and managing record context:
 * - Fetches record context from /api/relationships/record-context
 * - Caches per record (appKey.moduleKey.recordId)
 * - Exposes relationship groups, required relationships, and permissions
 * - App-agnostic and metadata-driven
 * 
 * ============================================================================
 */

import { ref, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { fetchRecordsForDisplay, isRecordEnrichedForDisplay, ensureRelatedModuleDefinitions, relatedDisplayOptionsForModule } from '@/utils/recordDisplay';
import { showGlobalNotification } from '@/composables/useNotifications';

// Cache for record contexts
const contextCache = new Map();

/**
 * Normalize recordId to a string (handles ObjectId-like, { _id }, or string)
 */
function normalizeRecordId(recordId) {
  if (recordId == null) return '';
  if (typeof recordId === 'string') return recordId.trim();
  if (typeof recordId === 'object' && recordId !== null) {
    const id = recordId._id ?? recordId.id ?? recordId.recordId;
    if (id != null) return String(id);
    if (typeof recordId.toString === 'function') return recordId.toString();
  }
  return String(recordId);
}

/**
 * Generate cache key for a record
 */
function getCacheKey(appKey, moduleKey, recordId) {
  const appKeyStr = String(appKey || 'sales').toLowerCase();
  const moduleKeyStr = String(moduleKey || 'unknown').toLowerCase();
  const recordIdStr = normalizeRecordId(recordId);
  return `${appKeyStr}.${moduleKeyStr}.${recordIdStr}`;
}

/**
 * Build relationships array from GET /relationships/links response (fallback when record-context returns empty)
 */
function buildRelationshipsFromLinks(links, appKey, moduleKey) {
  if (!Array.isArray(links) || links.length === 0) return [];
  const appKeyLower = String(appKey || '').toLowerCase();
  const moduleKeyLower = String(moduleKey || '').toLowerCase();
  const byKey = new Map();
  for (const link of links) {
    const relKey = (link?.relationshipKey || '').toLowerCase();
    if (!relKey || !link?.relatedRecord?.recordId) continue;
    const rec = {
      recordId: link.relatedRecord.recordId,
      id: link.relatedRecord.recordId,
      appKey: (link.relatedRecord.appKey || 'SALES').toUpperCase(),
      moduleKey: (link.relatedRecord.moduleKey || '').toLowerCase()
    };
    if (!byKey.has(relKey)) {
      const mod = (link.relatedRecord.moduleKey || relKey).toLowerCase();
      const label = mod ? mod.charAt(0).toUpperCase() + mod.slice(1) : relKey;
      byKey.set(relKey, {
        relationshipKey: relKey,
        label,
        direction: link.direction || 'SOURCE',
        cardinality: 'ONE_TO_MANY',
        records: [],
        ui: { showAs: 'TAB', label }
      });
    }
    byKey.get(relKey).records.push(rec);
  }
  return Array.from(byKey.values());
}

/**
 * Best-effort cleanup for stale relationship links.
 * If a linked record no longer exists/is accessible, unlink the broken edge so it
 * stops reappearing in subsequent context loads.
 */
async function cleanupBrokenRelationshipLink({
  relationshipKey,
  targetRecord,
  existingLinks = []
}) {
  const targetRecordId = targetRecord?.recordId ?? targetRecord?.id ?? targetRecord?._id;
  if (!relationshipKey || !targetRecordId) return false;

  const targetAppKey = targetRecord?.appKey;
  const targetModuleKey = targetRecord?.moduleKey;
  if (!targetAppKey || !targetModuleKey) return false;
  const targetIdStr = normalizeRecordId(targetRecordId);
  const relationshipKeyLower = String(relationshipKey).toLowerCase();
  const targetAppKeyLower = String(targetAppKey).toLowerCase();
  const targetModuleKeyLower = String(targetModuleKey).toLowerCase();

  const matchingLink = existingLinks.find((link) => {
    const relKey = String(link?.relationshipKey || '').toLowerCase();
    const related = link?.relatedRecord || {};
    const relatedId = normalizeRecordId(related.recordId);
    const relatedAppKey = String(related.appKey || '').toLowerCase();
    const relatedModuleKey = String(related.moduleKey || '').toLowerCase();
    return relKey === relationshipKeyLower
      && relatedId === targetIdStr
      && relatedAppKey === targetAppKeyLower
      && relatedModuleKey === targetModuleKeyLower;
  });
  if (!matchingLink?.source || !matchingLink?.target) return false;

  try {
    const response = await apiClient.post('/relationships/unlink', {
      relationshipKey,
      source: matchingLink.source,
      target: matchingLink.target
    });
    return Boolean(response?.success ?? true);
  } catch (err) {
    const status = err?.status;
    const message = String(err?.message || '');
    const isNotFound = status === 404 || message.toLowerCase().includes('relationship not found');
    if (!isNotFound) {
      console.warn('[useRecordContext] Failed to auto-clean broken relationship link:', err?.message || err);
    }
    return false;
  }
}

/**
 * Fetch labels/details for linked records (background enrichment).
 */
async function enrichContextRelationshipRecords(contextData, appKeyValue, moduleKeyValue, recordIdValue) {
  if (!contextData?.relationships?.length) return contextData;

  await ensureRelatedModuleDefinitions();

  await Promise.all(contextData.relationships.map(async (rel) => {
    if (!rel.records?.length) return;
    try {
      const originalRecords = Array.isArray(rel.records) ? [...rel.records] : [];
      const pendingIndexes = [];
      const pendingRecords = [];

      originalRecords.forEach((record, index) => {
        const moduleKey = String(record?.moduleKey || '').toLowerCase();
        if (isRecordEnrichedForDisplay(record, moduleKey, relatedDisplayOptionsForModule(moduleKey))) return;
        pendingIndexes.push(index);
        pendingRecords.push(record);
      });

      if (!pendingRecords.length) return;

      const enhancedRecords = await fetchRecordsForDisplay(pendingRecords);

      const brokenRecords = pendingRecords.filter((_, index) => !enhancedRecords[index]);
      if (brokenRecords.length > 0) {
        let existingLinks = [];
        try {
          const linksRes = await apiClient.get('/relationships/links', {
            params: {
              appKey: appKeyValue,
              moduleKey: moduleKeyValue,
              recordId: normalizeRecordId(recordIdValue)
            }
          });
          existingLinks = Array.isArray(linksRes?.data) ? linksRes.data : [];
        } catch (_linksErr) {
          existingLinks = [];
        }

        void Promise.allSettled(
          brokenRecords.map((brokenRecord) =>
            cleanupBrokenRelationshipLink({
              relationshipKey: rel.relationshipKey,
              targetRecord: brokenRecord,
              existingLinks
            })
          )
        ).then((results) => {
          const cleanedCount = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
          if (cleanedCount > 0) {
            const noun = cleanedCount === 1 ? 'stale relationship link was' : 'stale relationship links were';
            showGlobalNotification(`${cleanedCount} ${noun} removed automatically.`, 3500);
          }
        });
      }

      const mergedRecords = [...originalRecords];
      pendingIndexes.forEach((originalIndex, pendingIndex) => {
        const record = enhancedRecords[pendingIndex];
        const original = originalRecords[originalIndex];
        if (!record) {
          mergedRecords[originalIndex] = {
            ...original,
            _isBroken: true,
            label: 'Related record unavailable',
            secondaryText: 'Record may have been deleted or access denied',
            isDisabled: true
          };
          return;
        }

        const projection = record.projection || original.projection;
        mergedRecords[originalIndex] = {
          ...original,
          ...record,
          primaryField: record.label || original.primaryField || record.primaryField,
          label: record.label || original.label,
          secondaryText: record.secondaryText || original.secondaryText,
          projection: projection ? {
            currentType: projection.currentType,
            basePrimitive: projection.basePrimitive,
            appKey: projection.appKey || original.appKey?.toUpperCase() || 'SALES',
            allowedTypes: projection.allowedTypes,
            defaultType: projection.defaultType,
            readOnly: projection.readOnly,
            platformOwned: projection.platformOwned
          } : null
        };
      });

      rel.records = mergedRecords;
    } catch (error) {
      console.warn('[useRecordContext] Error fetching record details:', error);
      rel.records = rel.records.map((record) => ({
        ...record,
        _isBroken: true,
        label: 'Related record unavailable',
        secondaryText: 'Error loading record details',
        isDisabled: true
      }));
    }
  }));

  return contextData;
}

/** Shallow-clone context so nested relationship record updates trigger Vue reactivity. */
function cloneContextSnapshot(contextData) {
  if (!contextData || typeof contextData !== 'object') return contextData;
  return {
    ...contextData,
    relationships: Array.isArray(contextData.relationships)
      ? contextData.relationships.map((rel) => ({
          ...rel,
          records: Array.isArray(rel.records) ? rel.records.map((rec) => ({ ...rec })) : []
        }))
      : []
  };
}

/**
 * Get record context from API
 */
async function fetchRecordContext(appKey, moduleKey, recordId) {
  try {
    const appKeyStr = String(appKey || 'sales');
    const moduleKeyStr = String(moduleKey || 'unknown');
    const recordIdStr = normalizeRecordId(recordId);
    
    const response = await apiClient.get('/relationships/record-context', {
      params: {
        appKey: appKeyStr,
        moduleKey: moduleKeyStr,
        recordId: recordIdStr
      }
    });

    if (response.success && response.data) {
      return response.data;
    }

    // Return safe defaults on error
    return {
      record: { id: recordId, appKey, moduleKey, label: '' },
      relationships: [],
      hasRequiredUnsatisfied: false
    };
  } catch (error) {
    console.error('[useRecordContext] Error fetching record context:', error);
    return {
      record: { id: recordId, appKey, moduleKey, label: '' },
      relationships: [],
      hasRequiredUnsatisfied: false
    };
  }
}

/**
 * Resolve app access mode for the current user
 * This determines if user can link/unlink (EXECUTION) or only view (ADMIN)
 */
async function resolveAccessMode(appKey) {
  const authStore = useAuthStore();
  const user = authStore.user;
  const organization = authStore.organization;

  if (!user || !organization) {
    return { mode: null, canLink: false, canUnlink: false };
  }

  // Owner has ADMIN access (view-only for relationships)
  if (user.isOwner) {
    return { mode: 'ADMIN', canLink: false, canUnlink: false };
  }

  // Check if user has explicit app access
  const appAccess = user.appAccess || [];
  const hasAccess = appAccess.some(
    access => access.appKey === appKey.toUpperCase() && access.status === 'ACTIVE'
  );

  // Legacy: check allowedApps
  const hasLegacyAccess = !hasAccess && (user.allowedApps || []).includes(appKey.toUpperCase());

  if (hasAccess || hasLegacyAccess) {
    // EXECUTION mode - can link/unlink
    return { mode: 'EXECUTION', canLink: true, canUnlink: true };
  }

  // No access
  return { mode: null, canLink: false, canUnlink: false };
}

/**
 * Main composable function
 */
export function useRecordContext(appKey, moduleKey, recordId) {
  const loading = ref(false);
  const error = ref(null);
  const context = ref(null);
  const accessMode = ref(null);
  const contextRevision = ref(0);

  function publishContext(nextContext, cacheKeyValue = null) {
    context.value = nextContext;
    contextRevision.value += 1;
    if (cacheKeyValue) {
      contextCache.set(cacheKeyValue, nextContext);
    }
  }

  // Ensure accessors are called to get actual values
  const cacheKey = computed(() => {
    const appKeyValue = typeof appKey === 'function' ? appKey() : appKey;
    const moduleKeyValue = typeof moduleKey === 'function' ? moduleKey() : moduleKey;
    const recordIdValue = typeof recordId === 'function' ? recordId() : recordId;
    return getCacheKey(appKeyValue, moduleKeyValue, recordIdValue);
  });

  // Group relationships by UI display type
  const relatedGroups = computed(() => {
    if (!context.value || !context.value.relationships) {
      return {
        tabs: [],
        embeds: [],
        inlines: []
      };
    }

    const groups = {
      tabs: [],
      embeds: [],
      inlines: []
    };

    context.value.relationships.forEach(rel => {
      const linkedRecords = (rel.records || []).filter((record) => !record?._isBroken);
      if (linkedRecords.length === 0) return;

      const group = {
        relationshipKey: rel.relationshipKey,
        label: rel.ui?.label || rel.label || rel.relationshipKey,
        direction: rel.direction,
        cardinality: rel.cardinality,
        required: rel.required || false,
        requiredSatisfied: rel.requiredSatisfied !== false,
        linkedRecords,
        ui: rel.ui || {}
      };

      const showAs = (rel.ui?.showAs || 'TAB').toUpperCase();
      
      if (showAs === 'TAB') {
        groups.tabs.push(group);
      } else if (showAs === 'EMBED') {
        groups.embeds.push(group);
      } else if (showAs === 'INLINE') {
        groups.inlines.push(group);
      }
    });

    return groups;
  });

  // Required relationships that are not satisfied
  const requiredRelationships = computed(() => {
    if (!context.value || !context.value.relationships) {
      return [];
    }

    return context.value.relationships.filter(
      rel => rel.required && !rel.requiredSatisfied
    );
  });

  // Check if there are unsatisfied required relationships
  const hasUnsatisfiedRequired = computed(() => {
    return requiredRelationships.value.length > 0;
  });

  // Can link/unlink based on access mode
  const canLink = computed(() => {
    return accessMode.value?.canLink || false;
  });

  const canUnlink = computed(() => {
    return accessMode.value?.canUnlink || false;
  });

  // Load record context
  const load = async (forceRefresh = false) => {
    // Get actual values from accessors
    const appKeyValue = typeof appKey === 'function' ? appKey() : appKey;
    const moduleKeyValue = typeof moduleKey === 'function' ? moduleKey() : moduleKey;
    const recordIdValue = typeof recordId === 'function' ? recordId() : recordId;
    
    const key = cacheKey.value;

    // Check cache first (unless force refresh)
    if (!forceRefresh && contextCache.has(key)) {
      const cached = cloneContextSnapshot(contextCache.get(key));
      publishContext(cached);
      accessMode.value = await resolveAccessMode(appKeyValue);
      loading.value = false;
      const loadKey = key;
      void enrichContextRelationshipRecords(cached, appKeyValue, moduleKeyValue, recordIdValue)
        .then((enriched) => {
          if (cacheKey.value !== loadKey) return;
          publishContext(cloneContextSnapshot(enriched), loadKey);
        })
        .catch((enrichErr) => {
          console.warn('[useRecordContext] Cache enrichment failed:', enrichErr);
        });
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      // Fetch context and resolve access in parallel
      const [contextData, access] = await Promise.all([
        fetchRecordContext(appKeyValue, moduleKeyValue, recordIdValue),
        resolveAccessMode(appKeyValue)
      ]);

      // Fallback: when record-context returns no relationships, use links API so Related Records still shows linked items (e.g. Deals)
      if ((!contextData.relationships || contextData.relationships.length === 0) && recordIdValue) {
        try {
          const linksRes = await apiClient.get('/relationships/links', {
            params: {
              appKey: appKeyValue,
              moduleKey: moduleKeyValue,
              recordId: normalizeRecordId(recordIdValue)
            }
          });
          if (linksRes?.success && Array.isArray(linksRes.data) && linksRes.data.length > 0) {
            contextData.relationships = buildRelationshipsFromLinks(
              linksRes.data,
              appKeyValue,
              moduleKeyValue
            );
          }
        } catch (linksErr) {
          console.warn('[useRecordContext] Links fallback failed:', linksErr);
        }
      }

      // Publish raw links immediately so Related Records updates without waiting for label enrichment.
      publishContext(contextData);
      accessMode.value = access;
      loading.value = false;

      const loadKey = key;
      void enrichContextRelationshipRecords(contextData, appKeyValue, moduleKeyValue, recordIdValue)
        .then((enriched) => {
          if (cacheKey.value !== loadKey) return;
          publishContext(cloneContextSnapshot(enriched), loadKey);
        })
        .catch((enrichErr) => {
          console.warn('[useRecordContext] Background enrichment failed:', enrichErr);
        });

      return;
    } catch (err) {
      error.value = err;
      console.error('[useRecordContext] Error loading context:', err);
    } finally {
      loading.value = false;
    }
  };

  // Refresh context (force reload)
  const refresh = () => {
    const key = cacheKey.value;
    contextCache.delete(key);
    return load(true);
  };

  // Clear cache for this record
  const clearCache = () => {
    const key = cacheKey.value;
    contextCache.delete(key);
    context.value = null;
  };

  return {
    // State
    loading,
    error,
    context,
    accessMode,
    contextRevision,

    // Computed
    relatedGroups,
    requiredRelationships,
    hasUnsatisfiedRequired,
    canLink,
    canUnlink,

    // Methods
    load,
    refresh,
    clearCache
  };
}

/**
 * Clear all cached contexts (useful on logout)
 */
export function clearAllRecordContextCache() {
  contextCache.clear();
}

/**
 * Invalidate cached context for a single record so the next load refetches.
 * Call after linking/unlinking so Related Records section and tab show up-to-date data.
 * @param {string} appKey - e.g. 'SALES', 'sales'
 * @param {string} moduleKey - e.g. 'deals', 'tasks'
 * @param {string} recordId - record id
 */
export function invalidateRecordContext(appKey, moduleKey, recordId) {
  const appKeyStr = String(appKey || 'sales').toLowerCase();
  const moduleKeyStr = String(moduleKey || 'unknown').toLowerCase();
  const recordIdStr = normalizeRecordId(recordId);
  const key = `${appKeyStr}.${moduleKeyStr}.${recordIdStr}`;
  contextCache.delete(key);
}

/**
 * Merge newly linked records into an in-memory context (optimistic UI).
 */
export function mergeLinkedRecordsIntoContext(contextRef, relationshipKey, newRecords, options = {}) {
  const ctx = contextRef?.value ?? contextRef;
  if (!ctx || !relationshipKey || !Array.isArray(newRecords) || newRecords.length === 0) return;

  if (!Array.isArray(ctx.relationships)) {
    ctx.relationships = [];
  }

  const relKey = String(relationshipKey).toLowerCase();
  let rel = ctx.relationships.find(
    (entry) => String(entry?.relationshipKey || '').toLowerCase() === relKey
  );

  if (!rel) {
    rel = {
      relationshipKey: relKey,
      label: options.label || relKey,
      direction: options.direction || 'TARGET',
      records: [],
      ui: { showAs: 'TAB', label: options.label || relKey }
    };
    ctx.relationships.push(rel);
  }

  if (!Array.isArray(rel.records)) {
    rel.records = [];
  }

  for (const rec of newRecords) {
    const id = normalizeRecordId(rec?.recordId ?? rec?.id ?? rec?._id);
    if (!id) continue;
    const alreadyLinked = rel.records.some(
      (existing) => normalizeRecordId(existing?.recordId ?? existing?.id ?? existing?._id) === id
    );
    if (alreadyLinked) continue;
    rel.records.push({
      ...rec,
      recordId: id,
      id,
      appKey: String(rec?.appKey || options.appKey || 'PLATFORM').toUpperCase(),
      moduleKey: String(rec?.moduleKey || options.moduleKey || '').toLowerCase()
    });
  }

  if (contextRef?.value != null) {
    contextRef.value = cloneContextSnapshot(ctx);
  }
  if (typeof options.onUpdated === 'function') {
    options.onUpdated();
  }
}

/**
 * Replace lookup-backed relationship records after a key field save (many-to-one).
 */
export function syncLookupRelationshipInContext(contextRef, relationshipKey, linkedRecord, options = {}) {
  const ctx = contextRef?.value ?? contextRef;
  if (!ctx || !relationshipKey) return;

  if (!Array.isArray(ctx.relationships)) {
    ctx.relationships = [];
  }

  const relKey = String(relationshipKey).toLowerCase();
  let rel = ctx.relationships.find(
    (entry) => String(entry?.relationshipKey || '').toLowerCase() === relKey
  );

  if (!rel) {
    rel = {
      relationshipKey: relKey,
      label: options.label || relKey,
      direction: options.direction || 'SOURCE',
      records: [],
      ui: { showAs: 'TAB', label: options.label || relKey }
    };
    ctx.relationships.push(rel);
  }

  if (!linkedRecord) {
    rel.records = [];
  } else {
    const id = normalizeRecordId(linkedRecord?.recordId ?? linkedRecord?.id ?? linkedRecord?._id);
    rel.records = id
      ? [{
          ...linkedRecord,
          recordId: id,
          id,
          appKey: String(linkedRecord?.appKey || options.appKey || 'SALES').toUpperCase(),
          moduleKey: String(linkedRecord?.moduleKey || options.moduleKey || '').toLowerCase()
        }]
      : [];
  }

  if (contextRef?.value != null) {
    contextRef.value = cloneContextSnapshot(ctx);
  }
  if (typeof options.onUpdated === 'function') {
    options.onUpdated();
  }
}

