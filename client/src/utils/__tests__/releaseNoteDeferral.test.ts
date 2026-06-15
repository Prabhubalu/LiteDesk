import { describe, expect, it } from 'vitest';
import { shouldBlockReleaseNotesAutoSurface } from '../releaseNoteDeferral';

describe('shouldBlockReleaseNotesAutoSurface', () => {
  it('blocks on onboarding route', () => {
    expect(
      shouldBlockReleaseNotesAutoSurface({ routePath: '/onboarding' })
    ).toBe(true);
  });

  it('allows platform routes even when onboarding API suggests redirect', () => {
    expect(
      shouldBlockReleaseNotesAutoSurface({ routePath: '/platform/home' })
    ).toBe(false);
  });

  it('allows sales routes', () => {
    expect(
      shouldBlockReleaseNotesAutoSurface({ routePath: '/people' })
    ).toBe(false);
  });
});
