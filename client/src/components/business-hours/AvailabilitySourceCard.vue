<template>
  <div
    class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
  >
    <div class="min-w-0">
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {{ resolvedLabel }}
      </p>
      <p v-if="loading" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        {{ t('settings.settingsBhLoadingSchedule') }}
      </p>
      <template v-else-if="resolved">
        <p class="text-sm font-medium text-gray-900 dark:text-white mt-0.5 truncate">
          {{ resolved.name }}
        </p>
        <p class="text-xs text-gray-600 dark:text-gray-400 truncate">
          {{ resolved.sourceLabel }} · {{ resolved.summary }}
        </p>
      </template>
      <p v-else class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        {{ t('settings.settingsBhNoScheduleConfigured') }}
      </p>
    </div>
    <button
      v-if="showSettingsLink && canManage"
      type="button"
      class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 shrink-0"
      @click="goToSettings"
    >
      {{ t('settings.settingsBhChangeInSettings') }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useBusinessHours } from '@/composables/useBusinessHours';
import { useAuthStore } from '@/stores/authRegistry';

const props = defineProps({
  label: { type: String, default: '' },
  userId: { type: String, default: null },
  showSettingsLink: { type: Boolean, default: true }
});

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { resolveSchedule } = useBusinessHours();

const resolvedLabel = computed(
  () => props.label || t('settings.settingsBhUsingScheduleLabel')
);

const loading = ref(true);
const resolved = ref(null);

const canManage = computed(() => {
  if (authStore.user?.isOwner) return true;
  if (String(authStore.user?.role || '').toLowerCase() === 'admin') return true;
  return Boolean(authStore.user?.permissions?.settings?.edit);
});

async function load() {
  loading.value = true;
  try {
    resolved.value = await resolveSchedule(props.userId || undefined);
  } catch {
    resolved.value = null;
  } finally {
    loading.value = false;
  }
}

function goToSettings() {
  router.push({ path: '/settings', query: { tab: 'business-hours' } });
}

onMounted(load);
watch(() => props.userId, load);
</script>
