import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import type { PlatformHomeLayout, PlatformHomeLayoutItem } from '@/types/platformHome.types';
import {
  clonePlatformHomeLayout,
  createDefaultPlatformHomeLayout,
  normalizePlatformHomeLayout,
  PLATFORM_HOME_WIDGET_MIN_H,
  PLATFORM_HOME_WIDGET_MIN_W,
} from '@/utils/platformHomeWidgetRegistry';

export function usePlatformHomeLayout() {
  const layout = ref<PlatformHomeLayout>(createDefaultPlatformHomeLayout());
  const savedLayout = ref<PlatformHomeLayout>(createDefaultPlatformHomeLayout());
  const customizeMode = ref(false);
  const loading = ref(false);
  const saving = ref(false);

  async function fetchLayout() {
    loading.value = true;
    try {
      const response = await apiClient('/platform/home/layout', { method: 'GET' });
      const normalized = normalizePlatformHomeLayout(response?.data);
      layout.value = normalized;
      savedLayout.value = clonePlatformHomeLayout(normalized);
      return normalized;
    } catch (error) {
      console.error('[PlatformHomeLayout] fetch error:', error);
      const fallback = createDefaultPlatformHomeLayout();
      layout.value = fallback;
      savedLayout.value = clonePlatformHomeLayout(fallback);
      return fallback;
    } finally {
      loading.value = false;
    }
  }

  async function saveLayout(nextLayout: PlatformHomeLayout = layout.value) {
    saving.value = true;
    try {
      const payload = clonePlatformHomeLayout(nextLayout);
      const response = await apiClient.put('/platform/home/layout', {
        items: payload.items,
        widthMode: payload.widthMode ?? 'wide',
      });
      if (response?.success) {
        savedLayout.value = clonePlatformHomeLayout(payload);
      }
      return response;
    } catch (error) {
      console.error('[PlatformHomeLayout] save error:', error);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function saveDefaultLayout(nextLayout: PlatformHomeLayout = layout.value) {
    saving.value = true;
    try {
      const payload = clonePlatformHomeLayout(nextLayout);
      const response = await apiClient.put('/platform/home/layout/default', {
        items: payload.items,
        widthMode: payload.widthMode ?? 'wide',
      });
      return response;
    } catch (error) {
      console.error('[PlatformHomeLayout] save default error:', error);
      return null;
    } finally {
      saving.value = false;
    }
  }

  function enterCustomizeMode() {
    savedLayout.value = clonePlatformHomeLayout(layout.value);
    customizeMode.value = true;
  }

  function cancelCustomizeMode() {
    layout.value = clonePlatformHomeLayout(savedLayout.value);
    customizeMode.value = false;
  }

  async function finishCustomizeMode() {
    await saveLayout(clonePlatformHomeLayout(layout.value));
    customizeMode.value = false;
  }

  function setItemEnabled(instanceId: string, enabled: boolean) {
    const item = layout.value.items.find((entry) => entry.instanceId === instanceId);
    if (item) item.enabled = enabled;
  }

  function toggleBuiltinWidget(type: string, enabled: boolean) {
    const existing = layout.value.items.find((item) => item.type === type && item.type !== 'analytics');
    if (existing) {
      existing.enabled = enabled;
      return existing;
    }

    if (!enabled) return null;

    const defaults = createDefaultPlatformHomeLayout();
    const template = defaults.items.find((item) => item.type === type);
    if (!template) return null;

    const maxY = layout.value.items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    const next: PlatformHomeLayoutItem = {
      ...template,
      y: maxY,
      enabled: true,
    };
    layout.value.items.push(next);
    return next;
  }

  function hasAnalyticsWidget(widgetId: string) {
    const id = String(widgetId);
    return layout.value.items.some(
      (item) => item.type === 'analytics' && String(item.widgetId) === id && item.enabled !== false,
    );
  }

  function addAnalyticsWidget(widgetId: string, widgetName?: string) {
    if (hasAnalyticsWidget(widgetId)) return null;

    const instanceId = crypto.randomUUID();
    const maxY = layout.value.items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    layout.value.items.push({
      instanceId,
      type: 'analytics',
      widgetId: String(widgetId),
      enabled: true,
      x: 0,
      y: maxY,
      w: 6,
      h: 4,
      minW: PLATFORM_HOME_WIDGET_MIN_W,
      minH: PLATFORM_HOME_WIDGET_MIN_H,
    });
    return { instanceId, widgetName };
  }

  function removeLayoutItem(instanceId: string) {
    layout.value.items = layout.value.items.filter((item) => item.instanceId !== instanceId);
  }

  function updateLayoutItems(items: PlatformHomeLayoutItem[]) {
    for (const next of items) {
      const target = layout.value.items.find((item) => item.instanceId === next.instanceId);
      if (!target) continue;
      target.x = next.x;
      target.y = next.y;
      target.w = next.w;
      target.h = next.h;
    }
  }

  function setWidthMode(widthMode: PlatformHomeLayout['widthMode']) {
    layout.value.widthMode = widthMode ?? 'wide';
  }

  return {
    layout,
    savedLayout,
    customizeMode,
    loading,
    saving,
    fetchLayout,
    saveLayout,
    saveDefaultLayout,
    enterCustomizeMode,
    cancelCustomizeMode,
    finishCustomizeMode,
    setItemEnabled,
    toggleBuiltinWidget,
    addAnalyticsWidget,
    hasAnalyticsWidget,
    removeLayoutItem,
    updateLayoutItems,
    setWidthMode,
  };
}
