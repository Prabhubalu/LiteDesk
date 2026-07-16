/**
 * PostHog events for Blog / Content Studio.
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
    const storageKey = `ph-blog:${key}`;
    if (sessionStorage.getItem(storageKey)) return false;
    sessionStorage.setItem(storageKey, '1');
    return true;
  } catch {
    return true;
  }
}

export function captureBlogModuleVisited(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('module-visited')) return;
  capture('blog_module_visited', extra);
}

export function captureBlogAddonInstalled(extra: Record<string, unknown> = {}) {
  capture('blog_addon_installed', extra);
}

export function captureBlogPostCreated(extra: Record<string, unknown> = {}) {
  capture('blog_post_created', extra);
}

export function captureBlogPostPublished(extra: Record<string, unknown> = {}) {
  capture('blog_post_published', extra);
}

export function captureBlogPostSaved(extra: Record<string, unknown> = {}) {
  capture('blog_post_saved', extra);
}
