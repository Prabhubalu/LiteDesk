/**
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const REDUCED_MOTION = {
  enter: '',
  enterFrom: '',
  enterTo: '',
  leave: '',
  leaveFrom: '',
  leaveTo: '',
  panelEnter: '',
  panelEnterFrom: '',
  panelEnterTo: '',
  panelLeave: '',
  panelLeaveFrom: '',
  panelLeaveTo: ''
};

/**
 * @param {'modal' | 'drawer'} variant
 * @returns {Record<string, string>}
 */
export function getReleaseNoteSurfaceMotion(variant = 'modal') {
  if (prefersReducedMotion()) return { ...REDUCED_MOTION };

  const backdrop = {
    enter: 'ease-out duration-200',
    enterFrom: 'opacity-0',
    enterTo: 'opacity-100',
    leave: 'ease-in duration-150',
    leaveFrom: 'opacity-100',
    leaveTo: 'opacity-0'
  };

  if (variant === 'drawer') {
    return {
      ...backdrop,
      panelEnter: 'transform transition ease-in-out duration-300',
      panelEnterFrom: 'translate-x-full',
      panelEnterTo: 'translate-x-0',
      panelLeave: 'transform transition ease-in-out duration-300',
      panelLeaveFrom: 'translate-x-0',
      panelLeaveTo: 'translate-x-full'
    };
  }

  return {
    ...backdrop,
    panelEnter: 'ease-out duration-200',
    panelEnterFrom: 'opacity-0 translate-y-4 sm:scale-95',
    panelEnterTo: 'opacity-100 translate-y-0 sm:scale-100',
    panelLeave: 'ease-in duration-150',
    panelLeaveFrom: 'opacity-100 translate-y-0 sm:scale-100',
    panelLeaveTo: 'opacity-0 translate-y-4 sm:scale-95'
  };
}

/** Shared panel classes for mobile full-screen sheets. */
export const RELEASE_NOTE_MODAL_PANEL_CLASS =
  'relative flex max-h-[min(90vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900 max-md:fixed max-md:inset-0 max-md:h-full max-md:max-h-none max-md:max-w-none max-md:rounded-none';

export const RELEASE_NOTE_DRAWER_PANEL_CLASS =
  'pointer-events-auto flex h-full w-screen max-w-xl flex-col bg-white shadow-xl dark:bg-gray-900 max-md:max-w-none';

export const RELEASE_NOTE_CENTER_PANEL_CLASS =
  'pointer-events-auto flex h-full w-screen max-w-2xl flex-col bg-white shadow-xl dark:bg-gray-900 max-md:max-w-none';

export const RELEASE_NOTE_DRAWER_HOST_CLASS =
  'pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16 max-md:pl-0';
