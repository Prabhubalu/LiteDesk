import { useAuthStore } from '@/stores/authRegistry';
import type { ExecutionUserRole } from '@/types/eventExecution.types';

function normalizeUserId(id: unknown): string | null {
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id !== null) {
    const obj = id as { _id?: string; id?: string };
    return obj._id || obj.id || null;
  }
  return null;
}

/**
 * Determine the current user's role in an event execution context.
 */
export function determineEventExecutionRole(event: {
  auditorId?: unknown;
  reviewerId?: unknown;
  correctiveOwnerId?: unknown;
  assignedTo?: unknown;
  assignedTo?: unknown;
  createdBy?: unknown;
} | null | undefined): ExecutionUserRole {
  const authStore = useAuthStore();
  const currentUserId = authStore.user?._id || authStore.user?.id;

  if (!currentUserId || !event) {
    return null;
  }

  if (normalizeUserId(event.auditorId) === currentUserId) {
    return 'AUDITOR';
  }
  if (normalizeUserId(event.reviewerId) === currentUserId) {
    return 'REVIEWER';
  }
  if (normalizeUserId(event.correctiveOwnerId) === currentUserId) {
    return 'CORRECTIVE_OWNER';
  }
  if (
    normalizeUserId(event.assignedTo) === currentUserId
    || normalizeUserId(event.assignedTo) === currentUserId
    || normalizeUserId(event.createdBy) === currentUserId
  ) {
    return 'OWNER';
  }

  return null;
}
