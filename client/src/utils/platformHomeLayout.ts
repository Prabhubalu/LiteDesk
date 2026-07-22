/**
 * Platform Home elevation system — three tiers, shared tokens.
 *
 * Surface  — every top-level block (sections, cards, alerts, skeletons)
 * Inset    — fields inside a surface (search)
 * Popover  — floating UI (dropdown menus)
 * Flat     — chips / pills — border only, never shadow
 */

const SURFACE_BORDER =
  'border border-neutral-900/[0.06] dark:border-white/[0.08]';

const SURFACE_SHADOW =
  'shadow-[0_1px_2px_rgba(15,23,42,0.05),0_6px_16px_-4px_rgba(15,23,42,0.08),inset_0_1px_0_0_rgba(255,255,255,0.85)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_10px_28px_-12px_rgba(0,0,0,0.45)]';

const SURFACE_ELEVATION = [SURFACE_BORDER, SURFACE_SHADOW].join(' ');

const POPOVER_SHADOW =
  'shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.03),0_0_0_1px_rgba(15,23,42,0.03)] dark:shadow-[0_12px_28px_-10px_rgba(0,0,0,0.42),0_0_0_1px_rgba(255,255,255,0.06)]';

const INSET_SHADOW =
  'shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none';

/** Collapsible section wells (Today, Your apps). */
export const PLATFORM_HOME_SECTION_CLASS = [
  'overflow-hidden rounded-2xl bg-white',
  SURFACE_ELEVATION,
  'dark:bg-neutral-800/55'
].join(' ');

export const PLATFORM_HOME_SECTION_DIVIDER_CLASS =
  'border-t border-neutral-200/50 dark:border-white/[0.07]';

/** Primary cards (intent bar, workspace columns, empty state). */
export const PLATFORM_HOME_CARD_CLASS = [
  'rounded-2xl bg-white',
  SURFACE_ELEVATION,
  'dark:bg-neutral-800/55'
].join(' ');

export const PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS =
  'border-b border-neutral-100/90 dark:border-white/[0.07]';

/** Intent bar overlay (pairs with PLATFORM_HOME_CARD_CLASS) — solid white, no tint. */
export const PLATFORM_HOME_INTENT_GRADIENT_CLASS = '';

/** Loading placeholders — same elevation as content blocks. */
export const PLATFORM_HOME_SKELETON_CLASS = [
  'rounded-2xl bg-neutral-100 animate-pulse',
  SURFACE_ELEVATION,
  'dark:bg-neutral-800/80'
].join(' ');

/** Inline alerts between sections. */
export const PLATFORM_HOME_ALERT_ERROR_CLASS = [
  'rounded-2xl border-danger-200/80 bg-danger-50',
  SURFACE_SHADOW,
  'dark:border-danger-600 dark:bg-danger-900/35'
].join(' ');

export const PLATFORM_HOME_ALERT_WARNING_CLASS = [
  'rounded-2xl border-warning-200/80 bg-warning-50',
  SURFACE_SHADOW,
  'dark:border-warning-600 dark:bg-warning-900/35'
].join(' ');

/** Inset controls on home cards (search field). */
export const PLATFORM_HOME_INSET_CONTROL_CLASS = [
  'border border-neutral-200/55 bg-white shadow-none',
  INSET_SHADOW,
  'dark:border-white/[0.10] dark:bg-neutral-900/50'
].join(' ');

/** Primary action button — flat inside an elevated surface. */
export const PLATFORM_HOME_PRIMARY_BUTTON_CLASS = 'shadow-none';

/** Create menu dropdown — popover tier. */
export const PLATFORM_HOME_DROPDOWN_CLASS = POPOVER_SHADOW;

/** Chips and app pills — never carry elevation. */
export const PLATFORM_HOME_FLAT_CHIP_CLASS = 'shadow-none';

/** Default visible rows in Up next / Recent before internal scroll. */
export const PLATFORM_HOME_LIST_VISIBLE_ROWS = 5;

/** ~5 compact rows visible; scroll within card when list is longer. */
export const PLATFORM_HOME_LIST_SCROLL_CLASS =
  'min-h-0 max-h-[16.25rem] overflow-y-auto overscroll-y-contain arivu-scrollbar';
