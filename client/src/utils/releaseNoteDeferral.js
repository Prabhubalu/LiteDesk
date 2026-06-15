/**
 * When auto surfacing What's New must be deferred (onboarding route only).
 * Router already redirects incomplete founders to /onboarding.
 * @param {{ routePath?: string }} input
 * @returns {boolean}
 */
export function shouldBlockReleaseNotesAutoSurface({ routePath = '' } = {}) {
  return String(routePath).startsWith('/onboarding');
}
