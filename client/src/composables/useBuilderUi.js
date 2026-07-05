/**
 * Shared builder surface classes — Tailwind + Arivu design tokens.
 */
export function useBuilderUi() {
  return {
    shell: 'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100',
    toolbar: 'flex h-12 shrink-0 items-center gap-2 border-b border-neutral-200 bg-white px-3 dark:border-neutral-800 dark:bg-neutral-900 sm:px-4',
    toolbarCenter: 'hidden min-w-0 flex-1 items-center justify-center gap-3 md:flex',
    toolbarStatus: 'inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300',
    toolbarStatusSaved: 'text-success-700 dark:text-success-400',
    toolbarStatusSaving: 'text-warning-700 dark:text-warning-400',
    toolbarStatusDirty: 'text-warning-700 dark:text-warning-400',
    toolbarStatusError: 'text-danger-700 dark:text-danger-400',
    deviceGroup: 'inline-flex shrink-0 items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 dark:border-neutral-700 dark:bg-neutral-800/60',
    deviceBtn: 'inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100',
    deviceBtnActive: 'bg-white text-primary-700 shadow-sm dark:bg-neutral-900 dark:text-primary-300',
    iconRail: 'flex w-12 shrink-0 flex-col items-center gap-1 border-r border-neutral-200 bg-white py-2 dark:border-neutral-800 dark:bg-neutral-900',
    iconRailBtn: 'relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
    iconRailBtnActive: 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300',
    inspectorTabList: 'flex shrink-0 gap-1 border-b border-neutral-200 bg-white px-3 pt-2 dark:border-neutral-800 dark:bg-neutral-900',
    inspectorTab: 'rounded-t-lg px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/30',
    inspectorTabActive: 'border border-b-0 border-neutral-200 bg-neutral-50 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100',
    inspectorTabIdle: 'border border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
    inspectorBlockIcon: 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/80',
    segmentGroup: 'inline-flex w-full rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 dark:border-neutral-700 dark:bg-neutral-800/60',
    segmentBtn: 'flex flex-1 items-center justify-center rounded-md py-1.5 text-neutral-500 transition-colors hover:text-neutral-800 disabled:opacity-40 dark:text-neutral-400 dark:hover:text-neutral-100',
    segmentBtnActive: 'bg-white text-primary-700 shadow-sm dark:bg-neutral-900 dark:text-primary-300',
    rangeTrack: 'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-primary-600 dark:bg-neutral-700',
    workspaceTabList: 'flex shrink-0 items-center gap-1 border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900',
    workspaceTab: 'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30',
    workspaceTabActive: 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300',
    workspaceTabIdle: 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
    toolbarSection: 'flex min-w-0 items-center gap-1',
    toolbarDivider: 'mx-1 h-4 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700',
    toolbarActions: 'flex shrink-0 items-center gap-1 overflow-x-auto',
    panel: 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800',
    panelMuted: 'bg-neutral-50 dark:bg-neutral-900/80',
    border: 'border-neutral-200 dark:border-neutral-800',
    textMuted: 'text-neutral-500 dark:text-neutral-400',
    textSubtle: 'text-neutral-600 dark:text-neutral-300',
    heading: 'text-section-title text-neutral-900 dark:text-neutral-100',
    label: 'text-label text-neutral-500 dark:text-neutral-400',
    meta: 'text-meta text-neutral-500 dark:text-neutral-400 uppercase tracking-wide',
    input:
      'w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none',
    btnGhost:
      'inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md border border-neutral-200 px-2 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800',
    btnPrimary:
      'inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-40',
    btnSecondary:
      'inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800',
    btnIcon:
      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
    btnIconActive:
      'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100',
    tabList:
      'flex w-full shrink-0 gap-0.5 border-b border-neutral-200 bg-neutral-100/90 p-1 dark:border-neutral-800 dark:bg-neutral-900/80',
    tab:
      'relative flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/30',
    tabActive: 'bg-white text-primary-700 shadow-sm dark:bg-neutral-800 dark:text-primary-300',
    tabIdle: 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
    tabPanel: 'min-h-0 flex-1 overflow-y-auto p-3 focus:outline-none',
    disclosurePanel: 'space-y-3 pb-2 pt-1',
    menuItems:
      'absolute right-0 z-20 mt-1 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-neutral-900 dark:ring-white/10',
    menuItem:
      'block w-full px-3 py-1.5 text-left text-xs text-neutral-700 transition-colors dark:text-neutral-200',
    menuItemActive: 'bg-neutral-100 dark:bg-neutral-800',
    disclosureBtn:
      'mb-1.5 flex w-full items-center justify-between rounded-md px-1 py-0.5 text-left transition-colors hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60',
    disclosureTitle: 'text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400',
    blockCard:
      'flex cursor-grab flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3.5 text-center shadow-sm transition-all active:cursor-grabbing',
    blockCardEnabled:
      'hover:-translate-y-px hover:border-primary-300 hover:bg-white hover:shadow-md dark:hover:border-primary-600 dark:hover:bg-neutral-900',
    blockCardDisabled: 'cursor-not-allowed opacity-50',
    zoomBar:
      'pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-neutral-200 bg-white/95 p-0.5 shadow-md backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95',
    zoomBtn:
      'pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800',
    zoomLabel:
      'pointer-events-auto min-w-[2.75rem] rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800',
    zoomDivider: 'mx-0.5 h-3.5 w-px bg-neutral-200 dark:bg-neutral-700',
    selectedRing: 'ring-2 ring-primary-500/50 border-primary-500 shadow-sm',
    selectedBg: 'bg-primary-50/80 dark:bg-primary-950/30',
    hoverRow: 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60',
    mergePill:
      'inline-flex items-center rounded-md bg-primary-100 dark:bg-primary-900/50 px-1.5 py-0.5 text-meta font-mono text-primary-700 dark:text-primary-300',
    canvasOuter: 'h-full min-h-0 flex-1 overflow-auto bg-neutral-200/60 p-3 dark:bg-neutral-950 md:p-4',
    canvasPaper:
      'relative mx-auto min-h-full rounded-sm bg-white shadow-lg ring-1 ring-neutral-200/80 transition-transform duration-150 dark:ring-neutral-700/50',
    canvasDoc:
      'cursor-text selection:bg-primary-100 dark:selection:bg-primary-900/40',
    emptyState: 'flex flex-col items-center justify-center gap-2 py-16 text-center text-helper text-neutral-500 dark:text-neutral-400',
    badgeEmail: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
    badgeDefault: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
    saveDotSaved: 'bg-success-500',
    saveDotSaving: 'bg-warning-400 animate-pulse',
    saveDotDirty: 'bg-warning-500',
    saveDotError: 'bg-danger-500'
  };
}
