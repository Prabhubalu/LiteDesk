/**
 * Migration Script: Events Schema Update
 * 
 * Migrates existing events from old schema to new schema:
 * - title → eventName
 * - description → agendaNotes
 * - startDate → startDateTime
 * - endDate → endDateTime
 * - organizer → eventOwnerId
 * - type → eventType (with value mapping)
 * - relatedTo.{type, id} → relatedToType, relatedToId
 * - Adds eventId UUID for existing events
 * - Normalizes status values
 * - Maps Person to Contact for relatedToType
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Connect to MongoDB - check multiple environment variable names (same logic as server.js)
const isProduction = process.env.NODE_ENV === 'production';
const MONGO_URI = process.env.MONGODB_URI 
  || process.env.MONGO_URI 
  || (isProduction ? process.env.MONGO_URI_PRODUCTION : process.env.MONGO_URI_LOCAL)
  || process.env.MONGO_URI_ATLAS;

if (!MONGO_URI) {
  console.error('❌ Error: MongoDB URI not found in environment variables.');
  console.error('   Set MONGODB_URI, MONGO_URI, MONGO_URI_LOCAL, or MONGO_URI_ATLAS in .env file');
  process.exit(1);
}

// Extract base URI and connect to litedesk_master (same as server.js)
const [mongoUriWithoutQuery, mongoUriQueryPart] = MONGO_URI.split('?');
const mongoQueryString = mongoUriQueryPart ? `?${mongoUriQueryPart}` : '';
const baseUri = mongoUriWithoutQuery.split('/').slice(0, -1).join('/');
const masterDbName = 'litedesk_master';
const MONGODB_URI = `${baseUri}/${masterDbName}${mongoQueryString}`;

console.log(`📊 Using database: ${masterDbName}`);
console.log(`📊 Base URI: ${baseUri.substring(0, 30)}...`);

async function migrateEvents() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    console.log(`   URI: ${MONGODB_URI.replace(/:[^:@]+@/, ':****@')}`); // Hide password in logs
    
    // Mongoose 6+ handles these options automatically, but including them for compatibility
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const Event = mongoose.model('Event', new mongoose.Schema({}, { strict: false }), 'events');
    
    // Find all events
    const events = await Event.find({});
    console.log(`📊 Found ${events.length} events to migrate`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const event of events) {
      try {
        const update = {};
        let needsUpdate = false;

        // Generate eventId if missing
        if (!event.eventId) {
          update.eventId = uuidv4();
          needsUpdate = true;
        }

        // Map title → eventName
        if (event.title && !event.eventName) {
          update.eventName = event.title;
          needsUpdate = true;
        }

        // Map description → agendaNotes
        if (event.description && !event.agendaNotes) {
          update.agendaNotes = event.description;
          needsUpdate = true;
        }

        // Map startDate → startDateTime
        if (event.startDate && !event.startDateTime) {
          update.startDateTime = event.startDate;
          needsUpdate = true;
        }

        // Map endDate → endDateTime
        if (event.endDate && !event.endDateTime) {
          update.endDateTime = event.endDate;
          needsUpdate = true;
        }

        // Map organizer → eventOwnerId
        if (event.organizer && !event.eventOwnerId) {
          update.eventOwnerId = event.organizer;
          needsUpdate = true;
        }

        // Map type → eventType (with value normalization)
        if (event.type && !event.eventType) {
            const typeMap = {
                'meeting': 'Meeting',
                'call': 'Call',
                'email': 'Other',
                'task': 'Other',
                'deadline': 'Other',
                'follow-up': 'Other',
                'other': 'Other'
            };
            update.eventType = typeMap[event.type.toLowerCase()] || 'Other';
            needsUpdate = true;
        }

        // Normalize eventType if it exists but doesn't match enum
        if (event.eventType) {
            const validEventTypes = ['Meeting', 'Call', 'Site Visit', 'Demo', 'Training', 'Webinar', 'Other'];
            const normalizedEventType = event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1);
            if (!validEventTypes.includes(event.eventType) && validEventTypes.includes(normalizedEventType)) {
                update.eventType = normalizedEventType;
                needsUpdate = true;
            } else if (!validEventTypes.includes(event.eventType)) {
                // Map invalid values to 'Other'
                update.eventType = 'Other';
                needsUpdate = true;
            }
        }

        // Normalize status (capitalize first letter and validate against enum)
        if (event.status && typeof event.status === 'string') {
            const validStatuses = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'];
            const normalizedStatus = event.status.charAt(0).toUpperCase() + event.status.slice(1).toLowerCase();
            
            if (!validStatuses.includes(event.status)) {
                if (validStatuses.includes(normalizedStatus)) {
                    update.status = normalizedStatus;
                    needsUpdate = true;
                } else {
                    // Map common variations
                    const statusMap = {
                        'scheduled': 'Scheduled',
                        'completed': 'Completed',
                        'cancelled': 'Cancelled',
                        'canceled': 'Cancelled',
                        'rescheduled': 'Rescheduled'
                    };
                    const mappedStatus = statusMap[event.status.toLowerCase()];
                    if (mappedStatus) {
                        update.status = mappedStatus;
                        needsUpdate = true;
                    } else {
                        // Default to Scheduled if invalid
                        update.status = 'Scheduled';
                        needsUpdate = true;
                    }
                }
            }
        }

        // Map relatedTo structure
        if (event.relatedTo) {
          if (event.relatedTo.type && !event.relatedToType) {
            // Map Person to Contact for database consistency
            const relatedType = event.relatedTo.type === 'Person' ? 'Person' : event.relatedTo.type;
            update.relatedToType = relatedType;
            needsUpdate = true;
          }
          if (event.relatedTo.id && !event.relatedToId) {
            update.relatedToId = event.relatedTo.id;
            needsUpdate = true;
          }
        }

        // Ensure createdBy and modifiedBy are set
        if (!event.createdBy && event.organizer) {
          update.createdBy = event.organizer;
          needsUpdate = true;
        }
        if (!event.modifiedBy && event.updatedBy) {
          update.modifiedBy = event.updatedBy;
          needsUpdate = true;
        } else if (!event.modifiedBy && event.createdBy) {
          update.modifiedBy = event.createdBy;
          needsUpdate = true;
        }

        // Ensure createdTime and modifiedTime are set
        if (!event.createdTime && event.createdAt) {
          update.createdTime = event.createdAt;
          needsUpdate = true;
        } else if (!event.createdTime) {
          update.createdTime = new Date();
          needsUpdate = true;
        }
        if (!event.modifiedTime && event.updatedAt) {
          update.modifiedTime = event.updatedAt;
          needsUpdate = true;
        } else if (!event.modifiedTime) {
          update.modifiedTime = event.createdTime || new Date();
          needsUpdate = true;
        }

        // Initialize auditHistory if missing (add creation entry)
        if (!event.auditHistory || event.auditHistory.length === 0) {
          update.auditHistory = [{
            timestamp: event.createdTime || event.createdAt || new Date(),
            actorUserId: event.createdBy || event.organizer,
            action: 'created',
            from: null,
            to: null,
            metadata: {
              eventName: event.eventName || event.title,
              eventType: event.eventType || event.type,
              startDateTime: event.startDateTime || event.startDate
            }
          }];
          needsUpdate = true;
        }

        // Migrate location (combine location and meetingUrl if needed)
        if (event.meetingUrl && !event.location) {
          update.location = event.meetingUrl;
          needsUpdate = true;
        } else if (event.meetingUrl && event.location && !event.location.includes('http')) {
          // If location is physical and meetingUrl exists, prefer meetingUrl
          update.location = event.meetingUrl;
          needsUpdate = true;
        }

        // Initialize tags array if missing
        if (!event.tags) {
          update.tags = [];
          needsUpdate = true;
        }

        // Update attendees structure and normalize status
        if (event.attendees && Array.isArray(event.attendees)) {
            const validAttendeeStatuses = ['pending', 'accepted', 'declined', 'tentative'];
            let attendeesUpdated = false;
            
            const updatedAttendees = event.attendees.map(attendee => {
                const updatedAttendee = { ...attendee };
                
                // Normalize attendee status
                if (attendee.status && !validAttendeeStatuses.includes(attendee.status)) {
                    const normalizedStatus = attendee.status.toLowerCase();
                    if (validAttendeeStatuses.includes(normalizedStatus)) {
                        updatedAttendee.status = normalizedStatus;
                        attendeesUpdated = true;
                    } else {
                        updatedAttendee.status = 'pending'; // Default
                        attendeesUpdated = true;
                    }
                } else if (!attendee.status) {
                    updatedAttendee.status = 'pending';
                    attendeesUpdated = true;
                }
                
                return updatedAttendee;
            });
            
            if (attendeesUpdated || JSON.stringify(updatedAttendees) !== JSON.stringify(event.attendees)) {
                update.attendees = updatedAttendees;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
          await Event.updateOne(
            { _id: event._id },
            { $set: update }
          );
          migrated++;
          console.log(`  ✅ Migrated event: ${event.eventName || event.title || event._id}`);
        } else {
          skipped++;
          console.log(`  ⏭️  Skipped event (already migrated): ${event.eventName || event.title || event._id}`);
        }
      } catch (error) {
        errors++;
        console.error(`  ❌ Error migrating event ${event._id}:`, error.message);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Migrated: ${migrated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📝 Total: ${events.length}`);

    // Create indexes if they don't exist
    console.log('\n🔧 Creating indexes...');
    const db = mongoose.connection.db;
    const collection = db.collection('events');
    
    try {
      await collection.createIndex({ eventOwnerId: 1, startDateTime: 1 }, { name: 'idx_events_owner_start' });
      await collection.createIndex({ relatedToId: 1, relatedToType: 1 }, { name: 'idx_events_relatedTo' });
      await collection.createIndex({ organizationId: 1, startDateTime: 1 });
      await collection.createIndex({ organizationId: 1, status: 1 });
      await collection.createIndex({ 'attendees.userId': 1 });
      await collection.createIndex({ 'attendees.personId': 1 });
      await collection.createIndex({ eventId: 1 });
      console.log('✅ Indexes created');
    } catch (indexError) {
      console.log('⚠️  Some indexes may already exist:', indexError.message);
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
if (require.main === module) {
  migrateEvents()
    .then(() => {
      console.log('✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { migrateEvents };

