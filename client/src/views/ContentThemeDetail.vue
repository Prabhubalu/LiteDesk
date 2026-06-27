<template>
  <div class="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
    <TemplatesModuleNav />

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('states.loading') }}
    </div>

    <div v-else-if="!theme" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('templates.themeLoadFailed') }}
    </div>

    <template v-else>
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ theme.name }}</h1>
          <p v-if="theme.description" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ theme.description }}
          </p>
          <div class="mt-3">
            <span class="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-300">
              {{ formatStatus(theme.status) }}
            </span>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-if="canEdit"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="saving"
            @click="handleSave"
          >
            {{ saving ? t('states.saving') : t('actions.save') }}
          </button>
          <button
            v-if="canPublish && theme.status !== 'published'"
            type="button"
            class="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm"
            @click="handlePublish"
          >
            {{ t('templates.publish') }}
          </button>
          <button
            v-if="canArchive && theme.status !== 'archived'"
            type="button"
            class="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm"
            @click="handleArchive"
          >
            {{ t('templates.archive') }}
          </button>
        </div>
      </div>

      <form class="grid gap-6 md:grid-cols-2" @submit.prevent="handleSave">
        <section class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:col-span-2">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('templates.themeSectionGeneral') }}</h2>
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('templates.fieldName') }}</label>
              <input
                v-model="form.name"
                type="text"
                required
                :disabled="!canEdit"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('templates.themeFieldDescription') }}</label>
              <textarea
                v-model="form.description"
                rows="2"
                :disabled="!canEdit"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('templates.themeSectionColors') }}</h2>
          <div class="space-y-3">
            <div v-for="field in colorFields" :key="field.key" class="flex items-center gap-3">
              <input
                v-model="form.colors[field.key]"
                type="color"
                :disabled="!canEdit"
                class="h-9 w-12 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-60"
              />
              <div class="flex-1">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">{{ field.label }}</label>
                <input
                  v-model="form.colors[field.key]"
                  type="text"
                  :disabled="!canEdit"
                  class="mt-0.5 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm disabled:opacity-60"
                />
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('templates.themeSectionTypography') }}</h2>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('templates.themeFieldBodyFont') }}</label>
              <input
                v-model="form.typography.bodyFont"
                type="text"
                :disabled="!canEdit"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('templates.themeFieldHeadingFont') }}</label>
              <input
                v-model="form.typography.headingFont"
                type="text"
                :disabled="!canEdit"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('templates.themeFieldBaseFontSize') }}</label>
              <input
                v-model.number="form.typography.baseFontSize"
                type="number"
                min="8"
                max="24"
                :disabled="!canEdit"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:col-span-2">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('templates.themeSectionWatermark') }}</h2>
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('templates.themeFieldWatermarkText') }}</label>
              <input
                v-model="form.watermark.text"
                type="text"
                :disabled="!canEdit"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('templates.themeFieldWatermarkOpacity') }}</label>
              <input
                v-model.number="form.watermark.opacity"
                type="number"
                min="0"
                max="1"
                step="0.05"
                :disabled="!canEdit"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
          </div>
        </section>
      </form>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import TemplatesModuleNav from '@/components/templates/TemplatesModuleNav.vue';
import { useContentThemes } from '@/composables/useContentThemes';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  id: { type: String, default: '' }
});

const route = useRoute();
const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotifications();

const { fetchTheme, updateTheme, publishTheme, archiveTheme } = useContentThemes();

const loading = ref(true);
const saving = ref(false);
const theme = ref(null);

const form = reactive({
  name: '',
  description: '',
  colors: {
    primary: '#4f46e5',
    secondary: '#6366f1',
    text: '#111827',
    muted: '#6b7280',
    border: '#d1d5db',
    background: '#ffffff'
  },
  typography: {
    bodyFont: 'Arial, Helvetica, sans-serif',
    headingFont: 'Arial, Helvetica, sans-serif',
    baseFontSize: 12
  },
  watermark: {
    text: '',
    opacity: 0.15
  }
});

const themeId = computed(() => props.id || route.params.id);
const canEdit = computed(() => authStore.can('templates', 'edit'));
const canPublish = computed(() => authStore.can('templates', 'publish'));
const canArchive = computed(() => authStore.can('templates', 'archive'));

const colorFields = computed(() => [
  { key: 'primary', label: t('templates.themeColorPrimary') },
  { key: 'secondary', label: t('templates.themeColorSecondary') },
  { key: 'text', label: t('templates.themeColorText') },
  { key: 'muted', label: t('templates.themeColorMuted') },
  { key: 'border', label: t('templates.themeColorBorder') },
  { key: 'background', label: t('templates.themeColorBackground') }
]);

function formatStatus(value) {
  if (!value) return 'Draft';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function applyThemeToForm(data) {
  form.name = data.name || '';
  form.description = data.description || '';
  form.colors = { ...form.colors, ...(data.colors || {}) };
  form.typography = { ...form.typography, ...(data.typography || {}) };
  form.watermark = { ...form.watermark, ...(data.watermark || {}) };
}

async function loadTheme() {
  loading.value = true;
  try {
    theme.value = await fetchTheme(themeId.value);
    applyThemeToForm(theme.value);
  } catch (error) {
    theme.value = null;
    notifications.error(error?.message || t('templates.themeLoadFailed'));
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!canEdit.value) return;
  saving.value = true;
  try {
    theme.value = await updateTheme(themeId.value, {
      name: form.name.trim(),
      description: form.description.trim(),
      colors: { ...form.colors },
      typography: { ...form.typography },
      watermark: { ...form.watermark }
    });
    applyThemeToForm(theme.value);
    notifications.success(t('templates.themeSaveSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('templates.themeLoadFailed'));
  } finally {
    saving.value = false;
  }
}

async function handlePublish() {
  try {
    await publishTheme(themeId.value);
    notifications.success(t('templates.themePublishSuccess'));
    await loadTheme();
  } catch (error) {
    notifications.error(error?.message || t('templates.themeLoadFailed'));
  }
}

async function handleArchive() {
  try {
    await archiveTheme(themeId.value);
    await loadTheme();
  } catch (error) {
    notifications.error(error?.message || t('templates.themeLoadFailed'));
  }
}

watch(themeId, () => {
  if (themeId.value) loadTheme();
});

onMounted(() => {
  if (themeId.value) loadTheme();
});
</script>
