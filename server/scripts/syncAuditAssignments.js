#!/usr/bin/env node

/**
 * Sync Audit Assignments from Existing Events
 * 
 * This script syncs all existing audit events to AuditAssignment records.
 * Useful when:
 * - Events were created before the sync hook was added
 * - Sync failed for some events
 * - Need to backfill assignments
 * 
 * Usage: node scripts/syncAuditAssignments.js [organizationId]
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Event = require('../models/Event');
const AuditAssignment = require('../models/AuditAssignment');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

const AUDIT_EVENT_TYPES = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'];

async function syncAuditAssignments(organizationId = null) {
  try {
    console.log('🚀 Syncing Audit Assignments from Events...\n');

    // Connect to database
    const masterUri = getMasterDatabaseUri();
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(masterUri);
    console.log('✅ Connected to MongoDB\n');

    // Build query
    const query = {
      eventType: { $in: AUDIT_EVENT_TYPES }
    };
    
    if (organizationId) {
      query.organizationId = new mongoose.Types.ObjectId(organizationId);
      console.log(`📋 Filtering by organizationId: ${organizationId}\n`);
    }

    // Find all audit events
    console.log('🔍 Finding audit events...');
    const events = await Event.find(query).lean();
    console.log(`✅ Found ${events.length} audit events\n`);

    if (events.length === 0) {
      console.log('ℹ️  No audit events found. Nothing to sync.');
      await mongoose.connection.close();
      return;
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Process each event
    for (const event of events) {
      try {
        // Check if assignment already exists
        const existingAssignment = await AuditAssignment.findOne({ eventId: event._id });
        
        if (existingAssignment) {
          console.log(`⏭️  Skipping event ${event._id} - assignment already exists`);
          skipped++;
          continue;
        }

        // Get auditorId (required for assignment)
        const auditorId = event.auditorId || event.assignedTo;
        
        if (!auditorId) {
          console.warn(`⚠️  Skipping event ${event._id} - missing auditorId/assignedTo`);
          skipped++;
          continue;
        }

        // Determine assignment status
        const status = event.auditState === 'closed' ? 'closed' : 'active';

        // Create assignment
        await AuditAssignment.create({
          auditorId: auditorId,
          organizationId: event.organizationId,
          eventId: event._id,
          auditType: event.eventType,
          auditState: event.auditState || 'Ready to start',
          scheduledAt: event.startDateTime,
          dueAt: event.endDateTime,
          status: status
        });

        console.log(`✅ Synced assignment for event ${event._id} (${event.eventType})`);
        synced++;
      } catch (error) {
        console.error(`❌ Error syncing event ${event._id}:`, error.message);
        errors++;
      }
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   ✅ Synced: ${synced}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📋 Total events: ${events.length}\n`);

    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error syncing audit assignments:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Get organizationId from command line args
const organizationId = process.argv[2] || null;

syncAuditAssignments(organizationId);
