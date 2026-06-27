const mongoose = require('mongoose');

function buildItemsListQuery(req) {
  let query = { organizationId: req.user.organizationId, deletedAt: null };

  if (req.query.lifecycle_state) query.lifecycle_state = req.query.lifecycle_state;
  if (req.query.status) query.status = req.query.status;
  if (req.query.item_type) query.item_type = req.query.item_type;
  if (req.query.category) query.category = req.query.category;
  if (req.query.categoryId && mongoose.Types.ObjectId.isValid(req.query.categoryId)) {
    query.categoryId = new mongoose.Types.ObjectId(req.query.categoryId);
  }
  if (req.query.vendor && mongoose.Types.ObjectId.isValid(req.query.vendor)) {
    query.vendor = new mongoose.Types.ObjectId(req.query.vendor);
  }
  if (req.query.tag) query.tags = req.query.tag;

  const { buildSearchOrConditions } = require('../searchRelevance');
  const directSearchTerm = req.query.search ? String(req.query.search).trim() : '';
  if (directSearchTerm) {
    query.$or = buildSearchOrConditions(directSearchTerm, ['item_name', 'item_code', 'item_id', 'description']);
  }

  if (req.query.low_stock === 'true') {
    query.item_type = { $in: ['Product', 'Serialized Product'] };
    query.status = 'Active';
    query.$expr = { $lte: ['$stock_quantity', '$reorder_level'] };
  }
  if (req.query.out_of_stock === 'true') {
    query.item_type = { $in: ['Product', 'Serialized Product'] };
    query.stock_quantity = 0;
  }

  const { applyListFilterQueryParam } = require('../listFilterQuery');
  query = applyListFilterQueryParam(query, req.query, 'items', { userId: req.user?._id });

  return query;
}

module.exports = {
  buildItemsListQuery,
};
