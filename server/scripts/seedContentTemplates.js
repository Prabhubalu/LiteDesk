'use strict';

/**
 * Seeds default Content Platform templates for a tenant.
 *
 * Usage:
 *   node scripts/seedContentTemplates.js <organizationId>
 *   node scripts/seedContentTemplates.js <organizationId> --publish
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const ContentTemplate = require('../models/ContentTemplate');
const ContentTemplateVersion = require('../models/ContentTemplateVersion');
const { SEED_TEMPLATES } = require('../constants/contentTemplateSeeds');
const { assertValidTemplateDefinition } = require('../services/contentPlatform/contentTemplateValidationService');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const { getMongoUris } = require('../lib/mongoConnect');

async function connect() {
  const uris = getMongoUris();
  const uri = uris.masterUri || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }
  await mongoose.connect(uri);
}

async function seedTemplatesForOrganization(organizationId, { publish = false } = {}) {
  return runWithOrganizationTenantContext(organizationId, async () => {
    const orgObjectId = new mongoose.Types.ObjectId(String(organizationId));
    const results = [];

    for (const seed of SEED_TEMPLATES) {
      assertValidTemplateDefinition(seed.jsonDefinition);

      let template = await ContentTemplate.findOne({
        organizationId: orgObjectId,
        name: seed.name,
        deletedAt: null
      });

      if (template) {
        results.push({ key: seed.key, status: 'exists', templateId: template._id });
        continue;
      }

      template = await ContentTemplate.create({
        organizationId: orgObjectId,
        name: seed.name,
        description: `Seeded ${seed.purpose} template`,
        purpose: seed.purpose,
        category: seed.category,
        moduleScope: seed.moduleScope,
        outputFormat: seed.outputFormat,
        paperSize: 'A4',
        orientation: 'portrait',
        status: publish ? 'published' : 'draft',
        latestVersion: 1,
        latestPublishedVersion: publish ? 1 : null,
        isDefault: true,
        tags: ['seed', seed.key]
      });

      const version = await ContentTemplateVersion.create({
        organizationId: orgObjectId,
        templateId: template._id,
        version: 1,
        jsonDefinition: seed.jsonDefinition,
        published: publish,
        validationStatus: 'passed',
        releaseNotes: 'Initial seeded template',
        publishedAt: publish ? new Date() : null
      });

      template.draftVersionId = publish ? null : version._id;
      await template.save();

      results.push({ key: seed.key, status: 'created', templateId: template._id, published: publish });
    }

    return results;
  });
}

async function main() {
  const organizationId = process.argv[2];
  const publish = process.argv.includes('--publish');

  if (!organizationId) {
    console.error('Usage: node scripts/seedContentTemplates.js <organizationId> [--publish]');
    process.exit(1);
  }

  await connect();
  try {
    const results = await seedTemplatesForOrganization(organizationId, { publish });
    console.log(JSON.stringify({ organizationId, results }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  seedTemplatesForOrganization
};
