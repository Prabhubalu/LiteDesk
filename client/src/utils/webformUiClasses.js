/**
 * Shared Tailwind utility classes for webform surfaces (hub, builder, public fill).
 */

export const WEBFORM_INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ' +
  'placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ' +
  'dark:border-gray-600 dark:bg-gray-800 dark:text-white';

export const WEBFORM_INPUT_READONLY_CLASS =
  'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 ' +
  'dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200';

export const WEBFORM_FIELD_INPUT_CLASS =
  'w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 dark:bg-gray-900 dark:text-white';

export const WEBFORM_FIELD_INPUT_FOCUS_CLASS =
  'border-gray-300 focus:border-[var(--wf-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--wf-accent)] dark:border-gray-600';

export const WEBFORM_FIELD_INPUT_ERROR_CLASS =
  'border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500';

export const WEBFORM_CHECKBOX_CLASS =
  'rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800';

export const WEBFORM_BTN_PRIMARY =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60';

export const WEBFORM_BTN_PRIMARY_SM =
  'inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700';

export const WEBFORM_BTN_SECONDARY =
  'rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ' +
  'dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60';

export const WEBFORM_BTN_GHOST =
  'rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 ' +
  'dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

export const WEBFORM_LINK_CLASS = 'text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400';

export const WEBFORM_LINK_SUBTLE_CLASS = 'hover:text-indigo-600 dark:hover:text-indigo-400';

export const WEBFORM_SPINNER_CLASS =
  'h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent';

export const WEBFORM_BUILDER_CANVAS_BG = 'bg-slate-100 dark:bg-gray-950/40';

export const WEBFORM_BRANDING_ROOT_CLASS = '[font-family:var(--wf-font-family)]';

export const WEBFORM_BRANDING_SURFACE_CLASS =
  'bg-[var(--wf-surface-bg)] [font-family:var(--wf-font-family)]';

export const WEBFORM_ACCENT_BG_CLASS = 'bg-[var(--wf-accent)]';

export const WEBFORM_ACCENT_CONTROL_CLASS = 'accent-[var(--wf-accent)]';

export const WEBFORM_PANEL_CLASS =
  'rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900';

export const WEBFORM_CARD_CLASS =
  'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800';

export const WEBFORM_CARD_HEADER_IMAGE_WRAP_CLASS = 'overflow-hidden rounded-t-xl';

export const WEBFORM_SECTION_TITLE_CLASS = 'text-sm font-semibold text-gray-900 dark:text-white';

export const WEBFORM_LABEL_CLASS = 'mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400';

export const WEBFORM_STEP_ACTIVE_CLASS = 'bg-indigo-600 text-white';

export const WEBFORM_STEP_COMPLETE_CLASS =
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300';

export const WEBFORM_STEP_IDLE_CLASS = 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';

export const WEBFORM_STEP_TEXT_ACTIVE_CLASS = 'text-indigo-600 dark:text-indigo-400';

export const WEBFORM_FIELD_SELECTED_CLASS =
  'border-indigo-500 bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/20';

export const WEBFORM_FIELD_LIBRARY_ITEM_CLASS =
  'flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-gray-100 px-2.5 py-2 text-left text-sm text-gray-700 ' +
  'transition hover:border-indigo-200 hover:bg-indigo-50 active:cursor-grabbing ' +
  'dark:border-gray-800 dark:text-gray-200 dark:hover:border-indigo-900/50 dark:hover:bg-indigo-950/30';

export const WEBFORM_SEARCH_INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

export const WEBFORM_MODAL_INPUT_CLASS =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ' +
  'placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ' +
  'dark:border-gray-600 dark:bg-gray-800 dark:text-white';

export const WEBFORM_DEVICE_TAB_ACTIVE_CLASS =
  'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400';

export const WEBFORM_MULTI_STEP_CHIP_ACTIVE_CLASS =
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300';

export const WEBFORM_THEMED_PRIMARY_BTN_CLASS =
  'bg-[var(--wf-accent)] text-white hover:opacity-90';
