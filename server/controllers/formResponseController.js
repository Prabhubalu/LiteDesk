const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const Task = require('../models/Task');
const Event = require('../models/Event');
const mongoose = require('mongoose');
const formProcessingService = require('../services/formProcessingService');
const { isEngagementFormExpired } = require('../utils/engagementFormLifecycle');

function toUserIdString(value) {
    if (value == null) return null;
    if (typeof value === 'object' && value._id != null) return value._id.toString();
    return String(value);
}

/** Batch-attach form metadata without replacing missing formId refs with null. */
async function attachFormDetailsToResponses(responses) {
    if (!Array.isArray(responses) || responses.length === 0) return responses;

    const formIds = [
        ...new Set(
            responses
                .map((response) => response.formId)
                .filter(Boolean)
                .map((formId) => (typeof formId === 'object' && formId._id != null ? formId._id : formId))
                .map(String)
        )
    ];

    if (formIds.length === 0) return responses;

    const forms = await Form.find({ _id: { $in: formIds } })
        .select('_id name formId formType')
        .lean();
    const formById = new Map(forms.map((form) => [String(form._id), form]));

    return responses.map((response) => {
        const rawFormId = response.formId;
        if (!rawFormId) return response;

        const formKey = typeof rawFormId === 'object' && rawFormId._id != null
            ? String(rawFormId._id)
            : String(rawFormId);
        const formDoc = formById.get(formKey);

        return {
            ...response,
            formId: formDoc || rawFormId
        };
    });
}

function inferAllowSelfReview(linkedEvent) {
    return (
        linkedEvent.allowSelfReview === true
        || ((linkedEvent.allowSelfReview === undefined || linkedEvent.allowSelfReview === null)
            && linkedEvent.eventType === 'Internal Audit')
    );
}

/** When no explicit reviewer, auditor may review if self-review is allowed. */
function resolveEffectiveReviewerId(linkedEvent) {
    const explicit = toUserIdString(linkedEvent.reviewerId);
    if (explicit) return explicit;
    if (!inferAllowSelfReview(linkedEvent)) return null;
    return toUserIdString(linkedEvent.auditorId) || toUserIdString(linkedEvent.assignedTo);
}

function assertAuditReviewAuthority(linkedEvent, response, currentUserId) {
    const effectiveReviewerId = resolveEffectiveReviewerId(linkedEvent);
    if (!effectiveReviewerId) {
        return {
            status: 403,
            message: 'No reviewer is assigned for this audit.',
            code: 'AUDIT_REVIEWER_NOT_ASSIGNED'
        };
    }
    if (currentUserId !== effectiveReviewerId) {
        return {
            status: 403,
            message: 'You are not assigned as the reviewer for this audit.',
            code: 'AUDIT_REVIEWER_MISMATCH'
        };
    }
    const submittedById = response.submittedBy ? response.submittedBy.toString() : null;
    const isSelfReview = submittedById && submittedById === currentUserId;
    if (isSelfReview && !inferAllowSelfReview(linkedEvent)) {
        return {
            status: 403,
            message: 'Self-review is not allowed for this audit',
            code: 'SELF_REVIEW_NOT_ALLOWED'
        };
    }
    return null;
}

// @desc    Submit form response (public or authenticated)
// @route   POST /api/public/forms/:slug/submit OR POST /api/forms/:id/submit
// @access  Public (for public forms) or Private
exports.submitForm = async (req, res) => {
    try {
        let form;
        let organizationId;
        
        // Determine if this is a public submission or authenticated
        if (req.params.slug) {
            const slug = String(req.params.slug || '').trim().toLowerCase();
            // Public form submission
            form = await Form.findOne({
                'publicLink.slug': slug,
                'publicLink.enabled': true,
                status: { $in: ['Active', 'Ready', 'Draft'] }
            });
            
            if (!form) {
                return res.status(404).json({
                    success: false,
                    message: 'Form not found or not available.'
                });
            }
            
            // Check expiry — valid through end of expiry day (UTC)
            if (isEngagementFormExpired(form.expiryDate)) {
                return res.status(410).json({
                    success: false,
                    message: 'This form has expired.'
                });
            }
            
            organizationId = form.organizationId;
            if (!organizationId) {
                return res.status(500).json({
                    success: false,
                    message: 'Form organization ID is missing.'
                });
            }
        } else {
            // Authenticated form submission
            form = await Form.findOne({
                _id: req.params.id,
                organizationId: req.user.organizationId,
                status: 'Active'
            });
            
            if (!form) {
                return res.status(404).json({
                    success: false,
                    message: 'Form not found or access denied.'
                });
            }
            
            organizationId = req.user.organizationId;
        }
        
        const { responseDetails, linkedTo, eventId, responseId } = req.body;
        
        console.log('[submitForm] 📥 Received submission request:', {
            formId: req.params.id || req.params.slug,
            hasResponseDetails: !!(responseDetails && responseDetails.length > 0),
            responseDetailsCount: responseDetails?.length || 0,
            eventId: eventId,
            responseId: responseId,
            linkedTo: linkedTo,
            hasLinkedTo: !!linkedTo,
            bodyKeys: Object.keys(req.body)
        });
        
        // Validate response details
        if (!responseDetails || !Array.isArray(responseDetails) || responseDetails.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Response details are required.'
            });
        }
        
        // If responseId is provided, use it directly (from check-in)
        // This prevents duplicate creation - THIS IS THE PRIMARY METHOD
        let existingResponse = null;
        if (responseId) {
            const mongoose = require('mongoose');
            console.log('[submitForm] 🔍 Looking for existing response by responseId:', {
                responseId: responseId,
                responseIdType: typeof responseId,
                isValid: mongoose.Types.ObjectId.isValid(responseId),
                formId: form._id,
                organizationId: organizationId
            });
            
            if (mongoose.Types.ObjectId.isValid(responseId)) {
                // Try exact match first
                existingResponse = await FormResponse.findOne({
                    _id: responseId,
                    organizationId: organizationId,
                    formId: form._id
                });
                
                // If not found, try without formId constraint (in case formId doesn't match exactly)
                if (!existingResponse) {
                    existingResponse = await FormResponse.findOne({
                        _id: responseId,
                        organizationId: organizationId
                    });
                }
                
                if (existingResponse) {
                    console.log('[submitForm] ✅ Found existing response by responseId:', {
                        responseId: existingResponse._id,
                        executionStatus: existingResponse.executionStatus,
                        formId: existingResponse.formId,
                        linkedTo: existingResponse.linkedTo,
                        linkedToId: existingResponse.linkedTo?.id
                    });
                } else {
                    console.log('[submitForm] ❌ Response not found by responseId:', responseId);
                }
            } else {
                console.warn('[submitForm] ⚠️ Invalid responseId format:', responseId);
            }
        } else {
            console.log('[submitForm] ⚠️ No responseId provided in request body');
            
            // DEFENSIVE CHECK: If no responseId AND no eventId, check if there are any "In Progress" responses
            // for this form+organization that are linked to events. This prevents duplicate creation when
            // users access the form directly (without eventId/responseId in URL).
            if (!eventId) {
                const inProgressResponses = await FormResponse.find({
                    formId: form._id,
                    organizationId: organizationId,
                    executionStatus: { $in: ['Not Started', 'In Progress'] },
                    'linkedTo.type': 'Event'
                }).sort({ createdAt: -1 }).limit(1);
                
                if (inProgressResponses && inProgressResponses.length > 0) {
                    const foundResponse = inProgressResponses[0];
                    console.warn('[submitForm] ⚠️ Found existing "In Progress" response linked to event, but no eventId/responseId provided:', {
                        existingResponseId: foundResponse._id,
                        linkedToEventId: foundResponse.linkedTo?.id,
                        executionStatus: foundResponse.executionStatus
                    });
                    
                    // Use the existing response to prevent duplicate creation
                    existingResponse = foundResponse;
                    console.log('[submitForm] ✅ Using existing "In Progress" response to prevent duplicate');
                }
            }
        }
        
        // If eventId is provided, link to event
        // Note: eventId can be either UUID string (eventId field) or ObjectId (_id field)
        // When stored in FormResponse.linkedTo.id, it's stored as ObjectId (event._id)
        let finalLinkedTo = linkedTo;
        if (eventId) {
            // Find the event to get its ObjectId (events can be identified by _id or eventId)
            const Event = require('../models/Event');
            const mongoose = require('mongoose');
            let eventObjectId = eventId;
            
            // If eventId is not a valid ObjectId (24 hex chars), it's likely a UUID
            // Find the event by eventId to get its _id
            if (!mongoose.Types.ObjectId.isValid(eventId) || eventId.toString().length !== 24) {
                const event = await Event.findOne({
                    eventId: eventId,
                    organizationId: organizationId
                }).select('_id');
                if (event) {
                    eventObjectId = event._id;
                }
            } else {
                // It's already an ObjectId format
                eventObjectId = new mongoose.Types.ObjectId(eventId);
            }
            
            finalLinkedTo = {
                type: 'Event',
                id: eventObjectId
            };
        }
        
        // Process submission using service
        // Pass existingResponse if found to prevent duplicate creation
        const processedResponse = await formProcessingService.processSubmission({
            form,
            responseDetails,
            linkedTo: finalLinkedTo,
            organizationId,
            submittedBy: req.user ? req.user._id : null,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent'),
            existingResponse: existingResponse // Pass existing response to prevent duplicate
        });
        
        // If eventId provided, update event metadata and audit state
        if (eventId && processedResponse && processedResponse._id) {
            try {
                const Event = require('../models/Event');
                const mongoose = require('mongoose');
                
                // Build query - eventId can be either UUID string (eventId field) or ObjectId (_id field)
                // Only include _id condition if eventId is a valid ObjectId to avoid casting errors
                const queryConditions = [];
                if (mongoose.Types.ObjectId.isValid(eventId) && eventId.toString().length === 24) {
                    queryConditions.push({ _id: new mongoose.Types.ObjectId(eventId) });
                }
                queryConditions.push({ eventId: eventId }); // Always check eventId field (UUID)
                
                const event = await Event.findOne({
                    $or: queryConditions,
                    organizationId: organizationId
                });
                
                if (event) {
                    // Update event metadata with form response ID
                    if (!event.metadata) {
                        event.metadata = {};
                    }
                    if (!event.metadata.formResponses) {
                        event.metadata.formResponses = [];
                    }
                    if (!event.metadata.formResponses.includes(processedResponse._id.toString())) {
                        event.metadata.formResponses.push(processedResponse._id.toString());
                    }
                    
                    // If this is an audit event and form is being submitted, update audit state
                    const isAuditEvent = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(event.eventType);
                    const isFormSubmitted = processedResponse.executionStatus === 'Submitted';
                    const isCheckedIn = event.auditState === 'checked_in';
                    
                    if (isAuditEvent && isFormSubmitted && isCheckedIn) {
                        console.log('[submitForm] Updating audit state for event:', {
                            eventId: event.eventId || event._id,
                            currentAuditState: event.auditState,
                            formResponseId: processedResponse._id
                        });
                        
                        // Check if form response has failures (needs corrective action)
                        const hasFailures = processedResponse.responseDetails?.some(detail => detail.passFail === 'Fail');
                        
                        // Auto check-out the event on form submission
                        const checkoutTime = new Date();
                        if (event.isMultiOrg) {
                            // For multi-org, check out current org
                            const currentOrg = event.orgList.find(o => o.sequence === event.currentOrgIndex);
                            if (currentOrg) {
                                currentOrg.checkOut = {
                                    timestamp: checkoutTime,
                                    location: currentOrg.checkIn?.location || null
                                };
                            }
                        } else {
                            event.checkOut = {
                                timestamp: checkoutTime,
                                location: event.checkIn?.location || null,
                                userId: req.user ? req.user._id : null
                            };
                        }
                        
                        // Calculate execution duration
                        if (event.checkIn && event.checkIn.timestamp) {
                            const timeSpent = Math.floor((checkoutTime - event.checkIn.timestamp) / 1000);
                            event.timeSpent = (event.timeSpent || 0) + timeSpent;
                        }
                        event.executionEndTime = checkoutTime;
                        
                        // Generate corrective actions for failed questions (if not already generated)
                        if (hasFailures) {
                            const Form = require('../models/Form');
                            const form = await Form.findById(event.linkedFormId);
                            
                            if (form && processedResponse) {
                                // Helper function to find question in form structure
                                const findQuestionInForm = (form, questionId) => {
                                    if (!form.sections || !Array.isArray(form.sections)) {
                                        return { question: null, section: null, subsection: null };
                                    }
                                    
                                    for (const section of form.sections) {
                                        // Check section-level questions
                                        if (section.questions && Array.isArray(section.questions)) {
                                            for (const question of section.questions) {
                                                if (question.questionId === questionId) {
                                                    return { question, section, subsection: null };
                                                }
                                            }
                                        }
                                        
                                        // Check subsection-level questions
                                        if (section.subsections && Array.isArray(section.subsections)) {
                                            for (const subsection of section.subsections) {
                                                if (subsection.questions && Array.isArray(subsection.questions)) {
                                                    for (const question of subsection.questions) {
                                                        if (question.questionId === questionId) {
                                                            return { question, section, subsection };
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    
                                    return { question: null, section: null, subsection: null };
                                };
                                
                                // Get all failed questions
                                const failedQuestions = processedResponse.responseDetails.filter(detail => detail.passFail === 'Fail');
                                
                                // Initialize correctiveActions array if it doesn't exist
                                if (!processedResponse.correctiveActions) {
                                    processedResponse.correctiveActions = [];
                                }
                                
                                // Create corrective action for each failed question (if not already exists)
                                for (const failedDetail of failedQuestions) {
                                    const existingAction = processedResponse.correctiveActions.find(
                                        action => action.questionId === failedDetail.questionId
                                    );
                                    
                                    if (!existingAction) {
                                        // Find question in form to get question text and section info
                                        const { question, section } = findQuestionInForm(form, failedDetail.questionId);
                                        
                                        // Create new corrective action
                                        const correctiveAction = {
                                            eventId: event._id,
                                            responseId: processedResponse._id,
                                            sectionId: failedDetail.sectionId || (section ? section.sectionId : null),
                                            questionId: failedDetail.questionId,
                                            questionText: question ? question.questionText : 'Unknown Question',
                                            auditorFinding: failedDetail.answer ? String(failedDetail.answer) : '',
                                            managerAction: {
                                                comment: '',
                                                proof: [],
                                                status: 'open',
                                                addedBy: null,
                                                addedAt: null
                                            },
                                            auditorVerification: {
                                                approved: false,
                                                comment: '',
                                                verifiedBy: null,
                                                verifiedAt: null
                                            }
                                        };
                                        
                                        processedResponse.correctiveActions.push(correctiveAction);
                                    }
                                }
                                
                                // Save form response with corrective actions
                                await processedResponse.save();
                                
                                // Notify the single corrective owner (explicit accountability)
                                if (event.correctiveOwnerId) {
                                    const User = require('../models/User');
                                    const owner = await User.findById(event.correctiveOwnerId).select('email firstName lastName').lean();
                                    console.log(
                                        `[submitForm] Created ${failedQuestions.length} corrective action(s) for event ${event.eventId}. Corrective Owner:`,
                                        owner?.email || String(event.correctiveOwnerId)
                                    );
                                } else {
                                    console.warn(`[submitForm] No correctiveOwnerId assigned for audit event ${event.eventId} (cannot notify)`);
                                }
                            }
                        }
                        
                        // Update auditState based on failures
                        if (hasFailures && processedResponse.reviewStatus === 'Pending Corrective Action') {
                            event.auditState = 'pending_corrective';
                            console.log('[submitForm] Event has failures, setting auditState to pending_corrective');
                        } else {
                            // No failures - go directly to needs_review (auditor can approve/reject)
                            // This allows auditor to review even when there are no failures
                            event.auditState = 'needs_review';
                            console.log('[submitForm] No failures, setting auditState to needs_review (ready for auditor review)');
                        }
                        
                        // Add audit entry
                        event.addAuditEntry('status_changed', req.user ? req.user._id : null, 'checked_in', event.auditState, {
                            formResponseId: processedResponse._id.toString(),
                            hasFailures: hasFailures,
                            autoCheckedOut: true
                        });
                        
                        event.modifiedBy = req.user ? req.user._id : null;
                    }
                    
                    await event.save();

                    // Keep Audit App timeline in sync when form submission transitions audit state.
                    try {
                        const auditSyncService = require('../services/auditSyncService');
                        await auditSyncService.syncAuditAssignmentFromEvent(event);
                        await auditSyncService.syncAuditTimelineFromEvent(event, {
                            action: 'SUBMIT',
                            fromState: 'checked_in',
                            toState: event.auditState,
                            actorId: req.user ? req.user._id : null,
                            timestamp: new Date(),
                            meta: {
                                formResponseId: processedResponse._id.toString(),
                                hasFailures: hasFailures,
                                autoCheckedOut: true,
                                source: 'form_submit'
                            }
                        });
                    } catch (syncError) {
                        console.error('[submitForm] Sync error (non-blocking):', syncError.message);
                    }
                }
            } catch (err) {
                console.error('Error updating event metadata and audit state:', err);
                // Don't fail the form submission if event update fails
            }
        }
        
        // Also check if form response is linked to an event via linkedTo field (created during check-in)
        if (processedResponse && processedResponse.linkedTo && processedResponse.linkedTo.type === 'Event') {
            try {
                const Event = require('../models/Event');
                const mongoose = require('mongoose');
                
                const eventLinkedId = processedResponse.linkedTo.id;
                if (eventLinkedId) {
                    // Find event by _id (linkedTo.id stores the ObjectId)
                    const event = await Event.findOne({
                        _id: eventLinkedId,
                        organizationId: organizationId
                    });
                    
                    if (event) {
                        const isAuditEvent = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(event.eventType);
                        const isFormSubmitted = processedResponse.executionStatus === 'Submitted';
                        const isCheckedIn = event.auditState === 'checked_in';
                        
                        if (isAuditEvent && isFormSubmitted && isCheckedIn) {
                            console.log('[submitForm] Updating audit state for event (via linkedTo):', {
                                eventId: event.eventId || event._id,
                                currentAuditState: event.auditState,
                                formResponseId: processedResponse._id
                            });
                            
                            // Check if form response has failures
                            const hasFailures = processedResponse.responseDetails?.some(detail => detail.passFail === 'Fail');
                            
                            // Auto check-out the event on form submission
                            const checkoutTime = new Date();
                            if (event.isMultiOrg) {
                                const currentOrg = event.orgList.find(o => o.sequence === event.currentOrgIndex);
                                if (currentOrg) {
                                    currentOrg.checkOut = {
                                        timestamp: checkoutTime,
                                        location: currentOrg.checkIn?.location || null
                                    };
                                }
                            } else {
                                event.checkOut = {
                                    timestamp: checkoutTime,
                                    location: event.checkIn?.location || null,
                                    userId: req.user ? req.user._id : null
                                };
                            }
                            
                            // Calculate execution duration
                            if (event.checkIn && event.checkIn.timestamp) {
                                const timeSpent = Math.floor((checkoutTime - event.checkIn.timestamp) / 1000);
                                event.timeSpent = (event.timeSpent || 0) + timeSpent;
                            }
                            event.executionEndTime = checkoutTime;
                            
                            // Generate corrective actions for failed questions (if not already generated)
                            if (hasFailures) {
                                const Form = require('../models/Form');
                                const form = await Form.findById(event.linkedFormId);
                                
                                if (form && processedResponse) {
                                    // Helper function to find question in form structure
                                    const findQuestionInForm = (form, questionId) => {
                                        if (!form.sections || !Array.isArray(form.sections)) {
                                            return { question: null, section: null, subsection: null };
                                        }
                                        
                                        for (const section of form.sections) {
                                            // Check section-level questions
                                            if (section.questions && Array.isArray(section.questions)) {
                                                for (const question of section.questions) {
                                                    if (question.questionId === questionId) {
                                                        return { question, section, subsection: null };
                                                    }
                                                }
                                            }
                                            
                                            // Check subsection-level questions
                                            if (section.subsections && Array.isArray(section.subsections)) {
                                                for (const subsection of section.subsections) {
                                                    if (subsection.questions && Array.isArray(subsection.questions)) {
                                                        for (const question of subsection.questions) {
                                                            if (question.questionId === questionId) {
                                                                return { question, section, subsection };
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        
                                        return { question: null, section: null, subsection: null };
                                    };
                                    
                                    // Get all failed questions
                                    const failedQuestions = processedResponse.responseDetails.filter(detail => detail.passFail === 'Fail');
                                    
                                    // Initialize correctiveActions array if it doesn't exist
                                    if (!processedResponse.correctiveActions) {
                                        processedResponse.correctiveActions = [];
                                    }
                                    
                                    // Create corrective action for each failed question (if not already exists)
                                    for (const failedDetail of failedQuestions) {
                                        const existingAction = processedResponse.correctiveActions.find(
                                            action => action.questionId === failedDetail.questionId
                                        );
                                        
                                        if (!existingAction) {
                                            // Find question in form to get question text and section info
                                            const { question, section } = findQuestionInForm(form, failedDetail.questionId);
                                            
                                            // Create new corrective action
                                            const correctiveAction = {
                                                eventId: event._id,
                                                responseId: processedResponse._id,
                                                sectionId: failedDetail.sectionId || (section ? section.sectionId : null),
                                                questionId: failedDetail.questionId,
                                                questionText: question ? question.questionText : 'Unknown Question',
                                                auditorFinding: failedDetail.answer ? String(failedDetail.answer) : '',
                                                managerAction: {
                                                    comment: '',
                                                    proof: [],
                                                    status: 'open',
                                                    addedBy: null,
                                                    addedAt: null
                                                },
                                                auditorVerification: {
                                                    approved: false,
                                                    comment: '',
                                                    verifiedBy: null,
                                                    verifiedAt: null
                                                }
                                            };
                                            
                                            processedResponse.correctiveActions.push(correctiveAction);
                                        }
                                    }
                                    
                                    // Save form response with corrective actions
                                    await processedResponse.save();
                                    
                                    // Notify the single corrective owner (explicit accountability)
                                    if (event.correctiveOwnerId) {
                                        const User = require('../models/User');
                                        const owner = await User.findById(event.correctiveOwnerId).select('email firstName lastName').lean();
                                        console.log(`[submitForm] Created ${failedQuestions.length} corrective action(s) for event ${event.eventId} (via linkedTo). Corrective Owner:`,
                                            owner?.email || String(event.correctiveOwnerId));
                                    } else {
                                        console.warn(`[submitForm] No correctiveOwnerId assigned for audit event ${event.eventId} (via linkedTo)`);
                                    }
                                }
                            }
                            
                            // Update auditState based on failures
                            if (hasFailures && processedResponse.reviewStatus === 'Pending Corrective Action') {
                                event.auditState = 'pending_corrective';
                                console.log('[submitForm] Event has failures (via linkedTo), setting auditState to pending_corrective');
                            } else {
                                // No failures - go directly to needs_review (auditor can approve/reject)
                                // This allows auditor to review even when there are no failures
                                event.auditState = 'needs_review';
                                console.log('[submitForm] No failures (via linkedTo), setting auditState to needs_review (ready for auditor review)');
                            }
                            
                            // Update event metadata
                            if (!event.metadata) {
                                event.metadata = {};
                            }
                            if (!event.metadata.formResponses) {
                                event.metadata.formResponses = [];
                            }
                            if (!event.metadata.formResponses.includes(processedResponse._id.toString())) {
                                event.metadata.formResponses.push(processedResponse._id.toString());
                            }
                            
                            // Add audit entry
                            event.addAuditEntry('status_changed', req.user ? req.user._id : null, 'checked_in', event.auditState, {
                                formResponseId: processedResponse._id.toString(),
                                hasFailures: hasFailures,
                                autoCheckedOut: true
                            });
                            
                            event.modifiedBy = req.user ? req.user._id : null;
                            await event.save();

                            // Keep Audit App timeline in sync when linked form submission transitions audit state.
                            try {
                                const auditSyncService = require('../services/auditSyncService');
                                await auditSyncService.syncAuditAssignmentFromEvent(event);
                                await auditSyncService.syncAuditTimelineFromEvent(event, {
                                    action: 'SUBMIT',
                                    fromState: 'checked_in',
                                    toState: event.auditState,
                                    actorId: req.user ? req.user._id : null,
                                    timestamp: new Date(),
                                    meta: {
                                        formResponseId: processedResponse._id.toString(),
                                        hasFailures: hasFailures,
                                        autoCheckedOut: true,
                                        source: 'form_submit_linked_to'
                                    }
                                });
                            } catch (syncError) {
                                console.error('[submitForm] Sync error via linkedTo (non-blocking):', syncError.message);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Error updating event audit state (via linkedTo):', err);
                // Don't fail the form submission if event update fails
            }
        }
        
        if (processedResponse?.executionStatus === 'Submitted') {
            try {
                const { emit: emitDomainEvent } = require('../services/domainEvents');
                emitDomainEvent({
                    entityType: 'form',
                    entityId: processedResponse._id,
                    eventType: 'form.submitted',
                    previousState: null,
                    currentState: {
                        formId: processedResponse.formId,
                        executionStatus: processedResponse.executionStatus,
                        reviewStatus: processedResponse.reviewStatus,
                        linkedTo: processedResponse.linkedTo || null
                    },
                    appKey: String(req.appKey || 'AUDIT').toUpperCase(),
                    triggeredBy: req.user ? req.user._id : null,
                    organizationId
                });
            } catch (emitErr) {
                console.error('[submitForm] form.submitted domain event failed (non-blocking):', emitErr.message);
            }
        }

        res.status(201).json({
            success: true,
            data: processedResponse,
            message: 'Form submitted successfully'
        });
    } catch (error) {
        console.error('Submit form error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting form.',
            error: error.message
        });
    }
};

// @desc    Get all responses for an organization (across all forms)
// @route   GET /api/responses
// @access  Private
exports.getResponseMeta = async (req, res) => {
    try {
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            organizationId: req.user.organizationId
        })
            .select('formId responseId')
            .lean();

        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                formId: response.formId ? String(response.formId) : null,
                responseId: String(response._id),
                responseCode: response.responseId || null
            }
        });
    } catch (error) {
        console.error('Get response meta error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching response metadata.',
            error: error.message
        });
    }
};

exports.getAllResponses = async (req, res) => {
    try {
        const isAuditScoped = req.auditScopedResponses === true || String(req.appKey || '').toUpperCase() === 'AUDIT';
        const query = {
            organizationId: req.user.organizationId
        };

        if (isAuditScoped) {
            const auditEventTypes = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'];
            const ownedEvents = await Event.find({
                organizationId: req.user.organizationId,
                assignedTo: req.user._id,
                eventType: { $in: auditEventTypes }
            }).select('_id').lean();

            const ownedEventIds = ownedEvents.map(event => event._id);
            if (ownedEventIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    pagination: {
                        currentPage: parseInt(req.query.page) || 1,
                        limit: parseInt(req.query.limit) || 20,
                        totalResponses: 0,
                        totalPages: 0
                    },
                    statistics: {
                        total: 0,
                        pending: 0,
                        needsReview: 0,
                        approved: 0,
                        rejected: 0,
                        closed: 0
                    }
                });
            }

            query['linkedTo.type'] = 'Event';
            query['linkedTo.id'] = { $in: ownedEventIds };
        }
        
        // Get pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Filter out archived/invalidated by default (unless explicitly requested)
        // Handle cases where fields might not exist in older documents
        const archiveInvalidateConditions = [];
        if (req.query.includeArchived !== 'true') {
            archiveInvalidateConditions.push({
                $or: [
                    { archived: { $exists: false } },
                    { archived: false },
                    { archived: null }
                ]
            });
        }
        if (req.query.includeInvalidated !== 'true') {
            archiveInvalidateConditions.push({
                $or: [
                    { invalidated: { $exists: false } },
                    { invalidated: false },
                    { invalidated: null }
                ]
            });
        }
        if (archiveInvalidateConditions.length > 0) {
            query.$and = (query.$and || []).concat(archiveInvalidateConditions);
        }
        
        // Get filters
        if (req.query.reviewStatus) {
            query.reviewStatus = req.query.reviewStatus;
        }
        if (req.query.executionStatus) {
            query.executionStatus = req.query.executionStatus;
        }
        // Backward compatibility: support old 'status' parameter
        if (req.query.status && !req.query.reviewStatus) {
            query.reviewStatus = req.query.status;
        }
        if (req.query.formId) {
            query.formId = req.query.formId;
        }
        if (!isAuditScoped && req.query.linkedToType) {
            query['linkedTo.type'] = req.query.linkedToType;
        }
        if (!isAuditScoped && req.query.linkedToId) {
            query['linkedTo.id'] = req.query.linkedToId;
        }
        
        // Date range filter
        if (req.query.fromDate || req.query.toDate) {
            query.submittedAt = {};
            if (req.query.fromDate) {
                query.submittedAt.$gte = new Date(req.query.fromDate);
            }
            if (req.query.toDate) {
                query.submittedAt.$lte = new Date(req.query.toDate);
            }
        }
        
        // Sorting
        const sortBy = req.query.sortBy || 'submittedAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortBy]: sortOrder };
        
        // Do not populate formId directly — missing forms would null out the raw ObjectId ref.
        let responses = await FormResponse.find(query)
            .populate('submittedBy', 'firstName lastName email')
            .populate('linkedTo.id')
            .sort(sort)
            .limit(limit)
            .skip(skip)
            .lean();

        responses = await attachFormDetailsToResponses(responses);
        
        const total = await FormResponse.countDocuments(query);
        
        // Get statistics (exclude archived/invalidated unless explicitly requested)
        const statsMatch = { organizationId: req.user.organizationId };
        if (isAuditScoped) {
            statsMatch['linkedTo.type'] = query['linkedTo.type'];
            statsMatch['linkedTo.id'] = query['linkedTo.id'];
        }
        const statsArchiveInvalidateConditions = [];
        if (req.query.includeArchived !== 'true') {
            statsArchiveInvalidateConditions.push({
                $or: [
                    { archived: { $exists: false } },
                    { archived: false },
                    { archived: null }
                ]
            });
        }
        if (req.query.includeInvalidated !== 'true') {
            statsArchiveInvalidateConditions.push({
                $or: [
                    { invalidated: { $exists: false } },
                    { invalidated: false },
                    { invalidated: null }
                ]
            });
        }
        if (statsArchiveInvalidateConditions.length > 0) {
            statsMatch.$and = statsArchiveInvalidateConditions;
        }
        
        const stats = await FormResponse.aggregate([
            { $match: statsMatch },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    pending: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'Pending Corrective Action'] }, 1, 0] } },
                    needsReview: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'Needs Auditor Review'] }, 1, 0] } },
                    approved: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'Approved'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'Rejected'] }, 1, 0] } },
                    closed: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'Closed'] }, 1, 0] } },
                    notStarted: { $sum: { $cond: [{ $eq: ['$executionStatus', 'Not Started'] }, 1, 0] } },
                    inProgress: { $sum: { $cond: [{ $eq: ['$executionStatus', 'In Progress'] }, 1, 0] } },
                    submitted: { $sum: { $cond: [{ $eq: ['$executionStatus', 'Submitted'] }, 1, 0] } }
                }
            }
        ]);
        
        const statistics = stats[0] || {
            total: 0,
            pending: 0,
            needsReview: 0,
            approved: 0,
            rejected: 0,
            closed: 0
        };
        
        res.status(200).json({
            success: true,
            data: responses,
            pagination: {
                currentPage: page,
                limit,
                totalResponses: total,
                totalPages: Math.ceil(total / limit)
            },
            statistics
        });
    } catch (error) {
        console.error('Get all responses error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching responses.',
            error: error.message
        });
    }
};

// @desc    Get all responses for a form
// @route   GET /api/forms/:id/responses
// @access  Private
exports.getResponses = async (req, res) => {
    try {
        const form = await Form.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or access denied.'
            });
        }
        
        const query = {
            formId: req.params.id,
            organizationId: req.user.organizationId
        };
        
        // Get pagination params
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Filter out archived/invalidated by default (unless explicitly requested)
        // Handle cases where fields might not exist in older documents
        const archiveInvalidateConditions = [];
        if (req.query.includeArchived !== 'true') {
            archiveInvalidateConditions.push({
                $or: [
                    { archived: { $exists: false } },
                    { archived: false },
                    { archived: null }
                ]
            });
        }
        if (req.query.includeInvalidated !== 'true') {
            archiveInvalidateConditions.push({
                $or: [
                    { invalidated: { $exists: false } },
                    { invalidated: false },
                    { invalidated: null }
                ]
            });
        }
        if (archiveInvalidateConditions.length > 0) {
            query.$and = (query.$and || []).concat(archiveInvalidateConditions);
        }
        
        // Get filters
        if (req.query.reviewStatus) {
            query.reviewStatus = req.query.reviewStatus;
        }
        if (req.query.executionStatus) {
            query.executionStatus = req.query.executionStatus;
        }
        // Backward compatibility: support old 'status' parameter
        if (req.query.status && !req.query.reviewStatus) {
            query.reviewStatus = req.query.status;
        }
        if (req.query.linkedToType) {
            query['linkedTo.type'] = req.query.linkedToType;
        }
        if (req.query.linkedToId) {
            query['linkedTo.id'] = req.query.linkedToId;
        }
        
        // Date range filter
        if (req.query.fromDate || req.query.toDate) {
            query.submittedAt = {};
            if (req.query.fromDate) {
                query.submittedAt.$gte = new Date(req.query.fromDate);
            }
            if (req.query.toDate) {
                query.submittedAt.$lte = new Date(req.query.toDate);
            }
        }
        
        // Sorting
        const sortBy = req.query.sortBy || 'submittedAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortBy]: sortOrder };
        
        // Execute query
        const responses = await FormResponse.find(query)
            .populate('submittedBy', 'firstName lastName email')
            .populate('linkedTo.id')
            .sort(sort)
            .limit(limit)
            .skip(skip);
        
        const total = await FormResponse.countDocuments(query);
        
        res.status(200).json({
            success: true,
            data: responses,
            pagination: {
                currentPage: page,
                limit,
                totalResponses: total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get responses error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching responses.',
            error: error.message
        });
    }
};

// @desc    Get single response
// @route   GET /api/forms/:id/responses/:responseId
// @access  Private
exports.getResponseById = async (req, res) => {
    try {
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        })
        .populate('submittedBy', 'firstName lastName email')
        .populate({
            path: 'linkedTo.id',
            select: 'eventId eventName auditState correctiveOwnerId auditorId reviewerId allowSelfReview',
        })
        .populate('correctiveActions.managerAction.addedBy', 'firstName lastName email')
        .populate('correctiveActions.auditorVerification.verifiedBy', 'firstName lastName email')
        .populate('finalReport.previousResponseId');
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        res.status(200).json({
            success: true,
            data: response
        });
    } catch (error) {
        console.error('Get response error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching response.',
            error: error.message
        });
    }
};

// @desc    Update response status
// @route   PATCH /api/forms/:id/responses/:responseId/status
// @access  Private
// @deprecated Status is now computed automatically. Use approve/reject endpoints instead.
exports.updateResponseStatus = async (req, res) => {
    try {
        // Status is now computed automatically based on business rules
        // This endpoint is deprecated but kept for backwards compatibility
        // Only 'Rejected' status can be set manually, all other statuses are computed
        const { status } = req.body;
        
        const validStatuses = ['Pending Corrective Action', 'Needs Auditor Review', 'Approved', 'Rejected', 'Closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid review status.'
            });
        }
        
        // Only allow setting 'Rejected' status manually, all others are computed
        if (status !== 'Rejected') {
            return res.status(400).json({
                success: false,
                message: 'Status is computed automatically. Only "Rejected" status can be set manually. Use approve/reject endpoints instead.'
            });
        }
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        if (response.executionStatus === 'Submitted') {
            // Only allow Rejected status to be set manually
            response.reviewStatus = 'Rejected';
            response.approved = false; // Reset approval if rejecting
        } else {
            return res.status(400).json({
                success: false,
                message: 'Review status can only be updated after response is submitted.'
            });
        }
        
        await response.save();
        
        const updatedResponse = await FormResponse.findById(response._id)
        .populate('submittedBy', 'firstName lastName email');
        
        res.status(200).json({
            success: true,
            data: updatedResponse,
            message: 'Response status updated successfully'
        });
    } catch (error) {
        console.error('Update response status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating response status.',
            error: error.message
        });
    }
};

// @desc    Add corrective action
// @route   POST /api/forms/:id/responses/:responseId/corrective-action
// @access  Private
exports.addCorrectiveAction = async (req, res) => {
    try {
        const { questionId, comment, status } = req.body;

        // Normalize incoming status to schema enum (UI historically sent friendly labels)
        const normalizeCaStatus = (value) => {
            const v = String(value || '').trim();
            if (!v) return undefined;
            const lower = v.toLowerCase();
            if (lower === 'open') return 'open';
            if (lower === 'in_progress' || lower === 'in progress') return 'in_progress';
            if (lower === 'completed' || lower === 'resolved') return 'completed';
            if (lower === 'pending') return 'open';
            return v; // let mongoose validate (and error) if unknown
        };
        const normalizedStatus = normalizeCaStatus(status);
        
        // Handle file uploads
        const proofUrls = [];
        if (req.files && req.files.length > 0) {
            const fileStorage = require('../services/fileStorageService');
            for (const file of req.files) {
                const uploadResult = await fileStorage.uploadMulterFile(file, {
                    organizationId: req.user.organizationId,
                    category: 'forms'
                });
                proofUrls.push(uploadResult.url);
            }
        } else if (req.body.proof && Array.isArray(req.body.proof)) {
            // If proof URLs are already provided (from existing files)
            proofUrls.push(...req.body.proof);
        }
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }

        // Ensure correctiveActions array exists (older responses may not have this field set)
        if (!Array.isArray(response.correctiveActions)) {
            response.correctiveActions = [];
        }
        
        // Immutability check: Corrective actions can only be added to submitted responses
        if (response.executionStatus !== 'Submitted') {
            return res.status(400).json({
                success: false,
                message: 'Corrective actions can only be added to submitted responses.'
            });
        }
        
        // Check if response is linked to an event that is approved or closed
        if (response.linkedTo && response.linkedTo.type === 'Event' && response.linkedTo.id) {
            const Event = require('../models/Event');
            const event = await Event.findById(response.linkedTo.id);
            
            if (event && (event.auditState === 'approved' || event.auditState === 'closed')) {
                return res.status(403).json({
                    success: false,
                    message: 'Response cannot be edited. The linked event has been approved or closed.'
                });
            }

            // Authorization: only the single corrective owner can add/update corrective actions
            if (event) {
                const assignedTo = event.correctiveOwnerId ? String(event.correctiveOwnerId) : '';
                if (!assignedTo || assignedTo !== String(req.user._id)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Only the assigned corrective owner can update this action.'
                    });
                }
            }
        }
        
        // Also check if response itself is approved or closed
        if (response.reviewStatus === 'Closed' || (response.approved && response.reviewStatus === 'Approved')) {
            return res.status(403).json({
                success: false,
                message: 'Response cannot be edited after approval or closure.'
            });
        }
        
        // Find the question in response details
        const questionResponse = response.responseDetails.find(detail => detail.questionId === questionId);
        if (!questionResponse) {
            return res.status(404).json({
                success: false,
                message: 'Question not found in response.'
            });
        }
        
        // Get form to find question text
        const Form = require('../models/Form');
        const form = await Form.findById(req.params.id);
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found.'
            });
        }
        
        // Find question text from form
        let questionText = '';
        for (const section of form.sections) {
            for (const subsection of section.subsections) {
                const question = subsection.questions.find(q => q.questionId === questionId);
                if (question) {
                    questionText = question.questionText;
                    break;
                }
            }
            if (questionText) break;
        }
        
        if (!questionText) {
            return res.status(404).json({
                success: false,
                message: 'Question not found in form.'
            });
        }
        
        // Find or create corrective action
        let correctiveAction = response.correctiveActions.find(action => action.questionId === questionId);
        
        if (correctiveAction) {
            // Update existing corrective action
            correctiveAction.managerAction.comment = comment || correctiveAction.managerAction.comment;
            // Merge new proof files with existing ones
            const existingProof = correctiveAction.managerAction.proof || [];
            correctiveAction.managerAction.proof = [...existingProof, ...proofUrls];
            correctiveAction.managerAction.status = normalizedStatus || correctiveAction.managerAction.status;
            correctiveAction.managerAction.addedBy = req.user._id;
            correctiveAction.managerAction.addedAt = new Date();

            // Ensure linkage fields are set for event-driven workflows
            if (!correctiveAction.responseId) correctiveAction.responseId = response._id;
            if (response.linkedTo && response.linkedTo.type === 'Event' && response.linkedTo.id && !correctiveAction.eventId) {
                correctiveAction.eventId = response.linkedTo.id;
            }
        } else {
            // Create new corrective action
            correctiveAction = {
                questionId,
                questionText: questionText,
                auditorFinding: questionResponse.answer || '',
                eventId: (response.linkedTo && response.linkedTo.type === 'Event' && response.linkedTo.id) ? response.linkedTo.id : undefined,
                responseId: response._id,
                managerAction: {
                    comment: comment || '',
                    proof: proofUrls,
                    status: normalizedStatus || 'open',
                    addedBy: req.user._id,
                    addedAt: new Date()
                },
                auditorVerification: {
                    approved: false
                }
            };
            response.correctiveActions.push(correctiveAction);
            
            // Notify corrective owner if linked to event
            if (correctiveAction.eventId) {
                const Event = require('../models/Event');
                const event = await Event.findById(correctiveAction.eventId);
                
                if (event && event.correctiveOwnerId) {
                    const User = require('../models/User');
                    const owner = await User.findById(event.correctiveOwnerId).select('email firstName lastName').lean();
                    
                    // TODO: Implement notification service
                    console.log(`[Corrective Action] Created corrective action for event ${event.eventId}. Corrective Owner:`,
                        owner?.email || String(event.correctiveOwnerId));
                    
                    // await notificationService.notifyUser(owner._id, { ... })
                }
            }
        }
        
        // Status will be computed automatically by pre-save hook based on business rules
        // No need to manually set reviewStatus
        
        await response.save();

        // Keep linked Event auditState consistent with corrective-action completion/regression.
        // NOTE: The UI uses this POST endpoint for edits + file uploads, so we must handle both:
        // - all completed => needs_review
        // - any reopened/incomplete => pending_corrective
        if (response.linkedTo && response.linkedTo.type === 'Event' && response.linkedTo.id) {
            const Event = require('../models/Event');
            const event = await Event.findById(response.linkedTo.id);
            if (event) {
                const allEventResponses = await FormResponse.find({
                    'linkedTo.type': 'Event',
                    'linkedTo.id': event._id,
                    organizationId: req.user.organizationId
                });

                const allCorrectiveActions = [];
                for (const resp of allEventResponses) {
                    if (Array.isArray(resp.correctiveActions)) {
                        allCorrectiveActions.push(...resp.correctiveActions);
                    }
                }

                const anyIncomplete = allCorrectiveActions.some(ca => ca.managerAction?.status !== 'completed');
                const allCompleted = allCorrectiveActions.length > 0 && !anyIncomplete;

                const previousState = event.auditState;

                if (allCompleted) {
                    const validTransitionStates = ['pending_corrective', 'submitted', 'rejected', 'needs_review'];
                    if (validTransitionStates.includes(previousState) && previousState !== 'needs_review') {
                        event.auditState = 'needs_review';
                        event.modifiedBy = req.user._id;
                        event.addAuditEntry('status_changed', req.user._id, previousState, 'needs_review', {
                            action: 'all_corrective_actions_completed',
                            completedActionsCount: allCorrectiveActions.length,
                            triggeredBy: 'corrective_action_completion'
                        });
                        await event.save();
                    }
                } else if (anyIncomplete) {
                    // Regression: if any corrective action becomes incomplete again after reaching needs_review,
                    // move event back to pending_corrective.
                    const validRegressionStates = ['needs_review', 'submitted', 'rejected'];
                    if (validRegressionStates.includes(previousState)) {
                        event.auditState = 'pending_corrective';
                        event.modifiedBy = req.user._id;
                        event.addAuditEntry('status_changed', req.user._id, previousState, 'pending_corrective', {
                            action: 'corrective_action_reopened',
                            triggeredBy: 'corrective_action_edit'
                        });
                        await event.save();
                    }
                }
            }
        }
        
        const updatedResponse = await FormResponse.findById(response._id)
            .populate('submittedBy', 'firstName lastName email')
            .populate('correctiveActions.managerAction.addedBy', 'firstName lastName email');
        
        res.status(200).json({
            success: true,
            data: updatedResponse,
            message: 'Corrective action added successfully'
        });
    } catch (error) {
        console.error('Add corrective action error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding corrective action.',
            error: error.message
        });
    }
};

// @desc    Update corrective action status
// @route   PATCH /api/forms/:id/responses/:responseId/corrective-action/:questionId
// @access  Private
exports.updateCorrectiveActionStatus = async (req, res) => {
    try {
        const { questionId } = req.params;
        const { status, comment, proof } = req.body;
        
        if (!status || !['open', 'in_progress', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status is required (open, in_progress, completed)'
            });
        }
        
        const FormResponse = require('../models/FormResponse');
        const Event = require('../models/Event');
        
        // Find the form response
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        // Find the corrective action
        const correctiveAction = response.correctiveActions.find(action => action.questionId === questionId);
        if (!correctiveAction) {
            return res.status(404).json({
                success: false,
                message: 'Corrective action not found.'
            });
        }
        
        // Check if response is linked to an event that is approved or closed
        if (response.linkedTo && response.linkedTo.type === 'Event' && response.linkedTo.id) {
            const Event = require('../models/Event');
            const event = await Event.findById(response.linkedTo.id);
            
            if (event && (event.auditState === 'approved' || event.auditState === 'closed')) {
                return res.status(403).json({
                    success: false,
                    message: 'Response cannot be edited. The linked event has been approved or closed.'
                });
            }
        }
        
        // Also check if response itself is approved or closed
        if (response.reviewStatus === 'Closed' || (response.approved && response.reviewStatus === 'Approved')) {
            return res.status(403).json({
                success: false,
                message: 'Response cannot be edited after approval or closure.'
            });
        }
        
        // Authorization: Only the assigned corrective owner can update
        if (correctiveAction.eventId) {
            const event = await Event.findById(correctiveAction.eventId);
            if (!event || !event.correctiveOwnerId) {
                return res.status(403).json({
                    success: false,
                    message: 'Event not found or no corrective owner assigned.'
                });
            }
            
            const isOwner = String(event.correctiveOwnerId) === String(req.user._id);
            if (!isOwner) {
                return res.status(403).json({
                    success: false,
                    message: 'Only the assigned corrective owner can update this action.'
                });
            }
        }
        
        // Validation: If status is 'completed', evidence and comment are mandatory
        if (status === 'completed') {
            const hasProof = (correctiveAction.managerAction.proof && correctiveAction.managerAction.proof.length > 0) ||
                            (proof && Array.isArray(proof) && proof.length > 0);
            const hasComment = (comment && comment.trim().length > 0) ||
                              (correctiveAction.managerAction.comment && correctiveAction.managerAction.comment.trim().length > 0);
            
            if (!hasProof) {
                return res.status(400).json({
                    success: false,
                    message: 'Evidence upload is mandatory when completing a corrective action.'
                });
            }
            
            if (!hasComment) {
                return res.status(400).json({
                    success: false,
                    message: 'Comment is mandatory when completing a corrective action.'
                });
            }
        }
        
        // Handle file uploads for proof
        let proofUrls = [];
        if (req.files && req.files.length > 0) {
            const fileStorage = require('../services/fileStorageService');
            for (const file of req.files) {
                const uploadResult = await fileStorage.uploadMulterFile(file, {
                    organizationId: req.user.organizationId,
                    category: 'forms'
                });
                proofUrls.push(uploadResult.url);
            }
        } else if (proof && Array.isArray(proof)) {
            proofUrls = proof;
        }
        
        // Update corrective action
        correctiveAction.managerAction.status = status;
        if (comment !== undefined) {
            correctiveAction.managerAction.comment = comment;
        }
        if (proofUrls.length > 0) {
            // Merge new proof with existing
            const existingProof = correctiveAction.managerAction.proof || [];
            correctiveAction.managerAction.proof = [...existingProof, ...proofUrls];
        }
        if (!correctiveAction.managerAction.addedBy) {
            correctiveAction.managerAction.addedBy = req.user._id;
        }
        if (!correctiveAction.managerAction.addedAt) {
            correctiveAction.managerAction.addedAt = new Date();
        }
        
        await response.save();
        
        // Keep linked Event auditState consistent with corrective-action completion/regression.
        if (correctiveAction.eventId) {
            const event = await Event.findById(correctiveAction.eventId);
            if (event) {
                // Get all form responses linked to this event
                const allEventResponses = await FormResponse.find({
                    'linkedTo.type': 'Event',
                    'linkedTo.id': event._id,
                    organizationId: req.user.organizationId
                });

                // Collect all corrective actions for this event
                const allCorrectiveActions = [];
                for (const resp of allEventResponses) {
                    if (resp.correctiveActions && Array.isArray(resp.correctiveActions)) {
                        for (const ca of resp.correctiveActions) {
                            if (ca.eventId && ca.eventId.toString() === event._id.toString()) {
                                allCorrectiveActions.push(ca);
                            }
                        }
                    }
                }

                const anyIncomplete = allCorrectiveActions.some(ca => ca.managerAction.status !== 'completed');
                const allCompleted = allCorrectiveActions.length > 0 && !anyIncomplete;

                const previousState = event.auditState;

                if (allCompleted) {
                    // Transition to needs_review from any state that has corrective actions
                    const validTransitionStates = ['pending_corrective', 'submitted', 'rejected', 'needs_review'];
                    if (validTransitionStates.includes(previousState) && previousState !== 'needs_review') {
                        event.auditState = 'needs_review';
                        event.modifiedBy = req.user._id;
                        event.addAuditEntry('status_changed', req.user._id, previousState, 'needs_review', {
                            action: 'all_corrective_actions_completed',
                            completedActionsCount: allCorrectiveActions.length,
                            triggeredBy: 'corrective_action_completion'
                        });
                        await event.save();
                    }
                } else if (anyIncomplete) {
                    // Regression: if any corrective action becomes incomplete again after reaching needs_review,
                    // move event back to pending_corrective.
                    const validRegressionStates = ['needs_review', 'submitted', 'rejected'];
                    if (validRegressionStates.includes(previousState)) {
                        event.auditState = 'pending_corrective';
                        event.modifiedBy = req.user._id;
                        event.addAuditEntry('status_changed', req.user._id, previousState, 'pending_corrective', {
                            action: 'corrective_action_reopened',
                            triggeredBy: 'corrective_action_status_update'
                        });
                        await event.save();
                    }
                }
            }
        }
        
        const updatedResponse = await FormResponse.findById(response._id)
            .populate('submittedBy', 'firstName lastName email')
            .populate('correctiveActions.managerAction.addedBy', 'firstName lastName email');
        
        res.status(200).json({
            success: true,
            data: updatedResponse,
            message: 'Corrective action status updated successfully'
        });
    } catch (error) {
        console.error('Update corrective action status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating corrective action status.',
            error: error.message
        });
    }
};

// @desc    Verify corrective action
// @route   POST /api/forms/:id/responses/:responseId/verify
// @access  Private
exports.verifyCorrectiveAction = async (req, res) => {
    try {
        const { questionId, approved, comment } = req.body;
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        const correctiveAction = response.correctiveActions.find(action => action.questionId === questionId);
        if (!correctiveAction) {
            return res.status(404).json({
                success: false,
                message: 'Corrective action not found.'
            });
        }
        
        // Update verification
        correctiveAction.auditorVerification.approved = approved;
        correctiveAction.auditorVerification.comment = comment || '';
        correctiveAction.auditorVerification.verifiedBy = req.user._id;
        correctiveAction.auditorVerification.verifiedAt = new Date();
        
        // Status will be computed automatically by pre-save hook based on business rules
        // No need to manually set reviewStatus
        
        await response.save();
        
        const updatedResponse = await FormResponse.findById(response._id)
            .populate('submittedBy', 'firstName lastName email')
            .populate('correctiveActions.managerAction.addedBy', 'firstName lastName email')
            .populate('correctiveActions.auditorVerification.verifiedBy', 'firstName lastName email');
        
        res.status(200).json({
            success: true,
            data: updatedResponse,
            message: 'Corrective action verified successfully'
        });
    } catch (error) {
        console.error('Verify corrective action error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying corrective action.',
            error: error.message
        });
    }
};

// @desc    Approve response
// @route   POST /api/forms/:id/responses/:responseId/approve
// @access  Private
exports.approveResponse = async (req, res) => {
    try {
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        // Self-review enforcement is audit-event-specific and must be server-side enforced.
        // If this response is linked to an audit Event, disallow approving your own submission unless explicitly enabled on that Event.
        if (response.executionStatus === 'Submitted') {
            let linkedEvent = null;
            let isAuditEvent = false;
            if (response.linkedTo && response.linkedTo.type === 'Event' && response.linkedTo.id) {
                const Event = require('../models/Event');
                linkedEvent = await Event.findOne({
                    _id: response.linkedTo.id,
                    organizationId: req.user.organizationId
                }).lean();
                if (linkedEvent) {
                    isAuditEvent = ['Internal Audit', 'External Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(linkedEvent.eventType);
                }
            }

            if (linkedEvent && isAuditEvent) {
                const currentUserId = req.user._id.toString();
                const reviewDenied = assertAuditReviewAuthority(linkedEvent, response, currentUserId);
                if (reviewDenied) {
                    return res.status(reviewDenied.status).json({
                        success: false,
                        message: reviewDenied.message,
                        code: reviewDenied.code
                    });
                }
            }

            // Set approved flag - status will be computed automatically by pre-save hook
            response.approved = true;
            response.approvedBy = req.user._id;
            response.approvedAt = new Date();

            // Reviewer tracking (immutable after approval)
            response.reviewedBy = req.user._id;
            response.selfReviewed = !!(response.submittedBy && response.submittedBy.toString() === req.user._id.toString());

            // Reset rejected status if it was previously rejected
            if (response.reviewStatus === 'Rejected') {
                response.reviewStatus = null; // Will be recomputed
            }
        }

        await response.save();
        
        // Check if response is linked to an audit event and update event state
        if (response.linkedTo && response.linkedTo.type === 'Event' && response.linkedTo.id) {
            try {
                const Event = require('../models/Event');
                const event = await Event.findById(response.linkedTo.id);
                
                if (event) {
                    const isAuditEvent = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(event.eventType);
                    const isInReviewState = event.auditState === 'needs_review';
                    
                    if (isAuditEvent && isInReviewState) {
                        // Check if all responses for this event are approved
                        const FormResponse = require('../models/FormResponse');
                        const allEventResponses = await FormResponse.find({
                            'linkedTo.type': 'Event',
                            'linkedTo.id': event._id,
                            organizationId: req.user.organizationId,
                            executionStatus: 'Submitted'
                        });
                        
                        const allApproved = allEventResponses.length > 0 && 
                                          allEventResponses.every(resp => resp.approved === true);
                        
                        if (allApproved) {
                            console.log('[approveResponse] All responses approved for event. Closing event.');
                            
                            // Update event state: approved -> immediately closed -> Completed
                            const previousState = event.auditState;
                            const previousStatus = event.status;
                            event.auditState = 'approved';
                            event.modifiedBy = req.user._id;
                            
                            // Immediately transition to closed
                            event.auditState = 'closed';
                            
                            // Set status to Completed (system-controlled transition)
                            event.status = 'Completed';
                            event.completedAt = new Date();
                            
                            // Make all form responses read-only by marking them as closed
                            for (const resp of allEventResponses) {
                                if (resp.executionStatus === 'Submitted') {
                                    resp.reviewStatus = 'Closed';
                                    await resp.save();
                                }
                            }
                            
                            // Add audit entry for status change
                            event.addAuditEntry('status_changed', req.user._id, previousStatus, 'Completed', {
                                action: 'approved_via_response',
                                approvedBy: req.user._id,
                                auditState: 'closed',
                                completedAt: event.completedAt,
                                allResponsesApproved: true
                            });
                            
                            await event.save();
                            
                            console.log(`[approveResponse] Event ${event.eventId} closed after all responses approved.`);
                        } else {
                            console.log(`[approveResponse] Response approved, but ${allEventResponses.length - allEventResponses.filter(r => r.approved).length} response(s) still pending approval.`);
                        }
                    }
                }
            } catch (eventError) {
                console.error('[approveResponse] Error updating linked event:', eventError);
                // Don't fail the response approval if event update fails
            }
        }
        
        const updatedResponse = await FormResponse.findById(response._id)
            .populate('submittedBy', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName email')
            .populate('reviewedBy', 'firstName lastName email');
        
        res.status(200).json({
            success: true,
            data: updatedResponse,
            message: 'Response approved successfully'
        });
    } catch (error) {
        console.error('Approve response error:', error);
        res.status(500).json({
            success: false,
            message: 'Error approving response.',
            error: error.message
        });
    }
};

// @desc    Reject response
// @route   POST /api/forms/:id/responses/:responseId/reject
// @access  Private
exports.rejectResponse = async (req, res) => {
    try {
        const { reason } = req.body;
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        if (response.executionStatus === 'Submitted') {
            if (response.linkedTo && response.linkedTo.type === 'Event' && response.linkedTo.id) {
                const linkedEvent = await Event.findOne({
                    _id: response.linkedTo.id,
                    organizationId: req.user.organizationId
                }).lean();
                const isAuditEvent = linkedEvent && ['Internal Audit', 'External Audit', 'External Audit — Single Org', 'External Audit Beat'].includes(linkedEvent.eventType);
                if (isAuditEvent) {
                    const currentUserId = req.user._id.toString();
                    const reviewDenied = assertAuditReviewAuthority(linkedEvent, response, currentUserId);
                    if (reviewDenied) {
                        return res.status(reviewDenied.status).json({
                            success: false,
                            message: reviewDenied.message,
                            code: reviewDenied.code
                        });
                    }
                }
            }

            // Set rejected status (this is one status that can be set manually)
            response.reviewStatus = 'Rejected';
            response.approved = false; // Reset approval when rejecting
            response.approvedBy = null;
            response.approvedAt = null;
        }
        // Could add rejection reason field if needed
        await response.save();
        
        res.status(200).json({
            success: true,
            data: response,
            message: 'Response rejected successfully'
        });
    } catch (error) {
        console.error('Reject response error:', error);
        res.status(500).json({
            success: false,
            message: 'Error rejecting response.',
            error: error.message
        });
    }
};

// @desc    Delete response (non-audit only)
// @route   DELETE /api/forms/:id/responses/:responseId
// @access  Private
exports.deleteResponse = async (req, res) => {
    try {
        // Get response and form to check if it's an audit
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        }).populate('formId', 'formType');
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        // Check if form is an Audit type
        const formType = response.formId?.formType || (response.formId && typeof response.formId === 'object' ? response.formId.formType : null);
        
        // If we don't have formType from populate, fetch form directly
        let isAuditForm = false;
        if (!formType) {
            const Form = require('../models/Form');
            const form = await Form.findById(req.params.id);
            if (form && form.formType === 'Audit') {
                isAuditForm = true;
            }
        } else if (formType === 'Audit') {
            isAuditForm = true;
        }
        
        // Prevent hard delete for audit responses
        if (isAuditForm) {
            return res.status(403).json({
                success: false,
                message: 'Audit responses cannot be deleted. Use archive or invalidate instead.',
                code: 'AUDIT_DELETE_FORBIDDEN'
            });
        }
        
        // Prevent deletion of submitted responses (non-audit)
        if (response.executionStatus === 'Submitted') {
            return res.status(403).json({
                success: false,
                message: 'Submitted responses cannot be deleted. Use archive or invalidate instead.',
                code: 'SUBMITTED_DELETE_FORBIDDEN'
            });
        }
        
        // If response is linked to an event, clean up event metadata
        if (response.linkedTo && response.linkedTo.type === 'Event') {
            try {
                const Event = require('../models/Event');
                const event = await Event.findOne({
                    $or: [
                        { _id: response.linkedTo.id },
                        { eventId: response.linkedTo.id }
                    ],
                    organizationId: req.user.organizationId
                });
                
                if (event && event.metadata && event.metadata.formResponses) {
                    event.metadata.formResponses = event.metadata.formResponses.filter(
                        id => id.toString() !== response._id.toString()
                    );
                    await event.save();
                }
            } catch (err) {
                console.error('Error cleaning up event metadata:', err);
                // Continue with deletion even if cleanup fails
            }
        }
        
        const result = await FormResponse.findOneAndDelete({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        res.status(200).json({
            success: true,
            message: 'Response deleted successfully'
        });
    } catch (error) {
        console.error('Delete response error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting response.',
            error: error.message
        });
    }
};

// @desc    Export responses
// @route   GET /api/forms/:id/responses/export
// @access  Private
exports.exportResponses = async (req, res) => {
    try {
        const form = await Form.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!form) {
            return res.status(404).json({
                success: false,
                message: 'Form not found or access denied.'
            });
        }
        
        const responses = await FormResponse.find({
            formId: req.params.id,
            organizationId: req.user.organizationId
        })
        .populate('submittedBy', 'firstName lastName email')
        .sort({ submittedAt: -1 });
        
        // Convert to CSV format (simplified - in production, use a CSV library)
        const csvRows = [];
        
        // Header row
        const headers = ['Response ID', 'Submitted By', 'Submitted At', 'Execution Status', 'Review Status', 'Compliance %', 'Rating', 'Final Score'];
        csvRows.push(headers.join(','));
        
        // Data rows
        responses.forEach(response => {
            const row = [
                response.responseId,
                response.submittedBy ? `${response.submittedBy.firstName} ${response.submittedBy.lastName}` : 'N/A',
                response.submittedAt.toISOString(),
                response.executionStatus || 'N/A',
                response.reviewStatus || 'N/A',
                response.kpis.compliancePercentage,
                response.kpis.rating,
                response.kpis.finalScore
            ];
            csvRows.push(row.join(','));
        });
        
        const csv = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=form-responses-${form.formId}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Export responses error:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting responses.',
            error: error.message
        });
    }
};

// @desc    Get response comparison
// @route   GET /api/forms/:id/responses/:responseId/compare
// @access  Private
exports.getResponseComparison = async (req, res) => {
    try {
        const { previousResponseId, compareWith = 'last_audit' } = req.query;
        
        const currentResponse = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!currentResponse) {
            return res.status(404).json({
                success: false,
                message: 'Current response not found or access denied.'
            });
        }
        
        let previousResponse = null;
        
        if (previousResponseId) {
            // Compare with specific response
            previousResponse = await FormResponse.findOne({
                _id: previousResponseId,
                formId: req.params.id,
                organizationId: req.user.organizationId
            });
        } else if (compareWith === 'last_audit') {
            // Get most recent response before current one
            previousResponse = await FormResponse.findOne({
                formId: req.params.id,
                organizationId: req.user.organizationId,
                submittedAt: { $lt: currentResponse.submittedAt }
            })
            .sort({ submittedAt: -1 });
        } else if (compareWith === 'average') {
            // Calculate average from all previous responses
            const previousResponses = await FormResponse.find({
                formId: req.params.id,
                organizationId: req.user.organizationId,
                submittedAt: { $lt: currentResponse.submittedAt }
            })
            .sort({ submittedAt: -1 })
            .limit(10);
            
            if (previousResponses.length > 0) {
                // Create an average response object
                const avgKpis = {
                    compliancePercentage: previousResponses.reduce((sum, r) => sum + (r.kpis?.compliancePercentage || 0), 0) / previousResponses.length,
                    finalScore: previousResponses.reduce((sum, r) => sum + (r.kpis?.finalScore || 0), 0) / previousResponses.length,
                    rating: previousResponses.reduce((sum, r) => sum + (r.kpis?.rating || 0), 0) / previousResponses.length,
                    totalPassed: previousResponses.reduce((sum, r) => sum + (r.kpis?.totalPassed || 0), 0) / previousResponses.length,
                    totalFailed: previousResponses.reduce((sum, r) => sum + (r.kpis?.totalFailed || 0), 0) / previousResponses.length
                };
                
                // Calculate average section scores
                const avgSectionScores = {};
                const sectionScoresMap = {};
                previousResponses.forEach(r => {
                    if (r.sectionScores && typeof r.sectionScores === 'object') {
                        Object.entries(r.sectionScores).forEach(([sectionId, score]) => {
                            if (!sectionScoresMap[sectionId]) {
                                sectionScoresMap[sectionId] = [];
                            }
                            sectionScoresMap[sectionId].push(score);
                        });
                    }
                });
                
                Object.entries(sectionScoresMap).forEach(([sectionId, scores]) => {
                    avgSectionScores[sectionId] = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
                });
                
                previousResponse = {
                    _id: 'average',
                    kpis: avgKpis,
                    sectionScores: avgSectionScores,
                    submittedAt: previousResponses[0].submittedAt // Use most recent date
                };
            }
        }
        
        if (!previousResponse) {
            return res.status(200).json({
                success: true,
                data: {
                    current: currentResponse,
                    previous: null,
                    comparison: null,
                    message: 'No previous response found for comparison'
                }
            });
        }
        
        // Calculate comparison metrics
        const comparison = {
            overallScore: {
                current: currentResponse.kpis?.finalScore || 0,
                previous: previousResponse.kpis?.finalScore || 0,
                difference: (currentResponse.kpis?.finalScore || 0) - (previousResponse.kpis?.finalScore || 0)
            },
            complianceChange: (currentResponse.kpis?.compliancePercentage || 0) - (previousResponse.kpis?.compliancePercentage || 0),
            ratingChange: (currentResponse.kpis?.rating || 0) - (previousResponse.kpis?.rating || 0),
            scoreChange: (currentResponse.kpis?.finalScore || 0) - (previousResponse.kpis?.finalScore || 0),
            passedChange: (currentResponse.kpis?.totalPassed || 0) - (previousResponse.kpis?.totalPassed || 0),
            failedChange: (currentResponse.kpis?.totalFailed || 0) - (previousResponse.kpis?.totalFailed || 0)
        };
        
        // Calculate section-level comparison
        const sectionComparison = {};
        if (currentResponse.sectionScores && previousResponse.sectionScores) {
            const allSectionIds = new Set([
                ...Object.keys(currentResponse.sectionScores),
                ...Object.keys(previousResponse.sectionScores)
            ]);
            
            allSectionIds.forEach(sectionId => {
                const current = currentResponse.sectionScores[sectionId] || 0;
                const previous = previousResponse.sectionScores[sectionId] || 0;
                sectionComparison[sectionId] = {
                    current,
                    previous,
                    difference: current - previous
                };
            });
        }
        
        // Get trends data
        const reportGenerationService = require('../services/reportGenerationService');
        const trends = await reportGenerationService.buildTrendsChart(req.params.id, 5);
        
        res.status(200).json({
            success: true,
            data: {
                current: currentResponse,
                previous: previousResponse,
                comparison,
                sectionComparison,
                trends
            }
        });
    } catch (error) {
        console.error('Get response comparison error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching response comparison.',
            error: error.message
        });
    }
};

// @desc    Generate report
// @route   POST /api/forms/:id/responses/:responseId/generate-report
// @access  Private
exports.generateReport = async (req, res) => {
    try {
        const reportGenerationService = require('../services/reportGenerationService');
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        })
        .populate('formId')
        .populate('submittedBy', 'firstName lastName email');
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        // Validate status - only allow report generation for Approved or Closed statuses
        const reviewStatus = response.reviewStatus || response.status;
        if (reviewStatus === 'Pending Corrective Action' || reviewStatus === 'Needs Auditor Review') {
            return res.status(400).json({
                success: false,
                message: 'Report can be generated after the response is approved.'
            });
        }
        
        if (reviewStatus !== 'Approved' && reviewStatus !== 'Closed') {
            return res.status(400).json({
                success: false,
                message: 'Report can only be generated for approved or closed responses.'
            });
        }
        
        // Generate report data
        const reportData = await reportGenerationService.generateReport(response._id);
        
        // Add corrective actions if available
        if (response.correctiveActions && response.correctiveActions.length > 0) {
            reportData.correctiveActions = reportGenerationService.buildCorrectiveActionsSection(response.correctiveActions).actions;
        }
        
        // Generate PDF
        let reportUrl = null;
        try {
            reportUrl = await reportGenerationService.exportToPDF(reportData, req.user.organizationId.toString());
            reportData.reportUrl = reportUrl;
        } catch (pdfError) {
            console.error('PDF generation error:', pdfError);
            // Continue without PDF if generation fails
        }
        
        // Persist report URL in finalReport (schema-backed; root reportUrl is legacy)
        if (!response.finalReport) {
            response.finalReport = {};
        }
        response.finalReport.reportUrl = reportUrl;
        response.finalReport.generatedAt = new Date();
        await response.save();
        
        res.status(200).json({
            success: true,
            message: 'Report generated successfully',
            data: reportData
        });
    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating report.',
            error: error.message
        });
    }
};

// @desc    Export report to Excel
// @route   POST /api/forms/:id/responses/:responseId/export-excel
// @access  Private
exports.exportExcel = async (req, res) => {
    try {
        const reportGenerationService = require('../services/reportGenerationService');
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        })
        .populate('formId')
        .populate('submittedBy', 'firstName lastName email');
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        // Validate status - only allow report generation for Approved or Closed statuses
        const reviewStatus = response.reviewStatus || response.status;
        if (reviewStatus === 'Pending Corrective Action' || reviewStatus === 'Needs Auditor Review') {
            return res.status(400).json({
                success: false,
                message: 'Report can be generated after the response is approved.'
            });
        }
        
        if (reviewStatus !== 'Approved' && reviewStatus !== 'Closed') {
            return res.status(400).json({
                success: false,
                message: 'Report can only be generated for approved or closed responses.'
            });
        }
        
        // Generate report data
        const reportData = await reportGenerationService.generateReport(response._id);
        
        // Add corrective actions if available
        if (response.correctiveActions && response.correctiveActions.length > 0) {
            reportData.correctiveActions = reportGenerationService.buildCorrectiveActionsSection(response.correctiveActions).actions;
        }
        
        // Generate Excel
        let excelUrl = null;
        try {
            excelUrl = await reportGenerationService.exportToExcel(reportData, req.user.organizationId.toString());
        } catch (excelError) {
            console.error('Excel generation error:', excelError);
            return res.status(500).json({
                success: false,
                message: 'Error generating Excel report.',
                error: excelError.message
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Excel report generated successfully',
            data: {
                excelUrl,
                reportData
            }
        });
    } catch (error) {
        console.error('Export Excel error:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting Excel report.',
            error: error.message
        });
    }
};

// @desc    Generate comprehensive PDF report (world-class audit report)
// @route   POST /api/forms/:id/responses/:responseId/generate-comprehensive-report
// @access  Private
exports.generateComprehensiveReport = async (req, res) => {
    try {
        console.log('Generate comprehensive report called for form:', req.params.id, 'response:', req.params.responseId);
        const enhancedPdfReportService = require('../services/enhancedPdfReportService');
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        })
        .populate('formId')
        .populate('submittedBy', 'firstName lastName email')
        .populate('organizationId', 'name');

        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }

        // Validate status - only allow report generation for Approved or Closed statuses
        const reviewStatus = response.reviewStatus || response.status;
        if (reviewStatus === 'Pending Corrective Action' || reviewStatus === 'Needs Auditor Review') {
            return res.status(400).json({
                success: false,
                message: 'Report can be generated after the response is approved.'
            });
        }
        
        if (reviewStatus !== 'Approved' && reviewStatus !== 'Closed') {
            return res.status(400).json({
                success: false,
                message: 'Report can only be generated for approved or closed responses.'
            });
        }

        // Validate that formId exists
        if (!response.formId) {
            console.error('FormId is null/undefined for response:', req.params.responseId);
            return res.status(400).json({
                success: false,
                message: 'Form data not found. Cannot generate report.'
            });
        }

        // Validate that organizationId exists
        if (!response.organizationId) {
            console.error('OrganizationId is null/undefined for response:', req.params.responseId);
            return res.status(400).json({
                success: false,
                message: 'Organization data not found. Cannot generate report.'
            });
        }

        // Ensure form is fully populated and validate it has a responseTemplate
        let form;
        if (typeof response.formId === 'object' && response.formId && response.formId._id) {
            // formId is already populated, but we need to ensure it has the responseTemplate field
            form = response.formId;
            // If form was populated but doesn't have responseTemplate, fetch it fresh
            if (!form.responseTemplate) {
                form = await Form.findById(form._id);
            }
        } else {
            // formId is just an ObjectId, fetch the full form
            const formIdToFetch = response.formId || req.params.id;
            form = await Form.findById(formIdToFetch);
        }
        
        if (!form) {
            console.error('Form not found for response:', req.params.responseId);
            return res.status(404).json({
                success: false,
                message: 'Form not found. Cannot generate report.'
            });
        }
        
        // Persist default template when none configured (matches client ResponseTemplateBuilder defaults)
        const hadNoTemplates =
            !form.responseTemplate?.templates ||
            !Array.isArray(form.responseTemplate.templates) ||
            form.responseTemplate.templates.length === 0;

        if (hadNoTemplates) {
            const { buildDefaultResponseTemplate } = require('../utils/defaultResponseTemplate');
            const { responseTemplate } = buildDefaultResponseTemplate();
            await Form.updateOne(
                { _id: form._id, organizationId: req.user.organizationId },
                { $set: { responseTemplate } }
            );
            form.responseTemplate = responseTemplate;
        }

        // Get template configuration from request body (legacy support, merged into template if needed)
        const customTemplateConfig = req.body.templateConfig || {};

        // Generate comprehensive PDF report
        const options = {
            organizationId: req.user.organizationId.toString(),
            templateConfig: customTemplateConfig, // Legacy template config for backward compatibility
            includeComparison: req.body.includeComparison || false,
            previousResponseId: req.body.previousResponseId || null
        };

        console.log('Calling enhancedPdfReportService.generateComprehensiveReport with response ID:', response._id);
        const pdfUrl = await enhancedPdfReportService.generateComprehensiveReport(
            response._id,
            options
        );
        console.log('PDF URL generated:', pdfUrl);

        // Update response with report URL
        response.reportGenerated = true;
        response.reportUrl = pdfUrl;
        if (!response.finalReport) {
            response.finalReport = {};
        }
        response.finalReport.reportUrl = pdfUrl;
        response.finalReport.generatedAt = new Date();
        response.finalReport.includesComparison = options.includeComparison;
        if (options.previousResponseId) {
            response.finalReport.previousResponseId = options.previousResponseId;
        }
        await response.save();

        res.status(200).json({
            success: true,
            message: 'Comprehensive report generated successfully',
            data: {
                reportUrl: pdfUrl,
                responseId: response._id,
                formId: (response.formId && response.formId._id) ? response.formId._id : req.params.id,
                generatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('Generate comprehensive report error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            params: {
                formId: req.params.id,
                responseId: req.params.responseId
            }
        });
        
        // Handle template validation errors as 400 (bad request) instead of 500
        if (error.message && (
            error.message.includes('Template validation failed') ||
            error.message.includes('missing required core blocks') ||
            error.message.includes('No active template found') ||
            error.message.includes('template') && error.message.includes('not found')
        )) {
            return res.status(400).json({
                success: false,
                message: error.message || 'Template validation failed. Please ensure your response template has all required blocks.',
                error: error.message
            });
        }
        
        // Handle form/response not found errors as 404
        if (error.message && (
            error.message.includes('not found') ||
            error.message.includes('Form ID not found') ||
            error.message.includes('Response not found')
        )) {
            return res.status(404).json({
                success: false,
                message: error.message || 'Resource not found.',
                error: error.message
            });
        }
        
        // All other errors return 500
        res.status(500).json({
            success: false,
            message: 'Error generating comprehensive report.',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// @desc    Archive response (for audit integrity)
// @route   POST /api/forms/:id/responses/:responseId/archive
// @access  Private
exports.archiveResponse = async (req, res) => {
    try {
        const { reason } = req.body;
        
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Archive reason is required.'
            });
        }
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        // Archive the response
        response.archived = true;
        response.archivedAt = new Date();
        response.archivedBy = req.user._id;
        response.archiveReason = reason.trim();
        
        await response.save();
        
        const updatedResponse = await FormResponse.findById(response._id)
            .populate('submittedBy', 'firstName lastName email')
            .populate('archivedBy', 'firstName lastName email')
            .populate('formId', '_id name formId formType');
        
        res.status(200).json({
            success: true,
            data: updatedResponse,
            message: 'Response archived successfully'
        });
    } catch (error) {
        console.error('Archive response error:', error);
        res.status(500).json({
            success: false,
            message: 'Error archiving response.',
            error: error.message
        });
    }
};

// @desc    Invalidate response (for audit integrity)
// @route   POST /api/forms/:id/responses/:responseId/invalidate
// @access  Private
exports.invalidateResponse = async (req, res) => {
    try {
        const { reason } = req.body;
        
        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalidation reason is required.'
            });
        }
        
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        // Invalidate the response
        response.invalidated = true;
        response.invalidatedAt = new Date();
        response.invalidatedBy = req.user._id;
        response.invalidationReason = reason.trim();
        
        await response.save();
        
        const updatedResponse = await FormResponse.findById(response._id)
            .populate('submittedBy', 'firstName lastName email')
            .populate('invalidatedBy', 'firstName lastName email')
            .populate('formId', '_id name formId formType');
        
        res.status(200).json({
            success: true,
            data: updatedResponse,
            message: 'Response invalidated successfully'
        });
    } catch (error) {
        console.error('Invalidate response error:', error);
        res.status(500).json({
            success: false,
            message: 'Error invalidating response.',
            error: error.message
        });
    }
};

// @desc    Restore archived/invalidated response
// @route   POST /api/forms/:id/responses/:responseId/restore
// @access  Private
exports.restoreResponse = async (req, res) => {
    try {
        const response = await FormResponse.findOne({
            _id: req.params.responseId,
            formId: req.params.id,
            organizationId: req.user.organizationId
        });
        
        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Response not found or access denied.'
            });
        }
        
        // Restore the response
        response.archived = false;
        response.archivedAt = null;
        response.archivedBy = null;
        response.archiveReason = null;
        response.invalidated = false;
        response.invalidatedAt = null;
        response.invalidatedBy = null;
        response.invalidationReason = null;
        
        await response.save();
        
        const updatedResponse = await FormResponse.findById(response._id)
            .populate('submittedBy', 'firstName lastName email')
            .populate('formId', '_id name formId formType');
        
        res.status(200).json({
            success: true,
            data: updatedResponse,
            message: 'Response restored successfully'
        });
    } catch (error) {
        console.error('Restore response error:', error);
        res.status(500).json({
            success: false,
            message: 'Error restoring response.',
            error: error.message
        });
    }
};

