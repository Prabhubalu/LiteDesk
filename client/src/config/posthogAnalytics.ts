/**
 * PostHog events for Analytics platform.
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

export function captureAnalyticsReportCreated(extra: Record<string, unknown> = {}) {
  capture('analytics_report_created', extra);
}

export function captureAnalyticsReportPublished(extra: Record<string, unknown> = {}) {
  capture('analytics_report_published', extra);
}

export function captureAnalyticsReportExecuted(extra: Record<string, unknown> = {}) {
  capture('analytics_report_executed', extra);
}

export function captureAnalyticsReportDuplicated(extra: Record<string, unknown> = {}) {
  capture('analytics_report_duplicated', extra);
}

export function captureAnalyticsReportArchived(extra: Record<string, unknown> = {}) {
  capture('analytics_report_archived', extra);
}

export function captureAnalyticsModuleVisited(extra: Record<string, unknown> = {}) {
  capture('analytics_module_visited', extra);
}

export function captureAnalyticsWidgetCreated(extra: Record<string, unknown> = {}) {
  capture('analytics_widget_created', extra);
}

export function captureAnalyticsWidgetPublished(extra: Record<string, unknown> = {}) {
  capture('analytics_widget_published', extra);
}

export function captureAnalyticsWidgetExecuted(extra: Record<string, unknown> = {}) {
  capture('analytics_widget_executed', extra);
}

export function captureAnalyticsWidgetDuplicated(extra: Record<string, unknown> = {}) {
  capture('analytics_widget_duplicated', extra);
}

export function captureAnalyticsWidgetArchived(extra: Record<string, unknown> = {}) {
  capture('analytics_widget_archived', extra);
}

export function captureAnalyticsDashboardCreated(extra: Record<string, unknown> = {}) {
  capture('analytics_dashboard_created', extra);
}

export function captureAnalyticsDashboardPublished(extra: Record<string, unknown> = {}) {
  capture('analytics_dashboard_published', extra);
}

export function captureAnalyticsDashboardExecuted(extra: Record<string, unknown> = {}) {
  capture('analytics_dashboard_executed', extra);
}

export function captureAnalyticsDashboardDuplicated(extra: Record<string, unknown> = {}) {
  capture('analytics_dashboard_duplicated', extra);
}

export function captureAnalyticsDashboardArchived(extra: Record<string, unknown> = {}) {
  capture('analytics_dashboard_archived', extra);
}

export function captureAnalyticsDashboardWidgetAdded(extra: Record<string, unknown> = {}) {
  capture('analytics_dashboard_widget_added', extra);
}

export function captureAnalyticsDashboardDrillDown(extra: Record<string, unknown> = {}) {
  capture('analytics_dashboard_drill_down', extra);
}

export function captureAnalyticsHomeViewed(extra: Record<string, unknown> = {}) {
  capture('analytics_home_viewed', extra);
}

export function captureAnalyticsSearch(extra: Record<string, unknown> = {}) {
  capture('analytics_search', extra);
}

export function captureAnalyticsFavoriteToggled(extra: Record<string, unknown> = {}) {
  capture('analytics_favorite_toggled', extra);
}

export function captureAnalyticsTrashRestored(extra: Record<string, unknown> = {}) {
  capture('analytics_trash_restored', extra);
}

export function captureAnalyticsSettingsUpdated(extra: Record<string, unknown> = {}) {
  capture('analytics_settings_updated', extra);
}

export function captureAnalyticsScheduleCreated(extra: Record<string, unknown> = {}) {
  capture('analytics_schedule_created', extra);
}

export function captureAnalyticsScheduleRunNow(extra: Record<string, unknown> = {}) {
  capture('analytics_schedule_run_now', extra);
}

export function captureAnalyticsScheduleUpdated(extra: Record<string, unknown> = {}) {
  capture('analytics_schedule_updated', extra);
}

export function captureAnalyticsScheduleDeleted(extra: Record<string, unknown> = {}) {
  capture('analytics_schedule_deleted', extra);
}

export function captureAnalyticsSnapshotExported(extra: Record<string, unknown> = {}) {
  capture('analytics_snapshot_exported', extra);
}

export function captureAnalyticsAlertCreated(extra: Record<string, unknown> = {}) {
  capture('analytics_alert_created', extra);
}

export function captureAnalyticsAlertUpdated(extra: Record<string, unknown> = {}) {
  capture('analytics_alert_updated', extra);
}

export function captureAnalyticsAlertDeleted(extra: Record<string, unknown> = {}) {
  capture('analytics_alert_deleted', extra);
}

export function captureAnalyticsReportCertified(extra: Record<string, unknown> = {}) {
  capture('analytics_report_certified', extra);
}

export function captureAnalyticsReportUncertified(extra: Record<string, unknown> = {}) {
  capture('analytics_report_uncertified', extra);
}

export function captureAnalyticsReportViewed(extra: Record<string, unknown> = {}) {
  capture('analytics_report_viewed', extra);
}

export function captureAnalyticsApiTokenCreated(extra: Record<string, unknown> = {}) {
  capture('analytics_api_token_created', extra);
}

export function captureAnalyticsEmbedLinkCreated(extra: Record<string, unknown> = {}) {
  capture('analytics_embed_link_created', extra);
}
