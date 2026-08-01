<template>
  <div class="mx-auto max-w-6xl">
    <div class="mb-8">
      <router-link
        to="/control/release-notes"
        class="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        ← {{ t('releaseNotes.adminBackList') }}
      </router-link>
      <h1 class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
        {{ isNew ? t('releaseNotes.adminCreateTitle') : t('releaseNotes.adminEditTitle') }}
      </h1>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
    >
      {{ error }}
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
    </div>

    <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <form class="space-y-6" @submit.prevent="saveDraft">
        <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('releaseNotes.adminSectionDetails') }}
          </h2>
          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('releaseNotes.adminFieldVersion') }}</label>
              <input
                v-model="form.version"
                type="text"
                required
                :disabled="!canEdit"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
              >
            </div>
            <div class="sm:col-span-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('releaseNotes.adminFieldTitle') }}</label>
              <input
                v-model="form.title"
                type="text"
                required
                :disabled="!canEdit"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
              >
            </div>
            <div class="sm:col-span-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ t('releaseNotes.adminFieldSummary') }}
                <span class="font-normal text-gray-400 dark:text-gray-500">({{ t('releaseNotes.adminFieldOptional') }})</span>
              </label>
              <textarea
                v-model="form.summary"
                rows="2"
                :disabled="!canEdit"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('releaseNotes.adminFieldImportance') }}</label>
              <select
                v-model="form.importance"
                :disabled="!canEdit"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
              >
                <option v-for="option in importanceOptions" :key="option" :value="option">
                  {{ t(`releaseNotes.adminImportance_${option}`) }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('releaseNotes.adminFieldBadgeExpires') }}</label>
              <input
                v-model="badgeExpiresAtLocal"
                type="datetime-local"
                :disabled="!canEdit"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
              >
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('releaseNotes.adminSectionTargeting') }}
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('releaseNotes.adminTargetingHint') }}
          </p>
          <div class="mt-4">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('releaseNotes.adminTargetApps') }}</p>
            <div class="mt-2 flex flex-wrap gap-3">
              <label
                v-for="appKey in targetApps"
                :key="appKey"
                class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  v-model="form.targetApps"
                  type="checkbox"
                  :value="appKey"
                  :disabled="!canEdit"
                  class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                >
                {{ appKey }}
              </label>
            </div>
          </div>
          <div class="mt-4">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('releaseNotes.adminTargetPlans') }}</p>
            <div class="mt-2 flex flex-wrap gap-3">
              <label
                v-for="plan in targetPlans"
                :key="plan"
                class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  v-model="form.targetPlans"
                  type="checkbox"
                  :value="plan"
                  :disabled="!canEdit"
                  class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                >
                {{ t(`releaseNotes.adminPlan_${plan}`) }}
              </label>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('releaseNotes.adminSectionItems') }}
            </h2>
            <button
              v-if="canEdit"
              type="button"
              class="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
              @click="addItem"
            >
              {{ t('releaseNotes.adminAddItem') }}
            </button>
          </div>

          <div class="mt-4 space-y-6">
            <div
              v-for="(item, index) in form.items"
              :key="index"
              class="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            >
              <div class="mb-3 flex items-center justify-between gap-2">
                <span class="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {{ t('releaseNotes.adminItemIndex', { index: index + 1 }) }}
                </span>
                <button
                  v-if="canEdit && form.items.length > 1"
                  type="button"
                  class="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                  @click="removeItem(index)"
                >
                  {{ t('actions.remove') }}
                </button>
              </div>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('releaseNotes.adminItemType') }}</label>
                  <select
                    v-model="item.type"
                    :disabled="!canEdit"
                    class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
                  >
                    <option v-for="type in itemTypes" :key="type" :value="type">
                      {{ t(`releaseNotes.adminItemType_${type}`) }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('releaseNotes.adminItemTitle') }}</label>
                  <input
                    v-model="item.title"
                    type="text"
                    :disabled="!canEdit"
                    class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
                  >
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ t('releaseNotes.adminItemDescription') }}
                    <span class="font-normal text-gray-400 dark:text-gray-500">({{ t('releaseNotes.adminFieldOptional') }})</span>
                  </label>
                  <textarea
                    v-model="item.description"
                    rows="4"
                    :disabled="!canEdit"
                    class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
                  />
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('releaseNotes.adminItemImage') }}</label>
                  <div class="mt-2 space-y-3">
                    <div
                      class="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600"
                      :class="item.imageUrl ? 'bg-gray-50 dark:bg-gray-900/40' : ''"
                    >
                      <img
                        v-if="item.imageUrl"
                        :src="resolveImageUrl(item.imageUrl)"
                        alt=""
                        class="max-h-32 rounded-lg border border-gray-200 object-contain dark:border-gray-700"
                      >
                      <p
                        v-else
                        class="text-sm text-gray-500 dark:text-gray-400"
                      >
                        {{ t('releaseNotes.adminItemImageEmpty') }}
                      </p>
                      <div v-if="canEdit" class="flex flex-wrap items-center gap-2">
                        <label
                          class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                          :class="imageUploadingIndex === index ? 'pointer-events-none opacity-60' : ''"
                        >
                          <input
                            type="file"
                            class="hidden"
                            accept="image/*"
                            :disabled="imageUploadingIndex === index"
                            @change="(event) => onImageSelected(index, event)"
                          >
                          <span>{{ imageUploadingIndex === index ? t('common.formUploading') : t('releaseNotes.adminItemUploadImage') }}</span>
                        </label>
                        <button
                          v-if="item.imageUrl"
                          type="button"
                          class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900"
                          :disabled="imageUploadingIndex === index"
                          @click="item.imageUrl = ''"
                        >
                          {{ t('releaseNotes.adminItemRemoveImage') }}
                        </button>
                      </div>
                    </div>
                    <details v-if="canEdit" class="group">
                      <summary class="inline-flex cursor-pointer select-none items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                        <svg class="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                        {{ t('releaseNotes.adminItemPasteImageUrl') }}
                      </summary>
                      <input
                        v-model="item.imageUrl"
                        type="text"
                        :placeholder="t('releaseNotes.adminItemImageUrlPh')"
                        class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                      >
                    </details>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('releaseNotes.adminItemCtaLabel') }}</label>
                  <input
                    v-model="item.ctaLabel"
                    type="text"
                    :disabled="!canEdit"
                    class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
                  >
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('releaseNotes.adminItemCtaUrl') }}</label>
                  <input
                    v-model="item.ctaUrl"
                    type="text"
                    :disabled="!canEdit"
                    class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
                  >
                </div>
              </div>
            </div>
          </div>
        </section>

        <div v-if="canEdit" class="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <button
            type="submit"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="saving"
          >
            {{ saving ? t('states.saving') : t('releaseNotes.adminSaveDraft') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900 disabled:opacity-50"
            :disabled="saving || isNew"
            @click="publishNow"
          >
            {{ t('releaseNotes.adminPublishNow') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900 disabled:opacity-50"
            :disabled="saving || isNew"
            @click="scheduleRelease"
          >
            {{ t('releaseNotes.adminSchedule') }}
          </button>
        </div>
      </form>

      <aside class="space-y-4">
        <div
          v-if="noteStatus"
          class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ t('releaseNotes.adminColStatus') }}
          </p>
          <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {{ t(`releaseNotes.adminStatus_${noteStatus}`) }}
          </p>
          <p v-if="publishedAt" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {{ t('releaseNotes.adminPublishedAt', { date: formatDate(publishedAt) }) }}
          </p>
        </div>

        <div
          v-if="!isNew"
          class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('releaseNotes.adminAudiencePreview') }}
            </p>
            <button
              type="button"
              class="text-xs font-medium text-indigo-600 dark:text-indigo-400"
              @click="loadAudiencePreview"
            >
              {{ t('actions.refresh') }}
            </button>
          </div>
          <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
            {{ audienceCount ?? '—' }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('releaseNotes.adminAudienceHint') }}
          </p>
        </div>

        <div
          v-if="stats"
          class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('releaseNotes.adminStatsTitle') }}
            </p>
            <button
              type="button"
              class="text-xs font-medium text-indigo-600 dark:text-indigo-400"
              @click="loadStats"
            >
              {{ t('actions.refresh') }}
            </button>
          </div>
          <dl class="mt-3 space-y-2 text-sm">
            <div class="flex justify-between gap-2">
              <dt class="text-gray-500 dark:text-gray-400">{{ t('releaseNotes.adminStatsViewed') }}</dt>
              <dd class="font-medium text-gray-900 dark:text-white">{{ stats.viewedUserCount }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-gray-500 dark:text-gray-400">{{ t('releaseNotes.adminStatsTargeted') }}</dt>
              <dd class="font-medium text-gray-900 dark:text-white">{{ stats.targetedUserCount }}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-gray-500 dark:text-gray-400">{{ t('releaseNotes.adminStatsViewRate') }}</dt>
              <dd class="font-medium text-gray-900 dark:text-white">{{ formatRate(stats.viewRate) }}</dd>
            </div>
          </dl>
        </div>

        <button
          v-if="!isNew && noteStatus !== 'archived'"
          type="button"
          class="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          :disabled="archiving"
          @click="archiveNote"
        >
          {{ archiving ? t('states.saving') : t('releaseNotes.adminArchive') }}
        </button>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { getApiUrlForFetch } from '@/config/apiBase';
import {
  archivePlatformNote,
  createPlatformNote,
  getPlatformAudiencePreview,
  getPlatformNote,
  getPlatformStats,
  publishPlatformNote,
  schedulePlatformNote,
  updatePlatformNote
} from '@/utils/releaseNotesApi';
import { uploadReleaseNoteImage } from '@/utils/releaseNoteImageUpload';
import {
  RELEASE_NOTE_IMPORTANCE_OPTIONS,
  RELEASE_NOTE_ITEM_TYPES,
  RELEASE_NOTE_TARGET_APPS,
  RELEASE_NOTE_TARGET_PLANS,
  emptyReleaseForm,
  emptyReleaseItem
} from '@/constants/releaseNoteAdmin';

import { confirmAction } from '@/composables/useConfirmAction';
import { formatUserDateTime } from '@/utils/localeFormat';
const props = defineProps({
  id: { type: String, required: true }
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const archiving = ref(false);
const error = ref('');
const form = ref(emptyReleaseForm());
const noteStatus = ref(null);
const publishedAt = ref(null);
const audienceCount = ref(null);
const stats = ref(null);
const scheduleAtLocal = ref('');
const imageUploadingIndex = ref(null);

const importanceOptions = RELEASE_NOTE_IMPORTANCE_OPTIONS;
const itemTypes = RELEASE_NOTE_ITEM_TYPES;
const targetApps = RELEASE_NOTE_TARGET_APPS;
const targetPlans = RELEASE_NOTE_TARGET_PLANS;

const isNew = computed(() => props.id === 'new');
const canEdit = computed(() => !noteStatus.value || noteStatus.value === 'draft' || noteStatus.value === 'scheduled');

const badgeExpiresAtLocal = computed({
  get() {
    if (!form.value.badgeExpiresAt) return '';
    const date = new Date(form.value.badgeExpiresAt);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },
  set(value) {
    form.value.badgeExpiresAt = value ? new Date(value).toISOString() : null;
  }
});

watch(
  () => props.id,
  (id) => {
    if (id && id !== 'new') {
      void loadNote();
    }
  }
);

function deriveReleaseSlug(version, title) {
  return String(version || title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDate(value) {
  return formatUserDateTime(value);
}

function formatRate(rate) {
  if (rate == null) return '—';
  return `${Math.round(rate * 1000) / 10}%`;
}

function resolveImageUrl(url) {
  const raw = String(url || '');
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return getApiUrlForFetch(raw);
  return raw;
}

function hydrateForm(note) {
  form.value = {
    version: note.version || '',
    slug: note.slug || '',
    title: note.title || '',
    summary: note.summary || '',
    importance: note.importance || 'minor',
    targetApps: [...(note.targetApps || [])],
    targetPlans: [...(note.targetPlans || [])],
    badgeExpiresAt: note.badgeExpiresAt || null,
    items: (note.items?.length ? note.items : [emptyReleaseItem(0)]).map((item, index) => ({
      type: item.type || 'feature',
      title: item.title || '',
      description: item.description || '',
      imageUrl: item.imageUrl || null,
      ctaLabel: item.ctaLabel || null,
      ctaUrl: item.ctaUrl || null,
      sortOrder: item.sortOrder ?? index
    }))
  };
  noteStatus.value = note.status || null;
  publishedAt.value = note.publishedAt || null;
}

function buildPayload() {
  return {
    version: form.value.version.trim(),
    slug: deriveReleaseSlug(form.value.version, form.value.title),
    title: form.value.title.trim(),
    summary: form.value.summary.trim(),
    importance: form.value.importance,
    targetApps: form.value.targetApps,
    targetPlans: form.value.targetPlans,
    badgeExpiresAt: form.value.badgeExpiresAt,
    items: form.value.items.map((item, index) => ({
      type: item.type,
      title: item.title.trim(),
      description: item.description.trim(),
      imageUrl: item.imageUrl || null,
      ctaLabel: item.ctaLabel?.trim() || null,
      ctaUrl: item.ctaUrl?.trim() || null,
      sortOrder: index
    }))
  };
}

function addItem() {
  form.value.items.push(emptyReleaseItem(form.value.items.length));
}

function removeItem(index) {
  form.value.items.splice(index, 1);
}

async function onImageSelected(index, event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  imageUploadingIndex.value = index;
  error.value = '';
  try {
    const url = await uploadReleaseNoteImage(file);
    form.value.items[index].imageUrl = url;
  } catch (err) {
    console.error('[PlatformReleaseNoteEditor] image upload failed:', err);
    error.value = t('releaseNotes.adminUploadFailed');
  } finally {
    imageUploadingIndex.value = null;
  }
}

async function loadNote() {
  if (isNew.value) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await getPlatformNote(props.id);
    if (!response?.success || !response.data) {
      throw new Error('not_found');
    }
    hydrateForm(response.data);
    await Promise.all([loadAudiencePreview(), loadStats()]);
  } catch (err) {
    console.error('[PlatformReleaseNoteEditor] load failed:', err);
    error.value = t('releaseNotes.adminLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function loadAudiencePreview() {
  if (isNew.value) return;
  try {
    const response = await getPlatformAudiencePreview(props.id);
    audienceCount.value = response?.data?.targetedUserCount ?? null;
  } catch (err) {
    console.error('[PlatformReleaseNoteEditor] audience preview failed:', err);
  }
}

async function loadStats() {
  if (isNew.value || !['published', 'archived'].includes(noteStatus.value || '')) {
    stats.value = null;
    return;
  }
  try {
    const response = await getPlatformStats(props.id);
    stats.value = response?.data || null;
  } catch (err) {
    stats.value = null;
  }
}

async function saveDraft() {
  saving.value = true;
  error.value = '';
  try {
    const payload = buildPayload();
    if (isNew.value) {
      const response = await createPlatformNote(payload);
      const id = response?.data?.id;
      if (!id) throw new Error('create_failed');
      await router.replace(`/control/release-notes/${id}`);
      return;
    }
    const response = await updatePlatformNote(props.id, payload);
    if (response?.data) hydrateForm(response.data);
    await loadAudiencePreview();
  } catch (err) {
    console.error('[PlatformReleaseNoteEditor] save failed:', err);
    error.value = err?.message || t('releaseNotes.adminSaveFailed');
  } finally {
    saving.value = false;
  }
}

async function publishNow() {
  if (!await confirmAction(t('releaseNotes.adminPublishConfirm'))) return;
  saving.value = true;
  error.value = '';
  try {
    await updatePlatformNote(props.id, buildPayload());
    const response = await publishPlatformNote(props.id);
    if (response?.data) hydrateForm(response.data);
    await Promise.all([loadAudiencePreview(), loadStats()]);
  } catch (err) {
    console.error('[PlatformReleaseNoteEditor] publish failed:', err);
    error.value = t('releaseNotes.adminPublishFailed');
  } finally {
    saving.value = false;
  }
}

async function scheduleRelease() {
  const when = window.prompt(t('releaseNotes.adminSchedulePrompt'), scheduleAtLocal.value);
  if (!when) return;
  const scheduled = new Date(when);
  if (Number.isNaN(scheduled.getTime())) {
    error.value = t('releaseNotes.adminScheduleInvalid');
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    await updatePlatformNote(props.id, buildPayload());
    const response = await schedulePlatformNote(props.id, scheduled.toISOString());
    if (response?.data) hydrateForm(response.data);
  } catch (err) {
    console.error('[PlatformReleaseNoteEditor] schedule failed:', err);
    error.value = t('releaseNotes.adminScheduleFailed');
  } finally {
    saving.value = false;
  }
}

async function archiveNote() {
  if (!await confirmAction(t('releaseNotes.adminArchiveConfirm'))) return;
  archiving.value = true;
  error.value = '';
  try {
    await archivePlatformNote(props.id);
    noteStatus.value = 'archived';
    await loadStats();
  } catch (err) {
    console.error('[PlatformReleaseNoteEditor] archive failed:', err);
    error.value = t('releaseNotes.adminArchiveFailed');
  } finally {
    archiving.value = false;
  }
}

onMounted(() => {
  document.title = isNew.value
    ? t('releaseNotes.adminCreateTitle')
    : t('releaseNotes.adminEditTitle');
  if (!authStore.isPlatformAdmin) {
    router.push({ name: 'dashboard' });
    return;
  }
  if (isNew.value) {
    noteStatus.value = 'draft';
    return;
  }
  void loadNote();
});
</script>
