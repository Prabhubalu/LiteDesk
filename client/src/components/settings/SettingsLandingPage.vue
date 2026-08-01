<template>
  <SettingsScrollPanel>
    <template #header>
      <SettingsPageHeader
        :title="t('navigation.settings')"
        :subtitle="t('settings.landingSubtitle')"
      >
        <div class="relative mt-4 max-w-2xl">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="search"
            class="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-16 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-primary-500 dark:focus:ring-primary-900/40"
            :placeholder="t('settings.searchPlaceholder')"
            autocomplete="off"
            @keydown.down.prevent="moveHit(1)"
            @keydown.up.prevent="moveHit(-1)"
            @keydown.enter.prevent="selectActiveHit"
          />
          <kbd class="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-neutral-200 px-1.5 py-0.5 text-[0.65rem] text-neutral-500 sm:inline dark:border-neutral-600">/</kbd>
        </div>
      </SettingsPageHeader>
    </template>

    <!-- Search results -->
    <div v-if="isSearching" class="space-y-3">
      <h3 :class="SETTINGS_RAIL_SECTION_LABEL_CLASS">{{ t('settings.searchResults') }}</h3>
      <div v-if="searchHits.length" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="(hit, idx) in searchHits"
          :key="hit.id"
          :class="[
            SETTINGS_OVERVIEW_CARD_CLASS,
            'group',
            idx === activeHitIndex && 'border-primary-400 ring-2 ring-primary-100 dark:border-primary-500 dark:ring-primary-900/40',
          ]"
          @click="navigateToEntry(hit)"
          @mouseenter="activeHitIndex = idx"
        >
          <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:group-hover:bg-primary-900/30">
            <component :is="iconFor(hit.parentId || hit.id)" class="h-5 w-5" />
          </div>
          <p v-if="hit.parentLabel" class="mb-1 text-[0.7rem] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {{ hit.parentLabel }}
          </p>
          <h3 :class="[SETTINGS_SECTION_TITLE_CLASS, 'mb-1.5']">{{ hit.label }}</h3>
          <p class="text-helper text-neutral-600 dark:text-neutral-400">{{ hit.description }}</p>
        </div>
      </div>
      <p v-else class="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {{ t('settings.searchEmpty') }}
      </p>
    </div>

    <!-- Browse: intent → one equal category grid -->
    <div v-else class="space-y-6">
      <section v-if="attentionEntries.length" class="overflow-hidden rounded-xl border border-amber-200/90 dark:border-amber-800/50">
        <div class="border-b border-amber-200/90 bg-amber-50/90 px-4 py-2 dark:border-amber-800/50 dark:bg-amber-950/40">
          <h3 class="text-[0.75rem] font-medium uppercase tracking-wider text-amber-900/80 dark:text-amber-200/80">
            {{ t('settings.needsAttentionLabel') }}
          </h3>
        </div>
        <ul class="divide-y divide-amber-100 dark:divide-amber-900/40">
          <li v-for="row in attentionEntries" :key="`attention-${row.item.catalogId}`">
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-amber-50/80 dark:hover:bg-amber-950/50"
              @click="navigateToEntry(row.entry)"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200">
                <component :is="iconFor(row.entry.parentId || row.entry.id)" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {{ t(row.entry.labelKey) }}
                </span>
                <span class="mt-0.5 block text-helper text-neutral-600 dark:text-neutral-400">
                  {{ t(row.item.reasonKey) }}
                </span>
              </span>
              <svg class="h-4 w-4 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </li>
        </ul>
      </section>

      <section v-else-if="recentEntries.length" class="space-y-2">
        <h3 :class="SETTINGS_RAIL_SECTION_LABEL_CLASS">{{ t('settings.recentLabel') }}</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="entry in recentEntries"
            :key="`recent-${entry.id}`"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-primary-600 dark:hover:bg-primary-900/20"
            @click="navigateToEntry(entry)"
          >
            <component :is="iconFor(entry.parentId || entry.id)" class="h-4 w-4 text-primary-600 dark:text-primary-400" />
            {{ t(entry.labelKey) }}
          </button>
        </div>
      </section>

      <section v-if="browseEntries.length" class="space-y-3">
        <h3 :class="SETTINGS_RAIL_SECTION_LABEL_CLASS">{{ t('settings.browseLabel') }}</h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="entry in browseEntries"
            :key="entry.id"
            type="button"
            :class="[SETTINGS_OVERVIEW_CARD_CLASS, 'group flex h-full flex-col text-left']"
            @click="navigateToEntry(entry)"
          >
            <div class="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:group-hover:bg-primary-900/30">
              <component :is="iconFor(entry.id)" class="h-5 w-5" />
            </div>
            <h3 :class="[SETTINGS_SECTION_TITLE_CLASS, 'mb-1']">
              {{ entry.id === 'business-hours' ? t('settings.tabBusinessHoursFull') : t(entry.labelKey) }}
            </h3>
            <p class="text-helper line-clamp-2 text-neutral-600 dark:text-neutral-400">
              {{ t(entry.descriptionKey) }}
            </p>
          </button>
        </div>
      </section>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsPageHeader from '@/components/settings/SettingsPageHeader.vue';
import {
  SETTINGS_OVERVIEW_CARD_CLASS,
  SETTINGS_RAIL_SECTION_LABEL_CLASS,
  SETTINGS_SECTION_TITLE_CLASS,
} from '@/components/settings/settingsSaveBar';
import { useRecentSettingsTabs } from '@/composables/useRecentSettingsTabs';
import { useSettingsHealth } from '@/composables/useSettingsHealth';
import {
  getAccessibleSettingsCatalog,
  getSettingsHubCatalog,
  searchSettingsCatalog,
} from '@/utils/settingsCatalog';
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { recentIds, record } = useRecentSettingsTabs();

const searchQuery = ref('');
const activeHitIndex = ref(0);
const searchInputRef = ref(null);

const settingsAccessCtx = computed(() => ({
  isOwner: !!authStore.user?.isOwner,
  role: authStore.user?.role,
  permissions: authStore.user?.permissions,
  entitledAddons: authStore.user?.entitledAddons || null,
  inventoryEnabled: authStore.inventoryEnabled === true,
}));

const organizationRef = computed(() => authStore.organization);
const { attentionItems } = useSettingsHealth(
  settingsAccessCtx,
  organizationRef
);

const accessible = computed(() => getAccessibleSettingsCatalog(settingsAccessCtx.value));
const hubs = computed(() => getSettingsHubCatalog(settingsAccessCtx.value));

const isSearching = computed(() => searchQuery.value.trim().length > 0);

const searchHits = computed(() =>
  searchSettingsCatalog(searchQuery.value, accessible.value, t)
);

const recentEntries = computed(() => {
  const byId = new Map(accessible.value.map((e) => [e.id, e]));
  return recentIds.value.map((id) => byId.get(id)).filter(Boolean).slice(0, 5);
});

const attentionEntries = computed(() => {
  const byId = new Map(accessible.value.map((e) => [e.id, e]));
  return attentionItems.value
    .map((item) => {
      const entry = byId.get(item.catalogId);
      return entry ? { item, entry } : null;
    })
    .filter(Boolean);
});

/** Hubs already represented in Needs attention — omit from browse to avoid duplicates. */
const attentionHubIds = computed(() => {
  const ids = new Set();
  for (const row of attentionEntries.value) {
    ids.add(row.item.hubId);
    ids.add(row.entry.id);
    if (row.entry.parentId) ids.add(row.entry.parentId);
  }
  return ids;
});

/** Single equal grid: personal + workspace, minus attention hubs. */
const browseEntries = computed(() =>
  hubs.value.filter((e) => !attentionHubIds.value.has(e.id))
);

watch(searchHits, () => {
  activeHitIndex.value = 0;
});

function navigateToEntry(entry) {
  if (!entry?.route) return;
  record(entry.id);
  router.push(entry.route);
}

function moveHit(delta) {
  if (!isSearching.value || !searchHits.value.length) return;
  const len = searchHits.value.length;
  activeHitIndex.value = (activeHitIndex.value + delta + len) % len;
}

function selectActiveHit() {
  const hit = searchHits.value[activeHitIndex.value];
  if (hit) navigateToEntry(hit);
}

function isTypingTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function onSlashKey(event) {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
  if (isTypingTarget(event.target)) return;
  event.preventDefault();
  searchInputRef.value?.focus();
}

onMounted(() => {
  window.addEventListener('keydown', onSlashKey);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onSlashKey);
});

// --- Icons (same set as before; keyed for catalog reuse) ---
const ProfileIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' }),
]);
const OrganizationIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' }),
]);
const BusinessHoursIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }),
]);
const UsersAccessIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }),
]);
const CoreModulesIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' }),
]);
const ApplicationsIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' }),
]);
const AddonsIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z' }),
]);
const InventoryIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' }),
]);
const CatalogIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' }),
]);
const AutomationIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M13 10V3L4 14h7v7l9-11h-7z' }),
]);
const WebformsIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }),
]);
const PerformanceIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }),
]);
const SubscriptionsIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' }),
]);
const BellIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' }),
]);
const SecurityIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' }),
]);
const IntegrationsIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' }),
]);
const AiIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' }),
]);
const AuditLogIcon = () => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' }),
]);

const ICONS = {
  profile: ProfileIcon,
  organization: OrganizationIcon,
  'business-hours': BusinessHoursIcon,
  'users-access': UsersAccessIcon,
  'core-modules': CoreModulesIcon,
  applications: ApplicationsIcon,
  addons: AddonsIcon,
  catalog: CatalogIcon,
  inventory: InventoryIcon,
  automation: AutomationIcon,
  webforms: WebformsIcon,
  performance: PerformanceIcon,
  subscriptions: SubscriptionsIcon,
  notifications: BellIcon,
  security: SecurityIcon,
  integrations: IntegrationsIcon,
  ai: AiIcon,
  'audit-log': AuditLogIcon,
};

function iconFor(id) {
  return ICONS[id] || ApplicationsIcon;
}
</script>
