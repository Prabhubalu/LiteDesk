<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <button type="button" class="mb-2 text-sm text-primary-600 hover:underline" @click="goList">
          ← {{ t('analytics.dashboardsListTitle') }}
        </button>
        <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
          {{ isNew ? t('analytics.dashboardDesignerTitle') : form.name || t('analytics.dashboardDesignerEditTitle') }}
        </h1>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
          :disabled="saving"
          @click="saveDraft"
        >
          {{ t('analytics.saveDraft') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
          :disabled="executing"
          @click="runPreview"
        >
          {{ t('analytics.preview') }}
        </button>
        <button
          v-if="!isNew"
          type="button"
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          :disabled="saving"
          @click="publish"
        >
          {{ t('analytics.publish') }}
        </button>
      </div>
    </div>

    <div class="mb-4 space-y-3">
      <div class="grid gap-3 md:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.dashboardFieldName') }}</span>
          <input v-model="form.name" type="text" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.dashboardFieldCategory') }}</span>
          <select v-model="form.category" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
            <option v-for="cat in categories" :key="cat" :value="cat">
              {{ t(`analytics.dashboardCategory_${cat}`) }}
            </option>
          </select>
        </label>
      </div>
      <DashboardSharePanel
        v-model:visibility="form.visibility"
        v-model:shared-with="form.sharedWith"
        v-model:viewer-role-ids="form.viewerRoleIds"
        v-model:app-key="form.appKey"
        v-model:is-default="form.isDefault"
        v-model:drill-down-enabled="form.drillDownEnabled"
        :category="form.category"
      />
      <DashboardDateRangeBar v-model="dateRange" @update:model-value="onDateRangeChange" />
    </div>

    <div class="grid gap-6 xl:grid-cols-[16rem_1fr]">
      <aside class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {{ t('analytics.dashboardWidgetPalette') }}
        </h2>
        <input
          v-model="widgetSearch"
          type="search"
          class="mb-3 w-full rounded-lg border px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          :placeholder="t('analytics.dashboardWidgetSearch')"
        />
        <div class="max-h-[28rem] space-y-2 overflow-y-auto">
          <button
            v-for="widget in filteredPaletteWidgets"
            :key="widget._id"
            type="button"
            class="w-full rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm hover:border-primary-400 dark:border-neutral-600"
            @click="addWidget(widget)"
          >
            <p class="font-medium text-neutral-900 dark:text-white">{{ widget.name }}</p>
            <p class="text-xs capitalize text-neutral-500">
              {{ t(`analytics.chartType_${widget.chartType}`, widget.chartType) }}
            </p>
          </button>
          <p v-if="filteredPaletteWidgets.length === 0" class="py-4 text-center text-xs text-neutral-500">
            {{ t('analytics.dashboardNoPublishedWidgets') }}
          </p>
        </div>
      </aside>

      <section class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <div ref="gridRef" class="grid-stack min-h-[32rem]">
          <div
            v-for="item in layout"
            :key="item.instanceId"
            class="grid-stack-item"
            :gs-id="item.instanceId"
            :gs-x="item.x"
            :gs-y="item.y"
            :gs-w="item.w"
            :gs-h="item.h"
            :gs-min-w="2"
            :gs-min-h="2"
          >
            <div class="grid-stack-item-content h-full">
              <DashboardWidgetCell
                :title="widgetTitle(item.widgetId)"
                :chart-type="widgetChartType(item.widgetId)"
                :payload="widgetPayloadByInstance(item.instanceId)"
                :theme-mode="themeMode"
                :loading="executing"
                editable
                show-remove
                @remove="removeWidget(item.instanceId)"
              />
            </div>
          </div>
        </div>
        <p v-if="layout.length === 0" class="pointer-events-none -mt-[28rem] py-24 text-center text-sm text-neutral-500">
          {{ t('analytics.dashboardEmptyCanvas') }}
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import DashboardDateRangeBar from '@/components/analytics/DashboardDateRangeBar.vue';
import DashboardSharePanel from '@/components/analytics/DashboardSharePanel.vue';
import DashboardWidgetCell from '@/components/analytics/DashboardWidgetCell.vue';
import { useAnalyticsDashboards } from '@/composables/useAnalyticsDashboards';
import { useAnalyticsWidgets } from '@/composables/useAnalyticsWidgets';
import { useColorMode } from '@/composables/useColorMode';
import { resolveDateRange } from '@/utils/analyticsDateRange';
import {
  captureAnalyticsDashboardCreated,
  captureAnalyticsDashboardPublished,
  captureAnalyticsDashboardWidgetAdded,
} from '@/config/posthogAnalytics';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { effectiveDark } = useColorMode();

const {
  saving,
  executing,
  fetchDashboard,
  createDashboard,
  updateDashboard,
  publishDashboard,
  executeDashboard,
  widgetPayloadByInstance,
} = useAnalyticsDashboards();

const { widgets: paletteWidgets, fetchWidgets } = useAnalyticsWidgets();

const isNew = computed(() => route.name === 'analytics-dashboard-create');
const categories = ['personal', 'team', 'executive', 'app'];
const themeMode = computed(() => (effectiveDark.value ? 'dark' : 'light'));

const form = reactive({
  name: '',
  apiName: '',
  category: 'personal',
  visibility: 'private',
  sharedWith: [],
  viewerRoleIds: [],
  appKey: null,
  isDefault: false,
  drillDownEnabled: false,
});

const layout = ref([]);
const widgetSearch = ref('');
const dateRange = ref({ preset: 'last30days' });
const dashboardId = ref(null);
const gridRef = ref(null);
const widgetMeta = ref(new Map());

let grid = null;
let syncingGrid = false;

const filteredPaletteWidgets = computed(() => {
  const q = widgetSearch.value.trim().toLowerCase();
  const published = paletteWidgets.value.filter((w) => w.status === 'published');
  if (!q) return published;
  return published.filter((w) => w.name.toLowerCase().includes(q));
});

function slugify(name) {
  return String(name || 'dashboard')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function widgetTitle(widgetId) {
  return widgetMeta.value.get(String(widgetId))?.name || t('analytics.dashboardWidgetPlaceholder');
}

function widgetChartType(widgetId) {
  return widgetMeta.value.get(String(widgetId))?.chartType || null;
}

function buildPayload() {
  return {
    name: form.name.trim(),
    apiName: form.apiName.trim() || slugify(form.name),
    category: form.category,
    visibility: form.visibility,
    sharedWith: form.sharedWith,
    viewerRoleIds: form.viewerRoleIds,
    appKey: form.category === 'app' ? form.appKey : null,
    isDefault: form.category === 'app' ? form.isDefault : false,
    drillDownEnabled: form.drillDownEnabled,
    layout: layout.value,
  };
}

function syncLayoutFromGrid(nodes) {
  for (const node of nodes) {
    const item = layout.value.find((entry) => entry.instanceId === node.id);
    if (!item) continue;
    item.x = node.x;
    item.y = node.y;
    item.w = node.w;
    item.h = node.h;
  }
}

function initGrid() {
  if (!gridRef.value || grid) return;
  grid = GridStack.init(
    {
      column: 12,
      cellHeight: 80,
      margin: 8,
      float: false,
      animate: true,
    },
    gridRef.value
  );

  grid.on('change', (_event, nodes) => {
    if (syncingGrid) return;
    syncLayoutFromGrid(nodes);
  });
}

function destroyGrid() {
  if (grid) {
    grid.destroy(false);
    grid = null;
  }
}

async function registerGridItems() {
  if (!grid) return;
  syncingGrid = true;
  await nextTick();
  for (const item of layout.value) {
    const el = gridRef.value?.querySelector(`[gs-id="${item.instanceId}"]`);
    if (el && !el.gridstackNode) {
      grid.makeWidget(el);
    }
  }
  syncingGrid = false;
}

function addWidget(widget) {
  const instanceId = crypto.randomUUID();
  const maxY = layout.value.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  layout.value.push({
    widgetId: widget._id,
    instanceId,
    x: 0,
    y: maxY,
    w: 6,
    h: 4,
  });
  widgetMeta.value.set(String(widget._id), widget);
  captureAnalyticsDashboardWidgetAdded({
    widget_id: widget._id,
    chart_type: widget.chartType,
    surface: 'dashboard_designer',
  });
  nextTick(() => registerGridItems());
}

function removeWidget(instanceId) {
  const el = gridRef.value?.querySelector(`[gs-id="${instanceId}"]`);
  if (el && grid) {
    grid.removeWidget(el, false);
  }
  layout.value = layout.value.filter((item) => item.instanceId !== instanceId);
}

async function saveDraft() {
  const payload = buildPayload();
  if (!payload.name) return;

  if (isNew.value) {
    const res = await createDashboard(payload);
    if (res?.success) {
      captureAnalyticsDashboardCreated({ category: payload.category });
      dashboardId.value = res.data._id;
      router.replace({ name: 'analytics-dashboard-edit', params: { id: res.data._id } });
    }
    return res;
  }

  return updateDashboard(String(dashboardId.value || route.params.id), payload);
}

async function runPreview() {
  const id = dashboardId.value || route.params.id;
  if (!id) {
    const res = await saveDraft();
    if (!res?.success) return;
  }
  const nextId = dashboardId.value || route.params.id;
  if (!nextId) return;

  await saveDraft();
  await executeDashboard(String(nextId), {
    preview: true,
    variables: { dateRange: resolveDateRange(dateRange.value) },
  });
}

async function publish() {
  const id = dashboardId.value || route.params.id;
  if (!id) return;
  await saveDraft();
  const res = await publishDashboard(String(id));
  if (res?.success) {
    captureAnalyticsDashboardPublished({ dashboard_id: id });
    router.push({ name: 'analytics-dashboard-view', params: { id } });
  }
}

function onDateRangeChange() {
  if (dashboardId.value || route.params.id) {
    void runPreview();
  }
}

function goList() {
  router.push({ name: 'analytics-dashboards' });
}

async function hydrateWidgetMeta() {
  const ids = [...new Set(layout.value.map((item) => String(item.widgetId)))];
  for (const widget of paletteWidgets.value) {
    if (ids.includes(String(widget._id))) {
      widgetMeta.value.set(String(widget._id), widget);
    }
  }
}

watch(
  () => form.name,
  (name) => {
    if (isNew.value && !form.apiName) form.apiName = slugify(name);
  }
);

onMounted(async () => {
  await fetchWidgets({ status: 'published', limit: 200 });

  const id = route.params.id;
  if (id) {
    dashboardId.value = String(id);
    const res = await fetchDashboard(String(id));
    if (res?.success && res.data) {
      const d = res.data;
      form.name = d.name;
      form.apiName = d.apiName;
      form.category = d.category;
      form.visibility = d.visibility;
      form.sharedWith = Array.isArray(d.sharedWith) ? d.sharedWith : [];
      form.viewerRoleIds = Array.isArray(d.viewerRoleIds) ? d.viewerRoleIds.map(String) : [];
      form.appKey = d.appKey || null;
      form.isDefault = Boolean(d.isDefault);
      form.drillDownEnabled = Boolean(d.drillDownEnabled);
      layout.value = Array.isArray(d.layout) ? [...d.layout] : [];
      await hydrateWidgetMeta();
      initGrid();
      await registerGridItems();
      await runPreview();
    }
  } else {
    initGrid();
  }
});

onBeforeUnmount(() => {
  destroyGrid();
});
</script>
