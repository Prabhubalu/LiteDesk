import type { Ref } from 'vue';
import type { AstraRecommendationSnapshot } from '@/utils/buildAstraRecommendations';

export type PlatformHomeSnapshot = AstraRecommendationSnapshot & {
  attention: NonNullable<AstraRecommendationSnapshot['attention']> & {
    items: NonNullable<NonNullable<AstraRecommendationSnapshot['attention']>['items']>;
    total: number;
    summary: { total: number; overdue: number; dueToday: number };
  };
  shell: NonNullable<AstraRecommendationSnapshot['shell']> & {
    approvalsPending: number;
    approvalsPreview?: unknown[];
    nextEvent: unknown | null;
    mail: { all?: number; unread: number; assignedToMe?: number; preview?: unknown[] };
    notifications?: { unread: number; preview: unknown[] };
    documents: { pendingReview: number; expiringSoon: number; preview?: unknown[] };
  };
  resume: NonNullable<AstraRecommendationSnapshot['resume']>;
  appPulses?: unknown[];
  greeting?: unknown | null;
  focus: AstraRecommendationSnapshot['focus'];
  onboarding?: unknown | null;
};

export declare function usePlatformHome(): {
  loading: Ref<boolean>;
  error: Ref<unknown>;
  snapshot: Ref<PlatformHomeSnapshot>;
  fetchSnapshot: () => Promise<void>;
};
