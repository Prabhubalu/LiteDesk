/**
 * ============================================================================
 * Phase 0I.2: Response Detail Controller (Read-Only)
 * ============================================================================
 * 
 * Read-only controller for Response Detail view.
 * 
 * ⚠️ SAFETY: Response Detail is read-only.
 * Any execution or review mutations must occur via Sales execution controllers only.
 * 
 * ============================================================================
 */

const FormResponse = require('../models/FormResponse');
const Form = require('../models/Form');
const Event = require('../models/Event');
const User = require('../models/User');
const { APP_KEYS } = require('../constants/appKeys');
const executionDomains = require('../constants/executionDomains');

/** Tenant apps with org-scoped read access to responses (platform execution domain). */
const TENANT_RESPONSE_READ_APPS = new Set([
  APP_KEYS.SALES,
  APP_KEYS.HELPDESK,
  APP_KEYS.PROJECTS,
  APP_KEYS.LMS,
  APP_KEYS.INVENTORY
]);

/**
 * Get response detail (read-only)
 * GET /api/responses/:responseId
 * 
 * Returns Response Detail DTO with:
 * - Response core fields
 * - Execution status
 * - Review status (computed, not mutated)
 * - Failed question summary
 * - Corrective actions (read-only)
 * - Timeline entries (read-only)
 * 
 * App Boundary Enforcement:
 * - Sales: Full read-only access
 * - AUDIT: Read-only if auditor owns the event
 * - PORTAL: Read-only if response belongs to tenant and user is corrective owner
 * - CONTROL_PLANE: No access
 */
exports.getResponseDetail = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { responseId } = req.params;
    const appKey = req.appKey || 'SALES'; // From resolveAppContext middleware
    const currentUser = req.user;

    // Load FormResponse with populated fields
    const response = await FormResponse.findOne({
      _id: responseId,
      organizationId
    })
      .populate('submittedBy', 'firstName lastName email')
      .populate({
        path: 'linkedTo.id',
        select: 'eventId eventName auditState correctiveOwnerId auditorId reviewerId allowSelfReview',
        populate: [
          {
            path: 'auditorId',
            select: 'firstName lastName email'
          },
          {
            path: 'correctiveOwnerId',
            select: 'firstName lastName email'
          }
        ]
      })
      .populate('correctiveActions.managerAction.addedBy', 'firstName lastName email')
      .populate('correctiveActions.auditorVerification.verifiedBy', 'firstName lastName email')
      .lean();

    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Response not found or access denied.'
      });
    }

    // App Boundary Enforcement
    const hasAccess = checkAppBoundaryAccess(appKey, response, currentUser);
    if (!hasAccess.allowed) {
      return res.status(403).json({
        success: false,
        message: hasAccess.reason || 'Access denied'
      });
    }

    // Load related Form for form name and question labels
    const form = await Form.findById(response.formId)
      .select('name description sections')
      .lean();
    
    // Enhance failed questions with labels from Form if available
    let enhancedFailedQuestions = buildFailedQuestionsSummary(response);
    if (form && form.sections && enhancedFailedQuestions.length > 0) {
      // Build question label map from form sections
      const questionLabelMap = {};
      if (form.sections) {
        form.sections.forEach(section => {
          if (section.questions) {
            section.questions.forEach(q => {
              if (q.id || q.questionId) {
                questionLabelMap[q.id || q.questionId] = q.label || q.text || q.question;
              }
            });
          }
          if (section.subsections) {
            section.subsections.forEach(subsection => {
              if (subsection.questions) {
                subsection.questions.forEach(q => {
                  if (q.id || q.questionId) {
                    questionLabelMap[q.id || q.questionId] = q.label || q.text || q.question;
                  }
                });
              }
            });
          }
        });
      }
      
      // Enhance failed questions with labels
      enhancedFailedQuestions = enhancedFailedQuestions.map(q => ({
        ...q,
        label: questionLabelMap[q.questionId] || q.label
      }));
    }

    // Compute review status (don't mutate)
    const computedReviewStatus = computeReviewStatusSafe(response);

    // Build corrective actions (read-only)
    const correctiveActions = buildCorrectiveActionsReadOnly(response);

    // Build timeline entries
    const timeline = buildTimelineEntries(response);

    // Get event reference if available
    const linkedEvent = response.linkedTo?.type === 'Event' ? response.linkedTo.id : null;
    const eventReference = linkedEvent
      ? {
          id: linkedEvent._id?.toString() || linkedEvent.toString(),
          eventId: linkedEvent.eventId || linkedEvent._id?.toString() || linkedEvent.toString(),
          eventName: linkedEvent.eventName || 'Event',
          auditState: linkedEvent.auditState
        }
      : null;

    // Get auditor info if available
    const auditorInfo = linkedEvent?.auditorId
      ? {
          id: linkedEvent.auditorId._id?.toString() || linkedEvent.auditorId.toString(),
          name: linkedEvent.auditorId.firstName || linkedEvent.auditorId.lastName
            ? `${linkedEvent.auditorId.firstName || ''} ${linkedEvent.auditorId.lastName || ''}`.trim()
            : linkedEvent.auditorId.email || 'Unknown'
        }
      : null;

    // Build Response Detail DTO
    const responseDetail = {
      id: response._id.toString(),
      responseId: response.responseId,
      formId: response.formId ? response.formId.toString() : null,
      formName: form?.name || 'Unknown Form',
      eventId: eventReference?.id?.toString(),
      eventReference,
      executionStatus: response.executionStatus || 'Not Started',
      reviewStatus: computedReviewStatus,
      submittedAt: response.submittedAt,
      submittedBy: response.submittedBy ? {
        id: response.submittedBy._id.toString(),
        name: `${response.submittedBy.firstName || ''} ${response.submittedBy.lastName || ''}`.trim() || response.submittedBy.email
      } : null,
      auditor: auditorInfo,
      failedQuestions: enhancedFailedQuestions,
      correctiveActions,
      timeline,
      // Additional metadata (read-only)
      compliancePercentage: response.kpis?.compliancePercentage || 0,
      totalPassed: response.kpis?.totalPassed || 0,
      totalFailed: response.kpis?.totalFailed || 0,
      totalQuestions: response.kpis?.totalQuestions || 0,
      finalScore: response.kpis?.finalScore || 0
    };

    res.status(200).json({
      success: true,
      data: responseDetail
    });
  } catch (error) {
    console.error('[responseDetailController] Error getting response detail:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching response detail',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Check app boundary access for response
 * Phase 0I.2: App boundary enforcement (ownership and app context only, no role checks)
 */
function checkAppBoundaryAccess(appKey, response, currentUser) {
  const normalizedAppKey = (appKey || APP_KEYS.SALES).toUpperCase();

  // Tenant apps: org isolation is enforced in the query; allow read within tenant.
  if (TENANT_RESPONSE_READ_APPS.has(normalizedAppKey)) {
    return { allowed: true };
  }

  // AUDIT: Read-only if auditor owns the event
  if (normalizedAppKey === 'AUDIT') {
    const event = response.linkedTo?.id;
    if (!event) {
      return { allowed: false, reason: 'Response not linked to an event' };
    }

    const auditorId = event.auditorId?._id || event.auditorId;
    const currentUserId = currentUser._id.toString();

    if (auditorId && auditorId.toString() === currentUserId) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Only the assigned auditor can view this response' };
  }

  // PORTAL: Read-only if response belongs to tenant and user is corrective owner
  if (normalizedAppKey === 'PORTAL') {
    const event = response.linkedTo?.id;
    if (!event) {
      return { allowed: false, reason: 'Response not linked to an event' };
    }

    // Check if user is corrective owner
    const correctiveOwnerId = event.correctiveOwnerId?._id || event.correctiveOwnerId;
    const currentUserId = currentUser._id.toString();

    if (correctiveOwnerId && correctiveOwnerId.toString() === currentUserId) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Only the corrective action owner can view this response' };
  }

  // CONTROL_PLANE: No access
  if (normalizedAppKey === 'CONTROL_PLANE') {
    return { allowed: false, reason: 'Control Plane cannot access responses' };
  }

  // Default: deny
  return { allowed: false, reason: 'Access denied' };
}

/**
 * Compute review status safely (without mutating)
 * Uses the same logic as FormResponse.computeReviewStatus() but on plain object
 */
function computeReviewStatusSafe(response) {
  // If not submitted, status is null
  if (response.executionStatus !== 'Submitted') {
    return null;
  }

  // Get failed scorable questions count
  const failedScorableQuestionsCount = (response.responseDetails || []).filter(
    detail => detail.passFail === 'Fail'
  ).length;

  // Check if corrective actions are complete
  const correctiveActions = response.correctiveActions || [];
  const hasIncompleteActions = correctiveActions.length === 0 || 
    correctiveActions.some(action => action.managerAction?.status !== 'completed');
  const allActionsComplete = correctiveActions.length > 0 && 
    correctiveActions.every(action => action.managerAction?.status === 'completed');

  // Rule 5: If approved and all corrective actions are completed → "Closed"
  if (response.approved && allActionsComplete) {
    return 'Closed';
  }

  // Rule 4: If auditor has approved the response → "Approved"
  if (response.approved) {
    return 'Approved';
  }

  // Rule 6 & 1: If there are failed scorable questions AND at least one corrective action is not completed → "Pending Corrective Action"
  if (failedScorableQuestionsCount > 0) {
    if (hasIncompleteActions) {
      return 'Pending Corrective Action';
    }
  }

  // Rule 2: If there are failed questions but all corrective actions are completed → "Needs Auditor Review"
  if (failedScorableQuestionsCount > 0 && allActionsComplete) {
    return 'Needs Auditor Review';
  }

  // Rule 3: If there are no failed questions AND response is not yet reviewed → "Needs Auditor Review"
  if (failedScorableQuestionsCount === 0) {
    return 'Needs Auditor Review';
  }

  // Default fallback
  return 'Needs Auditor Review';
}

/**
 * Build failed questions summary
 * Note: Question labels need to be fetched from Form if available
 */
function buildFailedQuestionsSummary(response) {
  const failedQuestions = [];

  if (!response.responseDetails || response.responseDetails.length === 0) {
    return failedQuestions;
  }

  response.responseDetails.forEach(detail => {
    if (detail.passFail === 'Fail') {
      // Determine severity based on question type or score
      // Default to MEDIUM if not specified
      let severity = 'MEDIUM';
      if (detail.score !== undefined && detail.score !== null) {
        if (detail.score < 50) {
          severity = 'HIGH';
        } else if (detail.score < 70) {
          severity = 'MEDIUM';
        } else {
          severity = 'LOW';
        }
      }

      failedQuestions.push({
        questionId: detail.questionId,
        label: `Question ${detail.questionId}`, // Label will be enhanced by frontend if Form data is available
        severity
      });
    }
  });

  return failedQuestions;
}

/**
 * Build corrective actions (read-only format)
 */
function buildCorrectiveActionsReadOnly(response) {
  const correctiveActions = [];

  if (!response.correctiveActions || response.correctiveActions.length === 0) {
    return correctiveActions;
  }

  response.correctiveActions.forEach((action, index) => {
    const managerAction = action.managerAction || {};
    const status = managerAction.status || 'open';
    
    // Map status to enum format
    let statusEnum = 'OPEN';
    if (status === 'in_progress') {
      statusEnum = 'IN_PROGRESS';
    } else if (status === 'completed') {
      statusEnum = 'COMPLETED';
    }

    const owner = managerAction.addedBy || {};
    correctiveActions.push({
      id: action.questionId || `action-${index}`, // Use questionId as identifier
      questionId: action.questionId,
      title: action.questionText || `Corrective Action for ${action.questionId}`,
      status: statusEnum,
      owner: {
        id: owner._id?.toString() || '',
        name: owner.firstName || owner.lastName 
          ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() 
          : owner.email || 'Unknown'
      },
      auditorFinding: action.auditorFinding,
      addedAt: managerAction.addedAt
    });
  });

  return correctiveActions;
}

/**
 * Build timeline entries from response history
 */
function buildTimelineEntries(response) {
  const timeline = [];

  // Add submission entry
  if (response.submittedAt && response.submittedBy) {
    timeline.push({
      type: 'SUBMIT',
      actor: {
        id: response.submittedBy._id?.toString() || '',
        name: response.submittedBy.firstName || response.submittedBy.lastName
          ? `${response.submittedBy.firstName || ''} ${response.submittedBy.lastName || ''}`.trim()
          : response.submittedBy.email || 'Unknown'
      },
      timestamp: response.submittedAt
    });
  }

  // Add corrective action completion entries
  if (response.correctiveActions && response.correctiveActions.length > 0) {
    response.correctiveActions.forEach(action => {
      if (action.managerAction?.status === 'completed' && action.managerAction?.addedAt) {
        const owner = action.managerAction.addedBy || {};
        timeline.push({
          type: 'ACTION_COMPLETED',
          actor: {
            id: owner._id?.toString() || '',
            name: owner.firstName || owner.lastName
              ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim()
              : owner.email || 'Unknown'
          },
          timestamp: action.managerAction.addedAt,
          questionId: action.questionId
        });
      }
    });
  }

  // Add approval entry
  if (response.approved && response.approvedAt && response.approvedBy) {
    timeline.push({
      type: 'REVIEW',
      actor: {
        id: response.approvedBy.toString(),
        name: 'Auditor' // Will be populated if needed
      },
      timestamp: response.approvedAt,
      reviewStatus: 'Approved'
    });
  }

  // Sort by timestamp (oldest first)
  timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return timeline;
}

