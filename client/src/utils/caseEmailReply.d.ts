export function isEmailChannelCase(caseRecord: { channel?: string } | null | undefined): boolean;

export function extractEmailFromActorName(actorName: string | null | undefined): string;

export function resolveCaseReplyToEmail(options?: {
  caseRecord?: Record<string, unknown> | null;
  contactEmail?: string;
  emailThreads?: Record<string, unknown>[];
  activities?: Record<string, unknown>[] | null;
}): string;

export function buildCaseEmailReplyDraft(options: {
  caseRecord?: Record<string, unknown> | null;
  contactEmail?: string;
  emailThreads?: Record<string, unknown>[];
}): {
  to: string;
  subject: string;
  parentCommunicationId: string | null;
  body?: string;
};

export function buildCaseEmailReplyFromMessage(
  message: Record<string, unknown>,
  options?: Record<string, unknown>
): Record<string, unknown>;

export function htmlBodyHasText(html: string | null | undefined): boolean;
