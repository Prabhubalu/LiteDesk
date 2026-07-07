/**
 * PostHog events for Articles / Content Studio.
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
    const storageKey = `ph-articles:${key}`;
    if (sessionStorage.getItem(storageKey)) return false;
    sessionStorage.setItem(storageKey, '1');
    return true;
  } catch {
    return true;
  }
}

export function captureArticlesModuleVisited(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('module-visited')) return;
  capture('articles_module_visited', extra);
}

export function captureArticlesAddonInstalled(extra: Record<string, unknown> = {}) {
  capture('articles_addon_installed', extra);
}

export function captureArticleCreated(extra: Record<string, unknown> = {}) {
  capture('article_created', extra);
}

export function captureArticleSaved(extra: Record<string, unknown> = {}) {
  capture('article_saved', extra);
}

export function captureArticlePublished(extra: Record<string, unknown> = {}) {
  capture('article_published', extra);
}

export function captureArticlePreviewed(extra: Record<string, unknown> = {}) {
  capture('article_previewed', extra);
}

export function captureCaseKnowledgeSuggestionOpened(extra: Record<string, unknown> = {}) {
  capture('case_knowledge_suggestion_opened', extra);
}

export function captureHeadlessHelpViewed(extra: Record<string, unknown> = {}) {
  capture('headless_help_viewed', extra);
}
