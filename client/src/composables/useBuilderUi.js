/**
 * Shared builder surface classes — Arivu design tokens only (primary/neutral/success/danger).
 * Do not use raw gray-* or indigo-* in builder components.
 */
export function useBuilderUi() {
  return {
    shell: 'flex h-[calc(100vh-var(--tabbar-offset,4rem))] flex-col bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100',
    toolbar: 'shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900',
    panel: 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800',
    panelMuted: 'bg-neutral-50 dark:bg-neutral-900/80',
    border: 'border-neutral-200 dark:border-neutral-800',
    textMuted: 'text-neutral-500 dark:text-neutral-400',
    textSubtle: 'text-neutral-600 dark:text-neutral-300',
    heading: 'text-section-title text-neutral-900 dark:text-neutral-100',
    label: 'text-label text-neutral-500 dark:text-neutral-400',
    meta: 'text-meta text-neutral-500 dark:text-neutral-400 uppercase tracking-wide',
    input:
      'w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-value text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none',
    btnGhost:
      'inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors',
    btnPrimary:
      'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-40 transition-colors',
    btnIcon:
      'inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 disabled:opacity-40 transition-colors',
    tabActive: 'border-b-2 border-primary-600 text-primary-700 dark:text-primary-300',
    tabIdle: 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200',
    selectedRing: 'ring-2 ring-primary-500/50 border-primary-500 shadow-sm',
    selectedBg: 'bg-primary-50/80 dark:bg-primary-950/30',
    hoverRow: 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60',
    mergePill:
      'inline-flex items-center rounded-md bg-primary-100 dark:bg-primary-900/50 px-1.5 py-0.5 text-meta font-mono text-primary-700 dark:text-primary-300',
    canvasOuter: 'flex-1 overflow-auto bg-neutral-200/60 dark:bg-neutral-950 p-6 md:p-10',
    canvasPaper:
      'mx-auto rounded-sm bg-white text-neutral-900 shadow-lg ring-1 ring-neutral-200/80 dark:ring-neutral-700/50',
    canvasDoc:
      'cursor-text selection:bg-primary-100 dark:selection:bg-primary-900/40',
    emptyState: 'flex flex-col items-center justify-center gap-2 py-16 text-center text-helper text-neutral-500 dark:text-neutral-400'
  };
}
