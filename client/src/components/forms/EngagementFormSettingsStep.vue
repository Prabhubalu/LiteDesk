<template>
  <div class="space-y-8">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ t('forms.engagementSettingsHeading') }}
      </h3>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ settingsIntro }}
      </p>
    </div>

    <!-- Distribution -->
    <section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 p-5 space-y-4">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('forms.engagementSettingsDistribution') }}
        </h4>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.engagementSettingsDistributionDesc') }}
        </p>
      </div>

      <label class="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
        <HeadlessCheckbox
          v-model="localForm.publicLink.enabled"
          checkbox-class="w-4 h-4 mt-0.5"
        />
        <div class="min-w-0">
          <span class="block text-sm font-medium text-gray-900 dark:text-white">
            {{ t('forms.engagementSettingsPublicLink') }}
          </span>
          <span class="block text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            {{ t('forms.engagementSettingsPublicLinkDesc') }}
          </span>
        </div>
      </label>

      <div
        v-if="localForm.publicLink?.enabled"
        class="rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-900/20 p-4"
      >
        <p class="text-xs font-medium text-indigo-800 dark:text-indigo-200 mb-1">
          {{ t('forms.engagementSettingsLinkPreview') }}
        </p>
        <p class="text-sm font-mono text-indigo-900 dark:text-indigo-100 truncate">
          {{ publicLinkPreview }}
        </p>
        <p class="mt-2 text-xs text-indigo-700/80 dark:text-indigo-300/80">
          {{ t('forms.engagementSettingsLinkSlugHint') }}
        </p>
      </div>

      <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('forms.fieldVisibility') }}:</span>
        <span>{{ visibilityLabel }}</span>
      </div>
    </section>

    <!-- Branding -->
    <section class="rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('forms.engagementBrandingTitle') }}
        </h4>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.engagementBrandingHint') }}
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('webforms.builderBrandingLogo') }}
        </label>
        <div class="space-y-3">
          <div class="rounded-lg border border-dashed border-gray-200 dark:border-gray-600 p-4">
            <img
              v-if="localForm.branding.logoUrl"
              :src="resolveLogoUrl(localForm.branding.logoUrl)"
              alt=""
              class="mx-auto mb-3 max-h-12 w-auto object-contain"
            />
            <p v-else class="text-xs text-center text-gray-400 dark:text-gray-500">
              {{ t('webforms.builderBrandingLogoEmpty') }}
            </p>
            <div class="flex flex-wrap items-center justify-center gap-2">
              <label
                class="inline-flex cursor-pointer items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                :class="logoUploading ? 'pointer-events-none opacity-60' : ''"
              >
                <input
                  type="file"
                  class="hidden"
                  accept="image/*"
                  :disabled="logoUploading"
                  @change="onLogoSelected"
                />
                <span>{{ logoUploading ? t('common.formUploading') : t('webforms.builderBrandingLogoUpload') }}</span>
              </label>
              <button
                v-if="localForm.branding.logoUrl"
                type="button"
                class="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                :disabled="logoUploading"
                @click="localForm.branding.logoUrl = ''"
              >
                {{ t('actions.remove') }}
              </button>
            </div>
          </div>
          <input
            v-model="localForm.branding.logoUrl"
            type="url"
            class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            :placeholder="t('webforms.builderBrandingLogoPh')"
          />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('webforms.builderBrandingThemeColor') }}
          </label>
          <div class="flex items-center gap-2">
            <input
              v-model="localForm.branding.themeColor"
              type="color"
              class="h-10 w-12 shrink-0 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
            />
            <input
              v-model="localForm.branding.themeColor"
              type="text"
              class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('webforms.builderBrandingBackground') }}
          </label>
          <div class="flex items-center gap-2">
            <input
              :value="localForm.branding.backgroundColor || '#f9fafb'"
              type="color"
              class="h-10 w-12 shrink-0 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
              @input="localForm.branding.backgroundColor = $event.target.value === '#f9fafb' ? '' : $event.target.value"
            />
            <input
              v-model="localForm.branding.backgroundColor"
              type="text"
              class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              :placeholder="t('webforms.builderBrandingBackgroundPh')"
            />
          </div>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('webforms.builderBrandingFont') }}
        </label>
        <select
          v-model="localForm.branding.fontFamily"
          class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        >
          <option value="system">{{ t('webforms.builderBrandingFontSystem') }}</option>
          <option value="serif">{{ t('webforms.builderBrandingFontSerif') }}</option>
          <option value="mono">{{ t('webforms.builderBrandingFontMono') }}</option>
        </select>
      </div>
    </section>

    <!-- Analytics -->
    <section class="rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('forms.engagementSettingsAnalytics') }}
        </h4>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.engagementSettingsAnalyticsDesc') }}
        </p>
      </div>

      <div class="space-y-3">
        <label class="flex items-center gap-3">
          <HeadlessCheckbox
            :checked="localForm.kpiMetrics?.rating"
            checkbox-class="w-4 h-4"
            @change="toggleKpi('rating', $event.target.checked)"
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.engagementSettingsTrackRating') }}
            </span>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.engagementSettingsTrackRatingDesc') }}</p>
          </div>
        </label>

        <label class="flex items-center gap-3">
          <HeadlessCheckbox
            :checked="localForm.kpiMetrics?.satisfactionPercentage"
            checkbox-class="w-4 h-4"
            @change="toggleKpi('satisfactionPercentage', $event.target.checked)"
          />
          <div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('forms.engagementSettingsTrackSatisfaction') }}
            </span>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.engagementSettingsTrackSatisfactionDesc') }}</p>
          </div>
        </label>
      </div>
    </section>

    <!-- Notifications -->
    <section class="rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('forms.engagementSettingsNotifications') }}
        </h4>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {{ t('forms.engagementSettingsNotificationsDesc') }}
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('forms.engagementSettingsNotifyUsers') }}
        </label>
        <select
          v-model="selectedNotifyUser"
          class="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          @change="addNotifyUser"
        >
          <option value="">{{ t('forms.engagementSettingsSelectUser') }}</option>
          <option
            v-for="user in availableNotifyUsers"
            :key="user._id"
            :value="user._id"
          >
            {{ user.firstName }} {{ user.lastName }}
          </option>
        </select>

        <div v-if="notifyUsers.length > 0" class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="userId in notifyUsers"
            :key="userId"
            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          >
            {{ getUserLabel(userId) }}
            <button
              type="button"
              class="text-gray-500 hover:text-gray-800 dark:hover:text-white"
              @click="removeNotifyUser(userId)"
            >
              <span class="sr-only">{{ t('actions.remove') }}</span>
              ×
            </button>
          </span>
        </div>
      </div>
    </section>

    <!-- Publish readiness -->
    <section
      class="rounded-xl border p-5"
      :class="readinessClasses"
    >
      <div class="flex items-start gap-3">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 dark:bg-gray-900/60">
          <CheckCircleIcon v-if="isReadyToPublish" class="h-5 w-5 text-emerald-600" />
          <InformationCircleIcon v-else class="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <p class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ readinessTitle }}
          </p>
          <p class="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {{ readinessDescription }}
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircleIcon, InformationCircleIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { defaultWebformBranding, mergeWebformBranding } from '@/utils/webformBranding';
import { uploadWebformHeaderImage } from '@/utils/webformHeaderImageUpload';
import { resolveWebformImageUrl } from '@/utils/webformFormatters';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const { notifyError } = useNotifications();

const props = defineProps({
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update']);

const users = ref([]);
const selectedNotifyUser = ref('');
const logoUploading = ref(false);

const initializeLocalForm = () => {
  const formData = props.form || {};
  return {
    ...formData,
    visibility: formData.visibility || 'Public',
    branding: mergeWebformBranding(formData.branding),
    kpiMetrics: {
      compliancePercentage: false,
      satisfactionPercentage: formData.kpiMetrics?.satisfactionPercentage ?? false,
      rating: formData.kpiMetrics?.rating ?? false,
      ...(formData.kpiMetrics || {})
    },
    publicLink: {
      enabled: formData.publicLink?.enabled ?? false,
      slug: formData.publicLink?.slug || '',
      ...(formData.publicLink || {})
    },
    workflowOnSubmit: {
      notify: Array.isArray(formData.workflowOnSubmit?.notify) ? [...formData.workflowOnSubmit.notify] : [],
      createTask: formData.workflowOnSubmit?.createTask ?? false,
      updateField: formData.workflowOnSubmit?.updateField ?? null,
      ...(formData.workflowOnSubmit || {})
    }
  };
};

const localForm = ref(initializeLocalForm());
let isSyncing = false;
let lastEmittedForm = null;

const formTypeLower = computed(() => (localForm.value.formType || 'survey').toLowerCase());
const isFeedback = computed(() => formTypeLower.value === 'feedback');

const settingsIntro = computed(() => {
  if (isFeedback.value) return t('forms.engagementSettingsIntroFeedback');
  return t('forms.engagementSettingsIntroSurvey');
});

const visibilityLabel = computed(() => {
  const map = {
    Public: t('forms.visibilityPublic'),
    Partner: t('forms.visibilityPartner'),
    Internal: t('forms.visibilityInternal')
  };
  return map[localForm.value.visibility] || localForm.value.visibility;
});

const publicLinkPreview = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.arivu.com';
  const slug = localForm.value.publicLink?.slug || t('forms.engagementSettingsLinkPlaceholder');
  return `${origin}/forms/public/${slug}`;
});

const notifyUsers = computed(() => localForm.value.workflowOnSubmit?.notify || []);

const availableNotifyUsers = computed(() => {
  const selected = new Set(notifyUsers.value.map(String));
  return users.value.filter((user) => !selected.has(String(user._id)));
});

const questionCount = computed(() => {
  const sections = props.form?.sections || [];
  let count = 0;
  for (const section of sections) {
    if (section._isRootSection && section.subsections?.[0]?.questions) {
      count += section.subsections[0].questions.length;
    }
    count += (section.questions || []).length;
    for (const sub of section.subsections || []) {
      count += (sub.questions || []).length;
    }
  }
  return count;
});

const isReadyToPublish = computed(() => {
  return Boolean(localForm.value.name?.trim()) && questionCount.value > 0;
});

const readinessClasses = computed(() => {
  return isReadyToPublish.value
    ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-900/20'
    : 'border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/20';
});

const readinessTitle = computed(() => {
  return isReadyToPublish.value
    ? t('forms.engagementSettingsReadyTitle')
    : t('forms.engagementSettingsNotReadyTitle');
});

const readinessDescription = computed(() => {
  if (isReadyToPublish.value) {
    return t('forms.engagementSettingsReadyDesc');
  }
  if (!localForm.value.name?.trim()) {
    return t('forms.engagementSettingsNotReadyName');
  }
  return t('forms.engagementSettingsNotReadyQuestions');
});

const toggleKpi = (key, checked) => {
  if (!localForm.value.kpiMetrics) {
    localForm.value.kpiMetrics = { compliancePercentage: false, satisfactionPercentage: false, rating: false };
  }
  localForm.value.kpiMetrics[key] = checked;
};

const getUserLabel = (userId) => {
  const user = users.value.find((u) => String(u._id) === String(userId));
  if (!user) return String(userId);
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
};

const addNotifyUser = () => {
  if (!selectedNotifyUser.value) return;
  const current = [...notifyUsers.value];
  if (!current.includes(selectedNotifyUser.value)) {
    current.push(selectedNotifyUser.value);
    localForm.value.workflowOnSubmit.notify = current;
  }
  selectedNotifyUser.value = '';
};

const removeNotifyUser = (userId) => {
  localForm.value.workflowOnSubmit.notify = notifyUsers.value.filter((id) => String(id) !== String(userId));
};

const resolveLogoUrl = (url) => resolveWebformImageUrl(url);

const onLogoSelected = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  logoUploading.value = true;
  try {
    if (!localForm.value.branding) {
      localForm.value.branding = defaultWebformBranding();
    }
    localForm.value.branding.logoUrl = await uploadWebformHeaderImage(file);
  } catch (error) {
    notifyError(error?.message || t('webforms.builderBrandingLogoUploadFailed'));
  } finally {
    logoUploading.value = false;
  }
};

watch(() => props.form?.formType, () => {
  isSyncing = true;
  localForm.value = initializeLocalForm();
  lastEmittedForm = null;
  setTimeout(() => { isSyncing = false; }, 100);
});

watch(() => localForm.value, (newForm) => {
  if (!isSyncing) {
    const serialized = JSON.stringify(newForm);
    if (serialized !== lastEmittedForm) {
      lastEmittedForm = serialized;
      emit('update', JSON.parse(serialized));
    }
  }
}, { deep: true });

const fetchUsers = async () => {
  try {
    const response = await apiClient('/users?limit=100', { method: 'GET' });
    if (response.success) {
      users.value = Array.isArray(response.data) ? response.data : [];
    }
  } catch {
    users.value = [];
  }
};

onMounted(fetchUsers);
</script>
