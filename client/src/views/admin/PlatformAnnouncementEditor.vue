<template>
  <div class="mx-auto max-w-4xl">
    <div class="mb-8">
      <router-link
        to="/control/announcements"
        class="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        ← {{ t('announcements.cpBackList') }}
      </router-link>
      <h1 class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
        {{ isNew ? t('announcements.cpCreateTitle') : t('announcements.cpEditTitle') }}
      </h1>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {{ t('announcements.fromPlatform') }}
      </p>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
    >
      {{ error }}
    </div>

    <div
      v-if="success"
      class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
    >
      {{ success }}
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
    </div>

    <form v-else class="space-y-6" @submit.prevent="save">
      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('announcements.cpSectionDetails') }}
        </h2>
        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('announcements.fieldTitle') }}</label>
            <input
              v-model="form.title"
              type="text"
              required
              :disabled="!canEdit"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
            >
          </div>
          <div class="sm:col-span-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('announcements.fieldShortDescription') }}</label>
            <textarea
              v-model="form.shortDescription"
              rows="2"
              :disabled="!canEdit"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
            />
          </div>
          <div class="sm:col-span-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('announcements.fieldBody') }}</label>
            <textarea
              v-model="form.detailedDescription"
              rows="5"
              :disabled="!canEdit"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('announcements.cpColCategory') }}</label>
            <select
              v-model="form.category"
              :disabled="!canEdit"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
            >
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('announcements.fieldPriority') }}</label>
            <select
              v-model="form.priority"
              :disabled="!canEdit"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
            >
              <option v-for="p in priorities" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('announcements.fieldDisplayType') }}</label>
            <select
              v-model="form.displayType"
              :disabled="!canEdit"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
            >
              <option value="banner">{{ t('announcements.typeBanner') }}</option>
              <option value="popover">{{ t('announcements.typePopover') }}</option>
            </select>
          </div>
          <div class="flex items-end">
            <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                v-model="form.criticalBypassOrgMute"
                type="checkbox"
                :disabled="!canEdit"
                class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              >
              {{ t('announcements.cpBypassMute') }}
            </label>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('announcements.cpSectionAudience') }}
        </h2>
        <div class="mt-4 space-y-3">
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="form.targetMode" type="radio" value="all" :disabled="!canEdit" class="text-indigo-600">
            {{ t('announcements.cpAudienceAll') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="form.targetMode" type="radio" value="organizations" :disabled="!canEdit" class="text-indigo-600">
            {{ t('announcements.cpAudienceSpecific') }}
          </label>
          <div v-if="form.targetMode === 'organizations'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('announcements.cpOrgIds') }}
            </label>
            <textarea
              v-model="orgIdsText"
              rows="3"
              :disabled="!canEdit"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
              :placeholder="t('announcements.cpOrgIdsHint')"
            />
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('announcements.cpSectionSchedule') }}
        </h2>
        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('announcements.fieldStartAt') }}</label>
            <input
              v-model="startAtLocal"
              type="datetime-local"
              :disabled="!canEdit"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('announcements.fieldEndAt') }}</label>
            <input
              v-model="endAtLocal"
              type="datetime-local"
              :disabled="!canEdit"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white disabled:opacity-60"
            >
          </div>
          <div class="sm:col-span-2 flex flex-wrap gap-4">
            <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input v-model="form.userBehaviour.dismissible" type="checkbox" :disabled="!canEdit" class="rounded border-gray-300 text-indigo-600">
              {{ t('announcements.fieldDismissible') }}
            </label>
            <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input v-model="form.userBehaviour.requireAcknowledgement" type="checkbox" :disabled="!canEdit" class="rounded border-gray-300 text-indigo-600">
              {{ t('announcements.fieldRequireAck') }}
            </label>
          </div>
        </div>
      </section>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p v-if="status" class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('announcements.colStatus') }}: <span class="font-medium text-gray-800 dark:text-gray-200">{{ status }}</span>
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="canEdit"
            type="submit"
            :disabled="saving"
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            {{ t('announcements.saveDraft') }}
          </button>
          <button
            v-if="canPublish"
            type="button"
            :disabled="saving"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            @click="publish"
          >
            {{ t('announcements.publish') }}
          </button>
          <button
            v-if="canPause"
            type="button"
            :disabled="saving"
            class="rounded-lg border border-orange-300 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-200"
            @click="pause"
          >
            {{ t('announcements.pause') }}
          </button>
          <button
            v-if="canArchive"
            type="button"
            :disabled="saving"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200"
            @click="archive"
          >
            {{ t('announcements.archive') }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import {
  archivePlatformAnnouncement,
  createPlatformAnnouncement,
  getPlatformAnnouncement,
  pausePlatformAnnouncement,
  publishPlatformAnnouncement,
  updatePlatformAnnouncement,
} from '@/utils/platformAnnouncementsApi';

const props = defineProps({
  id: { type: String, required: true },
});

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const success = ref('');
const status = ref('');
const isSystem = ref(false);
const orgIdsText = ref('');
const startAtLocal = ref('');
const endAtLocal = ref('');

const categories = ['maintenance', 'security', 'product', 'general'];
const priorities = ['critical', 'high', 'medium', 'low', 'information'];

const form = reactive({
  title: '',
  shortDescription: '',
  detailedDescription: '',
  category: 'general',
  priority: 'high',
  displayType: 'banner',
  targetMode: 'all',
  criticalBypassOrgMute: false,
  userBehaviour: {
    dismissible: true,
    requireAcknowledgement: false,
  },
});

const isNew = computed(() => props.id === 'new');
const canEdit = computed(() => !isSystem.value && !['archived', 'expired'].includes(status.value));
const canPublish = computed(() => canEdit.value && ['draft', 'scheduled', 'paused'].includes(status.value || 'draft'));
const canPause = computed(() => !isNew.value && ['published', 'scheduled'].includes(status.value));
const canArchive = computed(() => !isNew.value && !isSystem.value && status.value !== 'archived');

function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function applyDoc(doc) {
  form.title = doc.title || '';
  form.shortDescription = doc.shortDescription || '';
  form.detailedDescription = doc.detailedDescription || '';
  form.category = doc.category === 'system' ? 'general' : (doc.category || 'general');
  form.priority = doc.priority || 'high';
  form.displayType = doc.displayType || 'banner';
  form.targetMode = doc.targetMode || 'all';
  form.criticalBypassOrgMute = Boolean(doc.criticalBypassOrgMute);
  form.userBehaviour = {
    dismissible: doc.userBehaviour?.dismissible !== false,
    requireAcknowledgement: Boolean(doc.userBehaviour?.requireAcknowledgement),
  };
  orgIdsText.value = (doc.targetOrganizationIds || []).join('\n');
  startAtLocal.value = toLocalInput(doc.schedule?.startAt);
  endAtLocal.value = toLocalInput(doc.schedule?.endAt);
  status.value = doc.status || 'draft';
  isSystem.value = Boolean(doc.isSystem);
}

function buildPayload() {
  const targetOrganizationIds = orgIdsText.value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    title: form.title,
    shortDescription: form.shortDescription,
    detailedDescription: form.detailedDescription,
    category: form.category,
    priority: form.priority,
    displayType: form.displayType,
    targetMode: form.targetMode,
    targetOrganizationIds: form.targetMode === 'organizations' ? targetOrganizationIds : [],
    criticalBypassOrgMute: form.criticalBypassOrgMute,
    userBehaviour: {
      dismissible: form.userBehaviour.dismissible,
      requireAcknowledgement: form.userBehaviour.requireAcknowledgement,
      showEveryLogin: true,
    },
    schedule: {
      startAt: fromLocalInput(startAtLocal.value) || new Date().toISOString(),
      endAt: fromLocalInput(endAtLocal.value),
      timezone: 'UTC',
    },
  };
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    if (isNew.value) {
      status.value = 'draft';
      startAtLocal.value = toLocalInput(new Date());
      return;
    }
    const response = await getPlatformAnnouncement(props.id);
    applyDoc(response?.data || {});
  } catch (err) {
    console.error('[PlatformAnnouncementEditor] load failed:', err);
    error.value = t('announcements.cpLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    const payload = buildPayload();
    if (isNew.value) {
      const response = await createPlatformAnnouncement(payload);
      const id = response?.data?.id;
      success.value = t('announcements.saveSuccess');
      if (id) {
        await router.replace(`/control/announcements/${id}`);
        applyDoc(response.data);
      }
    } else {
      const response = await updatePlatformAnnouncement(props.id, payload);
      applyDoc(response?.data || {});
      success.value = t('announcements.saveSuccess');
    }
  } catch (err) {
    console.error('[PlatformAnnouncementEditor] save failed:', err);
    error.value = err?.response?.data?.message || t('announcements.saveFailed');
  } finally {
    saving.value = false;
  }
}

async function publish() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    const payload = buildPayload();
    let announcementId = props.id;
    if (isNew.value) {
      const created = await createPlatformAnnouncement(payload);
      announcementId = created?.data?.id;
      if (!announcementId) throw new Error('missing id');
      await router.replace(`/control/announcements/${announcementId}`);
    } else {
      await updatePlatformAnnouncement(announcementId, payload);
    }
    const response = await publishPlatformAnnouncement(announcementId);
    applyDoc(response?.data || {});
    success.value = t('announcements.publishSuccess');
  } catch (err) {
    console.error('[PlatformAnnouncementEditor] publish failed:', err);
    error.value = err?.response?.data?.message || t('announcements.saveFailed');
  } finally {
    saving.value = false;
  }
}

async function pause() {
  saving.value = true;
  error.value = '';
  try {
    const response = await pausePlatformAnnouncement(props.id);
    applyDoc(response?.data || {});
    success.value = t('announcements.cpPauseSuccess');
  } catch (err) {
    error.value = err?.response?.data?.message || t('announcements.saveFailed');
  } finally {
    saving.value = false;
  }
}

async function archive() {
  saving.value = true;
  error.value = '';
  try {
    const response = await archivePlatformAnnouncement(props.id);
    applyDoc(response?.data || {});
    success.value = t('announcements.cpArchiveSuccess');
  } catch (err) {
    error.value = err?.response?.data?.message || t('announcements.saveFailed');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  document.title = isNew.value ? t('announcements.cpCreateTitle') : t('announcements.cpEditTitle');
  if (!authStore.isPlatformAdmin) {
    router.push({ name: 'dashboard' });
    return;
  }
  void load();
});
</script>
