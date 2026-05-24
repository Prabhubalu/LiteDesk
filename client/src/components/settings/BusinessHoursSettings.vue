<template>
  <div class="space-y-6 max-w-5xl">
    <div>
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabBusinessHoursFull') }}</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ t('settings.tabBusinessHoursDesc') }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-1">
      <button
        v-for="tab in visibleTabs"
        :key="tab.id"
        type="button"
        :class="[
          'px-3 py-2 text-sm font-medium rounded-t-lg transition-colors',
          activeTab === tab.id
            ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        ]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <section v-if="activeTab === 'mine'" class="space-y-4">
      <AvailabilitySourceCard :label="t('settings.settingsBhScheduleCardLabel')" :show-settings-link="false" />
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ t('settings.settingsBhPersonalOverridesHint') }}
      </p>
    </section>

    <HolidayCalendarManager v-else-if="activeTab === 'holidays' && canManage" />

    <BusinessHoursInsightsPanel v-else-if="activeTab === 'insights' && canManage" />

    <section v-else-if="activeTab === 'schedules' && canManage" class="space-y-4">
      <div v-if="listLoading" class="text-sm text-gray-500 py-12 text-center">{{ t('settings.settingsBhLoadingSchedules') }}</div>

      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.settingsBhScheduleCount', { count: sets.length }) }}
          </p>
          <button
            type="button"
            class="px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            @click="openCreateDrawer"
          >
            {{ t('settings.settingsBhCreateSchedule') }}
          </button>
        </div>

        <div v-if="sets.length" class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="set in sets"
            :key="set._id"
            type="button"
            class="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition-all"
            @click="openEditDrawer(set._id)"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium text-gray-900 dark:text-white truncate">{{ set.name }}</span>
              <span
                v-if="set.isDefault"
                class="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
              >
                {{ t('settings.settingsBhBadgeDefault') }}
              </span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ scopeLabel(set) }}</p>
            <p class="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate">{{ set.summary }}</p>
          </button>
        </div>

        <div
          v-else
          class="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-12 text-center"
        >
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('settings.settingsBhEmptySchedules') }}</p>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            @click="openCreateDrawer"
          >
            {{ t('settings.settingsBhCreateFirstSchedule') }}
          </button>
        </div>
      </template>
    </section>

    <BusinessHoursScheduleDrawer
      v-model:open="drawerOpen"
      :mode="drawerMode"
      :schedule-id="drawerScheduleId"
      :holiday-calendar-options="holidayCalendarOptions"
      :suggest-as-default="!sets.some((s) => s.isDefault)"
      @saved="loadList"
      @deleted="loadList"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { useBusinessHours } from '@/composables/useBusinessHours';
import { useNotifications } from '@/composables/useNotifications';
import AvailabilitySourceCard from '@/components/business-hours/AvailabilitySourceCard.vue';
import HolidayCalendarManager from '@/components/business-hours/HolidayCalendarManager.vue';
import BusinessHoursScheduleDrawer from '@/components/business-hours/BusinessHoursScheduleDrawer.vue';
import BusinessHoursInsightsPanel from '@/components/business-hours/BusinessHoursInsightsPanel.vue';

const { t } = useI18n();
const authStore = useAuthStore();
const { error: notifyError } = useNotifications();
const { fetchSets, fetchHolidayCalendars } = useBusinessHours();

const canManage = computed(() => {
  if (authStore.user?.isOwner) return true;
  if (String(authStore.user?.role || '').toLowerCase() === 'admin') return true;
  return Boolean(authStore.user?.permissions?.settings?.edit);
});

const visibleTabs = computed(() => {
  const tabs = [{ id: 'mine', label: t('settings.settingsBhTabMine') }];
  if (canManage.value) {
    tabs.unshift({ id: 'schedules', label: t('settings.settingsBhTabSchedules') });
    tabs.push({ id: 'holidays', label: t('settings.settingsBhTabHolidays') });
    tabs.push({ id: 'insights', label: t('settings.settingsBhTabInsights') });
  }
  return tabs;
});

const activeTab = ref(canManage.value ? 'schedules' : 'mine');
const sets = ref([]);
const listLoading = ref(true);
const holidayCalendars = ref([]);

const drawerOpen = ref(false);
const drawerMode = ref('create');
const drawerScheduleId = ref(null);

const holidayCalendarOptions = computed(() =>
  holidayCalendars.value.map((cal) => ({
    value: cal._id,
    label: t('settings.settingsBhHolidayCalendarOption', {
      name: cal.name,
      count: cal.dates?.length || 0,
    }),
  }))
);

function scopeLabel(set) {
  const scopeType = set.linkedTo?.type || 'company';
  if (scopeType === 'company') return t('settings.settingsBhScopeCompany');
  if (scopeType === 'group') return t('settings.settingsBhScopeTeam');
  return t('settings.settingsBhScopeIndividual');
}

function openCreateDrawer() {
  drawerMode.value = 'create';
  drawerScheduleId.value = null;
  drawerOpen.value = true;
}

function openEditDrawer(id) {
  drawerMode.value = 'edit';
  drawerScheduleId.value = id;
  drawerOpen.value = true;
}

async function loadList() {
  listLoading.value = true;
  try {
    sets.value = await fetchSets();
    holidayCalendars.value = await fetchHolidayCalendars();
  } catch (e) {
    notifyError(e?.message || t('settings.settingsBhLoadFailed'));
  } finally {
    listLoading.value = false;
  }
}

onMounted(loadList);
</script>
