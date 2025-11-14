const mongoose = require('mongoose');
const Event = require('../models/Event');
const Deal = require('../models/Deal');
const People = require('../models/People');

// Get all events (with date range filtering for calendar)
exports.getEvents = async (req, res) => {
    try {
        const { 
            startDateTime, 
            endDateTime,
            eventType, 
            status, 
            search,
            relatedType,
            relatedId,
            includeRelated = 'false',
            page = 1, 
            limit = 100,
            sortBy = 'startDateTime',
            sortOrder = 'asc'
        } = req.query;
        
        const query = { organizationId: req.user.organizationId };
        
        // Date range filter
        if (startDateTime || endDateTime) {
            query.startDateTime = {};
            if (startDateTime) query.startDateTime.$gte = new Date(startDateTime);
            if (endDateTime) query.startDateTime.$lte = new Date(endDateTime);
        }
        
        // Event type filter
        if (eventType) {
            query.eventType = eventType;
        }
        
        // Status filter
        if (status) {
            // Normalize status (capitalize first letter)
            const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            query.status = normalizedStatus;
        }
        
        // Related record filter with rollup support
        if (relatedType && relatedId) {
            // Map Person to Contact for database queries
            const dbRelatedType = relatedType === 'Person' ? 'Contact' : relatedType;
            
            // If fetching for a Contact/Person and includeRelated is true, also fetch events from related Deals
            if ((relatedType === 'Contact' || relatedType === 'Person') && includeRelated === 'true') {
                // Find all deals related to this contact
                const relatedDeals = await Deal.find({
                    contactId: relatedId,
                    organizationId: req.user.organizationId
                }).select('_id').lean();
                
                const dealIds = relatedDeals.map(deal => deal._id);
                
                // Query for events related to the contact OR related to any of the contact's deals
                query.$or = [
                    {
                        relatedToType: 'Person',
                        relatedToId: relatedId
                    },
                    {
                        relatedToType: 'Deal',
                        relatedToId: { $in: dealIds }
                    }
                ];
            } else {
                // Standard query - just the specified related record
                query.relatedToType = relatedType;
                query.relatedToId = relatedId;
            }
        }
        
        // Search filter
        if (search) {
            const searchConditions = [
                { eventName: { $regex: search, $options: 'i' } },
                { agendaNotes: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } }
            ];
            
            // If we already have an $or from related records, combine them with $and
            if (query.$or) {
                query.$and = [
                    { $or: query.$or },
                    { $or: searchConditions }
                ];
                delete query.$or;
            } else {
                query.$or = searchConditions;
            }
        }
        
        // Sort order
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        // Fetch events without populating relatedToId (since refPath 'Person' doesn't match model 'People')
        const events = await Event.find(query)
            .populate('eventOwnerId', 'firstName lastName email')
            .populate('attendees.userId', 'firstName lastName email')
            .populate('attendees.personId', 'first_name last_name email')
            .populate('linkedFormId', 'name formId formType status')
            .populate('formAssignment.assignedAuditor', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName')
            .populate('modifiedBy', 'firstName lastName')
            .populate('linkedTaskId', 'title description')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();
        
        // Manually populate relatedToId for 'Person' type (maps to 'People' model)
        // Batch populate for better performance
        const personIds = events
            .filter(e => e.relatedToId && e.relatedToType === 'Person')
            .map(e => e.relatedToId);
        
        if (personIds.length > 0) {
            try {
                const peopleMap = new Map();
                const people = await People.find({ _id: { $in: personIds } })
                    .select('name title first_name last_name')
                    .lean();
                
                people.forEach(person => {
                    peopleMap.set(person._id.toString(), person);
                });
                
                // Assign populated data back to events
                events.forEach(event => {
                    if (event.relatedToId && event.relatedToType === 'Person') {
                        const personIdStr = event.relatedToId.toString();
                        if (peopleMap.has(personIdStr)) {
                            event.relatedToId = peopleMap.get(personIdStr);
                        }
                    }
                });
            } catch (err) {
                console.warn('Failed to populate relatedToId for Person type:', err.message);
            }
        }
        
        const count = await Event.countDocuments(query);
        
        res.status(200).json({
            success: true,
            data: events,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            total: count
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching events.', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get a single event by ID (supports both _id and eventId)
exports.getEventById = async (req, res) => {
    try {
        const query = { organizationId: req.user.organizationId };
        
        // Support both MongoDB _id and eventId UUID
        if (req.params.id.match(/^[0-9a-f]{24}$/i)) {
            query._id = req.params.id;
        } else {
            query.eventId = req.params.id;
        }
        
        let event = await Event.findOne(query)
            .populate('eventOwnerId', 'firstName lastName email')
            .populate('attendees.userId', 'firstName lastName email')
            .populate('attendees.personId', 'first_name last_name email')
            .populate('linkedFormId', 'name formId formType status')
            .populate('formAssignment.assignedAuditor', 'firstName lastName email')
            .populate('notes.created_by', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .populate('modifiedBy', 'firstName lastName')
            .populate('linkedTaskId', 'title description')
            .populate('auditHistory.actorUserId', 'firstName lastName email')
            .lean();
        
        // Manually populate relatedToId based on relatedToType
        // Since refPath uses 'Person' but model is 'People', we need to handle this manually
        // Only populate if relatedToId exists and relatedToType is 'Person' (which maps to 'People')
        if (event && event.relatedToId && event.relatedToType === 'Person') {
            try {
                const relatedDoc = await People.findById(event.relatedToId)
                    .select('name title first_name last_name')
                    .lean();
                if (relatedDoc) {
                    event.relatedToId = relatedDoc;
                }
            } catch (err) {
                // If populate fails, leave relatedToId as is
                console.warn(`Failed to populate relatedToId for event ${event._id}:`, err.message);
            }
        }
        // For other types (Organization, Deal, etc.), Mongoose refPath should work
        // But if it doesn't, we can add them here if needed
        
        if (!event) {
            return res.status(404).json({ 
                success: false,
                message: 'Event not found.' 
            });
        }
        
        res.status(200).json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching event.', 
            error: error.message 
        });
    }
};

// Create a new event
exports.createEvent = async (req, res) => {
    try {
        console.log('Creating event with data:', JSON.stringify(req.body, null, 2));
        
        const eventData = {
            ...req.body,
            organizationId: req.user.organizationId,
            eventOwnerId: req.body.eventOwnerId || req.user._id,
            createdBy: req.user._id,
            modifiedBy: req.user._id
        };
        
        // Normalize status if provided
        if (eventData.status && typeof eventData.status === 'string') {
            eventData.status = eventData.status.charAt(0).toUpperCase() + eventData.status.slice(1).toLowerCase();
        }
        
        // Normalize eventType if provided
        if (eventData.eventType && typeof eventData.eventType === 'string') {
            eventData.eventType = eventData.eventType.charAt(0).toUpperCase() + eventData.eventType.slice(1);
        }
        
        // Map Person to Contact for relatedToType
        if (eventData.relatedToType === 'Person') {
            // Keep as Person in the schema, but we'll handle it in queries
        }
        
        // If no attendees provided, add owner as attendee
        if (!eventData.attendees || eventData.attendees.length === 0) {
            eventData.attendees = [{
                userId: req.user._id,
                email: req.user.email || 'no-email@example.com',
                name: `${req.user.firstName || 'User'} ${req.user.lastName || ''}`.trim(),
                status: 'accepted'
            }];
        }
        
        const event = new Event(eventData);
        await event.save();
        
        console.log('Event saved successfully with ID:', event._id, 'eventId:', event.eventId);
        
        const populatedEvent = await Event.findById(event._id)
            .populate('eventOwnerId', 'firstName lastName email')
            .populate('attendees.userId', 'firstName lastName email')
            .populate('attendees.personId', 'first_name last_name email')
            .populate('relatedToId', 'name title first_name last_name')
            .populate('linkedTaskId', 'title description')
            .populate('createdBy', 'firstName lastName')
            .populate('modifiedBy', 'firstName lastName')
            .populate('linkedFormId', 'name formId formType status')
            .populate('formAssignment.assignedAuditor', 'firstName lastName email');
        
        res.status(201).json({
            success: true,
            message: 'Event created successfully.',
            data: populatedEvent
        });
    } catch (error) {
        console.error('Error creating event - Full error:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        if (error.errors) {
            console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        }
        
        res.status(400).json({ 
            success: false,
            message: 'Error creating event.', 
            error: error.message,
            validationErrors: error.errors ? Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            })) : null
        });
    }
};

// Update an event
exports.updateEvent = async (req, res) => {
    try {
        // Prevent changing organizationId, createdBy, createdTime, eventId
        delete req.body.organizationId;
        delete req.body.createdBy;
        delete req.body.createdTime;
        delete req.body._id;
        delete req.body.__v;
        delete req.body.eventId;
        
        // Build query (support both _id and eventId)
        const query = { organizationId: req.user.organizationId };
        if (req.params.id.match(/^[0-9a-f]{24}$/i)) {
            query._id = req.params.id;
        } else {
            query.eventId = req.params.id;
        }
        
        // Get current event to track changes for audit
        const currentEvent = await Event.findOne(query);
        if (!currentEvent) {
            return res.status(404).json({ 
                success: false,
                message: 'Event not found.' 
            });
        }
        
        // Normalize status if provided
        if (req.body.status && typeof req.body.status === 'string') {
            req.body.status = req.body.status.charAt(0).toUpperCase() + req.body.status.slice(1).toLowerCase();
        }
        
        // Track status changes for audit
        if (req.body.status && req.body.status !== currentEvent.status) {
            currentEvent.addAuditEntry('status_changed', req.user._id, currentEvent.status, req.body.status);
        }
        
        // Track reschedule for audit
        const oldStart = currentEvent.startDateTime;
        const oldEnd = currentEvent.endDateTime;
        const newStart = req.body.startDateTime ? new Date(req.body.startDateTime) : null;
        const newEnd = req.body.endDateTime ? new Date(req.body.endDateTime) : null;
        
        if ((newStart && oldStart && newStart.getTime() !== oldStart.getTime()) ||
            (newEnd && oldEnd && newEnd.getTime() !== oldEnd.getTime())) {
            currentEvent.addAuditEntry('rescheduled', req.user._id, {
                startDateTime: oldStart,
                endDateTime: oldEnd
            }, {
                startDateTime: newStart || oldStart,
                endDateTime: newEnd || oldEnd
            }, {
                reason: req.body.rescheduleReason || 'No reason provided'
            });
        }
        
        // Merge audit history
        const updateData = {
            ...req.body,
            modifiedBy: req.user._id,
            auditHistory: currentEvent.auditHistory
        };
        
        const updatedEvent = await Event.findOneAndUpdate(
            query,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('eventOwnerId', 'firstName lastName email')
            .populate('attendees.userId', 'firstName lastName email')
            .populate('attendees.personId', 'first_name last_name email')
            .populate('relatedToId', 'name title first_name last_name')
            .populate('linkedTaskId', 'title description')
            .populate('modifiedBy', 'firstName lastName')
            .populate('linkedFormId', 'name formId formType status')
            .populate('formAssignment.assignedAuditor', 'firstName lastName email');
        
        res.status(200).json({
            success: true,
            message: 'Event updated successfully.',
            data: updatedEvent
        });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error updating event.', 
            error: error.message 
        });
    }
};

// Delete an event (supports both _id and eventId)
exports.deleteEvent = async (req, res) => {
    try {
        const query = { organizationId: req.user.organizationId };
        
        // Support both MongoDB _id and eventId UUID
        if (req.params.id.match(/^[0-9a-f]{24}$/i)) {
            query._id = req.params.id;
        } else {
            query.eventId = req.params.id;
        }
        
        const deletedEvent = await Event.findOneAndDelete(query);
        
        if (!deletedEvent) {
            return res.status(404).json({ 
                success: false,
                message: 'Event not found.' 
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Event deleted successfully.'
        });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting event.', 
            error: error.message 
        });
    }
};

// Bulk delete events
exports.bulkDeleteEvents = async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Please provide an array of event IDs.' 
            });
        }
        
        // Support both _id and eventId
        const mongoIds = ids.filter(id => id.match(/^[0-9a-f]{24}$/i));
        const eventIds = ids.filter(id => !id.match(/^[0-9a-f]{24}$/i));
        
        const query = {
            organizationId: req.user.organizationId,
            $or: []
        };
        
        if (mongoIds.length > 0) {
            query.$or.push({ _id: { $in: mongoIds } });
        }
        if (eventIds.length > 0) {
            query.$or.push({ eventId: { $in: eventIds } });
        }
        
        if (query.$or.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: 'No valid event IDs provided.' 
            });
        }
        
        const result = await Event.deleteMany(query);
        
        res.status(200).json({
            success: true,
            message: `Successfully deleted ${result.deletedCount} event(s).`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error bulk deleting events:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting events.', 
            error: error.message 
        });
    }
};

// Update event status
exports.updateEventStatus = async (req, res) => {
    try {
        let { status } = req.body;
        
        // Normalize status (capitalize first letter)
        if (status) {
            status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        }
        
        if (!['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'].includes(status)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid status value. Must be one of: Scheduled, Completed, Cancelled, Rescheduled.' 
            });
        }
        
        // Build query (support both _id and eventId)
        const query = { organizationId: req.user.organizationId };
        if (req.params.id.match(/^[0-9a-f]{24}$/i)) {
            query._id = req.params.id;
        } else {
            query.eventId = req.params.id;
        }
        
        // Get current event to track status change
        const currentEvent = await Event.findOne(query);
        if (!currentEvent) {
            return res.status(404).json({ 
                success: false,
                message: 'Event not found.' 
            });
        }
        
        const oldStatus = currentEvent.status;
        
        // Add audit entry
        currentEvent.addAuditEntry('status_changed', req.user._id, oldStatus, status);
        
        const updatedEvent = await Event.findOneAndUpdate(
            query,
            { 
                status, 
                modifiedBy: req.user._id,
                auditHistory: currentEvent.auditHistory
            },
            { new: true }
        )
            .populate('eventOwnerId', 'firstName lastName email')
            .populate('attendees.userId', 'firstName lastName email')
            .populate('attendees.personId', 'first_name last_name email')
            .populate('modifiedBy', 'firstName lastName');
        
        res.status(200).json({
            success: true,
            message: 'Event status updated successfully.',
            data: updatedEvent
        });
    } catch (error) {
        console.error('Error updating event status:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error updating event status.', 
            error: error.message 
        });
    }
};

// Get events statistics
exports.getEventStats = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        
        // Total events
        const totalEvents = await Event.countDocuments({ organizationId });
        
        // Upcoming events (today onwards)
        const upcomingEvents = await Event.countDocuments({
            organizationId,
            startDateTime: { $gte: new Date() },
            status: 'Scheduled'
        });
        
        // Today's events
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const todayEvents = await Event.countDocuments({
            organizationId,
            startDateTime: { $gte: startOfToday, $lte: endOfToday }
        });
        
        // This week's events
        const day = now.getDay();
        const diff = now.getDate() - day; // Sunday is 0
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
        const endOfWeek = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59);
        const weekEvents = await Event.countDocuments({
            organizationId,
            startDateTime: { $gte: startOfWeek, $lte: endOfWeek }
        });
        
        // Events by type
        const eventsByType = await Event.aggregate([
            { $match: { organizationId } },
            { $group: { _id: '$eventType', count: { $sum: 1 } } }
        ]);
        
        // Events by status
        const eventsByStatus = await Event.aggregate([
            { $match: { organizationId } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                total: totalEvents,
                upcoming: upcomingEvents,
                today: todayEvents,
                thisWeek: weekEvents,
                byType: eventsByType.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                byStatus: eventsByStatus.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            }
        });
    } catch (error) {
        console.error('Error fetching event stats:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching event statistics.', 
            error: error.message 
        });
    }
};

// Add note to event
exports.addNote = async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Note text is required'
            });
        }
        
        // Build query (support both _id and eventId)
        const query = { organizationId: req.user.organizationId };
        if (req.params.id.match(/^[0-9a-f]{24}$/i)) {
            query._id = req.params.id;
        } else {
            query.eventId = req.params.id;
        }
        
        // Get current event
        const event = await Event.findOne(query);
        if (!event) {
            return res.status(404).json({ 
                success: false,
                message: 'Event not found.' 
            });
        }
        
        // Add note to notes array (backward compatibility) or create it if it doesn't exist
        if (!event.notes) {
            event.notes = [];
        }
        
        event.notes.push({
            text: text.trim(),
            created_by: req.user._id,
            created_at: new Date()
        });
        
        // Add audit entry for note addition
        event.addAuditEntry('note_added', req.user._id, null, null, {
            noteText: text.trim().substring(0, 100) // Store first 100 chars in metadata
        });
        
        // Update modifiedBy and modifiedTime
        event.modifiedBy = req.user._id;
        event.modifiedTime = new Date();
        
        await event.save();
        
        const populatedEvent = await Event.findById(event._id)
            .populate('eventOwnerId', 'firstName lastName email')
            .populate('attendees.userId', 'firstName lastName email')
            .populate('attendees.personId', 'first_name last_name email')
            .populate('relatedToId', 'name title first_name last_name')
            .populate('linkedTaskId', 'title description')
            .populate('notes.created_by', 'firstName lastName')
            .populate('modifiedBy', 'firstName lastName');
        
        res.status(200).json({
            success: true,
            message: 'Note added successfully.',
            data: populatedEvent
        });
    } catch (error) {
        console.error('Error adding note:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error adding note.', 
            error: error.message 
        });
    }
};

// Export events to CSV
exports.exportEvents = async (req, res) => {
    try {
        const events = await Event.find({ 
            organizationId: req.user.organizationId 
        })
            .populate('eventOwnerId', 'firstName lastName email')
            .populate('relatedToId', 'name title first_name last_name')
            .sort({ startDateTime: -1 })
            .lean();
        
        const csvData = events.map(event => ({
            eventId: event.eventId,
            eventName: event.eventName,
            eventType: event.eventType,
            status: event.status,
            startDateTime: event.startDateTime,
            endDateTime: event.endDateTime,
            location: event.location,
            agendaNotes: event.agendaNotes,
            eventOwner: event.eventOwnerId ? 
                `${event.eventOwnerId.firstName} ${event.eventOwnerId.lastName}` : '',
            attendeesCount: event.attendees?.length || 0,
            relatedToType: event.relatedToType,
            tags: event.tags?.join(', ') || '',
            createdTime: event.createdTime,
            modifiedTime: event.modifiedTime
        }));
        
        res.status(200).json({
            success: true,
            data: csvData
        });
    } catch (error) {
        console.error('Error exporting events:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error exporting events.', 
            error: error.message 
        });
    }
};
