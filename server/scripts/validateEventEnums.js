/**
 * Script to validate existing events against the new enum constraints
 * and report any documents with invalid enum values
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Get MongoDB URI
const isProduction = process.env.NODE_ENV === 'production';
const MONGO_URI = process.env.MONGODB_URI 
  || process.env.MONGO_URI 
  || (isProduction ? process.env.MONGO_URI_PRODUCTION : process.env.MONGO_URI_LOCAL)
  || process.env.MONGO_URI_ATLAS;

if (!MONGO_URI) {
  console.error('❌ Error: MongoDB URI not found in environment variables.');
  process.exit(1);
}

// Extract base URI and connect to litedesk_master
const [mongoUriWithoutQuery, mongoUriQueryPart] = MONGO_URI.split('?');
const mongoQueryString = mongoUriQueryPart ? `?${mongoUriQueryPart}` : '';
const baseUri = mongoUriWithoutQuery.split('/').slice(0, -1).join('/');
const masterDbName = 'litedesk_master';
const MONGODB_URI = `${baseUri}/${masterDbName}${mongoQueryString}`;

// Valid enum values
const VALID_EVENT_TYPES = ['Meeting', 'Call', 'Site Visit', 'Demo', 'Training', 'Webinar', 'Other'];
const VALID_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'];
const VALID_RELATED_TO_TYPES = ['Person', 'Organization', 'Deal', 'Item'];
const VALID_ATTENDEE_STATUSES = ['pending', 'accepted', 'declined', 'tentative'];

async function validateEvents() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Event = mongoose.model('Event', new mongoose.Schema({}, { strict: false }), 'events');
    
    // Find all events
    const events = await Event.find({}).lean();
    console.log(`📊 Found ${events.length} events to validate\n`);

    let invalidEvents = [];
    let issues = {
      eventType: [],
      status: [],
      relatedToType: [],
      attendeeStatus: []
    };

    for (const event of events) {
      const eventIssues = [];
      
      // Check eventType
      if (event.eventType && !VALID_EVENT_TYPES.includes(event.eventType)) {
        eventIssues.push(`eventType: "${event.eventType}" (valid: ${VALID_EVENT_TYPES.join(', ')})`);
        issues.eventType.push({
          eventId: event._id,
          eventName: event.eventName || event.title,
          invalidValue: event.eventType
        });
      }
      
      // Check status
      if (event.status && !VALID_STATUSES.includes(event.status)) {
        eventIssues.push(`status: "${event.status}" (valid: ${VALID_STATUSES.join(', ')})`);
        issues.status.push({
          eventId: event._id,
          eventName: event.eventName || event.title,
          invalidValue: event.status
        });
      }
      
      // Check relatedToType
      if (event.relatedToType && !VALID_RELATED_TO_TYPES.includes(event.relatedToType)) {
        eventIssues.push(`relatedToType: "${event.relatedToType}" (valid: ${VALID_RELATED_TO_TYPES.join(', ')})`);
        issues.relatedToType.push({
          eventId: event._id,
          eventName: event.eventName || event.title,
          invalidValue: event.relatedToType
        });
      }
      
      // Check attendee statuses
      if (event.attendees && Array.isArray(event.attendees)) {
        event.attendees.forEach((attendee, index) => {
          if (attendee.status && !VALID_ATTENDEE_STATUSES.includes(attendee.status)) {
            eventIssues.push(`attendees[${index}].status: "${attendee.status}" (valid: ${VALID_ATTENDEE_STATUSES.join(', ')})`);
            issues.attendeeStatus.push({
              eventId: event._id,
              eventName: event.eventName || event.title,
              attendeeIndex: index,
              invalidValue: attendee.status
            });
          }
        });
      }
      
      if (eventIssues.length > 0) {
        invalidEvents.push({
          _id: event._id,
          eventName: event.eventName || event.title,
          issues: eventIssues
        });
      }
    }

    console.log('📊 Validation Summary:');
    console.log(`  Total events: ${events.length}`);
    console.log(`  Valid events: ${events.length - invalidEvents.length}`);
    console.log(`  Events with issues: ${invalidEvents.length}\n`);

    if (invalidEvents.length > 0) {
      console.log('⚠️  Events with Invalid Enum Values:\n');
      
      invalidEvents.forEach((event, index) => {
        console.log(`${index + 1}. Event: ${event.eventName} (ID: ${event._id})`);
        event.issues.forEach(issue => {
          console.log(`   - ${issue}`);
        });
        console.log('');
      });

      console.log('\n📋 Issue Breakdown:');
      console.log(`  Invalid eventType: ${issues.eventType.length}`);
      console.log(`  Invalid status: ${issues.status.length}`);
      console.log(`  Invalid relatedToType: ${issues.relatedToType.length}`);
      console.log(`  Invalid attendee.status: ${issues.attendeeStatus.length}`);

      console.log('\n💡 Recommendation:');
      console.log('   Run the migration script (migrateEventsToNewSchema.js) to fix these issues.');
      console.log('   The migration will normalize enum values to match the schema.');
    } else {
      console.log('✅ All events have valid enum values!');
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run validation
if (require.main === module) {
  validateEvents()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { validateEvents };

