#!/usr/bin/env node

/**
 * Seed Platform Relationship Definitions
 *
 * RelationshipDefinition is the platform canonical schema. It must only be created or
 * updated by: system seeds, migrations, or platform-level modules (organizationId: null).
 * Tenant settings must NOT create or modify RelationshipDefinition.
 *
 * Use stable relationshipKeys (e.g. deal_events, deal_contacts, task_events) to reference
 * relationships across the system.
 *
 * Usage: node scripts/seedPlatformRelationships.js
 *
 * Run seedPlatformDefinitions.js first so AppDefinition and ModuleDefinition contain
 * the required apps (e.g. platform, sales) and modules (e.g. platform.tasks, sales.organizations).
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const RelationshipDefinition = require('../models/RelationshipDefinition');
const { validateRelationship } = require('../utils/relationshipRegistry');
const { PLATFORM_QUOTE_RELATIONSHIP_DEFINITIONS } = require('../constants/defaultQuoteRelationships');
const { PLATFORM_DOCUMENT_RELATIONSHIP_DEFINITIONS } = require('../constants/defaultDocumentRelationships');

// Support both MONGODB_URI and MONGO_URI
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;

// Platform Relationship Definitions
// Minimal foundational relationships - easy to extend
const RELATIONSHIP_DEFINITIONS = [
  // Deals → Projects (stable key: deal_projects)
  {
    relationshipKey: 'deal_projects',
    source: {
      appKey: 'sales',
      moduleKey: 'deals'
    },
    target: {
      appKey: 'projects',
      moduleKey: 'projects'
    },
    cardinality: 'ONE_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: {
      onDelete: 'DETACH'
    },
    ui: {
      source: {
        showAs: 'TAB',
        label: 'Related Projects'
      },
      target: {
        showAs: 'TAB',
        label: 'Related Deals'
      },
      picker: {
        enabled: true,
        searchable: true
      }
    },
    automation: {
      allowed: true
    },
    enabled: true
  },

  // Deals → Organizations (stable key: deal_organizations)
  {
    relationshipKey: 'deal_organizations',
    source: { appKey: 'sales', moduleKey: 'deals' },
    target: { appKey: 'sales', moduleKey: 'organizations' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Organizations' },
      target: { showAs: 'TAB', label: 'Related Deals' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  // Deals → People / Contacts (stable key: deal_contacts)
  {
    relationshipKey: 'deal_contacts',
    source: { appKey: 'sales', moduleKey: 'deals' },
    target: { appKey: 'sales', moduleKey: 'people' },
    cardinality: 'MANY_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Contacts' },
      target: { showAs: 'TAB', label: 'Related Deals' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  // Deals → Tasks (stable key: deal_tasks)
  {
    relationshipKey: 'deal_tasks',
    source: { appKey: 'sales', moduleKey: 'deals' },
    target: { appKey: 'platform', moduleKey: 'tasks' },
    cardinality: 'ONE_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Tasks' },
      target: { showAs: 'TAB', label: 'Related Deals' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  // Deals → Events (stable key: deal_events)
  {
    relationshipKey: 'deal_events',
    source: { appKey: 'sales', moduleKey: 'deals' },
    target: { appKey: 'platform', moduleKey: 'events' },
    cardinality: 'ONE_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Events' },
      target: { showAs: 'TAB', label: 'Related Deals' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  // Deals → Forms (stable key: deal_forms)
  {
    relationshipKey: 'deal_forms',
    source: { appKey: 'sales', moduleKey: 'deals' },
    target: { appKey: 'platform', moduleKey: 'forms' },
    cardinality: 'ONE_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Forms' },
      target: { showAs: 'TAB', label: 'Related Deals' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  // People → Organizations (stable key: people_organizations)
  {
    relationshipKey: 'people_organizations',
    source: { appKey: 'sales', moduleKey: 'people' },
    target: { appKey: 'sales', moduleKey: 'organizations' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Organization' },
      target: { showAs: 'TAB', label: 'Related Contacts' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  // People → Deals (stable key: people_deals)
  {
    relationshipKey: 'people_deals',
    source: { appKey: 'sales', moduleKey: 'people' },
    target: { appKey: 'sales', moduleKey: 'deals' },
    cardinality: 'MANY_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Deals' },
      target: { showAs: 'TAB', label: 'Related Contacts' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  // People → Tasks (stable key: people_tasks)
  {
    relationshipKey: 'people_tasks',
    source: { appKey: 'sales', moduleKey: 'people' },
    target: { appKey: 'platform', moduleKey: 'tasks' },
    cardinality: 'MANY_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Tasks' },
      target: { showAs: 'TAB', label: 'Related Contacts' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  // People → Events (stable key: people_events)
  {
    relationshipKey: 'people_events',
    source: { appKey: 'sales', moduleKey: 'people' },
    target: { appKey: 'platform', moduleKey: 'events' },
    cardinality: 'MANY_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Events' },
      target: { showAs: 'TAB', label: 'Related Contacts' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  // Helpdesk — Cases → People (contactId; stable key: case_people)
  {
    relationshipKey: 'case_people',
    source: { appKey: 'helpdesk', moduleKey: 'cases' },
    target: { appKey: 'sales', moduleKey: 'people' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Contact' },
      target: { showAs: 'TAB', label: 'Related Cases' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  // Helpdesk — Cases → Organizations (organizationRefId; stable key: case_organizations)
  {
    relationshipKey: 'case_organizations',
    source: { appKey: 'helpdesk', moduleKey: 'cases' },
    target: { appKey: 'sales', moduleKey: 'organizations' },
    cardinality: 'MANY_TO_ONE',
    ownership: 'TARGET',
    required: false,
    cascade: { onDelete: 'DETACH' },
    ui: {
      source: { showAs: 'TAB', label: 'Related Organization' },
      target: { showAs: 'TAB', label: 'Related Cases' },
      picker: { enabled: true, searchable: true }
    },
    automation: { allowed: true },
    enabled: true
  },
  // Audit → Audits ↔ Helpdesk → Cases
  {
    relationshipKey: 'audit.audits-to-helpdesk.cases',
    source: {
      appKey: 'audit',
      moduleKey: 'audits'
    },
    target: {
      appKey: 'helpdesk',
      moduleKey: 'cases'
    },
    cardinality: 'ONE_TO_MANY',
    ownership: 'SOURCE',
    required: false,
    cascade: {
      onDelete: 'DETACH'
    },
    ui: {
      source: {
        showAs: 'TAB',
        label: 'Related Cases'
      },
      target: {
        showAs: 'TAB',
        label: 'Related Audits'
      },
      picker: {
        enabled: true,
        searchable: true
      }
    },
    automation: {
      allowed: true
    },
    enabled: true
  },
  ...PLATFORM_QUOTE_RELATIONSHIP_DEFINITIONS,
  ...PLATFORM_DOCUMENT_RELATIONSHIP_DEFINITIONS
];

async function seedPlatformRelationships() {
  try {
    console.log('🚀 Seeding Platform Relationship Definitions...\n');

    // Validate MongoDB URI
    if (!MONGO_URI) {
      console.error('❌ Error: MONGODB_URI is not set in .env file!');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Seed Relationships
    console.log('📦 Seeding Relationship Definitions...');
    let relationshipsCreated = 0;
    let relationshipsUpdated = 0;
    let relationshipsSkipped = 0;

    for (const relData of RELATIONSHIP_DEFINITIONS) {
      // Validate relationship before creating/updating
      const validation = await validateRelationship(relData);
      
      if (!validation.valid) {
        console.log(`  ⚠️  Validation warnings for ${relData.relationshipKey}:`);
        validation.errors.forEach(err => console.log(`     - ${err}`));
        console.log('     → Upserting anyway to keep platform defaults present in DB.');
      }

      const existingRel = await RelationshipDefinition.findOne({
        relationshipKey: relData.relationshipKey
      });

      if (existingRel) {
        // Re-validate with exclude key for updates
        const updateValidation = await validateRelationship(relData, relData.relationshipKey);
        if (!updateValidation.valid) {
          console.log(`  ⚠️  Update validation warnings for ${relData.relationshipKey}:`);
          updateValidation.errors.forEach(err => console.log(`     - ${err}`));
          console.log('     → Updating anyway to keep platform defaults present in DB.');
        }

        await RelationshipDefinition.updateOne(
          { relationshipKey: relData.relationshipKey },
          relData
        );
        relationshipsUpdated++;
        console.log(`  ✅ Updated relationship: ${relData.relationshipKey}`);
      } else {
        await RelationshipDefinition.create(relData);
        relationshipsCreated++;
        console.log(`  ✅ Created relationship: ${relData.relationshipKey}`);
      }
    }

    console.log(`\n📊 Relationships: ${relationshipsCreated} created, ${relationshipsUpdated} updated, ${relationshipsSkipped} skipped\n`);

    // Summary
    console.log('✅ Platform relationships seeded successfully!');
    console.log(`\n📈 Summary:`);
    console.log(`   - Created: ${relationshipsCreated}`);
    console.log(`   - Updated: ${relationshipsUpdated}`);
    console.log(`   - Skipped: ${relationshipsSkipped}`);
    console.log(`   - Total: ${relationshipsCreated + relationshipsUpdated + relationshipsSkipped}\n`);

    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding platform relationships:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedPlatformRelationships();
}

module.exports = seedPlatformRelationships;
module.exports.RELATIONSHIP_DEFINITIONS = RELATIONSHIP_DEFINITIONS;

