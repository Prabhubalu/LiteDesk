const mongoose = require('mongoose');
const ImportHistory = require('../../models/ImportHistory');

const MODULE_MODELS = {
  contacts: () => require('../../models/People'),
  deals: () => require('../../models/Deal'),
  tasks: () => require('../../models/Task'),
  organizations: () => require('../../models/Organization'),
};

function getModuleModel(module) {
  const factory = MODULE_MODELS[module];
  if (!factory) return null;
  return factory();
}

async function fetchCreatedRecordsPaginated({ module, organizationId, importHistoryId, importRecord, page, limit }) {
  const Model = getModuleModel(module);
  const query = { importHistoryId: new mongoose.Types.ObjectId(importHistoryId) };
  if (module !== 'organizations') {
    query.organizationId = organizationId;
  }

  let total = await Model.countDocuments(query);
  if (total === 0 && (importRecord.recordIds?.created?.length || 0) > 0) {
    return fetchUpdatedRecordsPaginated({
      module,
      organizationId,
      importRecord: { ...importRecord, recordIds: { updated: importRecord.recordIds.created } },
      page,
      limit,
      type: 'created',
    });
  }

  let q = Model.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  if (module === 'tasks') {
    q = q.populate('assignedTo', 'firstName lastName');
  }
  const records = await q.lean();
  return { records, total, source: 'importHistoryId' };
}

async function fetchUpdatedRecordsPaginated({ module, organizationId, importRecord, page, limit, type = 'updated' }) {
  const Model = getModuleModel(module);
  const recordIds = importRecord.recordIds?.[type] || [];
  const total = recordIds.length;
  const slice = recordIds.slice((page - 1) * limit, page * limit);

  if (!slice.length) {
    return {
      records: [],
      total: importRecord.stats?.updated || total,
      source: 'recordIds',
      idsTruncated: Boolean(importRecord.metadata?.recordIdsTruncated),
    };
  }

  let q = Model.find({ _id: { $in: slice } });
  if (module !== 'organizations') {
    q = Model.find({ _id: { $in: slice }, organizationId });
  }
  if (module === 'tasks') {
    q = q.populate('assignedTo', 'firstName lastName');
  }
  const records = await q.lean();
  return { records, total: importRecord.stats?.updated || total, source: 'recordIds' };
}

async function getImportedRecordsPaginated(req, res) {
  try {
    const { organizationId } = req.user;
    const { id, type } = req.params;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);

    if (!['created', 'updated'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid record type. Must be "created" or "updated"' });
    }

    const importRecord = await ImportHistory.findOne({ _id: id, organizationId });
    if (!importRecord) {
      return res.status(404).json({ success: false, message: 'Import record not found' });
    }

    const result = type === 'created'
      ? await fetchCreatedRecordsPaginated({
        module: importRecord.module,
        organizationId,
        importHistoryId: id,
        importRecord,
        page,
        limit,
      })
      : await fetchUpdatedRecordsPaginated({
        module: importRecord.module,
        organizationId,
        importRecord,
        page,
        limit,
      });

    res.status(200).json({
      success: true,
      data: result.records,
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil((result.total || 0) / limit)),
        total: result.total || 0,
        limit,
      },
      meta: {
        source: result.source,
        idsTruncated: Boolean(result.idsTruncated),
      },
    });
  } catch (error) {
    console.error('Get imported records error:', error);
    res.status(500).json({ success: false, message: 'Error fetching imported records', error: error.message });
  }
}

module.exports = {
  getImportedRecordsPaginated,
};
