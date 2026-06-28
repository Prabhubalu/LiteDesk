/**
 * ============================================================================
 * AUDIT APP: Audit Read Controller (Read-Only APIs)
 * ============================================================================
 * 
 * Purpose:
 * - Read-only APIs for Audit App auditor workspace
 * - View assigned audits, execution context, and timeline
 * - No state mutations
 * - No workflow logic
 * 
 * Core Principles:
 * - SALES remains single source of truth
 * - Ownership-based access only (assignedTo === req.user._id)
 * - Use Audit App models only
 * - Reference SALES models via IDs
 * - No SALES permissions required
 * 
 * See AUDIT_READ_APIS.md for API documentation.
 * ============================================================================
 */

const AuditAssignment = require('../models/AuditAssignment');
const AuditExecutionContext = require('../models/AuditExecutionContext');
const AuditTimeline = require('../models/AuditTimeline');
const Event = require('../models/Event');
const Organization = require('../models/Organization');
const { resolveAppAccess } = require('../services/accessResolutionService');
const { resolveAccessFeedback } = require('../utils/executionFeedbackResolver');

/** Organization lives on master DB only — never populate it from tenant-scoped Event queries. */
async function loadRelatedOrganizationName(relatedToId) {
    if (!relatedToId) return null;
    try {
        const org = await Organization.findById(relatedToId).select('name').lean();
        if (!org) return null;
        return { _id: org._id, name: org.name };
    } catch (err) {
        console.warn('[auditReadController] Failed to load related organization:', err.message);
        return null;
    }
}

/**
 * Helper: Validate assignment ownership
 */
async function validateAssignmentOwnership(eventId, userId, organizationId) {
    let eventObjectId = null;
    
    // Determine if eventId is MongoDB _id or UUID eventId
    if (eventId.match(/^[0-9a-f]{24}$/i)) {
        // It's a MongoDB _id
        eventObjectId = eventId;
    } else {
        // It's a UUID eventId - find the Event first
        const event = await Event.findOne({ 
            eventId, 
            organizationId 
        }).select('_id').lean();
        
        if (!event) {
            return { 
                valid: false, 
                error: { 
                    status: 404, 
                    message: 'Event not found.' 
                } 
            };
        }
        eventObjectId = event._id;
    }
    
    // Find assignment by eventId (MongoDB _id) and auditor
    const assignment = await AuditAssignment.findOne({
        eventId: eventObjectId,
        auditorId: userId,
        organizationId
    }).lean();
    
    if (!assignment) {
        return {
            valid: false,
            error: {
                status: 404,
                message: 'Assignment not found or access denied.'
            }
        };
    }
    
    return { valid: true, assignment, eventObjectId };
}

/**
 * @route   GET /audit/assignments
 * @desc    List all audits assigned to the logged-in auditor
 * @access  Private (Audit App only)
 */
exports.listAssignments = async (req, res) => {
    try {
        const {
            auditState,
            auditType,
            status = 'active',
            sortBy = 'dueAt',
            sortOrder = 'asc',
            page = 1,
            limit = 50
        } = req.query;
        
        // Build query - filter by auditor and organization
        const query = {
            auditorId: req.user._id,
            organizationId: req.user.organizationId
        };
        
        // Apply filters
        if (status) {
            query.status = status;
        }
        if (auditState) {
            query.auditState = auditState;
        }
        if (auditType) {
            query.auditType = auditType;
        }
        
        // Build sort options
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
        
        // Fetch assignments
        const assignments = await AuditAssignment.find(query)
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();
        
        const total = await AuditAssignment.countDocuments(query);
        
        // Load event names for display in dashboard/list surfaces
        const eventObjectIds = assignments
            .map((assignment) => assignment.eventId)
            .filter(Boolean);
        const events = eventObjectIds.length > 0
            ? await Event.find({ _id: { $in: eventObjectIds } })
                .select('_id eventName')
                .lean()
            : [];
        const eventNameById = new Map(
            events.map((event) => [String(event._id), event.eventName || null])
        );

        // Format response
        const formattedAssignments = assignments.map(assignment => ({
            assignmentId: assignment._id,
            eventId: assignment.eventId,
            auditName: eventNameById.get(String(assignment.eventId)) || null,
            auditType: assignment.auditType,
            auditState: assignment.auditState,
            scheduledAt: assignment.scheduledAt,
            dueAt: assignment.dueAt,
            status: assignment.status,
            createdAt: assignment.createdAt,
            updatedAt: assignment.updatedAt
        }));
        
        res.status(200).json({
            success: true,
            data: {
                assignments: formattedAssignments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Error listing assignments:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching assignments.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @route   GET /audit/assignments/:eventId
 * @desc    Get audit detail view (assignment + event + execution context)
 * @access  Private (Audit App only)
 */
exports.getAssignmentDetail = async (req, res) => {
    try {
        const { eventId } = req.params;
        
        // Validate ownership
        const ownershipCheck = await validateAssignmentOwnership(
            eventId,
            req.user._id,
            req.user.organizationId
        );
        
        if (!ownershipCheck.valid) {
            return res.status(ownershipCheck.error.status).json({
                success: false,
                message: ownershipCheck.error.message
            });
        }
        
        const assignment = ownershipCheck.assignment;
        const eventObjectId = ownershipCheck.eventObjectId || assignment.eventId;
        
        // Fetch minimal event data (read-only)
        let event = null;
        if (eventObjectId) {
            event = await Event.findById(eventObjectId)
                .select('_id eventId eventName auditState eventType startDateTime endDateTime relatedToId location geoRequired linkedFormId metadata formAssignment')
                .populate({ path: 'assignedTo', select: 'firstName lastName', strictPopulate: false })
                .lean();
        }

        const relatedOrganization = event ? await loadRelatedOrganizationName(event.relatedToId) : null;
        
        // Fetch execution context if exists
        const executionContext = await AuditExecutionContext.findOne({
            eventId: eventObjectId,
            executedBy: req.user._id
        })
        .select('executionStatus checkedInAt checkedOutAt geo')
        .lean();
        
        // Format response
        res.status(200).json({
            success: true,
            data: {
                assignment: {
                    assignmentId: assignment._id,
                    eventId: assignment.eventId,
                    auditName: event?.eventName || null,
                    auditType: assignment.auditType,
                    auditState: assignment.auditState,
                    scheduledAt: assignment.scheduledAt,
                    dueAt: assignment.dueAt,
                    status: assignment.status
                },
                event: event ? {
                    id: event._id,
                    eventId: event.eventId,
                    eventName: event.eventName,
                    auditState: event.auditState,
                    eventType: event.eventType,
                    startDateTime: event.startDateTime,
                    endDateTime: event.endDateTime,
                    linkedFormId: event.linkedFormId || null,
                    metadata: event.metadata || {},
                    formAssignment: event.formAssignment || null,
                    relatedToId: event.relatedToId,
                    location: event.location,
                    geoRequired: event.geoRequired,
                    relatedOrganization
                } : null,
                executionContext: executionContext ? {
                    executionStatus: executionContext.executionStatus,
                    checkedInAt: executionContext.checkedInAt,
                    checkedOutAt: executionContext.checkedOutAt,
                    geo: executionContext.geo
                } : null
            }
        });
    } catch (error) {
        console.error('Error fetching assignment detail:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching assignment details.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @route   GET /audit/assignments/:eventId/timeline
 * @desc    Get audit timeline (read-only history)
 * @access  Private (Audit App only)
 */
exports.getTimeline = async (req, res) => {
    try {
        const { eventId } = req.params;
        
        // Validate ownership
        const ownershipCheck = await validateAssignmentOwnership(
            eventId,
            req.user._id,
            req.user.organizationId
        );
        
        if (!ownershipCheck.valid) {
            return res.status(ownershipCheck.error.status).json({
                success: false,
                message: ownershipCheck.error.message
            });
        }
        
        // Get event _id for timeline query
        const eventObjectId = ownershipCheck.eventObjectId || ownershipCheck.assignment.eventId;
        
        // Fetch timeline entries (sorted chronologically)
        const timeline = await AuditTimeline.find({
            eventId: eventObjectId,
            organizationId: req.user.organizationId
        })
        .sort({ createdAt: 1 }) // ASC - chronological
        .populate({ path: 'actorId', select: 'firstName lastName email', strictPopulate: false })
        .lean();
        
        // Format response
        const formattedTimeline = timeline.map(entry => ({
            action: entry.action,
            fromState: entry.fromState,
            toState: entry.toState,
            actor: entry.actorId ? {
                _id: entry.actorId._id,
                firstName: entry.actorId.firstName,
                lastName: entry.actorId.lastName,
                email: entry.actorId.email
            } : null,
            createdAt: entry.createdAt,
            meta: entry.meta || {}
        }));

        // Fallback: derive timeline from Event.auditHistory when synced AuditTimeline is sparse.
        // This preserves visibility for legacy events where submit/review transitions were not synced.
        let derivedTimeline = [];
        if (formattedTimeline.length <= 1) {
            const eventDoc = await Event.findById(eventObjectId)
                .select('auditHistory')
                .populate({
                    path: 'auditHistory.actorUserId',
                    select: 'firstName lastName email',
                    strictPopulate: false
                })
                .lean();

            const actionFromState = (toState) => {
                const state = String(toState || '').toLowerCase();
                if (state === 'checked_in') return 'CHECK_IN';
                if (state === 'submitted' || state === 'needs_review' || state === 'pending_corrective') return 'SUBMIT';
                if (state === 'approved' || state === 'closed') return 'APPROVE';
                if (state === 'rejected') return 'REJECT';
                return 'STATUS_CHANGED';
            };

            const history = Array.isArray(eventDoc?.auditHistory) ? eventDoc.auditHistory : [];
            derivedTimeline = history
                .filter(entry => entry && entry.timestamp && entry.action === 'status_changed')
                .map(entry => ({
                    action: actionFromState(entry.to),
                    fromState: entry.from || null,
                    toState: entry.to || null,
                    actor: entry.actorUserId ? {
                        _id: entry.actorUserId._id,
                        firstName: entry.actorUserId.firstName,
                        lastName: entry.actorUserId.lastName,
                        email: entry.actorUserId.email
                    } : null,
                    createdAt: entry.timestamp,
                    meta: entry.metadata || {}
                }));
        }

        const dedupeKey = (entry) => `${entry.action}::${new Date(entry.createdAt).getTime()}::${entry.toState || ''}`;
        const mergedTimeline = [...formattedTimeline];
        const seen = new Set(formattedTimeline.map(dedupeKey));
        for (const entry of derivedTimeline) {
            const key = dedupeKey(entry);
            if (!seen.has(key)) {
                seen.add(key);
                mergedTimeline.push(entry);
            }
        }
        mergedTimeline.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        res.status(200).json({
            success: true,
            data: {
                timeline: mergedTimeline
            }
        });
    } catch (error) {
        console.error('Error fetching timeline:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching timeline.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @route   GET /audit/assignments/:eventId/execution-status
 * @desc    Get execution status helper (for UI state decisions)
 * @access  Private (Audit App only)
 * 
 * Note: Logic is DERIVED, not enforced.
 * Actual enforcement happens in execution endpoints.
 */
exports.getExecutionStatus = async (req, res) => {
    try {
        const { eventId } = req.params;
        
        // Validate ownership
        const ownershipCheck = await validateAssignmentOwnership(
            eventId,
            req.user._id,
            req.user.organizationId
        );
        
        if (!ownershipCheck.valid) {
            return res.status(ownershipCheck.error.status).json({
                success: false,
                message: ownershipCheck.error.message
            });
        }
        
        const assignment = ownershipCheck.assignment;
        
        // Get event _id for execution context query
        const eventObjectId = ownershipCheck.eventObjectId || assignment.eventId;
        
        // Fetch execution context if exists
        const executionContext = await AuditExecutionContext.findOne({
            eventId: eventObjectId,
            executedBy: req.user._id
        })
        .select('executionStatus checkedInAt checkedOutAt')
        .lean();
        
        // Derive UI state (for button visibility, etc.)
        // Include execution entitlement to avoid offering CTAs that will fail.
        const auditState = assignment.auditState;
        const executionStatus = executionContext?.executionStatus || 'idle';
        const executionAccess = await resolveAppAccess({
            user: req.user?.toObject ? req.user.toObject() : req.user,
            organization: req.organization || req.user?.organizationId,
            appKey: req.appKey || 'AUDIT',
            intent: 'EXECUTE'
        });
        const executionFeedback = resolveAccessFeedback(executionAccess);
        const canExecute = executionAccess.allowed && executionAccess.mode === 'EXECUTION';
        
        // Determine available actions based on state
        const canCheckIn = canExecute && auditState === 'Ready to start' && executionStatus !== 'in_progress';
        const canSubmit = canExecute && auditState === 'checked_in' && executionStatus === 'in_progress';
        const canApprove = canExecute && auditState === 'needs_review';
        const canReject = canExecute && auditState === 'needs_review';
        
        res.status(200).json({
            success: true,
            data: {
                auditState,
                executionStatus,
                canCheckIn,
                canSubmit,
                canApprove,
                canReject,
                executionAccess: {
                    allowed: canExecute,
                    reason: executionAccess.reason || null,
                    mode: executionAccess.mode || null,
                    feedback: executionFeedback || null
                },
                checkedInAt: executionContext?.checkedInAt || null,
                checkedOutAt: executionContext?.checkedOutAt || null
            }
        });
    } catch (error) {
        console.error('Error fetching execution status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching execution status.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

