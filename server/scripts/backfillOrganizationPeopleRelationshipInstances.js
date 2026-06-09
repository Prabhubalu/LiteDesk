#!/usr/bin/env node

/**
 * Backfill people_organizations RelationshipInstance rows from People.organization.
 *
 * Default: dry-run. Apply: node server/scripts/backfillOrganizationPeopleRelationshipInstances.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const People = require('../models/People');
const { syncPeopleOrganizationRelationship } = require('../services/peopleOrganizationRelationshipSync');

async function main() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;
  if (!uri) {
    console.error('Missing Mongo URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`[backfillOrganizationPeopleRelationshipInstances] ${apply ? 'APPLY' : 'DRY RUN'}`);

  const cursor = People.find({
    organization: { $exists: true, $ne: null },
    deletedAt: null
  })
    .select('_id organizationId organization createdBy')
    .lean()
    .cursor();

  let examined = 0;
  let synced = 0;
  for await (const person of cursor) {
    examined += 1;
    if (!person.organization || !person.organizationId) continue;
    if (!apply) {
      synced += 1;
      continue;
    }
    await syncPeopleOrganizationRelationship({
      tenantOrganizationId: person.organizationId,
      personId: person._id,
      organizationValue: person.organization,
      userId: person.createdBy || person._id
    });
    synced += 1;
  }

  console.log(`[backfillOrganizationPeopleRelationshipInstances] examined=${examined} wouldSync=${synced}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
