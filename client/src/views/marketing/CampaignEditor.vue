<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
    <div v-if="loading" class="flex min-h-[40vh] items-center justify-center">
      <div class="text-center">
        <div
          class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
          aria-hidden="true"
        />
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('states.loading') }}
        </p>
      </div>
    </div>

    <template v-else>
      <header
        class="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <div class="border-b border-gray-100 bg-gradient-to-br from-indigo-50/80 via-white to-white px-5 py-5 dark:border-gray-800 dark:from-indigo-950/30 dark:via-gray-900 dark:to-gray-900 sm:px-6">
          <button
            type="button"
            class="mb-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            @click="goBack"
          >
            <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
            {{ t('actions.back') }}
          </button>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {{ pageTitle }}
          </h1>
          <p class="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
            {{ t('marketing.campaignsEditorDescription') }}
          </p>
        </div>
      </header>

      <form class="space-y-6 pb-24" @submit.prevent="handleSubmit">
        <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div class="border-b border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/60">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('marketing.campaignsEditorSectionBasics') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('marketing.campaignsEditorSectionBasicsDesc') }}
            </p>
          </div>
          <div class="space-y-5 px-5 py-5">
            <div>
              <label for="campaign-name" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                {{ t('marketing.campaignsFieldName') }}
                <span class="text-red-500">*</span>
              </label>
              <input
                id="campaign-name"
                v-model="form.name"
                type="text"
                required
                :class="fieldInputClass"
              />
            </div>

            <div>
              <label for="campaign-subject" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                {{ t('marketing.campaignsFieldSubject') }}
              </label>
              <input
                id="campaign-subject"
                v-model="form.subject"
                type="text"
                :class="fieldInputClass"
              />
            </div>

            <div class="grid gap-5 sm:grid-cols-2">
              <div>
                <label for="campaign-from-email" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  {{ t('marketing.campaignsFieldFromEmail') }}
                </label>
                <input
                  id="campaign-from-email"
                  v-model="form.fromEmail"
                  type="email"
                  :class="fieldInputClass"
                />
              </div>
              <div>
                <label for="campaign-from-name" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  {{ t('marketing.campaignsFieldFromName') }}
                </label>
                <input
                  id="campaign-from-name"
                  v-model="form.fromName"
                  type="text"
                  :class="fieldInputClass"
                />
              </div>
            </div>
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div class="border-b border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/60">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('marketing.campaignsEditorSectionAudience') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('marketing.campaignsEditorSectionAudienceDesc') }}
            </p>
          </div>
          <div class="space-y-5 px-5 py-5">
            <div>
              <label for="campaign-audience" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                {{ t('marketing.campaignsFieldAudience') }}
              </label>
              <HeadlessSelect
                id="campaign-audience"
                v-model="form.audienceId"
                :options="audienceSelectOptions"
                allow-empty
                :empty-label="t('marketing.campaignsFieldAudienceNone')"
                teleport
                wrapper-class="mt-2"
              />
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {{ t('marketing.campaignsFieldAudienceHelp') }}
              </p>
            </div>

            <div>
              <label for="campaign-template" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                {{ t('marketing.campaignsFieldTemplate') }}
              </label>
              <div class="mt-2 flex flex-wrap items-start gap-2">
                <HeadlessSelect
                  id="campaign-template"
                  v-model="form.templateId"
                  :options="templateSelectOptions"
                  allow-empty
                  :empty-label="t('marketing.campaignsFieldTemplateNone')"
                  teleport
                  wrapper-class="min-w-0 flex-1"
                  @update:model-value="handleTemplateChange"
                />
                <button
                  v-if="form.templateId"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  @click="openTemplateEditor"
                >
                  {{ t('marketing.campaignsEditTemplate') }}
                </button>
                <button
                  v-if="canPreviewEmail"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  @click="openEmailPreview"
                >
                  <EyeIcon class="h-4 w-4" aria-hidden="true" />
                  {{ t('marketing.campaignsPreviewEmail') }}
                </button>
              </div>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {{ t('marketing.campaignsFieldTemplateHelp') }}
                <router-link
                  to="/templates"
                  class="ml-1 font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  {{ t('marketing.campaignsFieldTemplateManage') }}
                </router-link>
              </p>
              <p
                v-if="templateOptions.length === 0 && !templatesLoading"
                class="mt-2 text-xs text-amber-600 dark:text-amber-400"
              >
                {{ t('marketing.campaignsFieldTemplateEmpty') }}
              </p>
            </div>
          </div>
        </section>

        <CampaignAbTestPanel
          v-model="form.abTest"
          v-model:variants="form.variants"
          :disabled="!isEditableAbTest"
        />

        <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div class="border-b border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/60">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('marketing.campaignsEditorSectionContent') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('marketing.campaignsEditorSectionContentDesc') }}
            </p>
          </div>
          <div class="px-5 py-5">
            <label for="campaign-body-html" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
              {{ t('marketing.campaignsFieldBodyHtml') }}
            </label>
            <textarea
              id="campaign-body-html"
              v-model="form.bodyHtml"
              rows="14"
              :class="[fieldInputClass, 'font-mono']"
            />
          </div>
        </section>

        <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div class="border-b border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/60">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('marketing.campaignsEditorSectionTracking') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('marketing.campaignsEditorSectionTrackingDesc') }}
            </p>
          </div>
          <div class="divide-y divide-gray-100 dark:divide-gray-800">
            <div class="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ t('marketing.campaignsFieldTrackOpens') }}
                </p>
              </div>
              <HeadlessSwitch v-model="form.trackOpens" />
            </div>
            <div class="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ t('marketing.campaignsFieldTrackClicks') }}
                </p>
              </div>
              <HeadlessSwitch v-model="form.trackClicks" />
            </div>
          </div>
        </section>
      </form>

      <div class="pointer-events-none fixed bottom-4 left-1/2 z-40 w-[min(95vw,720px)] -translate-x-1/2">
        <div class="pointer-events-auto flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800 dark:ring-white/10">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            @click="goBack"
          >
            {{ t('actions.cancel') }}
          </button>
          <PrimaryActionButton
            :label="saving ? t('states.saving') : t('actions.save')"
            type="button"
            icon="save"
            :loading="saving"
            :disabled="saving"
            @click="handleSubmit"
          />
        </div>
      </div>
    </template>

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
import { ChevronLeftIcon, EyeIcon } from '@heroicons/vue/24/outline';
import CampaignAbTestPanel from '@/components/marketing/CampaignAbTestPanel.vue';
import EmailPreviewModal from '@/modules/template/components/html/EmailPreviewModal.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessSwitch from '@/components/ui/HeadlessSwitch.vue';
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue';
import { useMarketingCampaigns } from '@/composables/useMarketingCampaigns';
import { useMarketingAudiences } from '@/composables/useMarketingAudiences';
import { useMarketingTemplates, buildMarketingEmailFromTemplate } from '@/composables/useMarketingTemplates';
import { useNotifications } from '@/composables/useNotifications';
import { parseCampaignEmailPreview } from '@/utils/marketingEmailPreview';
import { PROCESS_INPUT_CLASS } from '@/utils/processDesignerConstants';
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
const fieldInputClass = `${PROCESS_INPUT_CLASS} mt-2`;

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

const audienceSelectOptions = computed(() =>
  audienceOptions.value.map((item) => ({
    value: item._id,
    label: formatAudienceLabel(item)
  }))
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

const templateSelectOptions = computed(() =>
  templateOptions.value.map((item) => ({
    value: item._id,
    label: item.name
  }))
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
  const duplicateFrom = route.query?.duplicateFrom
    ? String(Array.isArray(route.query.duplicateFrom) ? route.query.duplicateFrom[0] : route.query.duplicateFrom)
    : '';
  if (!isEditMode.value && !duplicateFrom) return;
  loading.value = true;
  try {
    const data = await fetchCampaign(isEditMode.value ? resolvedId.value : duplicateFrom);
    applyCampaign(data);
    if (!isEditMode.value && duplicateFrom) {
      const base = String(form.name || '').trim();
      form.name = base && !/\(copy\)$/i.test(base) ? `${base} (Copy)` : base;
      campaignStatus.value = 'draft';
      form.abTest = {
        ...form.abTest,
        status: 'none'
      };
    }
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

async function handleTemplateChange(templateId) {
  if (!templateId) return;
  try {
    const record = await fetchTemplate(templateId);
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
