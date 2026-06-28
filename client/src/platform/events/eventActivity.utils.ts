/**
 * ============================================================================
 * EVENT ACTIVITY NORMALIZATION UTILITIES
 * ============================================================================
 * 
 * These utilities normalize event data into canonical EventActivity objects.
 * 
 * Rules:
 * - MUST NOT call APIs
 * - MUST NOT infer missing data
 * - MUST ONLY map existing event fields
 * - MUST return activities sorted by timestamp ASC
 * 
 * ============================================================================
 */

import type { EventActivity, EventActivityType, EventActivitySource } from './eventActivity.types';

/**
 * Normalize event data into canonical activity list
 * 
 * Maps existing event fields to activities:
 * - createdAt → EVENT_CREATED
 * - executionStartTime → EXECUTION_STARTED
 * - executionEndTime → EXECUTION_COMPLETED
 * - cancelledAt → EXECUTION_CANCELLED
 * - auditHistory[] → audit workflow activities
 * - checkIn / checkOut → GEO_CAPTURED
 * 
 * @param event - Event object (any shape, normalized from existing fields)
 * @returns Array of EventActivity objects, sorted by timestamp ASC
 */
export function normalizeEventActivities(event: any): EventActivity[] {
  if (!event) return [];
  
  const activities: EventActivity[] = [];
  
  // ============================================================================
  // EVENT CREATED
  // ============================================================================
  const createdAt = event.createdAt || event.startDateTime;
  if (createdAt) {
    activities.push({
      type: 'EVENT_CREATED',
      source: 'SYSTEM',
      timestamp: new Date(createdAt).toISOString(),
      actor: extractActor(event.createdBy || event.assignedTo),
      metadata: {}
    });
  }
  
  // ============================================================================
  // EXECUTION ACTIVITIES (Generic Events)
  // ============================================================================
  
  // Execution started
  if (event.executionStartTime) {
    activities.push({
      type: 'EXECUTION_STARTED',
      source: 'USER',
      timestamp: new Date(event.executionStartTime).toISOString(),
      actor: extractActor(event.executionStartedBy),
      metadata: {}
    });
  }
  
  // Execution completed
  if (event.executionEndTime || event.completedAt) {
    const completedAt = event.executionEndTime || event.completedAt;
    activities.push({
      type: 'EXECUTION_COMPLETED',
      source: 'USER',
      timestamp: new Date(completedAt).toISOString(),
      actor: extractActor(event.completedBy),
      metadata: {}
    });
  }
  
  // Execution cancelled
  if (event.cancelledAt) {
    activities.push({
      type: 'EXECUTION_CANCELLED',
      source: 'USER',
      timestamp: new Date(event.cancelledAt).toISOString(),
      actor: extractActor(event.cancelledBy),
      metadata: {
        reason: event.cancellationReason || undefined
      }
    });
  }
  
  // ============================================================================
  // AUDIT WORKFLOW ACTIVITIES
  // ============================================================================
  
  // Use auditHistory array if available (preferred source)
  if (event.auditHistory && Array.isArray(event.auditHistory) && event.auditHistory.length > 0) {
    event.auditHistory.forEach((entry: any) => {
      if (!entry || !entry.timestamp) return;
      
      // Map audit history actions to activity types
      const action = String(entry.action || '').toLowerCase();
      let activityType: EventActivityType | null = null;
      
      if (action.includes('check') || action.includes('check_in')) {
        activityType = 'AUDIT_CHECK_IN';
      } else if (action.includes('submit')) {
        activityType = 'AUDIT_SUBMITTED';
      } else if (action.includes('approve')) {
        activityType = 'AUDIT_APPROVED';
      } else if (action.includes('reject')) {
        activityType = 'AUDIT_REJECTED';
      } else if (entry.from || entry.to) {
        // State transition
        activityType = 'STATUS_CHANGED';
      }
      
      if (activityType) {
        activities.push({
          type: activityType,
          source: 'WORKFLOW',
          timestamp: new Date(entry.timestamp).toISOString(),
          actor: extractActor(entry.performedBy),
          metadata: {
            from: entry.from || undefined,
            to: entry.to || undefined,
            action: entry.action || undefined
          }
        });
      }
    });
  }
  
  // Fallback: Map individual audit fields if auditHistory not available
  // Check-in
  if (event.checkIn && event.checkIn.timestamp) {
    // Only add if not already in auditHistory
    const hasCheckInInHistory = activities.some(
      a => a.type === 'AUDIT_CHECK_IN' && 
      new Date(a.timestamp).getTime() === new Date(event.checkIn.timestamp).getTime()
    );
    
    if (!hasCheckInInHistory) {
      activities.push({
        type: 'AUDIT_CHECK_IN',
        source: 'WORKFLOW',
        timestamp: new Date(event.checkIn.timestamp).toISOString(),
        actor: extractActor(event.checkIn.userId),
        metadata: {
          location: event.checkIn.location || undefined
        }
      });
    }
  }
  
  // Submitted
  if (event.submittedAt) {
    const hasSubmittedInHistory = activities.some(
      a => a.type === 'AUDIT_SUBMITTED' && 
      new Date(a.timestamp).getTime() === new Date(event.submittedAt).getTime()
    );
    
    if (!hasSubmittedInHistory) {
      activities.push({
        type: 'AUDIT_SUBMITTED',
        source: 'WORKFLOW',
        timestamp: new Date(event.submittedAt).toISOString(),
        actor: extractActor(event.submittedBy),
        metadata: {}
      });
    }
  }
  
  // ============================================================================
  // GEO CAPTURED ACTIVITIES
  // ============================================================================
  
  // Check-in location
  if (event.checkIn && event.checkIn.location && event.checkIn.timestamp) {
    // Only add GEO_CAPTURED if location data exists and it's not already represented
    const hasGeoCheckIn = activities.some(
      a => a.type === 'GEO_CAPTURED' && 
      a.metadata?.checkType === 'checkIn' &&
      new Date(a.timestamp).getTime() === new Date(event.checkIn.timestamp).getTime()
    );
    
    if (!hasGeoCheckIn) {
      activities.push({
        type: 'GEO_CAPTURED',
        source: 'SYSTEM',
        timestamp: new Date(event.checkIn.timestamp).toISOString(),
        actor: extractActor(event.checkIn.userId),
        metadata: {
          checkType: 'checkIn',
          location: event.checkIn.location
        }
      });
    }
  }
  
  // Check-out location
  if (event.checkOut && event.checkOut.location && event.checkOut.timestamp) {
    activities.push({
      type: 'GEO_CAPTURED',
      source: 'SYSTEM',
      timestamp: new Date(event.checkOut.timestamp).toISOString(),
      actor: extractActor(event.checkOut.userId),
      metadata: {
        checkType: 'checkOut',
        location: event.checkOut.location
      }
    });
  }
  
  // ============================================================================
  // SORT BY TIMESTAMP (ASC)
  // ============================================================================
  
  const sorted = activities.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });
  
  // ============================================================================
  // DEV-ONLY GUARDS
  // ============================================================================
  
  if (process.env.NODE_ENV === 'development') {
    // Warn if no EVENT_CREATED activity exists
    const hasCreated = sorted.some(a => a.type === 'EVENT_CREATED');
    if (!hasCreated) {
      console.warn(
        '[eventActivity.utils] Event missing EVENT_CREATED activity',
        { eventId: event._id || event.id, hasCreatedAt: !!event.createdAt, hasStartDateTime: !!event.startDateTime }
      );
    }
    
    // Warn if audit event has no workflow activities
    const isAuditEvent = event.eventType && (
      event.eventType.includes('Audit') || 
      event.eventType === 'Internal Audit' ||
      event.eventType === 'External Audit — Single Org' ||
      event.eventType === 'External Audit Beat'
    );
    
    if (isAuditEvent) {
      const hasWorkflowActivities = sorted.some(
        a => a.type === 'AUDIT_CHECK_IN' || 
        a.type === 'AUDIT_SUBMITTED' || 
        a.type === 'AUDIT_APPROVED' || 
        a.type === 'AUDIT_REJECTED'
      );
      
      if (!hasWorkflowActivities && !event.auditHistory) {
        console.warn(
          '[eventActivity.utils] Audit event missing workflow activities',
          { eventId: event._id || event.id, hasAuditHistory: !!event.auditHistory, hasCheckIn: !!event.checkIn }
        );
      }
    }
  }
  
  return sorted;
}

/**
 * Extract actor information from various user reference formats
 * 
 * Handles:
 * - ObjectId references
 * - Populated user objects with firstName/lastName
 * - String IDs
 * 
 * @param userRef - User reference (any format)
 * @returns Actor object or undefined
 */
function extractActor(userRef: any): EventActivity['actor'] | undefined {
  if (!userRef) return undefined;
  
  // Populated user object
  if (typeof userRef === 'object' && userRef.firstName) {
    const name = `${userRef.firstName} ${userRef.lastName || ''}`.trim();
    return {
      id: userRef._id || userRef.id,
      name: name || undefined,
      appKey: userRef.appKey || undefined
    };
  }
  
  // ObjectId or string ID
  if (userRef._id || userRef.id || typeof userRef === 'string') {
    return {
      id: userRef._id || userRef.id || userRef,
      name: undefined,
      appKey: undefined
    };
  }
  
  return undefined;
}
