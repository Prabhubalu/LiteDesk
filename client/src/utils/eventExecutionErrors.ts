/**
 * Map backend execution error codes/messages to user-friendly text.
 */
export function mapExecutionError(error: {
  response?: { data?: { code?: string; message?: string } };
  code?: string;
  message?: string;
} | null | undefined): string {
  const errorCode = error?.response?.data?.code || error?.code;
  const errorMessage = error?.response?.data?.message || error?.message;

  const errorMap: Record<string, string> = {
    EVENT_ALREADY_COMPLETED: 'This event has already been completed and cannot be modified.',
    INVALID_STATE_TRANSITION: 'This action is not allowed in the current event state.',
    AUDIT_WORKFLOW_LOCKED: 'This audit workflow is locked and cannot be modified.',
    GEO_REQUIRED: 'Location tracking is required for this action. Please enable location access.',
    EVENT_NOT_FOUND: 'This event could not be found.',
    PERMISSION_DENIED: 'You do not have permission to perform this action.',
    AUDIT_ALREADY_SUBMITTED: 'This audit has already been submitted and cannot be modified.',
    AUDIT_PENDING_CORRECTIVE: 'This audit requires corrective actions before proceeding.'
  };

  if (errorCode && errorMap[errorCode]) {
    return errorMap[errorCode];
  }

  if (errorMessage) {
    const messageLower = errorMessage.toLowerCase();
    for (const [code, friendlyMessage] of Object.entries(errorMap)) {
      if (messageLower.includes(code.toLowerCase().replace(/_/g, ' '))) {
        return friendlyMessage;
      }
    }

    if (messageLower.includes('already completed')) {
      return errorMap.EVENT_ALREADY_COMPLETED!;
    }
    if (messageLower.includes('invalid state') || messageLower.includes('state transition')) {
      return errorMap.INVALID_STATE_TRANSITION!;
    }
    if (messageLower.includes('workflow locked') || messageLower.includes('audit locked')) {
      return errorMap.AUDIT_WORKFLOW_LOCKED!;
    }
    if (messageLower.includes('geo') || messageLower.includes('location')) {
      return errorMap.GEO_REQUIRED!;
    }
  }

  console.error('[eventExecution] Unmapped execution error:', error);
  return errorMessage || 'An unexpected error occurred. Please try again or contact support.';
}
