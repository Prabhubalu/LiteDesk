<template>
  <PortalPageShell
    :title="t('records.portalFormsTitle')"
    :subtitle="t('records.portalFormsHint')"
    :error="error"
  >
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-24" :class="PLATFORM_HOME_SKELETON_CLASS" />
    </div>
    <div
      v-else-if="!forms.length"
      :class="['p-10 text-center sm:p-12', PLATFORM_HOME_CARD_CLASS]"
    >
      <h3 class="text-lg font-medium text-neutral-900 dark:text-white">{{ t('records.portalFormsEmpty') }}</h3>
    </div>

    <div v-else class="space-y-3">
      <router-link
        v-for="form in forms"
        :key="form._id"
        :to="{ name: 'portal-form-fill', params: { id: form._id } }"
        class="block rounded-2xl p-4 transition-colors hover:border-primary-200 dark:hover:border-primary-500/30"
        :class="PLATFORM_HOME_CARD_CLASS"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-base font-semibold text-neutral-900 dark:text-white">{{ form.name }}</p>
            <p v-if="form.description" class="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
              {{ form.description }}
            </p>
          </div>
          <span class="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {{ form.formType }}
          </span>
        </div>
      </router-link>
    </div>
  </PortalPageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import portalApiClient from '@/utils/portalApiClient';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import { PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_SKELETON_CLASS } from '@/utils/platformHomeLayout';

const { t } = useI18n();
const loading = ref(true);
const error = ref(null);
const forms = ref([]);

async function loadForms() {
  loading.value = true;
  error.value = null;
  try {
    const res = await portalApiClient.get('/forms');
    forms.value = Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    error.value = err.response?.data?.message || err.message || t('records.portalFormsLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(loadForms);
</script>
