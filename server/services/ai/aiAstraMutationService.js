'use strict';

/**
 * Astra CRM mutations — create/update only (never delete / trash).
 * Permission + tenant isolation enforced on every call.
 */

const mongoose = require('mongoose');
const { getModelForModuleKey } = require('../../utils/assignmentRecordLoader');
const { resolveRuntimePermission } = require('../runtimePermissionResolver');
const { isTenantPrivilegedUser } = require('../../utils/tenantPrivilegedAccess');
const { AiConfigurationError } = require('./errors');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { findIntentDuplicatesForCreate, allowsForceCreate } = require('./aiAstraDuplicateGuard');

const ALLOWED_MODULES = new Set([
  'people',
  'organizations',
  'deals',
  'tasks',
  'events',
  'quotes',
  'items',
  'cases',
]);

const BLOCKED_FIELDS = new Set([
  '_id',
  'id',
  'organizationId',
  'organization',
  'deletedAt',
  'deletedBy',
  'deletionReason',
  'isTenant',
  'createdAt',
  'updatedAt',
  '__v',
  'password',
  'apiKey',
  'apiKeyEncrypted',
  'aiSettings',
  'linkPeopleId',
  'relatedTold',
  'relatedToType',
  'relatedToModule',
  'relatedModule',
  'forceCreate',
  'forceCreateReason',
]);

function resolveRecordLabel(moduleKey, doc) {
  if (!doc) return '';
  const mod = String(moduleKey || '').toLowerCase();
  if (mod === 'events') return String(doc.eventName || '').trim();
  if (mod === 'tasks') return String(doc.title || doc.name || '').trim();
  if (mod === 'deals') return String(doc.name || doc.dealName || '').trim();
  if (mod === 'cases') return String(doc.subject || doc.caseNumber || '').trim();
  if (mod === 'organizations') return String(doc.name || '').trim();
  if (mod === 'people') {
    const first = doc.firstName || doc.first_name || '';
    const last = doc.lastName || doc.last_name || '';
    return [first, last].filter(Boolean).join(' ').trim() || String(doc.email || '').trim();
  }
  if (mod === 'quotes' || mod === 'items') return String(doc.name || doc.title || '').trim();
  return String(doc.name || doc.title || doc.eventName || '').trim();
}

function extractLinkPeopleId(rawFields = {}, pageModuleKey = '', pageRecordId = '', moduleKey = '') {
  const mod = String(moduleKey || '').toLowerCase();
  if (mod !== 'events') return '';
  const fromField = String(rawFields.linkPeopleId || '').trim();
  if (fromField && mongoose.Types.ObjectId.isValid(fromField)) return fromField;
  const pageMod = String(pageModuleKey || '').toLowerCase();
  const pageId = String(pageRecordId || '').trim();
  if (pageMod === 'people' && pageId && mongoose.Types.ObjectId.isValid(pageId)) return pageId;
  // LLM sometimes puts contact id into relatedToId / relatedTold — Event.relatedToId is Organization only
  const maybeContact = String(rawFields.relatedTold || rawFields.relatedToId || '').trim();
  const relType = String(rawFields.relatedToType || rawFields.relatedToModule || rawFields.relatedModule || '').toLowerCase();
  if (
    maybeContact
    && mongoose.Types.ObjectId.isValid(maybeContact)
    && (relType === 'people' || relType === 'person' || relType === 'contact' || pageMod === 'people')
  ) {
    return maybeContact;
  }
  return '';
}

async function ensurePeopleEventsLink({ organizationId, userId, peopleId, eventId }) {
  if (!peopleId || !eventId || !mongoose.Types.ObjectId.isValid(peopleId) || !mongoose.Types.ObjectId.isValid(eventId)) {
    return { linked: false };
  }
  const RelationshipInstance = require('../../models/RelationshipInstance');
  const orgOid = new mongoose.Types.ObjectId(organizationId);
  const source = {
    appKey: 'sales',
    moduleKey: 'people',
    recordId: new mongoose.Types.ObjectId(peopleId),
  };
  const target = {
    appKey: 'platform',
    moduleKey: 'events',
    recordId: new mongoose.Types.ObjectId(eventId),
  };
  const existing = await RelationshipInstance.findOne({
    organizationId: orgOid,
    relationshipKey: 'people_events',
    'source.appKey': source.appKey,
    'source.moduleKey': source.moduleKey,
    'source.recordId': source.recordId,
    'target.appKey': target.appKey,
    'target.moduleKey': target.moduleKey,
    'target.recordId': target.recordId,
  }).lean();
  if (existing) return { linked: true, already: true, relationshipKey: 'people_events' };

  await RelationshipInstance.create({
    organizationId: orgOid,
    relationshipKey: 'people_events',
    source,
    target,
    createdBy: userId,
  });
  return { linked: true, already: false, relationshipKey: 'people_events' };
}

function sanitizeFields(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const k = String(key || '').trim();
    if (!k || BLOCKED_FIELDS.has(k)) continue;
    if (k.toLowerCase().includes('password') || k.toLowerCase().includes('secret')) continue;
    if (value === undefined) continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
      // Allow nested customFields map only
      if (k === 'customFields' && typeof value === 'object') {
        const cf = {};
        for (const [ck, cv] of Object.entries(value)) {
          if (cv === undefined || typeof cv === 'object') continue;
          cf[String(ck).slice(0, 80)] = typeof cv === 'string' ? cv.slice(0, 2000) : cv;
        }
        if (Object.keys(cf).length) out.customFields = cf;
      }
      continue;
    }
    if (typeof value === 'string') out[k] = value.slice(0, 4000);
    else out[k] = value;
  }
  return out;
}

function assertUserCanMutate(user, moduleKey, action, appKey = 'SALES') {
  if (!user) {
    throw new AiConfigurationError('Authentication required', 'UNAUTHORIZED');
  }
  if (user.isOwner || isTenantPrivilegedUser(user)) return true;
  const allowed = resolveRuntimePermission(user, moduleKey, action, { appKey });
  if (!allowed) {
    throw new AiConfigurationError(
      `Missing permission to ${action} ${moduleKey}`,
      'AI_ASTRA_PERMISSION_DENIED',
    );
  }
  return true;
}

/**
 * Apply a proposed Astra mutation (create | update). Delete is rejected.
 */
async function applyAstraMutation({
  organizationId,
  user,
  op,
  moduleKey,
  recordId = '',
  fields = {},
  appKey = 'SALES',
  pageModuleKey = '',
  pageRecordId = '',
}) {
  const startedAt = Date.now();
  const operation = String(op || '').trim().toLowerCase();
  const mod = String(moduleKey || '').trim().toLowerCase();

  if (operation === 'delete' || operation === 'trash' || operation === 'remove') {
    throw new AiConfigurationError('Astra cannot delete records', 'AI_ASTRA_DELETE_FORBIDDEN');
  }
  if (operation !== 'create' && operation !== 'update') {
    throw new AiConfigurationError('op must be create or update', 'AI_ASTRA_OP_INVALID');
  }
  if (!ALLOWED_MODULES.has(mod)) {
    throw new AiConfigurationError(`Module not allowed: ${mod}`, 'AI_ASTRA_MODULE_FORBIDDEN');
  }

  const permAction = operation === 'create' ? 'create' : 'edit';
  assertUserCanMutate(user, mod, permAction, appKey);

  const linkPeopleId = extractLinkPeopleId(fields, pageModuleKey, pageRecordId, mod);
  const clean = sanitizeFields(fields);

  // Event.relatedToId is Organization only — never persist a People id there
  if (mod === 'events' && clean.relatedToId && linkPeopleId
    && String(clean.relatedToId) === String(linkPeopleId)) {
    delete clean.relatedToId;
  }
  if (mod === 'events' && String(pageModuleKey || '').toLowerCase() === 'people') {
    delete clean.relatedToId;
  }

  // Link-only update (agent trying to "fix relatedTold") with no other fields
  if (operation === 'update' && mod === 'events' && linkPeopleId && !Object.keys(clean).length) {
    const id = String(recordId || '').trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new AiConfigurationError('recordId is required for update', 'AI_ASTRA_RECORD_REQUIRED');
    }
    const Model = getModelForModuleKey(mod);
    const doc = await Model.findOne({
      _id: new mongoose.Types.ObjectId(id),
      organizationId: new mongoose.Types.ObjectId(organizationId),
    }).lean();
    if (!doc) {
      throw new AiConfigurationError('Record not found or not accessible', 'AI_ASTRA_RECORD_NOT_FOUND');
    }
    const linked = await ensurePeopleEventsLink({
      organizationId,
      userId: user._id,
      peopleId: linkPeopleId,
      eventId: id,
    });
    const result = {
      ok: true,
      op: 'update',
      moduleKey: mod,
      recordId: id,
      recordLabel: resolveRecordLabel(mod, doc),
      fieldsApplied: [],
      linked,
    };
    await writeAiAuditLog({
      organizationId,
      userId: user._id,
      abilityKey: 'astra_mutation',
      provider: 'none',
      model: 'none',
      keyMode: 'platform',
      status: 'success',
      promptVersion: 'astra_mutation_v1',
      latencyMs: Date.now() - startedAt,
      metadata: result,
    });
    return result;
  }

  if (!Object.keys(clean).length) {
    throw new AiConfigurationError('No valid fields to apply', 'AI_ASTRA_FIELDS_REQUIRED');
  }

  const Model = getModelForModuleKey(mod);
  if (!Model) {
    throw new AiConfigurationError(`Unsupported module: ${mod}`, 'AI_ASTRA_MODULE_UNSUPPORTED');
  }

  const orgOid = new mongoose.Types.ObjectId(organizationId);
  const userId = user._id;

  let result;
  try {
    if (operation === 'create') {
      const forceCreate = Boolean(fields?.forceCreate) || allowsForceCreate(String(fields?.forceCreateReason || ''));
      if (!forceCreate) {
        const duplicates = await findIntentDuplicatesForCreate({
          organizationId,
          moduleKey: mod,
          fields: { ...clean, linkPeopleId },
          userId,
        });
        if (duplicates.length) {
          const top = duplicates[0];
          const err = new AiConfigurationError(
            `Possible duplicate: "${top.label}". Open the existing record instead, or say "create anyway".`,
            'AI_ASTRA_DUPLICATE',
          );
          err.details = { duplicates, recommendedRecordId: top.recordId, moduleKey: top.moduleKey };
          throw err;
        }
      }

      const payload = { ...clean };

      // Normalize aliases before system stamps
      if (mod === 'tasks') {
        if (!payload.title && (payload.name || payload.subject || payload.taskName)) {
          payload.title = String(payload.name || payload.subject || payload.taskName).trim();
        }
        delete payload.name;
        delete payload.subject;
        delete payload.taskName;
        if (!payload.status) payload.status = 'todo';
        if (!payload.priority) payload.priority = 'medium';
        if (!payload.taskType) payload.taskType = 'general_task';
      }
      if (mod === 'events') {
        if (!payload.eventType) payload.eventType = 'Meeting';
        if (!payload.status) payload.status = 'Planned';
      }
      if (mod === 'deals' && !payload.name && payload.dealName) {
        payload.name = payload.dealName;
      }

      if (Model.schema?.paths?.organizationId) {
        payload.organizationId = orgOid;
      }
      if (mod === 'organizations' || mod === 'organization') {
        payload.isTenant = false;
      }

      // System actor stamps — required on several CRM models (e.g. Event.modifiedBy)
      if (Model.schema?.paths?.createdBy && !payload.createdBy) payload.createdBy = userId;
      if (Model.schema?.paths?.modifiedBy && !payload.modifiedBy) payload.modifiedBy = userId;
      if (Model.schema?.paths?.updatedBy && !payload.updatedBy) payload.updatedBy = userId;
      if (Model.schema?.paths?.assignedBy && !payload.assignedBy) payload.assignedBy = userId;
      if (Model.schema?.paths?.createdTime && !payload.createdTime) payload.createdTime = new Date();
      if (Model.schema?.paths?.modifiedTime && !payload.modifiedTime) payload.modifiedTime = new Date();
      if (Model.schema?.paths?.assignedTo && !payload.assignedTo) {
        payload.assignedTo = userId;
      }

      // Task relatedTo contact when creating from a people page (passed via fields)
      if (mod === 'tasks' && payload.relatedToId && !payload.relatedTo) {
        const relType = String(payload.relatedToType || payload.relatedModule || 'contact').toLowerCase();
        const typeMap = {
          people: 'contact',
          person: 'contact',
          contact: 'contact',
          organizations: 'organization',
          organization: 'organization',
          deals: 'deal',
          deal: 'deal',
        };
        payload.relatedTo = {
          type: typeMap[relType] || 'contact',
          id: payload.relatedToId,
        };
        delete payload.relatedToId;
        delete payload.relatedToType;
        delete payload.relatedToModule;
        delete payload.relatedModule;
      }

      try {
        const { assignResolvedSource } = require('../sourceResolver');
        assignResolvedSource(payload, 'ai_astra');
      } catch {
        /* optional */
      }

      const doc = await Model.create(payload);
      result = {
        ok: true,
        op: 'create',
        moduleKey: mod,
        recordId: String(doc._id),
        recordLabel: resolveRecordLabel(mod, doc),
        fieldsApplied: Object.keys(clean),
      };

      if (mod === 'events' && linkPeopleId) {
        try {
          result.linked = await ensurePeopleEventsLink({
            organizationId,
            userId,
            peopleId: linkPeopleId,
            eventId: doc._id,
          });
        } catch {
          result.linked = { linked: false, error: 'people_events_link_failed' };
        }
      }

      try {
        const { publishDataChange } = require('../dataChangeService');
        publishDataChange({
          organizationId,
          moduleKey: mod,
          recordId: doc._id,
          op: 'create',
        });
      } catch {
        /* non-blocking */
      }
    } else {
      const id = String(recordId || '').trim();
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new AiConfigurationError('recordId is required for update', 'AI_ASTRA_RECORD_REQUIRED');
      }

      const query = { _id: new mongoose.Types.ObjectId(id) };
      if (Model.schema?.paths?.organizationId) {
        query.organizationId = orgOid;
      }
      if (mod === 'organizations' || mod === 'organization') {
        query.isTenant = false;
      }
      if (Model.schema?.paths?.deletedAt) query.deletedAt = null;

      const update = { ...clean };
      if (mod === 'tasks' && !update.title && (update.name || update.subject)) {
        update.title = String(update.name || update.subject).trim();
        delete update.name;
        delete update.subject;
      }
      if (Model.schema?.paths?.updatedBy) update.updatedBy = userId;
      if (Model.schema?.paths?.modifiedBy) update.modifiedBy = userId;
      if (Model.schema?.paths?.modifiedTime) update.modifiedTime = new Date();

      const doc = await Model.findOneAndUpdate(query, { $set: update }, { new: true });
      if (!doc) {
        throw new AiConfigurationError('Record not found or not accessible', 'AI_ASTRA_RECORD_NOT_FOUND');
      }

      result = {
        ok: true,
        op: 'update',
        moduleKey: mod,
        recordId: String(doc._id),
        recordLabel: resolveRecordLabel(mod, doc),
        fieldsApplied: Object.keys(clean),
      };

      if (mod === 'events' && linkPeopleId) {
        try {
          result.linked = await ensurePeopleEventsLink({
            organizationId,
            userId,
            peopleId: linkPeopleId,
            eventId: doc._id,
          });
        } catch {
          result.linked = { linked: false, error: 'people_events_link_failed' };
        }
      }

      try {
        const { publishDataChange } = require('../dataChangeService');
        publishDataChange({
          organizationId,
          moduleKey: mod,
          recordId: doc._id,
          op: 'update',
        });
      } catch {
        /* non-blocking */
      }
    }

    await writeAiAuditLog({
      organizationId,
      userId,
      abilityKey: 'astra_mutation',
      provider: 'none',
      model: 'none',
      keyMode: 'platform',
      status: 'success',
      promptVersion: 'astra_mutation_v1',
      latencyMs: Date.now() - startedAt,
      metadata: result,
    });

    return result;
  } catch (error) {
    if (error instanceof AiConfigurationError) throw error;
    await writeAiAuditLog({
      organizationId,
      userId,
      abilityKey: 'astra_mutation',
      provider: 'none',
      model: 'none',
      keyMode: 'platform',
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_ASTRA_MUTATION_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  applyAstraMutation,
  sanitizeFields,
  resolveRecordLabel,
  ensurePeopleEventsLink,
  ALLOWED_MODULES,
  BLOCKED_FIELDS,
};
