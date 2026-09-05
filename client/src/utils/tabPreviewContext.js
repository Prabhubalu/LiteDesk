import { resolveModuleDisplayName } from '@/utils/configurableLabelResolver';
import { formatHelpdeskTabAlertLabel } from '@/utils/helpdeskTabAlerts';
import {
  getAppNameKey,
  getModuleLabelKey,
  isRecordDetailTabPath,
  pathSegments,
  resolveTabTitle,
  ROUTE_TITLE_KEYS,
} from '@/utils/navigationLabels';

/** Infer app registry key from a tab path. */
export function inferAppKeyFromPath(path) {
  const pathOnly = String(path || '').split('?')[0].split('#')[0];
  if (pathOnly.startsWith('/helpdesk/')) return 'HELPDESK';
  if (pathOnly.startsWith('/audit/')) return 'AUDIT';
  if (pathOnly.startsWith('/portal/')) return 'PORTAL';
  if (pathOnly.startsWith('/projects/')) return 'PROJECTS';
  if (pathOnly.startsWith('/sales/') || pathOnly === '/dashboard/sales') return 'SALES';
  if (pathOnly.startsWith('/dashboard/')) {
    const appSegment = pathSegments(pathOnly)[1];
    return appSegment ? appSegment.toUpperCase() : 'SALES';
  }
  const first = pathSegments(pathOnly)[0];
  if (first && getModuleLabelKey(first)) return 'SALES';
  return null;
}

function localizedAppLabel(path, t, te) {
  const appKey = inferAppKeyFromPath(path);
  if (!appKey) return '';
  const nameKey = getAppNameKey(appKey);
  return nameKey && te(nameKey) ? t(nameKey) : '';
}

function localizedModuleContext(path, t, te) {
  const pathOnly = String(path || '').split('?')[0].split('#')[0];
  const segments = pathSegments(pathOnly);

  if (pathOnly.startsWith('/settings')) {
    return te('navigation.settings') ? t('navigation.settings') : '';
  }
  if (pathOnly.startsWith('/control')) {
    return te('navigation.userControlPanel') ? t('navigation.userControlPanel') : '';
  }
  if (pathOnly === '/platform/home' || pathOnly.startsWith('/platform/home/')) {
    return te('navigation.home') ? t('navigation.home') : '';
  }
  if (pathOnly.startsWith('/helpdesk/cases')) {
    return te('navigation.moduleCases') ? t('navigation.moduleCases') : '';
  }
  if (segments[0] === 'forms' && segments[2] === 'responses') {
    return te('navigation.moduleResponses') ? t('navigation.moduleResponses') : '';
  }

  const moduleKey = segments[0];
  if (moduleKey && getModuleLabelKey(moduleKey)) {
    return resolveModuleDisplayName(moduleKey, t, te);
  }

  const titleKey = ROUTE_TITLE_KEYS[pathOnly] || ROUTE_TITLE_KEYS[`/${moduleKey || ''}`];
  if (titleKey && te(titleKey)) return t(titleKey);
  return '';
}

function buildSecondaryLine({ path, isRecord, moduleLabel, appLabel, primary }) {
  if (isRecord) {
    return [moduleLabel, appLabel].filter(Boolean).join(' · ');
  }
  if (appLabel && appLabel !== primary) return appLabel;
  if (moduleLabel && moduleLabel !== primary) return moduleLabel;
  return '';
}

/**
 * Rich hover context for a tab (Chrome-style preview card content).
 * @param {object} tab
 * @param {(key: string, params?: object) => string} t
 * @param {(key: string) => boolean} [te]
 */
export function getTabPreviewContext(tab, t, te = () => false) {
  const path = tab?.path || '';
  const primary = tab?.alertBaseTitle || resolveTabTitle(tab, t, te);
  const isRecord = isRecordDetailTabPath(path);
  const moduleLabel = localizedModuleContext(path, t, te);
  const appLabel = localizedAppLabel(path, t, te);
  const secondary = buildSecondaryLine({ path, isRecord, moduleLabel, appLabel, primary });
  const tertiary = String(tab?.previewMeta?.subtitle || '').trim();

  const alertLines = [];
  if (Array.isArray(tab?.alertSegments)) {
    for (const seg of tab.alertSegments) {
      const count = Math.max(1, Number(seg.count) || 1);
      if (seg.kind === 'internal') {
        alertLines.push({
          kind: 'chat',
          label: count > 1
            ? t('internalChat.tabUnread', { count })
            : t('internalChat.tabUnreadOne'),
        });
        continue;
      }
      if (seg.kind === 'mention') {
        alertLines.push({
          kind: 'chat',
          label: count > 1
            ? t('internalChat.tabMentions', { count })
            : t('internalChat.tabMention'),
        });
        continue;
      }
      const kind = seg.kind === 'chat' || seg.kind === 'session'
        ? 'chat'
        : seg.kind === 'case'
          ? 'case'
          : 'email';
      alertLines.push({
        kind,
        label: formatHelpdeskTabAlertLabel(kind, seg.count, t),
      });
    }
  }

  return { primary, secondary, tertiary, alertLines, isRecord };
}

/** Whether the title element is visually truncated. */
export function isTabTitleTruncated(titleEl) {
  if (!(titleEl instanceof HTMLElement)) return false;
  return titleEl.scrollWidth > titleEl.clientWidth + 1;
}

/**
 * Show preview when hover/focus would add meaningful context.
 * @param {object} tab
 * @param {{ isTruncated?: boolean, secondary?: string }} [options]
 */
export function shouldShowTabPreview(tab, { isTruncated = false, secondary = '' } = {}) {
  if (!tab) return false;
  if (isTruncated) return true;
  if (tab.alertSegments?.length) return true;
  if (isRecordDetailTabPath(tab.path)) return true;
  if (tab.previewMeta?.subtitle) return true;
  if (String(secondary || '').trim()) return true;
  return false;
}
