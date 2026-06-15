/** Matches AppSidebar.vue desktop widths (rem at document root). */
export const SIDEBAR_PANEL_WIDTH_EXPANDED_REM = 13.75;
export const SIDEBAR_PANEL_WIDTH_COLLAPSED_REM = 3.5;

/** p-2 shell inset around floating shell panels (sidebar + work column). */
export const SIDEBAR_SHELL_PADDING_REM = 0.5;

/** Shared floating panel chrome (sidebar card + work column). */
export const SHELL_FLOATING_SURFACE_CLASS =
  'rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.1)] dark:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.4)]';

/** Light: brand primary surface. Dark: neutral-950 chrome (content stays neutral-900). */
export const SIDEBAR_FLOATING_SURFACE_CLASS = `${SHELL_FLOATING_SURFACE_CLASS} rounded-lg bg-primary-800 dark:bg-neutral-950`;

export const WORK_PANEL_SURFACE_CLASS = `${SHELL_FLOATING_SURFACE_CLASS} bg-white dark:bg-neutral-900`;

/** Nested rail inside the work panel (Inbox folders) — floating card on lg+ only. */
export const NESTED_PANEL_FLOATING_LG_CLASS =
  'lg:rounded-xl lg:overflow-hidden lg:border lg:border-neutral-200 lg:dark:border-neutral-700 lg:shadow-[0_2px_12px_-4px_rgba(15,23,42,0.1)] lg:dark:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.4)]';

export const INBOX_SIDEBAR_SURFACE_CLASS = 'bg-neutral-100 dark:bg-neutral-950';

/** Teleport target for drawers scoped to the work panel content area (PlatformShell). */
export const PLATFORM_WORKSPACE_DRAWER_HOST_ID = 'platform-workspace-drawer-host';

function rootFontSizePx(): number {
  if (typeof document === 'undefined') return 16;
  const parsed = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16;
}

export function sidebarPanelWidthPx(collapsed: boolean): number {
  const rem = collapsed ? SIDEBAR_PANEL_WIDTH_COLLAPSED_REM : SIDEBAR_PANEL_WIDTH_EXPANDED_REM;
  return rem * rootFontSizePx();
}

/** Left offset where tab bar / main column begins (inset + panel + inset). */
export function sidebarMainColumnOffsetPx(collapsed: boolean): number {
  const shellPaddingPx = SIDEBAR_SHELL_PADDING_REM * 2 * rootFontSizePx();
  return shellPaddingPx + sidebarPanelWidthPx(collapsed);
}
