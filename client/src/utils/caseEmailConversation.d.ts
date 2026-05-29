export type CaseEmailConversationItem =
  | {
      kind: 'message';
      id: string;
      createdAt: string;
      message: Record<string, unknown>;
      badge?: { key: string; tone: string };
      threadUnread?: boolean;
    }
  | {
      kind: 'system';
      id: string;
      createdAt: string;
      activity: Record<string, unknown>;
    }
  | {
      kind: 'internal_comment';
      id: string;
      createdAt: string;
      activity: Record<string, unknown>;
    }
  | {
      kind: 'note';
      id: string;
      createdAt: string;
      activity: Record<string, unknown>;
    };

export function isCaseEmailMessageActivity(activity: Record<string, unknown> | null | undefined): boolean;

export function caseActivityToEmailMessage(
  activity: Record<string, unknown>,
  caseRecord?: Record<string, unknown> | null
): Record<string, unknown>;

export function formatCaseEmailTimelineStamp(
  date: string | Date | number,
  t: (key: string, params?: Record<string, unknown>) => string
): string;

export function getCaseEmailMessageAvatarUser(
  message: Record<string, unknown>,
  caseRecord?: Record<string, unknown> | null
): Record<string, unknown> | null;

export function getCaseEmailMessageBadge(
  message: Record<string, unknown>,
  options?: { isFirstInbound?: boolean }
): { key: string; tone: string };

export function formatCaseEmailSystemPill(
  activity: Record<string, unknown>,
  t: (key: string, params?: Record<string, unknown>) => string
): string;

export function buildCaseEmailConversationItems(options?: {
  activities?: Record<string, unknown>[];
  emailThreads?: Record<string, unknown>[];
  caseRecord?: Record<string, unknown> | null;
}): CaseEmailConversationItem[];

export function formatCaseSystemActivityLine(
  activity: Record<string, unknown>,
  options: { t: (key: string, params?: Record<string, unknown>) => string; formatTime: () => string }
): string;
