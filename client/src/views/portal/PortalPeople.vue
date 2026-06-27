<template>
  <PortalPageShell
    :title="t('records.portalPeopleTitle')"
    :subtitle="t('records.portalPeopleHint')"
    :error="error"
  >
    <div v-if="loading" class="h-48" :class="PLATFORM_HOME_SKELETON_CLASS" />
    <div v-else-if="person" class="space-y-4">
      <div :class="['rounded-2xl p-5 sm:p-6', PLATFORM_HOME_CARD_CLASS]">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">{{ displayName }}</h2>
        <dl class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div v-if="person.email">
            <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('settings.settingsAddFieldTypeEmail') }}</dt>
            <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ person.email }}</dd>
          </div>
          <div v-if="person.phone">
            <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('settings.settingsAddFieldTypePhone') }}</dt>
            <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ person.phone }}</dd>
          </div>
          <div v-if="person.mobile">
            <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalPeopleMobile') }}</dt>
            <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ person.mobile }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </PortalPageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import portalApiClient from '@/utils/portalApiClient';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import { PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_SKELETON_CLASS } from '@/utils/platformHomeLayout';

const { t } = useI18n();
const loading = ref(true);
const error = ref(null);
const person = ref(null);

const displayName = computed(() => {
  const row = person.value;
  if (!row) return '';
  const name = `${row.firstName || ''} ${row.lastName || ''}`.trim();
  return name || row.email || t('records.portalPeopleTitle');
});

async function loadPerson() {
  loading.value = true;
  error.value = null;
  try {
    const res = await portalApiClient.get('/people/me');
    person.value = res?.data || null;
  } catch (err) {
    error.value = err.response?.data?.message || err.message || t('records.portalPeopleLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(loadPerson);
</script>
