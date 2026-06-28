/**
 * ============================================================================
 * Portal Application Controller
 * ============================================================================
 * 
 * Portal controller for Customer Portal application (App #2).
 * Provides customer-safe APIs for viewing audits and managing corrective actions.
 * 
 * Features:
 * - User profile (GET /portal/me)
 * - Organization summary (GET /portal/org)
 * - Health check (GET /portal/health)
 * - List audits (GET /portal/audits)
 * - Audit detail (GET /portal/audits/:eventId)
 * - List corrective actions (GET /portal/actions)
 * - Upload evidence (POST /portal/actions/:actionId/evidence)
 * 
 * Core Principles:
 * - Read-mostly (only evidence upload is mutation)
 * - Organization isolation enforced
 * - Ownership-based authorization
 * - Customer-safe language only
 * - No SALES internals exposed
 * 
 * ============================================================================
 */

const User = require('../models/User');
const Organization = require('../models/Organization');
const mailroomConfigService = require('../services/mailroomConfigService');
const { getPortalRulesForUser } = require('../platform/mailroom/connectors/portal/portalRules');
const Event = require('../models/Event');
const FormResponse = require('../models/FormResponse');
const CorrectiveActionEvidence = require('../models/CorrectiveActionEvidence');
const fileStorage = require('../services/fileStorageService');
const multer = require('multer');
const {
  buildPortalAuditAccessQuery,
  findPortalAccessibleEvent,
  countOpenCorrectiveActionsForUser
} = require('../services/portalAuditAccessService');

// Configure multer for file uploads (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: fileStorage.MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        if (fileStorage.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} is not allowed`), false);
        }
    }
});

/**
 * GET /portal/me
 * Returns authenticated user profile for Portal
 */
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password') // Exclude password
            .populate('organizationId', 'name industry settings')
            .populate('roleId', 'name description color icon level')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        let portalCapabilities = null;
        try {
            const organizationId = user.organizationId?._id || user.organizationId;
            if (organizationId) {
                const mailroomConfig = await mailroomConfigService.getOrCreateConfig(organizationId);
                portalCapabilities = await getPortalRulesForUser(user, mailroomConfig);
            }
        } catch (capErr) {
            console.warn('[portalController] getMe portal capabilities:', capErr.message);
        }

        // Return minimal user profile for Portal
        res.json({
            success: true,
            data: {
                _id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber,
                avatar: user.avatar,
                role: user.role,
                roleId: user.roleId,
                organization: {
                    _id: user.organizationId?._id,
                    name: user.organizationId?.name,
                    industry: user.organizationId?.industry
                },
                portalAudience: portalCapabilities?.audience || 'customer',
                portalCapabilities: portalCapabilities
                    ? {
                        audience: portalCapabilities.audience,
                        channel: portalCapabilities.channel,
                        allowCreateCase: portalCapabilities.allowCreateCase,
                        allowReply: portalCapabilities.allowReply,
                        allowAttachments: portalCapabilities.allowAttachments === true,
                        mailroomEnabled: portalCapabilities.mailroomEnabled === true,
                        maxAttachmentsPerMessage: portalCapabilities.maxAttachmentsPerMessage,
                        maxAttachmentBytes: portalCapabilities.maxAttachmentBytes
                    }
                    : null
            }
        });
    } catch (error) {
        console.error('Portal getMe error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching user profile'
        });
    }
};

/**
 * GET /portal/org
 * Returns organization summary for Portal
 */
exports.getOrg = async (req, res) => {
    try {
        const organization = await Organization.findById(req.user.organizationId)
            .select('name industry settings isActive')
            .lean();

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Return minimal organization summary for Portal
        res.json({
            success: true,
            data: {
                _id: organization._id,
                name: organization.name,
                industry: organization.industry,
                isActive: organization.isActive,
                branding: {
                    logoUrl: organization.settings?.logoUrl || null,
                    primaryColor: organization.settings?.primaryColor || '#3a1f8a',
                    supportEmail: organization.settings?.supportEmail || null
                },
                settings: {
                    dateFormat: organization.settings?.dateFormat || 'MM/DD/YYYY',
                    timeZone: organization.settings?.timeZone || 'UTC',
                    currency: organization.settings?.currency || 'USD'
                }
            }
        });
    } catch (error) {
        console.error('Portal getOrg error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching organization'
        });
    }
};

/**
 * GET /portal/health
 * Portal-specific health check endpoint
 */
exports.getHealth = async (req, res) => {
    try {
        // Basic health check - verify user and organization exist
        const user = await User.findById(req.user._id).select('_id email').lean();
        const organization = await Organization.findById(req.user.organizationId).select('_id name isActive').lean();

        res.json({
            success: true,
            status: 'healthy',
            app: 'PORTAL',
            timestamp: new Date().toISOString(),
            user: {
                authenticated: !!user,
                userId: user?._id,
                email: user?.email
            },
            organization: {
                found: !!organization,
                organizationId: organization?._id,
                name: organization?.name,
                isActive: organization?.isActive
            }
        });
    } catch (error) {
        console.error('Portal health check error:', error);
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            app: 'PORTAL',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
};

/**
 * GET /portal/audits
 * List audits where the user's organization is the related organization
 * Returns only customer-safe fields
 * Supports summary=true query parameter for dashboard summary
 */
exports.listAudits = async (req, res) => {
    try {
        const { auditState, auditType, page = 1, limit = 20, summary } = req.query;
        const organizationId = req.user.organizationId;

        const baseQuery = await buildPortalAuditAccessQuery(organizationId, req.user);
        const query = { ...baseQuery };

        if (auditState) {
            query.auditState = auditState;
        }
        if (auditType) {
            query.eventType = auditType;
        }

        if (summary === 'true') {
            const totalAudits = await Event.countDocuments(query);
            const closedAudits = await Event.countDocuments({
                ...query,
                auditState: 'closed'
            });

            const openActions = await countOpenCorrectiveActionsForUser(organizationId, req.user);

            const recentEvents = await Event.find(query)
                .select('eventId eventName eventType auditState createdAt updatedAt')
                .sort({ updatedAt: -1 })
                .limit(5)
                .lean();

            const recentActivity = recentEvents.map(event => ({
                _id: event.eventId,
                eventId: event.eventId,
                name: event.eventName,
                type: event.eventType,
                status: event.auditState,
                auditState: event.auditState,
                createdAt: event.createdAt,
                updatedAt: event.updatedAt
            }));

            return res.json({
                success: true,
                data: {
                    totalAudits,
                    openActions,
                    closedAudits,
                    recentActivity
                }
            });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const events = await Event.find(query)
            .select('eventId eventName eventType auditState startDateTime endDateTime assignedTo createdAt')
            .populate({ path: 'assignedTo', select: 'firstName lastName', strictPopulate: false })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        const total = await Event.countDocuments(query);
        
        // Format response with customer-safe fields only
        const audits = events.map(event => ({
            id: event.eventId,
            eventId: event.eventId,
            name: event.eventName || 'Untitled Audit', // Add eventName for display
            title: event.eventName || 'Untitled Audit', // Alias for compatibility
            auditType: event.eventType,
            auditState: event.auditState,
            status: event.auditState, // Alias for compatibility
            dueAt: event.endDateTime,
            dueDate: event.endDateTime, // Alias for compatibility
            auditorName: event.assignedTo 
                ? `${event.assignedTo.firstName || ''} ${event.assignedTo.lastName || ''}`.trim()
                : null,
            createdAt: event.createdAt
        }));
        
        res.json({
            success: true,
            data: {
                audits,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Portal listAudits error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching audits'
        });
    }
};

/**
 * GET /portal/audits/:eventId
 * Get audit detail with findings summary and corrective actions
 * Returns customer-safe view only
 */
exports.getAuditDetail = async (req, res) => {
    try {
        const { eventId } = req.params;
        const organizationId = req.user.organizationId;

        let event = await findPortalAccessibleEvent(organizationId, eventId, req.user);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Audit not found'
            });
        }

        const populatedEvent = await Event.findById(event._id)
            .select('eventId eventName eventType auditState startDateTime endDateTime assignedTo createdAt auditHistory')
            .populate({ path: 'assignedTo', select: 'firstName lastName', strictPopulate: false })
            .lean();
        event = populatedEvent || event;
        // Find form response for this event
        // FormResponse is linked to Event via linkedTo
        const formResponse = await FormResponse.findOne({
            'linkedTo.type': 'Event',
            'linkedTo.id': event._id,
            organizationId
        })
        .select('correctiveActions responses')
        .lean();
        
        // Build findings summary
        const findingsSummary = {
            total: 0,
            passed: 0,
            failed: 0,
            requiresAction: 0
        };
        
        if (formResponse && formResponse.responses) {
            const responses = Array.isArray(formResponse.responses) 
                ? formResponse.responses 
                : Object.values(formResponse.responses);
            
            findingsSummary.total = responses.length;
            responses.forEach(response => {
                if (response.answer === 'Yes' || response.answer === 'Pass') {
                    findingsSummary.passed++;
                } else if (response.answer === 'No' || response.answer === 'Fail') {
                    findingsSummary.failed++;
                    if (formResponse.correctiveActions && 
                        formResponse.correctiveActions.some(ca => ca.questionId === response.questionId)) {
                        findingsSummary.requiresAction++;
                    }
                }
            });
        }
        
        // Build corrective actions (customer-safe view)
        const correctiveActions = [];
        if (formResponse && formResponse.correctiveActions) {
            correctiveActions.push(...formResponse.correctiveActions.map(action => ({
                id: action.questionId,
                auditId: event.eventId,
                title: action.questionText || 'Corrective Action Required',
                status: action.managerAction?.status?.toUpperCase() || 'OPEN',
                dueDate: null, // Not stored in current model
                requiresEvidence: !!(action.managerAction?.proof && action.managerAction.proof.length > 0)
            })));
        }
        
        // Build timeline (read-only, sanitized)
        const timeline = [];
        if (event.auditHistory && Array.isArray(event.auditHistory)) {
            timeline.push(...event.auditHistory.map(entry => ({
                timestamp: entry.timestamp,
                action: sanitizeActionName(entry.action),
                actor: 'System' // Don't expose internal actor roles
            })));
        }
        
        // Format audit response
        const audit = {
            id: event.eventId,
            eventId: event.eventId,
            name: event.eventName || 'Untitled Audit',
            title: event.eventName || 'Untitled Audit', // Alias for compatibility
            eventName: event.eventName || 'Untitled Audit',
            auditType: event.eventType,
            auditState: event.auditState,
            status: event.auditState, // Alias for compatibility
            createdAt: event.createdAt,
            dueAt: event.endDateTime,
            dueDate: event.endDateTime, // Alias for compatibility
            scheduledAt: event.startDateTime,
            auditorName: event.assignedTo 
                ? `${event.assignedTo.firstName || ''} ${event.assignedTo.lastName || ''}`.trim()
                : null
        };
        
        res.json({
            success: true,
            data: {
                audit,
                findingsSummary,
                correctiveActions,
                timeline
            }
        });
    } catch (error) {
        console.error('Portal getAuditDetail error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching audit details'
        });
    }
};

/**
 * Helper: Sanitize action names for customer view
 */
function sanitizeActionName(action) {
    const sanitized = {
        'status_changed': 'Status Updated',
        'rescheduled': 'Rescheduled',
        'created': 'Created',
        'updated': 'Updated',
        'note_added': 'Note Added'
    };
    return sanitized[action] || action;
}

/**
 * GET /portal/actions
 * List corrective actions assigned to the user
 * Returns only actions where user is the corrective owner
 */
exports.listCorrectiveActions = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const organizationId = req.user.organizationId;

        const events = await Event.find(await buildPortalAuditAccessQuery(organizationId, req.user))
            .select('_id eventId eventName auditState')
            .lean();
        
        const eventIds = events.map(e => e._id);
        
        if (eventIds.length === 0) {
            return res.json({
                success: true,
                data: {
                    actions: [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: 0,
                        totalPages: 0
                    }
                }
            });
        }
        
        // Find form responses for these events
        // FormResponse is linked to Event via linkedTo
        const formResponses = await FormResponse.find({
            'linkedTo.type': 'Event',
            'linkedTo.id': { $in: eventIds },
            organizationId: organizationId
        })
        .select('linkedTo.id correctiveActions')
        .lean();
        
        // Build actions list from audits the portal user can access.
        const actions = [];
        formResponses.forEach(response => {
            const eventId = response.linkedTo?.id;
            const event = events.find(e => e._id.toString() === eventId?.toString());
            if (event && response.correctiveActions) {
                response.correctiveActions.forEach(action => {
                    // Normalize status - handle lowercase, uppercase, and null/undefined
                    let actionStatus = action.managerAction?.status;
                    if (!actionStatus) {
                        actionStatus = 'open';
                    }
                    // Normalize: convert to uppercase and replace spaces with underscores
                    // Database stores: 'open', 'in_progress', 'completed'
                    actionStatus = String(actionStatus).toLowerCase().replace(/\s+/g, '_');
                    // Convert to uppercase for API response
                    const normalizedStatus = actionStatus.toUpperCase();
                    
                    // Filter by status if provided
                    if (status) {
                        const filterStatus = status.toUpperCase().replace(/\s+/g, '_');
                        if (normalizedStatus !== filterStatus) {
                            return;
                        }
                    }
                    
                    actions.push({
                        id: action.questionId,
                        auditId: event.eventId,
                        auditName: event.eventName || 'Untitled Audit',
                        title: action.questionText || 'Corrective Action Required',
                        status: normalizedStatus, // 'OPEN', 'IN_PROGRESS', 'COMPLETED'
                        dueDate: null, // Not stored in current model
                        requiresEvidence: !!(action.managerAction?.proof && action.managerAction.proof.length > 0)
                    });
                });
            }
        });
        
        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedActions = actions.slice(skip, skip + parseInt(limit));
        
        res.json({
            success: true,
            data: {
                actions: paginatedActions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: actions.length,
                    totalPages: Math.ceil(actions.length / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Portal listCorrectiveActions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching corrective actions'
        });
    }
};

/**
 * POST /portal/actions/:actionId/evidence
 * Upload evidence for a corrective action
 * Only mutation allowed in Portal App
 */
exports.uploadEvidence = async (req, res) => {
    try {
        const { actionId } = req.params;
        const organizationId = req.user.organizationId;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'File is required'
            });
        }
        
        // Find the corrective action
        // actionId is questionId, we need to find the FormResponse containing it
        const formResponse = await FormResponse.findOne({
            organizationId: organizationId,
            'correctiveActions.questionId': actionId
        })
        .select('linkedTo correctiveActions')
        .lean();

        if (!formResponse) {
            return res.status(404).json({
                success: false,
                message: 'Corrective action not found'
            });
        }

        if (formResponse.linkedTo?.type !== 'Event' || !formResponse.linkedTo?.id) {
            return res.status(404).json({
                success: false,
                message: 'Audit not found'
            });
        }

        const event = await findPortalAccessibleEvent(
            organizationId,
            formResponse.linkedTo.id,
            req.user
        );
        if (!event) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        if (String(event.correctiveOwnerId) !== String(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to upload evidence for this action'
            });
        }

        const action = formResponse.correctiveActions.find((ca) => ca.questionId === actionId);
        if (!action) {
            return res.status(404).json({
                success: false,
                message: 'Corrective action not found'
            });
        }
        
        const actionStatus = action.managerAction?.status?.toLowerCase() || 'open';
        if (!['open', 'in_progress'].includes(actionStatus)) {
            return res.status(409).json({
                success: false,
                message: 'Cannot upload evidence for closed or completed action'
            });
        }
        
        if (event.auditState === 'closed') {
            return res.status(409).json({
                success: false,
                message: 'Cannot upload evidence for closed audit'
            });
        }
        
        // Upload file
        let uploadResult;
        try {
            uploadResult = await fileStorage.uploadMulterFile(req.file, {
                organizationId: organizationId.toString(),
                category: 'evidence'
            });
        } catch (uploadError) {
            if (uploadError.message.includes('File size')) {
                return res.status(413).json({
                    success: false,
                    message: 'File too large'
                });
            }
            if (uploadError.message.includes('File type')) {
                return res.status(415).json({
                    success: false,
                    message: 'Unsupported file type'
                });
            }
            throw uploadError;
        }
        
        // Create evidence record (append-only)
        const evidence = await CorrectiveActionEvidence.create({
            organizationId: organizationId,
            correctiveActionId: actionId, // Using questionId as identifier
            uploadedBy: userId,
            fileUrl: uploadResult.url,
            fileName: uploadResult.fileName,
            fileSize: uploadResult.fileSize,
            mimeType: uploadResult.mimeType
        });
        
        // Update FormResponse to append evidence (immutable append)
        // Note: This is the only mutation allowed - appending to proof array
        await FormResponse.updateOne(
            {
                _id: formResponse._id,
                'correctiveActions.questionId': actionId
            },
            {
                $push: {
                    'correctiveActions.$.managerAction.proof': uploadResult.url
                }
            }
        );
        
        res.status(201).json({
            success: true,
            data: {
                evidence: {
                    id: evidence._id,
                    fileUrl: evidence.fileUrl,
                    fileName: evidence.fileName,
                    fileSize: evidence.fileSize,
                    mimeType: evidence.mimeType,
                    uploadedAt: evidence.createdAt
                }
            }
        });
    } catch (error) {
        console.error('Portal uploadEvidence error:', error);
        
        // Handle specific error codes
        if (error.message.includes('File size')) {
            return res.status(413).json({
                success: false,
                message: 'File too large'
            });
        }
        if (error.message.includes('File type')) {
            return res.status(415).json({
                success: false,
                message: 'Unsupported file type'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Server error uploading evidence'
        });
    }
};

// Export upload middleware for route
exports.uploadMiddleware = upload.single('file');

