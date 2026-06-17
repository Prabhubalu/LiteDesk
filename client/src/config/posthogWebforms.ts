/**
 * PostHog Webforms activation events.
 */

type PostHog = typeof import('posthog-js').default;

let posthogModulePromise: Promise<PostHog> | null = null;

function loadPosthog(): Promise<PostHog> | null {
  if (!import.meta.env.VITE_POSTHOG_KEY) return null;
  if (!posthogModulePromise) {
    posthogModulePromise = import('posthog-js').then((m) => m.default);
  }
  return posthogModulePromise;
}

function capture(event: string, properties: Record<string, unknown> = {}) {
  const loader = loadPosthog();
  if (!loader) return;
  void loader.then((posthog) => {
    try {
      posthog.capture(event, properties);
    } catch {
      /* optional */
    }
  });
}

function oncePerSession(key: string): boolean {
  try {
    const storageKey = `ph-webforms:${key}`;
    if (sessionStorage.getItem(storageKey)) return false;
    sessionStorage.setItem(storageKey, '1');
    return true;
  } catch {
    return true;
  }
}

export function captureWebformsSettingsViewed(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('settings-viewed')) return;
  capture('webforms_settings_viewed', extra);
}

export function captureWebformPublished(
  webform: { _id?: string; webformId?: string; slug?: string },
  extra: Record<string, unknown> = {}
) {
  capture('webform_published', {
    webform_id: webform._id,
    webform_code: webform.webformId,
    slug: webform.slug,
    ...extra
  });
}

export function captureWebformPublicViewed(
  slug: string,
  extra: Record<string, unknown> = {}
) {
  capture('webform_public_viewed', { slug, ...extra });
}

export function captureWebformSubmitted(
  payload: {
    slug?: string;
    webformId?: string;
    submissionId?: string;
    crmAction?: string | null;
    dedupMatched?: boolean;
  },
  extra: Record<string, unknown> = {}
) {
  capture('webform_submitted', {
    slug: payload.slug,
    webform_id: payload.webformId,
    submission_id: payload.submissionId,
    crm_action: payload.crmAction,
    dedup_matched: payload.dedupMatched === true,
    ...extra
  });
  if (payload.crmAction === 'created') {
    capture('webform_crm_created', {
      slug: payload.slug,
      webform_id: payload.webformId,
      submission_id: payload.submissionId,
      ...extra
    });
  }
  if (payload.dedupMatched) {
    capture('webform_dedup_hit', {
      slug: payload.slug,
      webform_id: payload.webformId,
      submission_id: payload.submissionId,
      ...extra
    });
  }
}
