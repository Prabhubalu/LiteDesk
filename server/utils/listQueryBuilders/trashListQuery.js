/**
 * Trash list query builder (shared by list + meta endpoints).
 */

function buildTrashSnapshotFilter(organizationId, source = {}, options = {}) {
  const {
    moduleKey,
    deletedBy,
    search,
    deletedFrom,
    deletedTo,
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
        { 'snapshot.item_name': regex },
      ],
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

module.exports = {
  buildTrashSnapshotFilter,
};
