import type { Ref } from 'vue';

export type PlatformHomeSnapshot = {
  attention: {
    items: unknown[];
    total: number;
    summary: { total: number; overdue: number; dueToday: number };
  };
  shell: {
    approvalsPending: number;
    approvalsPreview?: unknown[];
    nextEvent: unknown | null;
    mail: { all?: number; unread: number; assignedToMe?: number; preview?: unknown[] };
    notifications?: { unread: number; preview: unknown[] };
    documents: { pendingReview: number; expiringSoon: number; preview?: unknown[] };
  };
  resume: unknown[];
  appPulses?: unknown[];
  greeting?: unknown | null;
  focus: unknown | null;
  onboarding?: unknown | null;
};

export declare function usePlatformHome(): {
  loading: Ref<boolean>;
  error: Ref<unknown>;
  snapshot: Ref<PlatformHomeSnapshot>;
  fetchSnapshot: () => Promise<void>;
};
