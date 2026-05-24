/**
 * Missing-translation and locale-load telemetry (staging / dev).
 */

export type I18nTelemetryEvent =
  | { type: 'missing_key'; key: string; locale: string; fallbackLocale: string }
  | { type: 'fallback_used'; key: string; locale: string }
  | { type: 'locale_load_failed'; locale: string; error: string }
  | { type: 'untranslated_screen'; route: string; locale: string; hardcodedCount: number };

type TelemetryListener = (event: I18nTelemetryEvent) => void;

const listeners = new Set<TelemetryListener>();
const recentEvents: I18nTelemetryEvent[] = [];
const MAX_RECENT = 200;

let telemetryEnabled = false;

export function isI18nTelemetryEnabled(): boolean {
  if (telemetryEnabled) return true;
  if (import.meta.env.PROD) return false;
  try {
    return localStorage.getItem('arivu:i18n:telemetry') === '1';
  } catch {
    return false;
  }
}

export function setI18nTelemetryEnabled(enabled: boolean): void {
  telemetryEnabled = enabled;
  try {
    if (enabled) {
      localStorage.setItem('arivu:i18n:telemetry', '1');
    } else {
      localStorage.removeItem('arivu:i18n:telemetry');
    }
  } catch {
    /* ignore */
  }
}

export function onI18nTelemetry(listener: TelemetryListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecentI18nTelemetry(): readonly I18nTelemetryEvent[] {
  return recentEvents;
}

export function trackI18nEvent(event: I18nTelemetryEvent): void {
  if (!isI18nTelemetryEnabled() && event.type !== 'locale_load_failed') {
    return;
  }

  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT) {
    recentEvents.shift();
  }

  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* ignore listener errors */
    }
  }

  if (import.meta.env.DEV || import.meta.env.VITE_I18N_TELEMETRY === 'true') {
    console.warn('[i18n:telemetry]', event);
  }
}

export function clearI18nTelemetry(): void {
  recentEvents.length = 0;
}
