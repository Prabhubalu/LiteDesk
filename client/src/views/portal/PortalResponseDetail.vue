<template>
  <PortalPageShell
    :title="response?.formName || t('records.portalResponsesTitle')"
    :subtitle="response?.responseId || ''"
    :error="error"
    :back-label="t('records.portalResponsesBack')"
    @back="router.push({ name: 'portal-response-list' })"
  >
    <div v-if="loading" class="h-48" :class="PLATFORM_HOME_SKELETON_CLASS" />
    <div v-else-if="response" :class="['rounded-2xl p-5 sm:p-6', PLATFORM_HOME_CARD_CLASS]">
      <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.status') }}</dt>
          <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ response.executionStatus }}</dd>
        </div>
        <div v-if="response.reviewStatus">
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalResponsesReviewStatus') }}</dt>
          <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ response.reviewStatus }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalResponsesSubmittedAtLabel') }}</dt>
          <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ formatDate(response.submittedAt) }}</dd>
        </div>
        <div v-if="response.finalScore != null">
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalResponsesFinalScore') }}</dt>
          <dd class="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{{ response.finalScore }}%</dd>
        </div>
        <div v-if="response.compliancePercentage != null">
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalResponsesCompliance') }}</dt>
          <dd class="mt-1 text-sm text-neutral-900 dark:text-white">{{ response.compliancePercentage }}%</dd>
        </div>
        <div v-if="response.totalQuestions">
          <dt class="text-xs font-medium uppercase tracking-wide text-neutral-500">{{ t('records.portalResponsesQuestions') }}</dt>
          <dd class="mt-1 text-sm text-neutral-900 dark:text-white">
            {{ t('records.portalResponsesPassFail', { passed: response.totalPassed, failed: response.totalFailed, total: response.totalQuestions }) }}
          </dd>
        </div>
      </dl>

      <router-link
        v-if="canContinue"
        :to="{
          name: 'portal-form-fill',
          params: { id: response.formMongoId || response.formId },
          query: { responseId: response._id }
        }"
        class="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
      >
        {{ t('records.portalResponsesContinueForm') }}
      </router-link>
    </div>
  </PortalPageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import portalApiClient from '@/utils/portalApiClient';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import { PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_SKELETON_CLASS } from '@/utils/platformHomeLayout';
import { formatUserDateTime } from '@/utils/localeFormat';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref(null);
const response = ref(null);

const canContinue = computed(() => {
  const status = String(response.value?.executionStatus || '');
  return status === 'In Progress' || status === 'Not Started';
});

function formatDate(value) {
  if (!value) return '—';
  return formatUserDateTime(value) || '—';
}

async function loadResponse() {
  loading.value = true;
  error.value = null;
  try {
    const res = await portalApiClient.get(`/responses/${route.params.id}`);
    response.value = res?.data || null;
  } catch (err) {
    error.value = err.response?.data?.message || err.message || t('records.portalResponsesLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(loadResponse);
</script>
