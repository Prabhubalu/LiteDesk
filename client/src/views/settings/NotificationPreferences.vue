<template>
  <div class="space-y-4">
    <div
      v-if="!loading && !hasLoaded && error"
      class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300"
    >
      {{ t('common.notificationPreferencesWeCouldntLoadYourNotificationPreferences') }}
    </div>

    <div v-if="loading" class="space-y-3">
      <div class="h-10 w-full max-w-md bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
      <div
        v-for="i in 4"
        :key="i"
        class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2"
      >
        <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div class="h-3 w-48 bg-gray-100 dark:bg-gray-700/80 rounded animate-pulse"></div>
      </div>
    </div>

    <template v-else-if="!loading">
      <div class="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div class="relative flex-1 max-w-md">
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('settings.notificationsSearchPlaceholder')"
            class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select
            v-model="channelFilter"
            class="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{{ t('settings.notificationsFilterAllChannels') }}</option>
            <option value="inApp">{{ t('common.notificationPreferencesInApp') }}</option>
            <option value="email">{{ t('settings.settingsAddFieldTypeEmail') }}</option>
          </select>
          <button
            type="button"
            class="text-xs font-medium px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            @click="expandAllGroups()"
          >
            {{ t('settings.notificationsExpandAll') }}
          </button>
          <button
            type="button"
            class="text-xs font-medium px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            @click="collapseAllGroups()"
          >
            {{ t('settings.notificationsCollapseAll') }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          @click="handleChannelGlobalToggle('email', false)"
        >
          {{ t('settings.notificationsMuteAllEmail') }}
        </button>
        <router-link
          to="/settings?tab=notifications&notificationPage=channels"
          class="px-3 py-1.5 text-xs font-medium rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
        >
          {{ t('settings.notificationsManageChannels') }}
        </router-link>
      </div>

      <div
        v-for="group in filteredGroups"
        :key="`${group.id}-${renderKey}`"
        :data-event-group="group.id"
        class="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800"
      >
        <button
          type="button"
          class="w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4"
          :aria-expanded="isGroupOpen(group.id)"
          @click="toggleGroup(group.id)"
        >
          <div class="text-left">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                {{ group.label }}
              </h2>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ groupEnabledLabel(group) }}
              </span>
            </div>
            <p class="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {{ group.description }}
            </p>
          </div>
          <svg
            class="w-5 h-5 text-gray-400 shrink-0"
            :class="{ 'rotate-180': isGroupOpen(group.id) }"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.188l3.71-3.957a.75.75 0 1 1 1.1 1.02l-4.25 4.53a.75.75 0 0 1-1.1 0l-4.25-4.53a.75.75 0 0 1 .02-1.06Z"
              fill="currentColor"
            />
          </svg>
        </button>

        <div
          v-if="isGroupOpen(group.id)"
          class="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700"
        >
          <div
            v-for="event in group.events"
            :key="`${event.eventType}-${event.inAppEnabled}-${event.emailEnabled}-${renderKey}`"
            :data-event-type="event.eventType"
            class="px-4 py-3 sm:px-5 sm:py-4 transition-colors"
            :class="highlightEventType === event.eventType ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800' : ''"
          >
            <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ event.label }}
                </p>
                <p class="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {{ event.description }}
                </p>
                <p
                  v-if="event.isUnknown"
                  class="mt-1 text-[11px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold"
                >
                  {{ t('common.notificationPreferencesSystemEventManagedByArivu') }}
                </p>
              </div>

              <div class="flex items-center gap-2 justify-end shrink-0">
                <ChannelBadge
                  channel="inApp"
                  :enabled="event.inAppEnabled"
                  :available="event.inAppAvailable"
                  :clickable="event.inAppAvailable"
                  @click="handleToggle(event.eventType, 'inApp', !event.inAppEnabled)"
                />
                <ChannelBadge
                  channel="email"
                  :enabled="event.emailEnabled"
                  :available="event.emailAvailable"
                  :clickable="event.emailAvailable"
                  @click="handleToggle(event.eventType, 'email', !event.emailEnabled)"
                />
                <ChannelBadge
                  v-if="event.pushAvailable"
                  channel="push"
                  :enabled="event.pushEnabled"
                  :available="event.pushAvailable"
                />
                <ChannelBadge
                  v-if="event.whatsappAvailable"
                  channel="whatsapp"
                  :enabled="event.whatsappEnabled"
                  :available="event.whatsappAvailable"
                />
                <ChannelBadge
                  v-if="event.smsAvailable"
                  channel="sms"
                  :enabled="event.smsEnabled"
                  :available="event.smsAvailable"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="filteredGroups.length === 0 && hasLoaded"
        class="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400"
      >
        {{ searchQuery ? t('settings.notificationsNoSearchResults') : t('common.notificationPreferencesThereAreNoConfigurableNotificationEvents') }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ChannelBadge from '@/components/notifications/ChannelBadge.vue';
import { useNotificationPreferencesPage } from '@/composables/useNotificationPreferencesPage';

const { t } = useI18n();
const route = useRoute();

const {
  loading,
  hasLoaded,
  error,
  renderKey,
  groupedEvents,
  isGroupOpen,
  toggleGroup,
  expandAllGroups,
  collapseAllGroups,
  handleToggle,
  handleChannelGlobalToggle
} = useNotificationPreferencesPage();

const searchQuery = ref('');
const channelFilter = ref('all');

const highlightEventType = computed(() => {
  const highlight = route.query.highlight;
  return typeof highlight === 'string' ? highlight : null;
});

const filteredGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const filter = channelFilter.value;

  return groupedEvents.value
    .map((group) => {
      let events = group.events;

      if (query) {
        events = events.filter(
          (event) =>
            event.label.toLowerCase().includes(query) ||
            event.description.toLowerCase().includes(query) ||
            event.eventType.toLowerCase().includes(query)
        );
      }

      if (filter === 'inApp') {
        events = events.filter((event) => event.inAppAvailable);
      } else if (filter === 'email') {
        events = events.filter((event) => event.emailAvailable);
      }

      if (events.length === 0) return null;
      return { ...group, events };
    })
    .filter(Boolean);
});

function groupEnabledLabel(group) {
  const enabled = group.events.filter((e) => e.inAppEnabled || e.emailEnabled).length;
  return t('settings.notificationsGroupEnabledCount', { enabled, total: group.events.length });
}
</script>
