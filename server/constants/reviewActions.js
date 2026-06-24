/**
 * ============================================================================
 * Phase 0I.3: Review Actions Metadata Registry
 * ============================================================================
 * 
 * Declarative metadata for Response review actions.
 * 
 * ⚠️ IMPORTANT: This is METADATA ONLY
 * - No logic is executed here
 * - No state mutation happens here
 * - No UI rendering happens here
 * - This is purely declarative vocabulary
 * 
 * Purpose:
 * - Teach the platform what review actions exist
 * - Declare who owns execution (PLATFORM)
 * - Declare which apps can observe
 * - Enable Process Designer discovery (future)
 * - Enable UI rendering without guessing (future)
 * 
 * Rules:
 * - All actions are Platform-owned
 * - Audit App and Portal are read-only
 * - Actions can only be executed from specific review states
 * - Process Designer can discover but not execute
 * 
 * ============================================================================
 */

/**
 * Response Review Actions
 * 
 * Declarative metadata for actions that can be performed on Response records
 * during the review phase (after executionStatus = 'Submitted').
 * 
 * ⚠️ SAFETY: These are declarations only, not executable logic.
 * Any execution must occur via Platform execution controllers only.
 */
const RESPONSE_REVIEW_ACTIONS = {
  APPROVE: {
    key: 'APPROVE',
    label: 'Approve Response',
    description: 'Auditor approves the submitted response after review',
    // States from which this action is allowed
    allowedFrom: ['Needs Auditor Review'],
    // State this action results in
    resultsIn: 'Approved',
    // Whether ownership of the record is required
    requiresOwnership: true,
    // Which execution domain owns this action
    executionDomain: 'PLATFORM',
    // Which apps can see this action (Platform is the executor)
    exposedToApps: ['PLATFORM'],
    // Whether Process Designer can automate this action
    automationAllowed: true,
    // UI hints (for future use)
    ui: {
      icon: 'check-circle',
      color: 'green',
      variant: 'success',
      requiresConfirmation: true
    }
  },

  REJECT: {
    key: 'REJECT',
    label: 'Reject Response',
    description: 'Auditor rejects the response for rework',
    allowedFrom: ['Needs Auditor Review'],
    resultsIn: 'Rejected',
    requiresOwnership: true,
    executionDomain: 'PLATFORM',
    exposedToApps: ['PLATFORM'],
    automationAllowed: true,
    ui: {
      icon: 'x-circle',
      color: 'red',
      variant: 'danger',
      requiresConfirmation: true,
      requiresReason: true
    }
  },

  CLOSE: {
    key: 'CLOSE',
    label: 'Close Response',
    description: 'Final closure after approval and all corrective actions completed',
    allowedFrom: ['Approved'],
    resultsIn: 'Closed',
    requiresOwnership: true,
    executionDomain: 'PLATFORM',
    exposedToApps: ['PLATFORM'],
    automationAllowed: true,
    ui: {
      icon: 'lock-closed',
      color: 'gray',
      variant: 'secondary',
      requiresConfirmation: true
    }
  }
};

/**
 * Get all review actions for a Response
 * 
 * ⚠️ SAFETY: Returns metadata only, no execution logic.
 * 
 * @param {string} currentReviewStatus - Current review status of the response
 * @returns {Array} - Array of action metadata objects that are allowed from current state
 */
function getAvailableReviewActions(currentReviewStatus) {
  if (!currentReviewStatus) {
    return [];
  }

  const availableActions = [];

  Object.values(RESPONSE_REVIEW_ACTIONS).forEach(action => {
    if (action.allowedFrom.includes(currentReviewStatus)) {
      availableActions.push(action);
    }
  });

  return availableActions;
}

/**
 * Check if a review action is allowed from current state
 * 
 * ⚠️ SAFETY: This is validation metadata only, not permission enforcement.
 * 
 * @param {string} actionKey - Action key (APPROVE, REJECT, CLOSE)
 * @param {string} currentReviewStatus - Current review status
 * @returns {boolean} - Whether action is allowed from current state
 */
function isReviewActionAllowed(actionKey, currentReviewStatus) {
  if (!actionKey || !currentReviewStatus) {
    return false;
  }

  const action = RESPONSE_REVIEW_ACTIONS[actionKey.toUpperCase()];
  if (!action) {
    return false;
  }

  return action.allowedFrom.includes(currentReviewStatus);
}

/**
 * Get review action metadata by key
 * 
 * @param {string} actionKey - Action key (APPROVE, REJECT, CLOSE)
 * @returns {Object|null} - Action metadata or null if not found
 */
function getReviewAction(actionKey) {
  if (!actionKey) {
    return null;
  }

  return RESPONSE_REVIEW_ACTIONS[actionKey.toUpperCase()] || null;
}

module.exports = {
  RESPONSE_REVIEW_ACTIONS,
  getAvailableReviewActions,
  isReviewActionAllowed,
  getReviewAction
};

