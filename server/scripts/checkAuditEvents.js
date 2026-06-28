#!/usr/bin/env node

/**
 * Check Audit Events in Database
 * 
 * Diagnostic script to see what events exist and their types
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Event = require('../models/Event');
const AuditAssignment = require('../models/AuditAssignment');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

async function checkAuditEvents() {
  try {
    console.log('🔍 Checking Audit Events...\n');

    // Connect to database
    const masterUri = getMasterDatabaseUri();
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(masterUri);
    console.log('✅ Connected to MongoDB\n');

    // Count all events
    const totalEvents = await Event.countDocuments({});
    console.log(`📊 Total Events: ${totalEvents}\n`);

    if (totalEvents === 0) {
      console.log('ℹ️  No events found in database.');
      await mongoose.connection.close();
      return;
    }

    // Get event type distribution
    console.log('📋 Event Type Distribution:');
    const eventTypes = await Event.aggregate([
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    eventTypes.forEach(type => {
      console.log(`   ${type._id || '(null)'}: ${type.count}`);
    });

    // Check audit event types specifically
    const AUDIT_EVENT_TYPES = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'];
    console.log('\n🔍 Audit Event Types:');
    for (const auditType of AUDIT_EVENT_TYPES) {
      const count = await Event.countDocuments({ eventType: auditType });
      console.log(`   ${auditType}: ${count}`);
      
      if (count > 0) {
        // Show sample events
        const samples = await Event.find({ eventType: auditType })
          .select('_id eventId eventName eventType auditorId assignedTo organizationId auditState')
          .limit(3)
          .lean();
        
        samples.forEach(event => {
          console.log(`      - ${event.eventName || 'Unnamed'} (ID: ${event._id})`);
          console.log(`        auditorId: ${event.auditorId || 'MISSING'}`);
          console.log(`        assignedTo: ${event.assignedTo || 'MISSING'}`);
          console.log(`        auditState: ${event.auditState || 'MISSING'}`);
        });
      }
    }

    // Check existing assignments
    console.log('\n📋 Audit Assignments:');
    const assignmentCount = await AuditAssignment.countDocuments({});
    console.log(`   Total Assignments: ${assignmentCount}`);

    if (assignmentCount > 0) {
      const assignments = await AuditAssignment.find({})
        .select('eventId auditorId organizationId auditType auditState status')
        .limit(5)
        .lean();
      
      console.log('\n   Sample Assignments:');
      assignments.forEach(assignment => {
        console.log(`      - Event: ${assignment.eventId}`);
        console.log(`        Type: ${assignment.auditType}`);
        console.log(`        Auditor: ${assignment.auditorId}`);
        console.log(`        State: ${assignment.auditState}`);
        console.log(`        Status: ${assignment.status}`);
      });
    }

    // Check for events without assignments
    const auditEvents = await Event.find({
      eventType: { $in: AUDIT_EVENT_TYPES }
    }).select('_id').lean();

    if (auditEvents.length > 0) {
      const eventIds = auditEvents.map(e => e._id);
      const existingAssignments = await AuditAssignment.find({
        eventId: { $in: eventIds }
      }).select('eventId').lean();
      
      const assignedEventIds = new Set(existingAssignments.map(a => a.eventId.toString()));
      const unassignedEvents = auditEvents.filter(e => !assignedEventIds.has(e._id.toString()));
      
      console.log(`\n⚠️  Audit Events Without Assignments: ${unassignedEvents.length}`);
      if (unassignedEvents.length > 0) {
        console.log('   These events need to be synced.');
      }
    }

    await mongoose.connection.close();
    console.log('\n✅ Check complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

checkAuditEvents();
