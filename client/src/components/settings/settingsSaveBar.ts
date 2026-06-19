/** Bottom padding for scroll panels when the floating save bar is visible. */
export const SETTINGS_SAVE_BAR_CONTENT_CLASS = 'pb-28';

/** Top padding below the sticky settings header before scroll content. */
export const SETTINGS_HEADER_CONTENT_GAP_CLASS = 'pt-5';

/** Page title — Arivu page-title role + neutral foreground. */
export const SETTINGS_PAGE_TITLE_CLASS =
  'text-page-title text-neutral-900 dark:text-neutral-100';

/** Page subtitle / helper copy under the title. */
export const SETTINGS_PAGE_SUBTITLE_CLASS =
  'mt-1 text-helper text-neutral-600 dark:text-neutral-400';

/** In-page section headings (cards, sub-panels). */
export const SETTINGS_SECTION_TITLE_CLASS =
  'text-section-title text-neutral-900 dark:text-neutral-100';

/** Secondary section label (e.g. WORKSPACE in the settings rail). */
export const SETTINGS_RAIL_SECTION_LABEL_CLASS =
  'px-2.5 py-1.5 text-[0.75rem] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400';

/** Shared settings rail nav item layout. */
export const SETTINGS_RAIL_ITEM_BASE_CLASS =
  'flex h-[2rem] w-full items-center gap-[0.5rem] rounded-lg px-[0.5rem] py-[0.375rem] text-[0.875rem] leading-tight transition-colors';

/** Collapsed rail: fixed width so icon keeps the same horizontal padding. */
export const SETTINGS_RAIL_ITEM_COLLAPSED_CLASS =
  '!w-[calc(0.5rem+1.125rem+0.5rem)] shrink-0 gap-0';

export const SETTINGS_RAIL_ITEM_ACTIVE_CLASS =
  'bg-neutral-100 text-neutral-900 dark:bg-white/5 dark:text-neutral-100';

export const SETTINGS_RAIL_ITEM_INACTIVE_CLASS =
  'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-neutral-100';

/** Landing / overview cards inside settings. */
export const SETTINGS_OVERVIEW_CARD_CLASS =
  'cursor-pointer rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-primary-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-primary-600';
