/**
 * ============================================================================
 * PLATFORM CORE: Trash Controller
 * ============================================================================
 *
 * API for Trash (recycle bin): move to trash, restore, purge, list, stats.
 * See docs/TRASH_IMPLEMENTATION_SPEC.md
 * ============================================================================
 */

const deletionService = require('../services/deletionService');
const TrashSnapshot = require('../models/TrashSnapshot');
const User = require('../models/User');

/**
 * Build TrashSnapshot list/purge filter from query or body filters.
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {Object} source
 * @param {{ purgeableOnly?: boolean, retentionExpiringSoon?: boolean }} [options]
 */
function buildTrashSnapshotFilter(organizationId, source = {}, options = {}) {
  const {
    moduleKey,
    deletedBy,
    search,
    deletedFrom,
    deletedTo
  } = source;

  const clauses = [{ organizationId }];

  if (moduleKey) clauses.push({ moduleKey });
  if (deletedBy) clauses.push({ deletedBy });

  if (deletedFrom || deletedTo) {
    const deletedAt = {};
    if (deletedFrom) deletedAt.$gte = new Date(deletedFrom);
    if (deletedTo) {
      const to = new Date(deletedTo);
      to.setHours(23, 59, 59, 999);
      deletedAt.$lte = to;
    }
    clauses.push({ deletedAt });
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(term, 'i');
    clauses.push({
      $or: [
        { displayName: regex },
        { 'snapshot.name': regex },
        { 'snapshot.title': regex },
        { 'snapshot.eventName': regex },
        { 'snapshot.first_name': regex },
        { 'snapshot.last_name': regex },
        { 'snapshot.email': regex },
        { 'snapshot.item_name': regex }
      ]
    });
  }

  if (options.retentionExpiringSoon) {
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    clauses.push({ retentionExpiresAt: { $gte: now, $lte: sevenDaysFromNow } });
  }

  if (options.purgeableOnly) {
    clauses.push({ $or: [{ isLegalHold: { $ne: true } }, { isLegalHold: null }] });
  }

  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

/**
 * Move record to trash
 * POST /api/trash/:moduleKey/:recordId
 */
exports.moveToTrash = async (req, res) => {
  try {
    const { moduleKey, recordId } = req.params;
    const { reason, cascadeConfirmed } = req.body || {};

    const result = await deletionService.moveToTrash({
      moduleKey,
      recordId,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      appKey: req.body?.appKey,
      reason,
      cascadeConfirmed: !!cascadeConfirmed
    });

    if (!result.ok) {
      if (result.blocked) {
        return res.status(400).json({
          success: false,
          blocked: true,
          dependencies: result.dependencies,
          message: result.message
        });
      }
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to move to trash'
      });
    }

    res.json({
      success: true,
      message: 'Moved to trash',
      retentionExpiresAt: result.retentionExpiresAt
    });
  } catch (error) {
    console.error('[trashController] moveToTrash error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Restore record from trash
 * POST /api/trash/:moduleKey/:recordId/restore
 */
exports.restore = async (req, res) => {
  try {
    const { moduleKey, recordId } = req.params;

    const result = await deletionService.restore({
      moduleKey,
      recordId,
      organizationId: req.user.organizationId,
      userId: req.user._id
    });

    if (!result.ok) {
      if (result.reason === 'ALREADY_PURGED') {
        return res.status(404).json({
          success: false,
          message: 'Record was permanently deleted and cannot be restored'
        });
      }
      return res.status(400).json({
        success: false,
        message: result.reason || 'Failed to restore'
      });
    }

    res.json({
      success: true,
      restored: true,
      orphanedReferences: result.orphanedReferences,
      message: result.orphanedReferences?.length
        ? 'Restored. Some parent records were permanently deleted.'
        : 'Restored successfully'
    });
  } catch (error) {
    console.error('[trashController] restore error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Purge record permanently (only from trash)
 * DELETE /api/trash/:moduleKey/:recordId
 */
/**
 * Bulk purge trash items or empty entire recycle bin.
 * POST /api/trash/bulk-purge
 * Body: { items?: [{ moduleKey, recordId }], purgeAll?: boolean, filters?: object }
 */
exports.bulkPurge = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { items, purgeAll, filters } = req.body || {};

    let result;
    if (purgeAll) {
      const snapshotQuery = buildTrashSnapshotFilter(organizationId, filters || {}, {
        purgeableOnly: true
      });
      result = await deletionService.purgeAll({ organizationId, snapshotQuery });
    } else if (Array.isArray(items) && items.length > 0) {
      result = await deletionService.purgeBulk({ organizationId, items });
    } else {
      return res.status(400).json({ success: false, message: 'No items to purge' });
    }

    res.json({
      success: true,
      purged: result.purged,
      skipped: result.skipped,
      failed: result.failed,
      message: `Permanently deleted ${result.purged} item(s)`
    });
  } catch (error) {
    console.error('[trashController] bulkPurge error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.purge = async (req, res) => {
  try {
    const { moduleKey, recordId } = req.params;

    const result = await deletionService.purge({
      moduleKey,
      recordId,
      organizationId: req.user.organizationId
    });

    if (!result.ok) {
      if (result.reason === 'LEGAL_HOLD') {
        return res.status(403).json({
          success: false,
          message: 'Cannot purge: record is under legal hold'
        });
      }
      return res.status(400).json({
        success: false,
        message: result.reason || 'Failed to purge'
      });
    }

    res.json({ success: true, message: 'Permanently deleted' });
  } catch (error) {
    console.error('[trashController] purge error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * List trash items
 * GET /api/trash?moduleKey=&deletedBy=&search=&deletedFrom=&deletedTo=&page=1&limit=20&sort=deletedAt|retentionExpiresAt|displayName&order=desc|asc
 */
exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'deletedAt', order = 'desc' } = req.query;
    const organizationId = req.user.organizationId;

    const query = buildTrashSnapshotFilter(organizationId, req.query, {
      retentionExpiringSoon: sort === 'retentionExpiresAt' && order === 'asc'
    });

    const sortField = ['deletedAt', 'retentionExpiresAt', 'displayName'].includes(sort) ? sort : 'deletedAt';
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const sortOrder = order === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      TrashSnapshot.find(query)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limitNum)
        .populate('deletedBy', 'firstName lastName email')
        .lean(),
      TrashSnapshot.countDocuments(query)
    ]);

    const displayNames = items.map((item) => {
      if (item.displayName) return item.displayName;
      const s = item.snapshot || {};
      if (item.moduleKey === 'people') return [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || item.originalId;
      if (item.moduleKey === 'deals' || item.moduleKey === 'organizations') return s.name || item.originalId;
      if (item.moduleKey === 'tasks' || item.moduleKey === 'events') return s.title || s.eventName || item.originalId;
      if (item.moduleKey === 'items') return s.item_name || item.originalId;
      return item.originalId;
    });

    const data = items.map((item, i) => ({
      moduleKey: item.moduleKey,
      recordId: item.originalId,
      displayName: displayNames[i],
      deletedAt: item.deletedAt,
      deletedBy: item.deletedBy,
      retentionExpiresAt: item.retentionExpiresAt,
      isLegalHold: item.isLegalHold
    }));

    res.json({
      success: true,
      data,
      pagination: { page: parseInt(page, 10), limit: limitNum, total }
    });
  } catch (error) {
    console.error('[trashController] list error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get trash stats
 * GET /api/trash/stats
 */
exports.stats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const [total, byModule, expiringIn7Days, oldest, deletedByUsers] = await Promise.all([
      TrashSnapshot.countDocuments({ organizationId }),
      TrashSnapshot.aggregate([
        { $match: { organizationId } },
        { $group: { _id: '$moduleKey', count: { $sum: 1 } } }
      ]),
      TrashSnapshot.countDocuments({
        organizationId,
        retentionExpiresAt: { $gte: now, $lte: sevenDaysFromNow }
      }),
      TrashSnapshot.findOne({ organizationId }).sort({ deletedAt: 1 }).select('deletedAt').lean(),
      TrashSnapshot.aggregate([
        { $match: { organizationId, deletedBy: { $ne: null } } },
        { $group: { _id: '$deletedBy', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            id: '$_id',
            count: 1,
            name: {
              $concat: [
                { $ifNull: ['$user.firstName', ''] },
                ' ',
                { $ifNull: ['$user.lastName', ''] }
              ]
            }
          }
        }
      ])
    ]);

    const byModuleMap = {};
    (byModule || []).forEach((m) => { byModuleMap[m._id] = m.count; });

    const deletedByList = (deletedByUsers || []).map((u) => ({
      id: u.id?.toString?.() || u._id?.toString?.(),
      name: (u.name || '').trim() || 'Unknown',
      count: u.count
    }));

    res.json({
      success: true,
      data: {
        total,
        byModule: byModuleMap,
        expiringIn7Days,
        oldestDeletedAt: oldest?.deletedAt || null,
        deletedByUsers: deletedByList
      }
    });
  } catch (error) {
    console.error('[trashController] stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
