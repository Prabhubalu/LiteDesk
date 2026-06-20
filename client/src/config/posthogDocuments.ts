/**
 * PostHog events for Documents module (activation / usage).
 * Dynamic import only — same pattern as posthogOnboarding.ts.
 */
type PostHog = typeof import('posthog-js').default

let posthogModulePromise: Promise<PostHog> | null = null

function loadPosthog(): Promise<PostHog> | null {
  if (!import.meta.env.VITE_POSTHOG_KEY) return null
  if (!posthogModulePromise) {
    posthogModulePromise = import('posthog-js').then((m) => m.default)
  }
  return posthogModulePromise
}

function capture(event: string, properties: Record<string, unknown> = {}) {
  const loader = loadPosthog()
  if (!loader) return
  void loader.then((posthog) => {
    try {
      posthog.capture(event, properties)
    } catch {
      /* optional */
    }
  })
}

function oncePerSession(key: string): boolean {
  try {
    const storageKey = `ph-documents:${key}`
    if (sessionStorage.getItem(storageKey)) return false
    sessionStorage.setItem(storageKey, '1')
    return true
  } catch {
    return true
  }
}

export function captureDocumentsModuleVisited(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('module-visited')) return
  capture('documents_module_visited', extra)
}

export function captureDocumentUploaded(extra: Record<string, unknown> = {}) {
  capture('document_uploaded', extra)
}

export function captureDocumentLinkedToRecord(extra: Record<string, unknown> = {}) {
  capture('document_linked_to_record', extra)
}

export function captureDocumentCreated(extra: Record<string, unknown> = {}) {
  capture('document_created', extra)
}

export function captureDocumentsTimelineViewed(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('timeline-viewed')) return
  capture('documents_timeline_viewed', extra)
}

export function captureKnowledgeBaseViewed(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('knowledge-viewed')) return
  capture('documents_knowledge_base_viewed', extra)
}

export function capturePortalKnowledgeViewed(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('portal-knowledge-viewed')) return
  capture('portal_knowledge_base_viewed', extra)
}

export function captureDocumentVersionCompared(extra: Record<string, unknown> = {}) {
  capture('document_version_compared', extra)
}
