'use strict';

/**
 * Reset every tenant AI token pool to 1,000,000 available (0 consumed) and clear usage audit.
 *
 * Usage: node server/scripts/resetAiTokenPoolsFresh.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const { FREE_STARTER_TOKENS } = require('../constants/aiTokenConstants');
const { resetOrgAiTokenPool } = require('../services/ai/aiCreditService');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI required');
  await mongoose.connect(uri);

  const tenants = await Organization.find({ isTenant: true }).select('_id name').lean();
  let reset = 0;
  let auditDeleted = 0;

  for (const org of tenants) {
    const result = await resetOrgAiTokenPool({
      organizationId: org._id,
      tokens: FREE_STARTER_TOKENS,
      clearAudit: true,
    });
    reset += 1;
    auditDeleted += result.auditDeleted || 0;
  }

  console.log(JSON.stringify({
    tenants: tenants.length,
    reset,
    tokensEach: FREE_STARTER_TOKENS,
    auditDeleted,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
