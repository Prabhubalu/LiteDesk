/**
 * ============================================================================
 * AUDIT APP: Audit Sync Service (CRM → Audit App One-Way Sync)
 * ============================================================================
 * 
 * Purpose:
 * - One-way, event-driven synchronization from CRM to Audit App
 * - Keeps AuditAssignment, AuditTimeline, AuditExecutionContext in sync
 * - No logic duplication
 * - No state machines
 * - CRM remains single source of truth
 * 
 * Rules:
 * - Sync is CRM → Audit App only
 * - Never throws errors that block CRM execution
 * - Log sync failures, don't crash flows
 * - Ignore non-audit events
 * - Ignore missing auditorId
 * 
 * SAFETY GUARDS:
 * - Kill switch: AUDIT_SYNC_ENABLED env flag
 * - Reverse sync prevention: Never allow Audit App to call this service
 * 
 * See AUDIT_SYNC_IMPLEMENTATION.md for architecture details.
 * ============================================================================
 */

const AuditAssignment = require('../models/AuditAssignment');
const AuditTimeline = require('../models/AuditTimeline');
const AuditExecutionContext = require('../models/AuditExecutionContext');

// Audit event types (must match eventController.js)
const AUDIT_EVENT_TYPES = ['Internal Audit', 'External Audit — Single Org', 'External Audit Beat'];

// Kill switch: Emergency rollback without redeploy
const AUDIT_SYNC_ENABLED = process.env.AUDIT_SYNC_ENABLED !== 'false'; // Default: enabled

/**
 * Safety guard: Prevent reverse sync (Audit App → CRM)
 * This service should ONLY be called from CRM context
 */
function checkSyncSafety() {
    // SAFETY: Never allow Audit App to call this service
    // This prevents future mistakes when teams grow
    if (process.env.APP_CONTEXT === 'AUDIT' || process.env.APP_KEY === 'AUDIT') {
        console.warn('[AuditSync] BLOCKED: Sync service called from Audit App context. This should never happen.');
        return false;
    }
    
    // Kill switch: Emergency rollback
    if (!AUDIT_SYNC_ENABLED) {
        console.warn('[AuditSync] DISABLED: Sync is disabled via AUDIT_SYNC_ENABLED=false');
        return false;
    }
    
    return true;
}

/**
 * Sync AuditAssignment from CRM Event
 * 
 * Triggered when:
 * - Audit event is created
 * - auditState changes
 * - Event is approved / rejected / closed
 * 
 * @param {Object} event - CRM Event document
 * @returns {Promise<void>}
 */
async function syncAuditAssignmentFromEvent(event) {
    try {
        // Safety guard: Prevent reverse sync and check kill switch
        if (!checkSyncSafety()) {
            return;
        }
        
        // Safeguard: Only sync audit event types
        if (!AUDIT_EVENT_TYPES.includes(event.eventType)) {
            return;
        }
        
        // Safeguard: Must have auditorId (assignedTo mirrors auditorId for audit events)
        const auditorId = event.auditorId || event.assignedTo;
        if (!auditorId) {
            console.warn('[AuditSync] Skipping sync: Event missing auditorId/assignedTo', {
                eventId: event._id,
                eventIdField: event.eventId
            });
            return;
        }
        
        // Determine assignment status based on auditState
        const status = event.auditState === 'closed' ? 'closed' : 'active';
        
        // Upsert assignment
        await AuditAssignment.findOneAndUpdate(
            { eventId: event._id },
            {
                auditorId: auditorId,
                organizationId: event.organizationId,
                eventId: event._id,
                auditType: event.eventType,
                auditState: event.auditState, // Read-only cache from CRM
                scheduledAt: event.startDateTime,
                dueAt: event.endDateTime,
                status: status
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );
        
        console.log('[AuditSync] Synced AuditAssignment', {
            eventId: event._id,
            eventIdField: event.eventId,
            auditState: event.auditState,
            status: status
        });
    } catch (error) {
        // Never throw - log and continue
        console.error('[AuditSync] Error syncing AuditAssignment:', error.message, {
            eventId: event._id,
            eventIdField: event.eventId
        });
    }
}

/**
 * Sync AuditTimeline from CRM Event
 * 
 * Create a timeline entry when:
 * - Event is created
 * - auditState changes
 * - approve / reject happens
 * - reschedule happens
 * 
 * @param {Object} event - CRM Event document
 * @param {Object} meta - Action metadata (action, fromState, toState, actorId, etc.)
 * @returns {Promise<void>}
 */
async function syncAuditTimelineFromEvent(event, meta = {}) {
    try {
        // Safety guard: Prevent reverse sync and check kill switch
        if (!checkSyncSafety()) {
            return;
        }
        
        // Safeguard: Only sync audit event types
        if (!AUDIT_EVENT_TYPES.includes(event.eventType)) {
            return;
        }
        
        // Safeguard: Must have actorId
        const actorId = meta.actorId || meta.actorUserId || event.modifiedBy || event.createdBy;
        if (!actorId) {
            console.warn('[AuditSync] Skipping timeline sync: Missing actorId', {
                eventId: event._id,
                eventIdField: event.eventId
            });
            return;
        }
        
        // Map CRM action to AuditTimeline action
        const actionMap = {
            'created': 'CREATED',
            'status_changed': 'STATUS_CHANGED',
            'rescheduled': 'RESCHEDULED',
            'cancelled': 'CANCELLED'
        };
        
        // Determine action from meta or default
        let action = meta.action || 'STATUS_CHANGED';
        if (actionMap[action]) {
            action = actionMap[action];
        }
        
        // Map auditState transitions to specific actions
        if (meta.toState === 'checked_in' || meta.toState === 'Ready to start') {
            if (event.checkIn && event.checkIn.timestamp) {
                action = 'CHECK_IN';
            }
        } else if (meta.toState === 'submitted' || meta.toState === 'pending_corrective' || meta.toState === 'needs_review') {
            action = 'SUBMIT';
        } else if (meta.toState === 'closed' || meta.toState === 'approved') {
            action = 'APPROVE';
        } else if (meta.toState === 'rejected') {
            action = 'REJECT';
        }
        
        // Create timeline entry
        await AuditTimeline.create({
            organizationId: event.organizationId,
            eventId: event._id,
            actorId: actorId,
            action: action,
            fromState: meta.fromState || null,
            toState: meta.toState || event.auditState || null,
            meta: {
                ...meta.metadata,
                ...meta.meta,
                eventId: event.eventId,
                eventName: event.eventName
            },
            createdAt: meta.timestamp || new Date()
        });
        
        console.log('[AuditSync] Created timeline entry', {
            eventId: event._id,
            eventIdField: event.eventId,
            action: action,
            fromState: meta.fromState,
            toState: meta.toState || event.auditState
        });
    } catch (error) {
        // Never throw - log and continue
        console.error('[AuditSync] Error syncing AuditTimeline:', error.message, {
            eventId: event._id,
            eventIdField: event.eventId
        });
    }
}

/**
 * Sync AuditExecutionContext from FormResponse
 * 
 * Triggered when:
 * - FormResponse submitted
 * - Corrective actions completed
 * 
 * @param {Object} formResponse - CRM FormResponse document
 * @returns {Promise<void>}
 */
async function syncAuditExecutionContextFromFormResponse(formResponse) {
    try {
        // Safety guard: Prevent reverse sync and check kill switch
        if (!checkSyncSafety()) {
            return;
        }
        
        // Safeguard: Only sync if linked to event
        if (!formResponse.linkedTo || formResponse.linkedTo.type !== 'Event' || !formResponse.linkedTo.id) {
            return;
        }
        
        const eventId = formResponse.linkedTo.id;
        const Event = require('../models/Event');
        
        // Verify event is audit type
        const event = await Event.findById(eventId).select('eventType').lean();
        if (!event || !AUDIT_EVENT_TYPES.includes(event.eventType)) {
            return;
        }
        
        // Only update if execution context exists (never create workflow logic)
        const executionContext = await AuditExecutionContext.findOne({
            eventId: eventId,
            executedBy: formResponse.submittedBy
        });
        
        if (!executionContext) {
            // Don't create - execution context is created lazily during execution
            return;
        }
        
        // Update execution status based on form response
        if (formResponse.executionStatus === 'Submitted') {
            executionContext.executionStatus = 'submitted';
            executionContext.checkedOutAt = formResponse.submittedAt || new Date();
            await executionContext.save();
            
            console.log('[AuditSync] Updated AuditExecutionContext', {
                eventId: eventId,
                executionStatus: 'submitted'
            });
        }
    } catch (error) {
        // Never throw - log and continue
        console.error('[AuditSync] Error syncing AuditExecutionContext:', error.message, {
            formResponseId: formResponse._id
        });
    }
}

module.exports = {
    syncAuditAssignmentFromEvent,
    syncAuditTimelineFromEvent,
    syncAuditExecutionContextFromFormResponse
};

