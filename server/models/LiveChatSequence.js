const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const LiveChatSequenceSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true,
  },
  nextValue: { type: Number, default: 1000, min: 1 },
});

module.exports = wrapTenantModel(mongoose.model('LiveChatSequence', LiveChatSequenceSchema));
