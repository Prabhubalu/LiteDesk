/**
 * PostHog events for template HTML import.
 * Dynamic import only — same pattern as posthogReleaseNotes.ts.
 */

type PostHog = typeof import('posthog-js').default;

let posthogModulePromise: Promise<PostHog> | null = null;

function loader(): Promise<PostHog> {
  if (!posthogModulePromise) {
    posthogModulePromise = import('posthog-js').then((m) => m.default);
  }
  return posthogModulePromise;
}

function capture(event: string, properties: Record<string, unknown> = {}) {
  void loader().then((posthog) => {
    try {
      posthog.capture(event, properties);
    } catch {
      // analytics must not block UX
    }
  });
}

export function captureEmailTemplateImportStarted(extra: Record<string, unknown> = {}) {
  capture('email_template_import_started', extra);
}

export function captureEmailTemplateImportCompleted(extra: Record<string, unknown> = {}) {
  capture('email_template_import_completed', extra);
}

export function captureEmailTemplateHtmlModeEntered(extra: Record<string, unknown> = {}) {
  capture('email_template_html_mode_entered', extra);
}

export function captureEmailTemplateMergeMappingsSaved(extra: Record<string, unknown> = {}) {
  capture('email_template_merge_mappings_saved', extra);
}

export function captureEmailTemplateExported(extra: Record<string, unknown> = {}) {
  capture('email_template_exported', extra);
}
