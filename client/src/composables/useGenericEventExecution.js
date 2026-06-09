import { computed, ref, toValue } from 'vue';
import apiClient from '@/utils/apiClient';
import { deriveEventExecutionState, isAuditEventType } from '@/utils/eventUtils';
import { determineEventExecutionRole } from '@/utils/eventExecutionRole';
import { mapExecutionError } from '@/utils/eventExecutionErrors';

/**
 * Generic event execution mutations (start / complete / cancel).
 * Used on the event record page inline execution panel.
 */
export function useGenericEventExecution(eventSource, eventIdSource) {
  const starting = ref(false);
  const completing = ref(false);
  const executionError = ref(null);

  const executionState = computed(() => deriveEventExecutionState(toValue(eventSource)));

  const canStart = computed(() => {
    const event = toValue(eventSource);
    if (!event || isAuditEventType(event.eventType)) return false;
    return executionState.value === 'NOT_STARTED' && determineEventExecutionRole(event) !== null;
  });

  const canComplete = computed(() => {
    const event = toValue(eventSource);
    if (!event || isAuditEventType(event.eventType)) return false;
    return executionState.value === 'IN_PROGRESS' && determineEventExecutionRole(event) !== null;
  });

  const canCancel = computed(() => canComplete.value);

  async function runMutation(kind, onSuccess) {
    const eventId = String(toValue(eventIdSource) || '').trim();
    if (!eventId) return false;

    const isStart = kind === 'start';
    const isComplete = kind === 'complete';
    const isCancel = kind === 'cancel';

    if (isStart && !canStart.value) return false;
    if (isComplete && !canComplete.value) return false;
    if (isCancel && !canCancel.value) return false;

    if (isStart) starting.value = true;
    else completing.value = true;
    executionError.value = null;

    try {
      const response = await apiClient.post(`/events/${eventId}/${kind}`);
      if (response.success) {
        if (typeof onSuccess === 'function') {
          await onSuccess();
        }
        return true;
      }
      executionError.value = mapExecutionError({ response: { data: { message: response.message } } });
    } catch (err) {
      executionError.value = mapExecutionError(err);
    } finally {
      if (isStart) starting.value = false;
      else completing.value = false;
    }
    return false;
  }

  return {
    starting,
    completing,
    executionError,
    executionState,
    canStart,
    canComplete,
    canCancel,
    startEvent: (onSuccess) => runMutation('start', onSuccess),
    completeEvent: (onSuccess) => runMutation('complete', onSuccess),
    cancelEvent: (onSuccess) => runMutation('cancel', onSuccess)
  };
}
