<template>
  <div
    role="dialog"
    :aria-label="t('platform.platformHomeCustomizeTitle')"
    class="absolute bottom-0 right-0 z-50 flex w-full max-w-xs flex-col overflow-hidden rounded-tl-xl border-l border-t border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
    :style="insetStyle"
    @click.stop
  >
    <div class="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-700">
      <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
        {{ t('platform.platformHomeCustomizeTitle') }}
      </h2>
      <button
        type="button"
        class="rounded-md p-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
        :aria-label="t('actions.close')"
        @click="$emit('close')"
      >
        <XMarkIcon class="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
      </button>
    </div>

    <div class="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
      <section>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {{ t('platform.platformHomeCustomizeWidth') }}
        </h3>
        <div
          class="flex rounded-lg border border-neutral-200/70 p-0.5 dark:border-white/10"
          role="group"
          :aria-label="t('platform.platformHomeCustomizeWidth')"
        >
          <button
            v-for="mode in widthModes"
            :key="mode"
            type="button"
            class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="
              widthMode === mode
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
            "
            @click="$emit('update-width-mode', mode)"
          >
            {{ t(`platform.platformHomeWidth${mode === 'compact' ? 'Compact' : 'Wide'}`) }}
          </button>
        </div>
      </section>

      <section>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {{ t('platform.platformHomeCustomizeBuiltIn') }}
        </h3>
        <ul class="space-y-2">
          <li
            v-for="def in builtinWidgets"
            :key="def.type"
            class="flex items-center justify-between rounded-lg border border-neutral-200/70 px-3 py-2 dark:border-white/10"
          >
            <span class="text-sm text-neutral-900 dark:text-white">{{ t(def.labelKey) }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="isBuiltinEnabled(def.type)"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
                isBuiltinEnabled(def.type) ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600'
              ]"
              @click="$emit('toggle-builtin', def.type, !isBuiltinEnabled(def.type))"
            >
              <span
                :class="[
                  'inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform',
                  isBuiltinEnabled(def.type) ? 'translate-x-5' : 'translate-x-0.5'
                ]"
              />
            </button>
          </li>
        </ul>
      </section>

      <section v-if="addedAnalyticsWidgets.length">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {{ t('platform.platformHomeCustomizeAddedReportWidgets') }}
        </h3>
        <ul class="space-y-2">
          <li
            v-for="item in addedAnalyticsWidgets"
            :key="item.instanceId"
            class="flex items-center justify-between gap-2 rounded-lg border border-neutral-200/70 px-3 py-2 dark:border-white/10"
          >
            <span class="min-w-0 truncate text-sm text-neutral-900 dark:text-white">
              {{ analyticsWidgetLabel(item) }}
            </span>
            <button
              type="button"
              class="shrink-0 text-xs text-neutral-500 hover:text-red-600"
              @click="$emit('remove-analytics', item.instanceId)"
            >
              {{ t('actions.remove') }}
            </button>
          </li>
        </ul>
      </section>

      <section>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {{ t('platform.platformHomeCustomizeReportWidgets') }}
        </h3>
        <input
          v-model="search"
          type="search"
          class="mb-3 w-full rounded-lg border border-neutral-200/70 px-3 py-1.5 text-sm dark:border-white/10 dark:bg-neutral-800"
          :placeholder="t('analytics.dashboardWidgetSearch')"
        />
        <div class="max-h-72 space-y-2 overflow-y-auto">
          <button
            v-for="widget in filteredWidgets"
            :key="widget._id"
            type="button"
            class="w-full rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60"
            :class="
              isAnalyticsAdded(widget._id)
                ? 'border-primary-200 bg-primary-50/60 dark:border-primary-900/40 dark:bg-primary-900/20'
                : 'border-neutral-200/70 hover:border-primary-400 dark:border-white/10'
            "
            :disabled="isAnalyticsAdded(widget._id)"
            @click="$emit('add-analytics', widget)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-medium text-neutral-900 dark:text-white">{{ widget.name }}</p>
                <p class="text-xs capitalize text-neutral-500">
                  {{ t(`analytics.chartType_${widget.chartType}`, widget.chartType) }}
                </p>
              </div>
              <span
                v-if="isAnalyticsAdded(widget._id)"
                class="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400"
              >
                {{ t('platform.platformHomeWidgetAlreadyAdded') }}
              </span>
            </div>
          </button>
          <p v-if="filteredWidgets.length === 0" class="py-4 text-center text-xs text-neutral-500">
            {{ t('analytics.dashboardNoPublishedWidgets') }}
          </p>
        </div>
      </section>
    </div>

    <div class="flex gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
      <button
        type="button"
        class="flex-1 rounded-lg border border-neutral-200/80 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-neutral-800"
        @click="$emit('cancel')"
      >
        {{ t('actions.cancel') }}
      </button>
      <button
        type="button"
        class="flex-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        :disabled="saving"
        @click="$emit('save')"
      >
        {{ saving ? t('states.saving') : t('platform.platformHomeCustomizeDone') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import type { AnalyticsWidgetRecord } from '@/types/analytics.types';
import type { PlatformHomeLayoutItem, PlatformHomeWidthMode } from '@/types/platformHome.types';
import { PLATFORM_HOME_BUILTIN_WIDGETS, PLATFORM_HOME_WIDTH_MODES } from '@/utils/platformHomeWidgetRegistry';

const props = defineProps<{
  layoutItems: PlatformHomeLayoutItem[];
  widthMode: PlatformHomeWidthMode;
  paletteWidgets: AnalyticsWidgetRecord[];
  insetStyle: Record<string, string>;
  saving?: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'cancel'): void;
  (e: 'save'): void;
  (e: 'toggle-builtin', type: string, enabled: boolean): void;
  (e: 'add-analytics', widget: AnalyticsWidgetRecord): void;
  (e: 'remove-analytics', instanceId: string): void;
  (e: 'update-width-mode', mode: PlatformHomeWidthMode): void;
}>();

const { t } = useI18n();
const search = ref('');

const builtinWidgets = PLATFORM_HOME_BUILTIN_WIDGETS;
const widthModes = PLATFORM_HOME_WIDTH_MODES;

const filteredWidgets = computed(() => {
  const q = search.value.trim().toLowerCase();
  const published = props.paletteWidgets.filter((widget) => widget.status === 'published');
  if (!q) return published;
  return published.filter((widget) => widget.name.toLowerCase().includes(q));
});

function isBuiltinEnabled(type: string) {
  const item = props.layoutItems.find((entry) => entry.type === type);
  return item ? item.enabled !== false : false;
}

function isAnalyticsAdded(widgetId: string) {
  return props.layoutItems.some(
    (item) => item.type === 'analytics' && String(item.widgetId) === String(widgetId) && item.enabled !== false,
  );
}

const addedAnalyticsWidgets = computed(() =>
  props.layoutItems.filter((item) => item.type === 'analytics' && item.enabled !== false),
);

function analyticsWidgetLabel(item: PlatformHomeLayoutItem) {
  const match = props.paletteWidgets.find((widget) => String(widget._id) === String(item.widgetId));
  return match?.name || t('analytics.dashboardWidgetPlaceholder');
}
</script>
