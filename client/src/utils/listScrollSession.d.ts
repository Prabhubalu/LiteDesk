export declare const LIST_SESSION_RESTORE_KEY: unique symbol;

export declare const LIST_SESSION_SCROLL_CONCEAL_KEY: unique symbol;

export declare const LIST_SESSION_PAGES_READY_KEY: unique symbol;

export interface ListSessionState {
  scrollTop?: number;
  currentPage?: number;
  savedAt?: number;
}

export function getListSessionKey(
  moduleKey: string,
  appKey: string,
  path: string,
  scope?: string
): string;

export function getListSession(key: string | null | undefined): ListSessionState | null;

export function patchListSession(
  key: string | null | undefined,
  patch: Partial<ListSessionState>
): void;

export function clearListSession(key: string | null | undefined): void;

export function clearListSessionsForRoutePath(routePath: string | null | undefined): void;
