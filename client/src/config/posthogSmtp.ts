/**
 * PostHog events for SMTP setup wizard.
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

export function captureSmtpWizardStarted(extra: Record<string, unknown> = {}) {
  capture('smtp_wizard_started', extra);
}

export function captureSmtpProviderDetected(extra: Record<string, unknown> = {}) {
  capture('smtp_provider_detected', extra);
}

export function captureSmtpConnectionTestStarted(extra: Record<string, unknown> = {}) {
  capture('smtp_connection_test_started', extra);
}

export function captureSmtpConnectionSuccess(extra: Record<string, unknown> = {}) {
  capture('smtp_connection_success', extra);
}

export function captureSmtpConnectionFailure(extra: Record<string, unknown> = {}) {
  capture('smtp_connection_failure', extra);
}

export function captureSmtpWizardCompleted(extra: Record<string, unknown> = {}) {
  capture('smtp_wizard_completed', extra);
}

export function captureSmtpWizardDropOff(extra: Record<string, unknown> = {}) {
  capture('smtp_wizard_drop_off', extra);
}
