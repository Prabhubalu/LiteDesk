export interface CaseCannedResponseContext {
  case: {
    id: string;
    caseId: string;
    title: string;
    status: string;
    priority: string;
    channel: string;
  };
  contact: {
    firstName: string;
    name: string;
    email: string;
  };
  agent: {
    name: string;
    email: string;
  };
}

export function buildCaseCannedResponseContext(options?: {
  caseRecord?: Record<string, unknown> | null;
  agentUser?: Record<string, unknown> | null;
  contactEmail?: string;
}): CaseCannedResponseContext;

export function applyCaseCannedResponseTokens(
  template: string,
  context: Record<string, unknown>
): string;

export function resolveCannedResponse(
  item: { subject?: string; body?: string } | null | undefined,
  context: Record<string, unknown>
): { subject: string; body: string };
