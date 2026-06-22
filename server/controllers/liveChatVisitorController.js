const mongoose = require('mongoose');
const {
  listVisitorsForOrganization,
  getVisitorForOrganization,
  listSessionsForVisitor,
} = require('../services/liveChatVisitorService');

function requireObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(String(id || '').trim())) {
    const err = new Error('Invalid visitor id');
    err.statusCode = 400;
    throw err;
  }
  return id;
}

exports.listVisitors = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const search = String(req.query.search || '').trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = Math.max(Number(req.query.skip) || 0, 0);

    const { rows, total } = await listVisitorsForOrganization(organizationId, {
      search,
      limit,
      skip,
    });

    return res.json({
      success: true,
      data: rows,
      meta: { total, limit, skip },
    });
  } catch (err) {
    console.error('[liveChatVisitorController] listVisitors', err);
    return res.status(500).json({ success: false, message: 'Failed to list visitors' });
  }
};

exports.getVisitor = async (req, res) => {
  try {
    const visitorId = requireObjectId(req.params.visitorId);
    const visitor = await getVisitorForOrganization(req.user.organizationId, visitorId);
    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    const sessionLimit = Math.min(Math.max(Number(req.query.sessionLimit) || 20, 1), 100);
    const sessions = await listSessionsForVisitor(req.user.organizationId, visitorId, sessionLimit);

    return res.json({
      success: true,
      data: {
        ...visitor,
        sessions,
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatVisitorController] getVisitor', err);
    return res.status(500).json({ success: false, message: 'Failed to load visitor' });
  }
};
