const Event = require('../models/Event');
const Deal = require('../models/Deal');

// Get all events (with date range filtering for calendar)
exports.getEvents = async (req, res) => {
    try {
        const { 
            startDate, 
            endDate, 
            type, 
            status, 
            priority,
            category,
            search,
            relatedType,
            relatedId,
            includeRelated = 'false',
            page = 1, 
            limit = 100,
            sortBy = 'startDate',
            sortOrder = 'asc'
        } = req.query;
        
        const query = { organizationId: req.user.organizationId };
        
        // Date range filter
        if (startDate || endDate) {
            query.startDate = {};
            if (startDate) query.startDate.$gte = new Date(startDate);
            if (endDate) query.startDate.$lte = new Date(endDate);
        }
        
        // Type filter
        if (type) query.type = type;
        
        // Status filter
        if (status) query.status = status;
        
        // Priority filter
        if (priority) query.priority = priority;
        
        // Category filter
        if (category) query.category = category;
        
        // Related record filter with rollup support
        if (relatedType && relatedId) {
            // If fetching for a Contact and includeRelated is true, also fetch events from related Deals
            if (relatedType === 'Contact' && includeRelated === 'true') {
                // Find all deals related to this contact
                const relatedDeals = await Deal.find({
                    contactId: relatedId,
                    organizationId: req.user.organizationId
                }).select('_id').lean();
                
                const dealIds = relatedDeals.map(deal => deal._id);
                
                // Query for events related to the contact OR related to any of the contact's deals
                query.$or = [
                    {
                        'relatedTo.type': 'Contact',
                        'relatedTo.id': relatedId
                    },
                    {
                        'relatedTo.type': 'Deal',
                        'relatedTo.id': { $in: dealIds }
                    }
                ];
            } else {
                // Standard query - just the specified related record
                query['relatedTo.type'] = relatedType;
                query['relatedTo.id'] = relatedId;
            }
        }
        
        // Search filter
        if (search) {
            const searchConditions = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
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
        
        const events = await Event.find(query)
            .populate('organizer', 'firstName lastName email')
            .populate('attendees.userId', 'firstName lastName email')
            .populate('relatedTo.id', 'name title first_name last_name')
            .populate('createdBy', 'firstName lastName')
            .populate('updatedBy', 'firstName lastName')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();
        
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
        res.status(500).json({ 
            success: false,
            message: 'Error fetching events.', 
            error: error.message 
        });
    }
};

// Get a single event by ID
exports.getEventById = async (req, res) => {
    try {
        const event = await Event.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        })
            .populate('organizer', 'firstName lastName email')
            .populate('attendees.userId', 'firstName lastName email')
            .populate('relatedTo.id', 'name title first_name last_name')
            .populate('notes.created_by', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .populate('updatedBy', 'firstName lastName');
        
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
        console.log('User info:', {
            _id: req.user._id,
            organizationId: req.user.organizationId,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName
        });
        
        const eventData = {
            ...req.body,
            organizationId: req.user.organizationId,
            organizer: req.user._id,
            createdBy: req.user._id
        };
        
        // If no attendees provided, add organizer as attendee
        if (!eventData.attendees || eventData.attendees.length === 0) {
            eventData.attendees = [{
                userId: req.user._id,
                email: req.user.email || 'no-email@example.com',
                name: `${req.user.firstName || 'User'} ${req.user.lastName || ''}`.trim(),
                status: 'accepted',
                isOrganizer: true
            }];
        }
        
        console.log('Final event data before save:', JSON.stringify(eventData, null, 2));
        
        const event = new Event(eventData);
        await event.save();
        
        console.log('Event saved successfully with ID:', event._id);
        
        const populatedEvent = await Event.findById(event._id)
            .populate('organizer', 'firstName lastName email')
            .populate('attendees.userId', 'firstName lastName email')
            .populate('relatedTo.id', 'name title first_name last_name');
        
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
        // Prevent changing organizationId and createdBy
        delete req.body.organizationId;
        delete req.body.createdBy;
        delete req.body.createdAt;
        delete req.body._id;
        delete req.body.__v;
        
        req.body.updatedBy = req.user._id;
        
        const updatedEvent = await Event.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId 
            },
            req.body,
            { new: true, runValidators: true }
        )
            .populate('organizer', 'firstName lastName email')
            .populate('attendees.userId', 'firstName lastName email')
            .populate('relatedTo.id', 'name title first_name last_name');
        
        if (!updatedEvent) {
            return res.status(404).json({ 
                success: false,
                message: 'Event not found.' 
            });
        }
        
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

// Delete an event
exports.deleteEvent = async (req, res) => {
    try {
        const deletedEvent = await Event.findOneAndDelete({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        });
        
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
        
        const result = await Event.deleteMany({
            _id: { $in: ids },
            organizationId: req.user.organizationId
        });
        
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

// Add note to event
exports.addNote = async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || !text.trim()) {
            return res.status(400).json({ 
                success: false,
                message: 'Note text is required.' 
            });
        }
        
        const event = await Event.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!event) {
            return res.status(404).json({ 
                success: false,
                message: 'Event not found.' 
            });
        }
        
        event.notes.push({
            text: text.trim(),
            created_by: req.user._id,
            created_at: new Date()
        });
        
        await event.save();
        
        const updatedEvent = await Event.findById(event._id)
            .populate('notes.created_by', 'firstName lastName');
        
        res.status(200).json({
            success: true,
            message: 'Note added successfully.',
            data: updatedEvent
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

// Update event status
exports.updateEventStatus = async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['scheduled', 'completed', 'cancelled', 'rescheduled'].includes(status)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid status value.' 
            });
        }
        
        const updatedEvent = await Event.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId 
            },
            { status, updatedBy: req.user._id },
            { new: true }
        )
            .populate('organizer', 'firstName lastName email')
            .populate('attendees.userId', 'firstName lastName email');
        
        if (!updatedEvent) {
            return res.status(404).json({ 
                success: false,
                message: 'Event not found.' 
            });
        }
        
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
            startDate: { $gte: new Date() },
            status: 'scheduled'
        });
        
        // Today's events
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const todayEvents = await Event.countDocuments({
            organizationId,
            startDate: { $gte: startOfToday, $lte: endOfToday }
        });
        
        // This week's events
        const day = now.getDay();
        const diff = now.getDate() - day; // Sunday is 0
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0);
        const endOfWeek = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59);
        const weekEvents = await Event.countDocuments({
            organizationId,
            startDate: { $gte: startOfWeek, $lte: endOfWeek }
        });
        
        // Events by type
        const eventsByType = await Event.aggregate([
            { $match: { organizationId } },
            { $group: { _id: '$type', count: { $sum: 1 } } }
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

// Export events to CSV
exports.exportEvents = async (req, res) => {
    try {
        const events = await Event.find({ 
            organizationId: req.user.organizationId 
        })
            .populate('organizer', 'firstName lastName email')
            .sort({ startDate: -1 })
            .lean();
        
        const csvData = events.map(event => ({
            title: event.title,
            description: event.description,
            startDate: event.startDate,
            endDate: event.endDate,
            allDay: event.allDay,
            location: event.location,
            meetingUrl: event.meetingUrl,
            type: event.type,
            category: event.category,
            status: event.status,
            priority: event.priority,
            organizer: event.organizer ? `${event.organizer.firstName} ${event.organizer.lastName}` : '',
            attendeesCount: event.attendees?.length || 0,
            createdAt: event.createdAt,
            updatedAt: event.updatedAt
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

