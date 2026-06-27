<template>
  <PortalPageShell
    :title="t('records.portalOrganizationTitle')"
    :subtitle="t('records.portalOrganizationHint')"
    :error="error"
  >
    <div v-if="loading" class="h-48" :class="PLATFORM_HOME_SKELETON_CLASS" />
    <div v-else-if="organization" class="space-y-4">
      <div :class="['rounded-2xl p-5 sm:p-6', PLATFORM_HOME_CARD_CLASS]">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">{{ organization.name }}</h2>
        <dl class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div v-if="organization.email">
            <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('settings.settingsAddFieldTypeEmail') }}</dt>
            <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ organization.email }}</dd>
          </div>
          <div v-if="organization.phone">
            <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('settings.settingsAddFieldTypePhone') }}</dt>
            <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ organization.phone }}</dd>
          </div>
          <div v-if="organization.industry">
            <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalOrganizationIndustry') }}</dt>
            <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ organization.industry }}</dd>
          </div>
          <div v-if="organization.status">
            <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.status') }}</dt>
            <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ organization.status }}</dd>
          </div>
          <div v-if="formattedAddress" class="sm:col-span-2">
            <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalOrganizationAddress') }}</dt>
            <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ formattedAddress }}</dd>
          </div>
          <div v-if="organization.website" class="sm:col-span-2">
            <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalOrganizationWebsite') }}</dt>
            <dd class="mt-1 text-sm">
              <a
                :href="organization.website"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-600 hover:underline dark:text-primary-400"
              >
                {{ organization.website }}
              </a>
            </dd>
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
const organization = ref(null);

const formattedAddress = computed(() => {
  const org = organization.value;
  if (!org) return '';
  return [org.address, org.city, org.state, org.postalCode, org.country].filter(Boolean).join(', ');
});

async function loadOrganization() {
  loading.value = true;
  error.value = null;
  try {
    const res = await portalApiClient.get('/organization');
    organization.value = res?.data || null;
  } catch (err) {
    error.value = err.response?.data?.message || err.message || t('records.portalOrganizationLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(loadOrganization);
</script>
