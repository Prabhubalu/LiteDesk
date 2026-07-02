<template>
  <div class="mx-auto max-w-3xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <button
          type="button"
          class="mb-2 text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          @click="goBack"
        >
          {{ t('actions.back') }}
        </button>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
          {{ pageTitle }}
        </h1>
      </div>
    </div>

    <form class="space-y-5" @submit.prevent="handleSubmit">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('marketing.campaignsFieldName') }}
        </label>
        <input
          v-model="form.name"
          type="text"
          required
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('marketing.campaignsFieldSubject') }}
        </label>
        <input
          v-model="form.subject"
          type="text"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.campaignsFieldFromEmail') }}
          </label>
          <input
            v-model="form.fromEmail"
            type="email"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.campaignsFieldFromName') }}
          </label>
          <input
            v-model="form.fromName"
            type="text"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('marketing.campaignsFieldAudience') }}
        </label>
        <select
          v-model="form.audienceId"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        >
          <option value="">{{ t('marketing.campaignsFieldAudienceNone') }}</option>
          <option
            v-for="item in audienceOptions"
            :key="item._id"
            :value="item._id"
          >
            {{ formatAudienceLabel(item) }}
          </option>
        </select>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ t('marketing.campaignsFieldAudienceHelp') }}
        </p>
      </div>

      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('marketing.campaignsFieldTemplate') }}
        </label>
        <div class="flex flex-wrap items-center gap-2">
          <select
            v-model="form.templateId"
            class="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            @change="handleTemplateChange"
          >
            <option value="">{{ t('marketing.campaignsFieldTemplateNone') }}</option>
            <option
              v-for="item in templateOptions"
              :key="item._id"
              :value="item._id"
            >
              {{ item.name }}
            </option>
          </select>
          <button
            v-if="form.templateId"
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            @click="openTemplateEditor"
          >
            {{ t('marketing.campaignsEditTemplate') }}
          </button>
          <button
            v-if="canPreviewEmail"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            @click="openEmailPreview"
          >
            <EyeIcon class="h-4 w-4" aria-hidden="true" />
            {{ t('marketing.campaignsPreviewEmail') }}
          </button>
        </div>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ t('marketing.campaignsFieldTemplateHelp') }}
          <router-link
            to="/templates"
            class="ml-1 text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            {{ t('marketing.campaignsFieldTemplateManage') }}
          </router-link>
        </p>
        <p
          v-if="templateOptions.length === 0 && !templatesLoading"
          class="mt-1 text-xs text-amber-600 dark:text-amber-400"
        >
          {{ t('marketing.campaignsFieldTemplateEmpty') }}
        </p>
      </div>

      <CampaignAbTestPanel
        v-model="form.abTest"
        v-model:variants="form.variants"
        :disabled="!isEditableAbTest"
        class="mb-2"
      />

      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('marketing.campaignsFieldBodyHtml') }}
        </label>
        <textarea
          v-model="form.bodyHtml"
          rows="12"
          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
        />
      </div>

      <div class="flex flex-wrap gap-6">
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input v-model="form.trackOpens" type="checkbox" class="rounded border-gray-300" />
          {{ t('marketing.campaignsFieldTrackOpens') }}
        </label>
        <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input v-model="form.trackClicks" type="checkbox" class="rounded border-gray-300" />
          {{ t('marketing.campaignsFieldTrackClicks') }}
        </label>
      </div>

      <div class="flex flex-wrap gap-3 border-t border-gray-200 pt-5 dark:border-gray-700">
        <button
          type="submit"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="saving"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="goBack"
        >
          {{ t('actions.cancel') }}
        </button>
      </div>
    </form>

    <EmailPreviewModal
      :open="showEmailPreview"
      :html="previewHtml"
      :css="previewCss"
      @close="showEmailPreview = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { EyeIcon } from '@heroicons/vue/24/outline';
import CampaignAbTestPanel from '@/components/marketing/CampaignAbTestPanel.vue';
import EmailPreviewModal from '@/modules/template/components/html/EmailPreviewModal.vue';
import { useMarketingCampaigns } from '@/composables/useMarketingCampaigns';
import { useMarketingAudiences } from '@/composables/useMarketingAudiences';
import { useMarketingTemplates, buildMarketingEmailFromTemplate } from '@/composables/useMarketingTemplates';
import { useNotifications } from '@/composables/useNotifications';
import { parseCampaignEmailPreview } from '@/utils/marketingEmailPreview';

const props = defineProps({
  campaignId: {
    type: String,
    default: ''
  }
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const notifications = useNotifications();
const { fetchCampaign, createCampaign, updateCampaign } = useMarketingCampaigns();
const { audiences, fetchAudiences } = useMarketingAudiences();
const { templates, fetchTemplates, fetchTemplate } = useMarketingTemplates();

const saving = ref(false);
const loading = ref(false);
const templatesLoading = ref(false);
const showEmailPreview = ref(false);
const previewHtml = ref('');
const previewCss = ref('');

const form = reactive({
  name: '',
  subject: '',
  fromEmail: '',
  fromName: '',
  bodyHtml: '',
  audienceId: '',
  templateId: '',
  trackOpens: true,
  trackClicks: true,
  abTest: {
    enabled: false,
    winnerMetric: 'open_rate',
    samplePercent: 20,
    testDurationHours: 4,
    status: 'none'
  },
  variants: [
    { key: 'A', label: 'Variant A', subject: '', splitPercent: 50 },
    { key: 'B', label: 'Variant B', subject: '', splitPercent: 50 }
  ]
});

const audienceOptions = computed(() =>
  audiences.value.filter((item) => {
    if (item.type !== 'dynamic') return true;
    return Boolean(item.segmentId);
  })
);

function formatAudienceLabel(item) {
  const count = item.memberCount ?? 0;
  const typeLabel = item.type === 'dynamic'
    ? t('marketing.audiencesTypeDynamic')
    : t('marketing.audiencesTypeStatic');
  return `${item.name} (${typeLabel} · ${count})`;
}

const templateOptions = computed(() =>
  templates.value.filter((item) => item.status === 'draft' || item.status === 'published')
);

const resolvedId = computed(() => props.campaignId || route.params.id || '');
const isEditMode = computed(() => Boolean(resolvedId.value && route.name === 'marketing-campaign-edit'));
const isEditableAbTest = computed(() => {
  if (!isEditMode.value) return true;
  const status = campaignStatus.value;
  return !status || status === 'draft' || status === 'scheduled';
});

const campaignStatus = ref('');

const pageTitle = computed(() =>
  isEditMode.value ? t('marketing.campaignsEditTitle') : t('marketing.campaignsCreateTitle')
);

const canPreviewEmail = computed(() =>
  Boolean(String(form.bodyHtml || '').trim() || form.templateId)
);

function applyCampaign(data) {
  form.name = data?.name || '';
  form.subject = data?.subject || '';
  form.fromEmail = data?.fromEmail || '';
  form.fromName = data?.fromName || '';
  form.bodyHtml = data?.bodyHtml || '';
  form.audienceId = data?.audienceId ? String(data.audienceId) : '';
  form.templateId = data?.templateId ? String(data.templateId) : '';
  form.trackOpens = data?.trackOpens !== false;
  form.trackClicks = data?.trackClicks !== false;
  campaignStatus.value = data?.status || 'draft';
  form.abTest = {
    enabled: data?.abTest?.enabled === true,
    winnerMetric: data?.abTest?.winnerMetric || 'open_rate',
    samplePercent: data?.abTest?.samplePercent ?? 20,
    testDurationHours: data?.abTest?.testDurationHours ?? 4,
    status: data?.abTest?.status || 'none'
  };
  if (Array.isArray(data?.variants) && data.variants.length >= 2) {
    form.variants = data.variants.map((row) => ({
      key: row.key,
      label: row.label || row.key,
      subject: row.subject || '',
      splitPercent: row.splitPercent ?? 50
    }));
  }
}

async function loadCampaign() {
  if (!isEditMode.value) return;
  loading.value = true;
  try {
    const data = await fetchCampaign(resolvedId.value);
    applyCampaign(data);
  } catch (err) {
    notifications.error(err?.message || t('marketing.campaignsDetailError'));
    router.push({ name: 'marketing-campaigns' });
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  if (!form.name.trim()) {
    notifications.error(t('marketing.campaignsValidationNameRequired'));
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      subject: form.subject.trim(),
      fromEmail: form.fromEmail.trim(),
      fromName: form.fromName.trim(),
      bodyHtml: form.bodyHtml,
      audienceId: form.audienceId || null,
      templateId: form.templateId || null,
      trackOpens: form.trackOpens,
      trackClicks: form.trackClicks,
      campaignType: form.abTest.enabled ? 'ab_test' : 'standard',
      abTest: form.abTest,
      variants: form.variants
    };

    if (isEditMode.value) {
      await updateCampaign(resolvedId.value, payload);
      notifications.success(t('marketing.campaignsUpdateSuccess'));
      router.push({ name: 'marketing-campaign-detail', params: { id: resolvedId.value } });
      return;
    }

    const created = await createCampaign(payload);
    notifications.success(t('marketing.campaignsCreateSuccess'));
    const id = created?._id || created?.id;
    if (id) {
      router.push({ name: 'marketing-campaign-detail', params: { id } });
    } else {
      router.push({ name: 'marketing-campaigns' });
    }
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    saving.value = false;
  }
}

function goBack() {
  if (isEditMode.value && resolvedId.value) {
    router.push({ name: 'marketing-campaign-detail', params: { id: resolvedId.value } });
    return;
  }
  router.push({ name: 'marketing-campaigns' });
}

async function handleTemplateChange() {
  if (!form.templateId) return;
  try {
    const record = await fetchTemplate(form.templateId);
    form.bodyHtml = buildMarketingEmailFromTemplate(record);
  } catch (err) {
    notifications.error(err?.message || t('marketing.campaignsTemplateApplyError'));
    form.templateId = '';
  }
}

function openTemplateEditor() {
  if (!form.templateId) return;
  router.push({ name: 'template-builder', params: { id: form.templateId } });
}

async function openEmailPreview() {
  try {
    let templateRecord = null;
    if (form.templateId) {
      templateRecord = await fetchTemplate(form.templateId);
    }
    const bodyHtml = String(form.bodyHtml || '').trim()
      || (templateRecord ? buildMarketingEmailFromTemplate(templateRecord) : '');
    const parsed = parseCampaignEmailPreview(bodyHtml, templateRecord);
    if (!parsed.html && !parsed.css) {
      notifications.error(t('marketing.campaignsPreviewEmailEmpty'));
      return;
    }
    previewHtml.value = parsed.html;
    previewCss.value = parsed.css;
    showEmailPreview.value = true;
  } catch (err) {
    notifications.error(err?.message || t('marketing.campaignsPreviewEmailEmpty'));
  }
}

onMounted(async () => {
  await fetchAudiences({ limit: 100 });
  templatesLoading.value = true;
  try {
    await fetchTemplates({ limit: 100 });
  } finally {
    templatesLoading.value = false;
  }
  await loadCampaign();
});
</script>
