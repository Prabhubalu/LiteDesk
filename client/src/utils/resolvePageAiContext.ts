import type { RouteLocationNormalizedLoaded } from 'vue-router';

export type PageAiContextKind = 'record' | 'list';

export type PageAiContext = {
  kind: PageAiContextKind;
  moduleKey: string;
  appKey: string;
  /** Present when kind === 'record' */
  recordId?: string;
};

const APP_KEY_BY_MODULE: Record<string, string> = {
  people: 'SALES',
  organizations: 'SALES',
  deals: 'SALES',
  tasks: 'SALES',
  events: 'SALES',
  quotes: 'SALES',
  items: 'INVENTORY',
  cases: 'HELPDESK',
  responses: 'AUDIT',
};

const PATH_MODULE_PREFIXES: Array<{ prefix: string; moduleKey: string }> = [
  { prefix: '/people', moduleKey: 'people' },
  { prefix: '/contacts', moduleKey: 'people' },
  { prefix: '/organizations', moduleKey: 'organizations' },
  { prefix: '/deals', moduleKey: 'deals' },
  { prefix: '/tasks', moduleKey: 'tasks' },
  { prefix: '/events', moduleKey: 'events' },
  { prefix: '/quotes', moduleKey: 'quotes' },
  { prefix: '/items', moduleKey: 'items' },
  { prefix: '/cases', moduleKey: 'cases' },
];

function moduleKeyFromPath(path: string): string {
  const normalized = String(path || '').split('?')[0] || '';
  for (const row of PATH_MODULE_PREFIXES) {
    if (normalized === row.prefix || normalized.startsWith(`${row.prefix}/`)) {
      return row.moduleKey;
    }
  }
  return '';
}

function resolveAppKey(moduleKey: string, route: RouteLocationNormalizedLoaded): string {
  const metaApp = String(route.meta?.appKey || '').trim().toUpperCase();
  return metaApp || APP_KEY_BY_MODULE[moduleKey] || 'SALES';
}

/**
 * Resolve CRM page context for Arivu Assistant Ask.
 * - Record detail → work-graph Ask
 * - Module list → page stats (counts) + KB fallback
 */
export function resolvePageAiContext(
  route: RouteLocationNormalizedLoaded,
): PageAiContext | null {
  const pathModule = moduleKeyFromPath(String(route.path || ''));
  const moduleKey = String(route.meta?.moduleKey || pathModule || '')
    .trim()
    .toLowerCase();
  if (!moduleKey) return null;

  const recordId = String(
    route.params?.id
    || route.params?.recordId
    || '',
  ).trim();
  const appKey = resolveAppKey(moduleKey, route);

  if (recordId && recordId !== 'new') {
    return { kind: 'record', moduleKey, recordId, appKey };
  }

  // List / create / other module surfaces without a record id
  if (pathModule || route.meta?.moduleKey) {
    return { kind: 'list', moduleKey, appKey };
  }

  return null;
}

/** @deprecated Use resolvePageAiContext; kept for callers expecting record-only. */
export function resolvePageAiRecordContext(
  route: RouteLocationNormalizedLoaded,
): (PageAiContext & { recordId: string }) | null {
  const ctx = resolvePageAiContext(route);
  if (!ctx || ctx.kind !== 'record' || !ctx.recordId) return null;
  return { ...ctx, recordId: ctx.recordId };
}
