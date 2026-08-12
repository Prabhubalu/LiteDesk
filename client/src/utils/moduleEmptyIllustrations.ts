import { normalizeModuleKey } from '@/utils/moduleIcons';

/** Filename (no path/ext) under /assets/illustrations — keyed by normalized module key. */
const MODULE_EMPTY_ILLUSTRATION_FILES: Record<string, string> = {
  cases: 'cases',
  deals: 'deals',
  events: 'events',
  forms: 'forms',
  inbox: 'inbox',
  invoices: 'invoice',
  invoice: 'invoice',
  items: 'items',
  organizations: 'organizations',
  people: 'people',
  quotes: 'quotes',
  responses: 'response',
  response: 'response',
  sales_orders: 'salesorder',
  salesorder: 'salesorder',
  tasks: 'tasks',
  import: 'import',
};

const DEFAULT_EMPTY_ILLUSTRATION = 'empty_state';
const SEARCH_EMPTY_ILLUSTRATION = 'search';

function illustrationSrc(file: string): string {
  return `/assets/illustrations/${file}.svg`;
}

/**
 * Module list empty-state artwork.
 * Use `noMatch` for search/filter empty (search.svg); otherwise map by module SVG name.
 */
export function getModuleEmptyIllustrationSrc(
  moduleKey?: string,
  options?: { noMatch?: boolean }
): string {
  if (options?.noMatch) {
    return illustrationSrc(SEARCH_EMPTY_ILLUSTRATION);
  }
  const key = normalizeModuleKey(moduleKey);
  const file = MODULE_EMPTY_ILLUSTRATION_FILES[key] || DEFAULT_EMPTY_ILLUSTRATION;
  return illustrationSrc(file);
}
