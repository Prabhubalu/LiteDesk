/**
 * Unified record API for all modules: activity, comments, and prev/next navigation.
 * Record CRUD stays on existing routes (GET /deals/:id, etc.); this controller
 * provides activity, comments, and neighbors for ModuleRecordPage.
 */
const Deal = require('../models/Deal');
const DealComment = require('../models/DealComment');
const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const RecordActivity = require('../models/RecordActivity');
const documentService = require('../services/documentService');
const recordPresenceService = require('../services/recordPresenceService');
const User = require('../models/User');
const mongoose = require('mongoose');
const { persistMulterUpload } = require('../middleware/uploadMiddleware');
const { processCommentMentions } = require('../services/commentMentionNotifications');

const MODULES_WITH_NATIVE_ACTIVITY = new Set(['deals', 'tasks']);
const MODULES_WITH_NATIVE_COMMENTS = new Set(['deals', 'tasks']);

function getCommentAuthorName(author) {
  if (!author) return 'Someone';
  return [author.firstName, author.lastName].filter(Boolean).join(' ') || author.username || 'Someone';
}

function dispatchRecordActivityCommentMentions({
  req,
  moduleKey,
  recordId,
  commentId,
  commentContent,
  author
}) {
  processCommentMentions({
    organizationId: String(req.user.organizationId),
    appKey: req.appKey || 'SALES',
    moduleKey,
    entityId: String(recordId),
    commentId: String(commentId),
    commentContent,
    authorId: String(req.user._id),
    authorName: getCommentAuthorName(author)
  }).catch((err) => console.error('[moduleRecordController] comment mention notifications error:', err));
}

function isMasterOrganizationRequest(req) {
  const orgName = String(req?.organization?.name || '').trim().toLowerCase();
  const userEmail = String(req?.user?.email || '').trim().toLowerCase();
  const isInternalEmail =
    userEmail.endsWith('@arivusystems.com')
    || userEmail.endsWith('@arivu.com')
    || userEmail.endsWith('@arivu.io');
  return orgName === 'arivu master' || orgName.includes('arivu master') || isInternalEmail;
}

async function buildOrganizationRecordAccessQuery(organizationId, recordId, req) {
  if (isMasterOrganizationRequest(req)) {
    return {
      _id: recordId,
      isTenant: false,
      deletedAt: null
    };
  }
  const { buildTenantAccessibleCrmOrganizationQuery } = require('../utils/crmOrganizationAccess');
  return buildTenantAccessibleCrmOrganizationQuery(organizationId, {
    recordIds: [recordId]
  });
}

/**
 * Default list handler: given a model and orgId, return record IDs for prev/next.
 * Used for any module that has a known model (add new modules here or via getDefaultListHandler).
 */
async function getRecordIdsFromModel(Model, organizationId, baseQuery = {}) {
  const query = { organizationId, ...baseQuery };
  if (Model.schema?.paths?.deletedAt) query.deletedAt = null;
  const ids = await Model.find(query)
    .sort({ updatedAt: -1 })
    .limit(500)
    .select('_id')
    .lean();
  return ids.map((d) => d._id.toString());
}

/**
 * Model getters for modules with a backing collection.
 * To add a new/custom module with prev/next support: add an entry here (e.g. tickets: () => require('../models/Ticket')).
 * getListHandlerForModule() will then return a list handler for that module by default.
 */
const MODEL_BY_KEY = {
  deals: () => Deal,
  tasks: () => Task,
  cases: () => require('../models/Case'),
  people: () => require('../models/People'),
  organizations: () => require('../models/Organization'),
  events: () => require('../models/Event'),
  items: () => require('../models/Item'),
  forms: () => require('../models/Form'),
  responses: () => require('../models/FormResponse'),
  quotes: () => require('../models/Quote'),
  sales_orders: () => require('../models/SalesOrder')
};

/** Optional base query per module (e.g. Organization uses isTenant: false). */
const LIST_BASE_QUERY_BY_KEY = {
  organizations: () => ({ isTenant: false })
};

/** Explicit list handlers (override default model behavior when needed). */
const LIST_HANDLERS = {
  deals: (organizationId) => getRecordIdsFromModel(Deal, organizationId),
  tasks: (organizationId) => getRecordIdsFromModel(Task, organizationId),
  cases: (organizationId) => getRecordIdsFromModel(require('../models/Case'), organizationId),
  people: (organizationId) => getRecordIdsFromModel(require('../models/People'), organizationId),
  organizations: (organizationId) =>
    getRecordIdsFromModel(require('../models/Organization'), organizationId, { isTenant: false }),
  events: (organizationId) => getRecordIdsFromModel(require('../models/Event'), organizationId),
  items: (organizationId) => getRecordIdsFromModel(require('../models/Item'), organizationId),
  responses: (organizationId) =>
    getRecordIdsFromModel(require('../models/FormResponse'), organizationId),
  quotes: (organizationId) => getRecordIdsFromModel(require('../models/Quote'), organizationId),
  sales_orders: (organizationId) => getRecordIdsFromModel(require('../models/SalesOrder'), organizationId)
};

/**
 * Resolve list handler for a module. Uses LIST_HANDLERS first, then builds one from MODEL_BY_KEY so
 * new/custom modules get prev/next by default when their model is registered.
 */
function getListHandlerForModule(moduleKey) {
  const key = (moduleKey || '').toLowerCase();
  if (LIST_HANDLERS[key]) return LIST_HANDLERS[key];
  const getModel = MODEL_BY_KEY[key];
  if (!getModel) return null;
  const baseQuery = LIST_BASE_QUERY_BY_KEY[key] ? LIST_BASE_QUERY_BY_KEY[key]() : {};
  return (organizationId) => getRecordIdsFromModel(getModel(), organizationId, baseQuery);
}

function getModuleKey(req) {
  return (req.params.moduleKey || '').toLowerCase().trim();
}

function getRecordId(req) {
  return req.params.recordId;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeReactionEmoji(value) {
  return String(value || '').trim();
}

const { getAppDisplayName } = require('../utils/personProfileComposer');

/**
 * Fallback message for legacy People.activityLogs entries (no `message` field).
 * @param {Record<string, any>} log
 * @returns {string}
 */
function peopleEmbeddedActivityMessage(log) {
  if (log.message && String(log.message).trim()) return String(log.message).trim();
  const d = log.details || {};
  const appKey = d.appKey || log.appContext;
  const appLabel = appKey ? getAppDisplayName(String(appKey)) : '';
  const role =
    d.participationType ||
    d.peopleType ||
    (typeof d.role === 'string' ? d.role : null);
  if (d.type === 'create') {
    if (role && appLabel) return `Created this person and joined ${appLabel} as ${role}`;
    if (appLabel) return `Created this person (${appLabel})`;
    return 'Created this person';
  }
  if (log.action === 'app_context_attached' || d.type === 'attach') {
    if (role && appLabel) return `Joined ${appLabel} as ${role}`;
    if (appLabel) return `Joined ${appLabel}`;
    return 'Joined an app';
  }
  const a = String(log.action || '');
  const legacy = a.match(/^added_to_(\w+)_as_(.+)$/i);
  if (legacy) {
    const rawApp = legacy[1].toLowerCase();
    const app = rawApp === 'sales' ? 'Sales' : rawApp === 'helpdesk' ? 'Helpdesk' : legacy[1];
    const typePart = legacy[2].replace(/_/g, ' ');
    return `Joined ${app} as ${typePart}`;
  }
  if (a === 'created this record' || a === 'record_created') return 'Created this person';
  if (a === 'process_completed' || a === 'process_failed' || a === 'process_waiting_approval' || a === 'process_waiting') {
    const name = d.processName || 'Process';
    if (a === 'process_completed') return `Process "${name}" completed`;
    if (a === 'process_failed') return d.error ? `Process "${name}" failed: ${d.error}` : `Process "${name}" failed`;
    if (a === 'process_waiting_approval') return `Process "${name}" is waiting for approval`;
    if (a === 'process_waiting') return `Process "${name}" is paused until a scheduled time`;
  }
  return '';
}

/**
 * Merge embedded People.activityLogs into unified activity events (ModuleRecordPage).
 * @param {Array<Record<string, any>>} events
 * @param {string} recordId
 * @param {import('mongoose').Types.ObjectId} organizationId
 */
/**
 * Merge embedded Case.activities into unified activity (ModuleRecordPage Activity tab).
 * Case CRUD writes timeline entries here; they are not stored in RecordActivity.
 * @param {Array<Record<string, any>>} events
 * @param {string} recordId
 * @param {import('mongoose').Types.ObjectId} organizationId
 */
async function mergeCaseEmbeddedActivities(events, recordId, organizationId) {
  const Case = require('../models/Case');
  const caseDoc = await Case.findOne({
    _id: recordId,
    organizationId,
    deletedAt: null
  })
    .select('activities')
    .lean();
  if (!caseDoc || !Array.isArray(caseDoc.activities) || caseDoc.activities.length === 0) return;
  const userIds = [...new Set(caseDoc.activities.map((a) => a.actorId).filter(Boolean))];
  let usersMap = {};
  if (userIds.length > 0) {
    const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName username email').lean();
    usersMap = users.reduce((acc, u) => {
      acc[u._id.toString()] = u;
      return acc;
    }, {});
  }
  for (const a of caseDoc.activities) {
    const uid = a.actorId && a.actorId.toString();
    const u = uid && usersMap[uid];
    const actor = a.actorName
      ? String(a.actorName)
      : (u
        ? `${(u.firstName || '').trim()} ${(u.lastName || '').trim()}`.trim() || u.username || u.email || 'Unknown'
        : 'System');
    const actorProfile = u
      ? {
          _id: u._id?.toString(),
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          username: u.username
        }
      : null;
    const createdAt = a.createdAt ? new Date(a.createdAt).toISOString() : null;
    const idSuffix = a._id != null ? String(a._id) : `${createdAt || 'na'}-${a.activityType || 'act'}`;
    events.push({
      id: `case-embedded-${idSuffix}`,
      type: 'system',
      actor,
      actorProfile,
      createdAt,
      payload: {
        action: a.activityType || 'case_activity',
        message: a.message || '',
        details: a.metadata && typeof a.metadata === 'object' ? a.metadata : {}
      }
    });
  }
}

async function mergePeopleEmbeddedActivity(events, recordId, organizationId) {
  const People = require('../models/People');
  const person = await People.findOne({
    _id: recordId,
    organizationId,
    deletedAt: null
  })
    .select('activityLogs')
    .lean();
  if (!person || !Array.isArray(person.activityLogs)) return;
  const userIds = [...new Set(person.activityLogs.map((l) => l.userId).filter(Boolean))];
  let usersMap = {};
  if (userIds.length > 0) {
    const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName username email').lean();
    usersMap = users.reduce((acc, u) => {
      acc[u._id.toString()] = u;
      return acc;
    }, {});
  }
  for (const log of person.activityLogs) {
    const u = log.userId && usersMap[log.userId.toString()];
    const actor = u
      ? `${(u.firstName || '').trim()} ${(u.lastName || '').trim()}`.trim() || u.username || u.email || 'Unknown'
      : (log.user || 'Unknown');
    const actorProfile = u
      ? {
          _id: u._id?.toString(),
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          username: u.username
        }
      : null;
    const message = peopleEmbeddedActivityMessage(log);
    events.push({
      id: `people-embedded-${log.timestamp}-${log._id || ''}`,
      type: 'system',
      actor,
      actorProfile,
      createdAt: log.timestamp ? new Date(log.timestamp).toISOString() : null,
      payload: {
        action: log.action || 'updated',
        message: message || '',
        details: log.details || {}
      }
    });
  }
}

/**
 * GET /api/modules/:moduleKey/records/:recordId/activity
 * Returns merged activity logs + comments for the record (all modules).
 */
exports.getActivity = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const recordId = getRecordId(req);
    const organizationId = req.user.organizationId;

    if (!moduleKey || !recordId) {
      return res.status(400).json({ success: false, message: 'moduleKey and recordId are required' });
    }

    const events = [];

    if (MODULES_WITH_NATIVE_ACTIVITY.has(moduleKey)) {
      if (moduleKey === 'deals') {
        const deal = await Deal.findOne({
          _id: recordId,
          organizationId,
          deletedAt: null
        }).select('activityLogs').lean();
        if (deal && Array.isArray(deal.activityLogs)) {
          const userIds = [...new Set(deal.activityLogs.map((l) => l.userId).filter(Boolean))];
          let usersMap = {};
          if (userIds.length > 0) {
            const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName username email').lean();
            usersMap = users.reduce((acc, u) => {
              acc[u._id.toString()] = u;
              return acc;
            }, {});
          }
          for (const log of deal.activityLogs) {
            const user = log.userId && usersMap[log.userId.toString()];
            const actor = user ? `${(user.firstName || '').trim()} ${(user.lastName || '').trim()}`.trim() || user.username || user.email || 'Unknown' : (log.user || 'Unknown');
            events.push({
              id: `activity-${log.timestamp}-${log._id || ''}`,
              type: 'system',
              actor: log.user && log.user !== 'Unknown' ? log.user : actor,
              createdAt: log.timestamp ? new Date(log.timestamp).toISOString() : null,
              payload: { action: log.action || 'updated', message: log.message || '', details: log.details || {} }
            });
          }
        }
        const comments = await DealComment.find({ dealId: recordId, organizationId })
          .populate('author', 'firstName lastName email username')
          .sort({ createdAt: 1 })
          .lean();
        for (const c of comments) {
          const author = c.author;
          const actor = author ? `${(author.firstName || '').trim()} ${(author.lastName || '').trim()}`.trim() || author.username || author.email : 'Unknown';
          events.push({
            id: `comment-${c._id}`,
            type: 'comment',
            actor,
            createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
            payload: {
              body: c.content,
              parentCommentId: c.parentCommentId ? c.parentCommentId.toString() : null,
              attachments: c.attachments || [],
              reactions: c.reactions || [],
              editedAt: c.editedAt || null,
              commentId: c._id.toString()
            },
            meta: { authorId: c.author?._id?.toString() }
          });
        }
      } else if (moduleKey === 'tasks') {
        const task = await Task.findOne({
          _id: recordId,
          organizationId,
          deletedAt: null
        })
          .populate('activityLogs.userId', 'firstName lastName username email')
          .select('activityLogs createdAt updatedAt createdBy')
          .lean();
        if (task) {
          const getUserName = (u) => {
            if (!u) return 'System';
            if (typeof u === 'string') return u;
            const name = [(u.firstName || ''), (u.lastName || '')].filter(Boolean).join(' ').trim();
            return name || u.username || u.email || 'User';
          };
          const logs = (task.activityLogs || []).map((entry) => ({
            timestamp: entry.timestamp || task.updatedAt || task.createdAt,
            user: getUserName(entry.userId),
            action: entry.action || 'updated',
            details: entry.details || {}
          }));
          if (logs.length === 0 && task.createdAt) {
            logs.push({
              timestamp: task.createdAt,
              user: getUserName(task.createdBy),
              action: 'created',
              details: {}
            });
          }
          for (const log of logs) {
            events.push({
              id: `activity-${log.timestamp}-${Math.random()}`,
              type: 'system',
              actor: log.user,
              createdAt: log.timestamp ? new Date(log.timestamp).toISOString() : null,
              payload: { action: log.action, message: '', details: log.details }
            });
          }
        }
        const comments = await TaskComment.find({ taskId: recordId, organizationId })
          .populate('author', 'firstName lastName email username')
          .sort({ createdAt: 1 })
          .lean();
        for (const c of comments) {
          const author = c.author;
          const actor = author ? `${(author.firstName || '').trim()} ${(author.lastName || '').trim()}`.trim() || author.username || author.email : 'Unknown';
          events.push({
            id: `comment-${c._id}`,
            type: 'comment',
            actor,
            createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
            payload: {
              body: c.content,
              parentCommentId: c.parentCommentId ? c.parentCommentId.toString() : null,
              attachments: c.attachments || [],
              reactions: c.reactions || [],
              editedAt: c.editedAt || null,
              commentId: c._id.toString()
            },
            meta: { authorId: c.author?._id?.toString() }
          });
        }
      }
    } else {
      const generic = await RecordActivity.find({
        organizationId,
        moduleKey,
        recordId: new mongoose.Types.ObjectId(recordId)
      })
        .populate('author', 'firstName lastName email username')
        .sort({ createdAt: 1 })
        .lean();
      for (const entry of generic) {
        const author = entry.author;
        const actorLabel = entry.details?.actorLabel;
        const actorDisplay = actorLabel === 'customer'
          ? 'Customer'
          : author
            ? `${(author.firstName || '').trim()} ${(author.lastName || '').trim()}`.trim() || author.username || author.email
            : 'Unknown';
        const actorProfile = author ? {
          _id: author._id?.toString(),
          firstName: author.firstName,
          lastName: author.lastName,
          email: author.email,
          username: author.username
        } : null;
        if (entry.type === 'activity') {
          events.push({
            id: `activity-${entry._id}`,
            type: 'system',
            actor: actorDisplay,
            actorProfile,
            createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
            payload: { action: entry.action || 'updated', message: entry.message || '', details: entry.details || {} }
          });
        } else {
          events.push({
            id: `comment-${entry._id}`,
            type: 'comment',
            actor: actorDisplay,
            actorProfile,
            createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
            payload: {
              body: entry.content,
              parentCommentId: entry.parentCommentId ? entry.parentCommentId.toString() : null,
              attachments: entry.attachments || [],
              reactions: entry.reactions || [],
              editedAt: entry.editedAt || null,
              commentId: entry._id.toString()
            },
            meta: { authorId: entry.author?._id?.toString() }
          });
        }
      }

      if (moduleKey === 'people') {
        await mergePeopleEmbeddedActivity(events, recordId, organizationId);
      }
      if (moduleKey === 'cases') {
        await mergeCaseEmbeddedActivities(events, recordId, organizationId);
      }
      if (moduleKey === 'documents') {
        await documentService.mergeDocumentAuditActivity(events, recordId, organizationId);
      }
    }

    events.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

    return res.json({ success: true, data: events });
  } catch (err) {
    console.error('getActivity error:', err);
    return res.status(500).json({ success: false, message: 'Error fetching activity', error: err.message });
  }
};

/**
 * GET /api/modules/:moduleKey/records/:recordId/comments
 */
exports.getComments = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const recordId = getRecordId(req);
    const organizationId = req.user.organizationId;

    if (!moduleKey || !recordId) {
      return res.status(400).json({ success: false, message: 'moduleKey and recordId are required' });
    }

    if (MODULES_WITH_NATIVE_COMMENTS.has(moduleKey)) {
      if (moduleKey === 'deals') {
        const deal = await Deal.findOne({ _id: recordId, organizationId, deletedAt: null }).select('_id').lean();
        if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
        const comments = await DealComment.find({ dealId: recordId, organizationId })
          .populate('author', 'firstName lastName email avatar username')
          .populate('reactions.users', 'firstName lastName email avatar username')
          .sort({ createdAt: 1 })
          .lean();
        const { buildDealCommentResponse } = require('./dealController');
        const data = comments.map((c) => buildDealCommentResponse(c, req.user?._id));
        return res.json({ success: true, data });
      }
      if (moduleKey === 'tasks') {
        const task = await Task.findOne({ _id: recordId, organizationId, deletedAt: null }).select('_id').lean();
        if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
        const comments = await TaskComment.find({ taskId: recordId, organizationId })
          .populate('author', 'firstName lastName email avatar username')
          .populate('reactions.users', 'firstName lastName email avatar username')
          .sort({ createdAt: 1 })
          .lean();
        const { buildTaskCommentResponse } = require('./taskController');
        const data = comments.map((c) => buildTaskCommentResponse(c, req.user?._id));
        return res.json({ success: true, data });
      }
    }

    const comments = await RecordActivity.find({
      organizationId,
      moduleKey,
      recordId: new mongoose.Types.ObjectId(recordId),
      type: 'comment'
    })
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .sort({ createdAt: 1 })
      .lean();

    const data = comments.map((c) => ({
      _id: c._id,
      content: c.content,
      parentCommentId: c.parentCommentId,
      attachments: c.attachments || [],
      reactions: (c.reactions || []).map((r) => ({
        emoji: r.emoji,
        users: r.users || [],
        count: (r.users || []).length
      })),
      author: c.author,
      editedAt: c.editedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('getComments error:', err);
    return res.status(500).json({ success: false, message: 'Error fetching comments', error: err.message });
  }
};

/**
 * POST /api/modules/:moduleKey/records/:recordId/comment-attachments
 */
exports.uploadCommentAttachment = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const recordId = getRecordId(req);
    const organizationId = req.user.organizationId;

    if (!moduleKey || !recordId) {
      return res.status(400).json({ success: false, message: 'moduleKey and recordId are required' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (MODULES_WITH_NATIVE_COMMENTS.has(moduleKey)) {
      const fakeReq = {
        params: { id: recordId },
        user: req.user,
        file: req.file
      };
      const fakeRes = {
        statusCode: 200,
        _data: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(obj) {
          this._data = obj;
          return this;
        }
      };
      if (moduleKey === 'deals') {
        const { uploadDealCommentAttachment } = require('./dealController');
        await uploadDealCommentAttachment(fakeReq, fakeRes);
      } else {
        const { uploadTaskCommentAttachment } = require('./taskController');
        await uploadTaskCommentAttachment(fakeReq, fakeRes);
      }
      return res.status(fakeRes.statusCode).json(fakeRes._data);
    }

    const recordObjectId = mongoose.Types.ObjectId.isValid(recordId)
      ? new mongoose.Types.ObjectId(recordId)
      : null;
    if (!recordObjectId) {
      return res.status(400).json({ success: false, message: 'Invalid record id' });
    }

    const Model = MODEL_BY_KEY[moduleKey]?.();
    if (!Model) {
      return res.status(404).json({ success: false, message: `Unknown module: ${moduleKey}` });
    }
    let record;
    if (moduleKey === 'organizations') {
      const baseQuery = await buildOrganizationRecordAccessQuery(organizationId, recordObjectId, req);
      record = await Model.findOne(baseQuery).select('_id').lean();
    } else {
      const baseQuery = { _id: recordObjectId };
      if (Model.schema?.paths?.deletedAt) {
        baseQuery.deletedAt = null;
      }
      baseQuery.organizationId = organizationId;
      record = await Model.findOne(baseQuery).select('_id').lean();
    }
    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    const uploadResult = await persistMulterUpload(req, 'comments');
    let documentId = null;
    try {
      const { SOURCE_APP_BY_MODULE } = require('../constants/defaultDocumentRelationships');
      const documentService = require('../services/documentService');
      const registration = await documentService.registerCommentAttachmentAsDocument({
        organizationId,
        userId: req.user._id,
        moduleKey,
        recordId,
        appKey: SOURCE_APP_BY_MODULE[moduleKey] || 'platform',
        uploadResult,
        file: req.file
      });
      documentId = registration?.document?._id ? String(registration.document._id) : null;
    } catch (registerError) {
      console.error('Module comment attachment document registration failed:', registerError.message);
    }
    return res.json({
      success: true,
      url: uploadResult.url,
      storagePath: uploadResult.storagePath,
      filename: uploadResult.storedFileName,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      documentId
    });
  } catch (err) {
    console.error('uploadCommentAttachment error:', err);
    return res.status(500).json({ success: false, message: 'Error uploading attachment', error: err.message });
  }
};

/**
 * POST /api/modules/:moduleKey/records/:recordId/comments
 */
exports.createComment = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const recordId = getRecordId(req);
    const organizationId = req.user.organizationId;
    const { content, attachments, parentCommentId } = req.body || {};

    if (!moduleKey || !recordId) {
      return res.status(400).json({ success: false, message: 'moduleKey and recordId are required' });
    }
    const validAttachments = Array.isArray(attachments)
      ? attachments
        .filter((attachment) => (
          attachment
            && typeof attachment.url === 'string'
            && typeof attachment.filename === 'string'
        ))
        .slice(0, 10)
        .map((attachment) => {
          const row = {
            url: attachment.url,
            filename: attachment.filename,
            size: attachment.size || 0,
            mimetype: attachment.mimetype || ''
          };
          if (attachment.documentId && mongoose.Types.ObjectId.isValid(attachment.documentId)) {
            row.documentId = attachment.documentId;
          }
          return row;
        })
      : [];
    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    if (!normalizedContent && validAttachments.length === 0) {
      return res.status(400).json({ success: false, message: 'Comment content or attachment is required' });
    }

    if (MODULES_WITH_NATIVE_COMMENTS.has(moduleKey)) {
      const fakeReq = {
        params: { id: recordId },
        user: req.user,
        body: req.body
      };
      const fakeRes = {
        statusCode: 200,
        _data: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(obj) {
          this._data = obj;
          return this;
        }
      };
      if (moduleKey === 'deals') {
        const { createDealComment } = require('./dealController');
        await createDealComment(fakeReq, fakeRes);
      } else {
        const { createTaskComment } = require('./taskController');
        await createTaskComment(fakeReq, fakeRes);
      }
      return res.status(fakeRes.statusCode).json(fakeRes._data);
    }

    let validatedParentId = null;
    if (parentCommentId && mongoose.Types.ObjectId.isValid(parentCommentId)) {
      const parent = await RecordActivity.findOne({
        _id: parentCommentId,
        organizationId,
        moduleKey,
        recordId: new mongoose.Types.ObjectId(recordId),
        type: 'comment'
      }).select('_id').lean();
      if (parent) validatedParentId = parent._id;
    }

    const commentDetails =
      moduleKey === 'quotes'
        ? { portalThread: req.body?.internalOnly !== true }
        : {};

    const comment = await RecordActivity.create({
      organizationId,
      moduleKey,
      recordId: new mongoose.Types.ObjectId(recordId),
      type: 'comment',
      content: normalizedContent || 'Attached file(s)',
      parentCommentId: validatedParentId,
      attachments: validAttachments,
      details: commentDetails,
      author: req.user._id
    });

    const populated = await RecordActivity.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .lean();

    dispatchRecordActivityCommentMentions({
      req,
      moduleKey,
      recordId,
      commentId: comment._id,
      commentContent: populated.content,
      author: populated.author
    });

    return res.status(201).json({
      success: true,
      data: {
        _id: populated._id,
        content: populated.content,
        parentCommentId: populated.parentCommentId,
        attachments: populated.attachments || [],
        reactions: populated.reactions || [],
        author: populated.author,
        createdAt: populated.createdAt,
        updatedAt: populated.updatedAt
      }
    });
  } catch (err) {
    console.error('createComment error:', err);
    return res.status(500).json({ success: false, message: 'Error creating comment', error: err.message });
  }
};

/**
 * PUT /api/modules/:moduleKey/records/:recordId/comments/:commentId
 */
exports.updateComment = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const recordId = getRecordId(req);
    const { commentId } = req.params;
    const organizationId = req.user.organizationId;

    if (!moduleKey || !recordId || !commentId) {
      return res.status(400).json({ success: false, message: 'moduleKey, recordId, and commentId are required' });
    }

    if (MODULES_WITH_NATIVE_COMMENTS.has(moduleKey)) {
      const fakeReq = {
        params: { id: recordId, commentId },
        user: req.user,
        body: req.body,
        appKey: req.appKey
      };
      const fakeRes = {
        statusCode: 200,
        _data: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(obj) {
          this._data = obj;
          return this;
        }
      };

      if (moduleKey === 'deals') {
        const { updateDealComment } = require('./dealController');
        await updateDealComment(fakeReq, fakeRes);
      } else {
        const { updateTaskComment } = require('./taskController');
        await updateTaskComment(fakeReq, fakeRes);
      }

      return res.status(fakeRes.statusCode).json(fakeRes._data);
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid commentId' });
    }

    const comment = await RecordActivity.findOne({
      _id: commentId,
      organizationId,
      moduleKey,
      recordId: new mongoose.Types.ObjectId(recordId),
      type: 'comment'
    });

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (String(comment.author) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own comments' });
    }

    const rawContent = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const hasAttachmentsPayload = Array.isArray(req.body?.attachments);
    const validAttachments = hasAttachmentsPayload
      ? req.body.attachments
        .filter((attachment) => (
          attachment
          && typeof attachment.url === 'string'
          && typeof attachment.filename === 'string'
        ))
        .slice(0, 10)
      : (comment.attachments || []);

    if (!rawContent && (!Array.isArray(validAttachments) || validAttachments.length === 0)) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    comment.content = rawContent || 'Attached file(s)';
    if (hasAttachmentsPayload) {
      comment.attachments = validAttachments;
    }
    comment.editedAt = new Date();
    await comment.save();

    const populated = await RecordActivity.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .lean();

    const currentUserId = String(req.user._id);
    const data = {
      _id: populated._id,
      content: populated.content,
      parentCommentId: populated.parentCommentId,
      attachments: populated.attachments || [],
      reactions: (populated.reactions || []).map((reaction) => ({
        emoji: reaction.emoji,
        users: reaction.users || [],
        count: Array.isArray(reaction.users) ? reaction.users.length : 0,
        reactors: (reaction.users || []).map((u) => ({
          id: u?._id ? String(u._id) : undefined,
          _id: u?._id,
          name: [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.username || u?.email || 'Unknown',
          firstName: u?.firstName,
          lastName: u?.lastName,
          email: u?.email,
          username: u?.username,
          avatar: u?.avatar || ''
        }))
      })),
      myReactions: (populated.reactions || [])
        .filter((reaction) => (reaction.users || []).some((u) => String(u?._id || u) === currentUserId))
        .map((reaction) => reaction.emoji),
      author: populated.author,
      editedAt: populated.editedAt,
      createdAt: populated.createdAt,
      updatedAt: populated.updatedAt
    };

    dispatchRecordActivityCommentMentions({
      req,
      moduleKey,
      recordId,
      commentId: comment._id,
      commentContent: populated.content,
      author: populated.author
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('updateComment error:', err);
    return res.status(500).json({ success: false, message: 'Error updating comment', error: err.message });
  }
};

/**
 * POST /api/modules/:moduleKey/records/:recordId/comments/:commentId/reactions
 */
exports.toggleCommentReaction = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const recordId = getRecordId(req);
    const { commentId } = req.params;
    const organizationId = req.user.organizationId;
    const emoji = normalizeReactionEmoji(req.body?.emoji);

    if (!moduleKey || !recordId || !commentId) {
      return res.status(400).json({ success: false, message: 'moduleKey, recordId, and commentId are required' });
    }
    if (!emoji || emoji.length > 16) {
      return res.status(400).json({ success: false, message: 'A valid emoji is required' });
    }

    if (MODULES_WITH_NATIVE_COMMENTS.has(moduleKey)) {
      const fakeReq = {
        params: { id: recordId, commentId },
        user: req.user,
        body: req.body
      };
      const fakeRes = {
        statusCode: 200,
        _data: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(obj) {
          this._data = obj;
          return this;
        }
      };

      if (moduleKey === 'deals') {
        const { toggleDealCommentReaction } = require('./dealController');
        await toggleDealCommentReaction(fakeReq, fakeRes);
      } else {
        const { toggleTaskCommentReaction } = require('./taskController');
        await toggleTaskCommentReaction(fakeReq, fakeRes);
      }

      return res.status(fakeRes.statusCode).json(fakeRes._data);
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid commentId' });
    }

    const comment = await RecordActivity.findOne({
      _id: commentId,
      organizationId,
      moduleKey,
      recordId: new mongoose.Types.ObjectId(recordId),
      type: 'comment'
    });

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (!Array.isArray(comment.reactions)) {
      comment.reactions = [];
    }

    const currentUserId = String(req.user._id);
    let reaction = comment.reactions.find((entry) => normalizeReactionEmoji(entry?.emoji) === emoji);

    if (!reaction) {
      comment.reactions.push({
        emoji,
        users: [req.user._id]
      });
    } else {
      const userIndex = reaction.users.findIndex((userId) => String(userId) === currentUserId);
      if (userIndex >= 0) {
        reaction.users.splice(userIndex, 1);
      } else {
        reaction.users.push(req.user._id);
      }

      if (!reaction.users.length) {
        comment.reactions = comment.reactions.filter((entry) => String(entry._id) !== String(reaction._id));
      }
    }

    comment.markModified('reactions');
    await comment.save();

    const populated = await RecordActivity.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .lean();

    const data = {
      _id: populated._id,
      content: populated.content,
      parentCommentId: populated.parentCommentId,
      attachments: populated.attachments || [],
      reactions: (populated.reactions || []).map((r) => ({
        emoji: r.emoji,
        users: r.users || [],
        count: Array.isArray(r.users) ? r.users.length : 0,
        reactors: (r.users || []).map((u) => ({
          id: u?._id ? String(u._id) : undefined,
          _id: u?._id,
          name: [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.username || u?.email || 'Unknown',
          firstName: u?.firstName,
          lastName: u?.lastName,
          email: u?.email,
          username: u?.username,
          avatar: u?.avatar || ''
        }))
      })),
      myReactions: (populated.reactions || [])
        .filter((r) => (r.users || []).some((u) => String(u?._id || u) === currentUserId))
        .map((r) => r.emoji),
      author: populated.author,
      editedAt: populated.editedAt,
      createdAt: populated.createdAt,
      updatedAt: populated.updatedAt
    };

    return res.json({ success: true, data });
  } catch (err) {
    console.error('toggleCommentReaction error:', err);
    return res.status(500).json({ success: false, message: 'Error toggling reaction', error: err.message });
  }
};

/**
 * GET /api/modules/:moduleKey/records/:recordId/neighbors
 * Returns { previousId, nextId } for prev/next navigation.
 */
exports.getNeighbors = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const recordId = getRecordId(req);
    const organizationId = req.user.organizationId;

    if (!moduleKey || !recordId) {
      return res.status(400).json({ success: false, message: 'moduleKey and recordId are required' });
    }

    const getIds = getListHandlerForModule(moduleKey);
    if (!getIds) {
      return res.json({ success: true, data: { previousId: null, nextId: null } });
    }

    const ids = await getIds(organizationId);
    const currentIndex = ids.indexOf(recordId);
    const previousId = currentIndex > 0 ? ids[currentIndex - 1] : null;
    const nextId = currentIndex >= 0 && currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null;

    return res.json({ success: true, data: { previousId, nextId } });
  } catch (err) {
    console.error('getNeighbors error:', err);
    return res.status(500).json({ success: false, message: 'Error fetching neighbors', error: err.message });
  }
};

const RecordDescriptionVersion = require('../models/RecordDescriptionVersion');
const { getRecordDescription, setRecordDescription, buildVersionDocQuery } = require('../utils/descriptionVersionHelper');

const MODULES_WITH_NATIVE_DESCRIPTION_VERSIONS = new Set(['deals', 'tasks']);
const DESCRIPTION_VERSION_RETENTION_DAYS = 365;

/**
 * GET /api/modules/:moduleKey/records/:recordId/description-versions
 * Returns { currentDescription, versions } for any module (generic or deal/task).
 */
exports.getDescriptionVersions = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const recordId = getRecordId(req);
    const organizationId = req.user.organizationId;

    if (!moduleKey || !recordId) {
      return res.status(400).json({ success: false, message: 'moduleKey and recordId are required' });
    }

    const key = moduleKey.toLowerCase();

    if (MODULES_WITH_NATIVE_DESCRIPTION_VERSIONS.has(key)) {
      const Model = key === 'deals' ? Deal : Task;
      const record = await Model.findOne({
        _id: recordId,
        organizationId,
        deletedAt: null
      })
        .select('description descriptionVersions')
        .lean();

      if (!record) {
        return res.status(404).json({ success: false, message: 'Record not found or access denied' });
      }

      const versions = (record.descriptionVersions || [])
        .map((v) => ({ content: v.content, createdAt: v.createdAt, createdBy: v.createdBy }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const createdByIds = [...new Set(versions.map((v) => v.createdBy).filter(Boolean))];
      let createdByMap = {};
      if (createdByIds.length > 0) {
        const users = await User.find({ _id: { $in: createdByIds }, organizationId })
          .select('firstName lastName')
          .lean();
        users.forEach((u) => {
          const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
          createdByMap[String(u._id)] = name || 'Unknown';
        });
      }

      const list = versions.map((v) => ({
        content: v.content,
        createdAt: v.createdAt,
        createdBy: v.createdBy ? createdByMap[String(v.createdBy)] || 'Unknown' : 'Unknown',
        createdById: v.createdBy
      }));

      return res.json({
        success: true,
        data: {
          currentDescription: (record.description || '').toString(),
          versions: list
        }
      });
    }

    const getModel = MODEL_BY_KEY[key];
    if (!getModel) {
      return res.status(400).json({ success: false, message: `Unsupported module: ${moduleKey}` });
    }

    const Model = getModel();
    let query;
    if (key === 'organizations') {
      query = await buildOrganizationRecordAccessQuery(organizationId, recordId, req);
    } else {
      query = {
        _id: recordId,
        ...(Model.schema.paths.deletedAt ? { deletedAt: null } : {}),
        organizationId
      };
    }

    const record = await Model.findOne(query)
      .select('description customFields descriptionVersions')
      .lean();

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found or access denied' });
    }

    const currentDescription = getRecordDescription(record);
    let rawVersions = Array.isArray(record.descriptionVersions) ? record.descriptionVersions : [];
    if (rawVersions.length === 0) {
      const versionDoc = await RecordDescriptionVersion.findOne(
        buildVersionDocQuery(organizationId, key, recordId, 'description')
      ).lean();
      rawVersions = (versionDoc && versionDoc.versions) || [];
    }
    const versions = rawVersions
      .map((v) => ({ content: v.content, createdAt: v.createdAt, createdBy: v.createdBy }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const createdByIds = [...new Set(versions.map((v) => v.createdBy).filter(Boolean))];
    let createdByMap = {};
    if (createdByIds.length > 0) {
      const users = await User.find({ _id: { $in: createdByIds }, organizationId })
        .select('firstName lastName')
        .lean();
      users.forEach((u) => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
        createdByMap[String(u._id)] = name || 'Unknown';
      });
    }

    const list = versions.map((v) => ({
      content: v.content,
      createdAt: v.createdAt,
      createdBy: v.createdBy ? createdByMap[String(v.createdBy)] || 'Unknown' : 'Unknown',
      createdById: v.createdBy
    }));

    return res.json({
      success: true,
      data: { currentDescription, versions: list }
    });
  } catch (err) {
    console.error('getDescriptionVersions error:', err);
    return res.status(500).json({ success: false, message: 'Error fetching description versions', error: err.message });
  }
};

/**
 * POST /api/modules/:moduleKey/records/:recordId/description-versions/restore
 * Body: { versionIndex: number }
 */
exports.restoreDescriptionVersion = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const recordId = getRecordId(req);
    const organizationId = req.user.organizationId;
    const userId = req.user._id;

    if (!moduleKey || !recordId) {
      return res.status(400).json({ success: false, message: 'moduleKey and recordId are required' });
    }

    const { versionIndex } = req.body;
    if (typeof versionIndex !== 'number' || versionIndex < 0) {
      return res.status(400).json({ success: false, message: 'Invalid versionIndex' });
    }

    const key = moduleKey.toLowerCase();

    if (MODULES_WITH_NATIVE_DESCRIPTION_VERSIONS.has(key)) {
      const Model = key === 'deals' ? Deal : Task;
      const record = await Model.findOne({
        _id: recordId,
        organizationId,
        deletedAt: null
      });

      if (!record) {
        return res.status(404).json({ success: false, message: 'Record not found or access denied' });
      }

      const versions = (record.descriptionVersions || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const version = versions[versionIndex];
      if (!version) {
        return res.status(404).json({ success: false, message: 'Version not found' });
      }

      const previousDescription = record.description;
      record.description = version.content || '';
      if (!Array.isArray(record.descriptionVersions)) record.descriptionVersions = [];
      if (previousDescription !== undefined && previousDescription !== null) {
        record.descriptionVersions.push({
          content: typeof previousDescription === 'string' ? previousDescription : '',
          createdAt: new Date(),
          createdBy: userId
        });
      }
      const retentionCutoff = new Date();
      retentionCutoff.setDate(retentionCutoff.getDate() - DESCRIPTION_VERSION_RETENTION_DAYS);
      record.descriptionVersions = record.descriptionVersions.filter((e) => e && e.createdAt >= retentionCutoff);
      await record.save();

      const populated = await Model.findById(record._id).lean();
      const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
      return res.status(200).json({ success: true, data: flattenCustomFieldsForResponse(populated) });
    }

    const getModel = MODEL_BY_KEY[key];
    if (!getModel) {
      return res.status(400).json({ success: false, message: `Unsupported module: ${moduleKey}` });
    }

    const Model = getModel();

    let query;
    if (key === 'organizations') {
      query = await buildOrganizationRecordAccessQuery(organizationId, recordId, req);
    } else {
      query = {
        _id: recordId,
        ...(Model.schema.paths.deletedAt ? { deletedAt: null } : {}),
        organizationId
      };
    }

    const record = await Model.findOne(query);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Record not found or access denied' });
    }

    let versions = Array.isArray(record.descriptionVersions) ? record.descriptionVersions.slice() : [];
    if (versions.length === 0) {
      const versionDoc = await RecordDescriptionVersion.findOne(
        buildVersionDocQuery(organizationId, key, recordId, 'description')
      ).lean();
      versions = Array.isArray(versionDoc?.versions) ? versionDoc.versions.slice() : [];
    }
    const sorted = versions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const version = sorted[versionIndex];
    if (!version) {
      return res.status(404).json({ success: false, message: 'Version not found' });
    }

    const previousContent = getRecordDescription(record.toObject ? record.toObject() : record);
    setRecordDescription(record, version.content || '', Model);
    if (!Array.isArray(record.descriptionVersions)) record.descriptionVersions = [];
    if (previousContent !== undefined && previousContent !== null) {
      record.descriptionVersions.push({
        content: typeof previousContent === 'string' ? previousContent : '',
        createdAt: new Date(),
        createdBy: userId
      });
    }
    const retentionCutoff = new Date();
    retentionCutoff.setDate(retentionCutoff.getDate() - DESCRIPTION_VERSION_RETENTION_DAYS);
    record.descriptionVersions = record.descriptionVersions.filter((e) => e && e.createdAt >= retentionCutoff);
    await record.save();

    const populated = await Model.findById(record._id).lean();
    const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    return res.status(200).json({ success: true, data: flattenCustomFieldsForResponse(populated) });
  } catch (err) {
    console.error('restoreDescriptionVersion error:', err);
    return res.status(500).json({ success: false, message: 'Error restoring description version', error: err.message });
  }
};

/** Modules that support batch fetch for related-record enrichment. */
const BATCH_MODULES = new Set([
  'people',
  'organizations',
  'deals',
  'tasks',
  'events',
  'forms',
  'items',
  'cases',
  'quotes',
  'sales_orders',
  'invoices',
  'documents'
]);

async function buildBatchQueryForModule(req, moduleKey, organizationId, ids) {
  const idQuery = normalizeBatchIdQuery(ids);
  if (!idQuery) return null;
  const baseOrgQuery = { ...idQuery, organizationId };

  if (moduleKey === 'deals') {
    return { Model: Deal, query: { ...baseOrgQuery, deletedAt: null } };
  }
  if (moduleKey === 'events') {
    return { Model: require('../models/Event'), query: { ...baseOrgQuery, deletedAt: null } };
  }
  if (moduleKey === 'forms') {
    return { Model: require('../models/Form'), query: baseOrgQuery };
  }
  if (moduleKey === 'people') {
    return { Model: require('../models/People'), query: { ...baseOrgQuery, deletedAt: null } };
  }
  if (moduleKey === 'cases') {
    return { Model: require('../models/Case'), query: { ...baseOrgQuery, deletedAt: null } };
  }
  if (moduleKey === 'quotes') {
    return { Model: require('../models/Quote'), query: { ...baseOrgQuery, deletedAt: null } };
  }
  if (moduleKey === 'sales_orders') {
    return { Model: require('../models/SalesOrder'), query: { ...baseOrgQuery, deletedAt: null } };
  }
  if (moduleKey === 'tasks') {
    return { Model: require('../models/Task'), query: { ...baseOrgQuery, deletedAt: null } };
  }
  if (moduleKey === 'items') {
    return { Model: require('../models/Item'), query: { ...baseOrgQuery, deletedAt: null } };
  }
  if (moduleKey === 'invoices') {
    return { Model: require('../models/Invoice'), query: { ...baseOrgQuery, deletedAt: null } };
  }
  if (moduleKey === 'documents') {
    return { Model: require('../models/Document'), query: { ...baseOrgQuery, deletedAt: null } };
  }
  if (moduleKey === 'organizations') {
    const Organization = require('../models/Organization');
    const { buildTenantAccessibleCrmOrganizationQuery } = require('../utils/crmOrganizationAccess');
    const query = await buildTenantAccessibleCrmOrganizationQuery(organizationId, {
      recordIds: ids,
      masterAccess: isMasterOrganizationRequest(req)
    });
    return { Model: Organization, query };
  }
  return null;
}

function normalizeBatchIdQuery(ids = []) {
  const objectIds = [];
  const stringIds = [];
  for (const rawId of ids) {
    const id = rawId != null ? String(rawId).trim() : '';
    if (!id) continue;
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      objectIds.push(new mongoose.Types.ObjectId(id));
    } else {
      stringIds.push(id);
    }
  }
  if (objectIds.length === 0 && stringIds.length === 0) return null;
  if (objectIds.length > 0 && stringIds.length === 0) {
    return { _id: { $in: objectIds } };
  }
  if (stringIds.length > 0 && objectIds.length === 0) {
    return { _id: { $in: stringIds } };
  }
  return { $or: [{ _id: { $in: objectIds } }, { _id: { $in: stringIds } }] };
}

/**
 * POST /api/modules/:moduleKey/records/batch
 * Body: { ids: string[] }
 * Returns { success: true, data: record[] } with only records that exist and belong to the org.
 * Used by relationship UIs and record pages to enrich related records without N GET requests or 404s.
 */
exports.getRecordsBatch = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const organizationId = req.user.organizationId;
    const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const ids = rawIds
      .map((id) => (id != null && String(id).trim() ? String(id).trim() : null))
      .filter(Boolean);
    if (!moduleKey) {
      return res.status(400).json({ success: false, message: 'moduleKey is required' });
    }
    if (!BATCH_MODULES.has(moduleKey)) {
      return res.status(400).json({ success: false, message: `Batch not supported for module: ${moduleKey}` });
    }
    if (ids.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const batchConfig = await buildBatchQueryForModule(req, moduleKey, organizationId, ids);
    if (!batchConfig) {
      return res.json({ success: true, data: [] });
    }

    const { Model, query } = batchConfig;
    const records = await Model.find(query).lean();
    const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    const data = records.map((record) => flattenCustomFieldsForResponse(record));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('getRecordsBatch error:', err);
    return res.status(500).json({ success: false, message: 'Error fetching records batch', error: err.message });
  }
};

/**
 * POST /api/modules/:moduleKey/tags/delete
 * Body: { tagName: string }
 * Removes the tag from all records in the module for the current organization.
 */
const DELETION_SERVICE_MODULES = new Set([
  'people',
  'organizations',
  'deals',
  'tasks',
  'events',
  'items',
  'cases',
  'quotes'
]);

/**
 * POST /api/modules/:moduleKey/records/bulk-delete
 * Body: { ids: string[] }
 */
/**
 * PATCH /api/modules/:moduleKey/records/bulk-update
 * Body: { ids?: string[], updates: object, updateMatching?: boolean, listQuery?: object, excludedIds?: string[] }
 */
exports.bulkUpdateRecords = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const { bulkUpdateRecords } = require('../services/bulkUpdateService');

    const result = await bulkUpdateRecords({
      moduleKey,
      organizationId: req.user.organizationId,
      user: req.user,
      updates: req.body?.updates,
      ids: req.body?.ids,
      updateMatching: !!req.body?.updateMatching,
      listQuery: req.body?.listQuery || {},
      excludedIds: req.body?.excludedIds || [],
      appKey: req.body?.appKey || req.appKey,
      batchSize: req.body?.batchSize,
      afterId: req.body?.afterId || null,
    });

    return res.json({
      success: true,
      message: `Updated ${result.updatedCount} record(s)`,
      data: result,
      meta: {
        operation: 'bulk_update_records',
        moduleKey,
        updatedFields: result.updatedFields || [],
      },
    });
  } catch (err) {
    const code = err.code || 'BULK_UPDATE_FAILED';
    if (code === 'MODULE_BULK_UPDATE_UNSUPPORTED') {
      return res.status(400).json({ success: false, code, message: err.message });
    }
    if (code === 'BULK_UPDATE_EMPTY' || code === 'BULK_UPDATE_NO_IDS' || code === 'BULK_UPDATE_TOO_MANY_FIELDS') {
      return res.status(400).json({ success: false, code, message: err.message });
    }
    if (code === 'BULK_UPDATE_FIELD_DENIED') {
      return res.status(400).json({
        success: false,
        code,
        message: err.message,
        deniedFields: err.deniedFields || [],
      });
    }
    if (code === 'FIELD_ACCESS_DENIED') {
      return res.status(403).json({
        success: false,
        code,
        message: err.message,
        violations: err.violations || [],
      });
    }
    console.error('bulkUpdateRecords error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error bulk updating records',
      error: err.message,
    });
  }
};

exports.bulkDeleteRecords = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);

    if (!DELETION_SERVICE_MODULES.has(moduleKey)) {
      return res.status(400).json({
        success: false,
        code: 'MODULE_BULK_DELETE_UNSUPPORTED',
        message: `Bulk delete is not supported for module: ${moduleKey}`
      });
    }

    const deletionService = require('../services/deletionService');
    let ids = [];

    const batchSizeRaw = Number(req.body?.batchSize);
    const batchSize = Number.isFinite(batchSizeRaw) && batchSizeRaw > 0
      ? Math.min(Math.floor(batchSizeRaw), 5000)
      : 0;

    if (req.body?.deleteMatching) {
      const { resolveMatchingRecordIds } = require('../services/bulkDeleteMatchingResolver');
      ids = await resolveMatchingRecordIds({
        moduleKey,
        organizationId: req.user.organizationId,
        listQuery: req.body.listQuery || {},
        excludedIds: req.body.excludedIds || [],
        user: req.user,
        appKey: req.body?.appKey || req.appKey,
        limit: batchSize || undefined,
        afterId: req.body?.afterId || null
      });
    } else {
      const rawIds = req.body?.ids;
      if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return res.status(400).json({ success: false, message: 'ids array is required' });
      }
      ids = [...new Set(rawIds.map((id) => String(id).trim()).filter(Boolean))];
    }

    if (ids.length === 0) {
      return res.json({
        success: true,
        message: req.body?.resolveOnly ? 'No matching records' : 'No records to delete',
        data: {
          deletedCount: 0,
          failedCount: 0,
          failures: [],
          requestedCount: 0,
          ids: [],
          hasMore: false,
          lastId: null,
          resolvedCount: 0
        }
      });
    }

    const hasMore = batchSize > 0 && ids.length === batchSize;
    const lastId = ids.length > 0 ? ids[ids.length - 1] : null;

    if (req.body?.resolveOnly) {
      if (!req.body?.deleteMatching) {
        return res.status(400).json({
          success: false,
          message: 'resolveOnly requires deleteMatching'
        });
      }
      return res.json({
        success: true,
        message: `Resolved ${ids.length} record(s)`,
        data: {
          ids,
          hasMore,
          lastId,
          resolvedCount: ids.length
        }
      });
    }

    const result = await deletionService.bulkMoveToTrash({
      moduleKey,
      recordIds: ids,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      user: req.user,
      appKey: req.body?.appKey,
      reason: req.body?.reason,
      cascadeConfirmed: !!req.body?.cascadeConfirmed
    });

    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      message: `Moved ${result.movedCount} record(s) to trash`,
      data: {
        deletedCount: result.movedCount,
        failedCount: result.failedCount,
        failures: result.failures,
        requestedCount: result.requestedCount ?? ids.length,
        hasMore,
        lastId
      }
    });
  } catch (err) {
    console.error('bulkDeleteRecords error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error bulk deleting records',
      error: err.message
    });
  }
};

exports.deleteTagFromModule = async (req, res) => {
  try {
    const moduleKey = getModuleKey(req);
    const organizationId = req.user.organizationId;
    const tagName = String(req.body?.tagName || '').trim();

    if (!moduleKey) {
      return res.status(400).json({ success: false, message: 'moduleKey is required' });
    }
    if (!tagName) {
      return res.status(400).json({ success: false, message: 'tagName is required' });
    }

    const getModel = MODEL_BY_KEY[moduleKey];
    if (!getModel) {
      return res.status(400).json({ success: false, message: `Unsupported module: ${moduleKey}` });
    }

    const Model = getModel();
    const query = { organizationId };
    if (moduleKey === 'organizations' && !isMasterOrganizationRequest(req)) query.isTenant = false;
    if (Model.schema?.paths?.deletedAt) query.deletedAt = null;

    const tagRegex = new RegExp(`^${escapeRegExp(tagName)}$`, 'i');
    const result = await Model.updateMany(query, {
      $pull: { tags: { $regex: tagRegex } }
    });

    return res.status(200).json({
      success: true,
      data: {
        moduleKey,
        tagName,
        modifiedCount: Number(result?.modifiedCount || 0)
      }
    });
  } catch (err) {
    console.error('deleteTagFromModule error:', err);
    return res.status(500).json({ success: false, message: 'Error deleting tag from module', error: err.message });
  }
};

exports.getRecordPresence = async (req, res) => {
  try {
    const presence = await recordPresenceService.listRecordPresence({
      organizationId: req.user.organizationId,
      moduleKey: getModuleKey(req),
      recordId: getRecordId(req)
    });
    return res.json({ success: true, data: presence });
  } catch (error) {
    console.error('[moduleRecordController] getRecordPresence error:', error);
    const status = error.message === 'Record not found' ? 404 : 400;
    return res.status(status).json({ success: false, message: error.message || 'Failed to load presence' });
  }
};

exports.heartbeatRecordPresence = async (req, res) => {
  try {
    const session = await recordPresenceService.heartbeatRecordPresence({
      organizationId: req.user.organizationId,
      moduleKey: getModuleKey(req),
      recordId: getRecordId(req),
      userId: req.user._id,
      activityType: req.body?.activityType
    });
    return res.json({ success: true, data: session });
  } catch (error) {
    console.error('[moduleRecordController] heartbeatRecordPresence error:', error);
    const status = error.message === 'Record not found' ? 404 : 400;
    return res.status(status).json({ success: false, message: error.message || 'Failed to update presence' });
  }
};

exports.clearRecordPresence = async (req, res) => {
  try {
    await recordPresenceService.clearRecordPresence({
      organizationId: req.user.organizationId,
      moduleKey: getModuleKey(req),
      recordId: getRecordId(req),
      userId: req.user._id
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('[moduleRecordController] clearRecordPresence error:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to clear presence' });
  }
};
