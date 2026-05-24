<template>
  <div class="mx-auto w-full max-w-3xl">
    <button
      type="button"
      class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
      @click="goToPagesHub"
    >
      {{ t('appointments.backToPages') }}
    </button>
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-medium text-indigo-600 dark:text-indigo-400">{{ t('appointments.teamEyebrow') }}</p>
          <h1 class="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {{ isEdit ? t('appointments.teamEditTitle') : t('appointments.teamCreateTitle') }}
          </h1>
          <p class="mt-2 max-w-xl text-gray-600 dark:text-gray-400">
            {{ t('appointments.teamConfigureHint') }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-indigo-700 disabled:opacity-50"
          :disabled="saving || !slugAvailable || form.memberUserIds.length === 0"
          @click="handleSave"
        >
          {{ saving ? t('states.saving') : t('appointments.saveTeamPage') }}
        </button>
      </div>

      <div v-if="error" class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
        {{ error }}
      </div>

      <div v-if="loading" class="flex justify-center py-24">
        <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>

      <div v-else class="space-y-6">
        <section class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/80">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('appointments.teamDetails') }}</h2>
          <div class="mt-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.teamName') }}</label>
              <input
                v-model="form.displayName"
                type="text"
                class="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                :placeholder="t('appointments.teamNamePh')"
                @blur="maybeAutoSlug"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.publicUrl') }}</label>
              <div class="mt-1.5 flex overflow-hidden rounded-xl border border-gray-200 dark:border-gray-600">
                <span class="flex items-center bg-gray-100 px-3 text-sm text-gray-500 dark:bg-gray-800">/book/</span>
                <input
                  v-model="form.slug"
                  type="text"
                  class="min-w-0 flex-1 border-0 bg-white px-3 py-2.5 dark:bg-gray-900 dark:text-white"
                  @input="onSlugInput"
                />
              </div>
              <p v-if="!slugAvailable" class="mt-1 text-xs text-amber-600">{{ t('appointments.urlTaken') }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.assignment') }}</label>
              <select
                v-model="form.assignmentStrategy"
                class="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="round_robin">{{ t('appointments.assignRoundRobin') }}</option>
                <option value="first_available">{{ t('appointments.assignFirstAvailable') }}</option>
              </select>
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/80">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('appointments.teamMembers') }}</h2>
          <p class="mt-1 text-sm text-gray-500">
            {{ t('appointments.teamMembersHint') }}
          </p>
          <div v-if="usersLoading" class="mt-4 text-sm text-gray-500">{{ t('appointments.loadingUsers') }}</div>
          <div v-else class="mt-4 max-h-64 space-y-2 overflow-y-auto">
            <label
              v-for="u in orgUsers"
              :key="u._id"
              class="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/80"
            >
              <input
                v-model="form.memberUserIds"
                type="checkbox"
                :value="u._id"
                class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span class="text-sm text-gray-900 dark:text-white">
                {{ userLabel(u) }}
              </span>
            </label>
          </div>
          <p v-if="form.memberUserIds.length === 0" class="mt-2 text-xs text-amber-600">{{ t('appointments.selectOneMember') }}</p>
        </section>

        <AppointmentBookingScheduleSection
          v-model:schedule-source="form.scheduleSource"
          v-model:business-hour-set-id="form.businessHourSetId"
          v-model:available-days="form.availableDays"
          v-model:working-hours="form.workingHours"
          v-model:slot-duration-minutes="form.slotDurationMinutes"
          v-model:buffer-minutes="form.bufferMinutes"
          :inherit-user-id="teamOwnerId"
        />

        <AppointmentCustomFieldsEditor v-model="form.customFields" />

        <section class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/80">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('appointments.branding') }}</h2>
          <div class="mt-4">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.accentColor') }}</label>
            <input v-model="form.branding.themeColor" type="color" class="mt-2 h-10 w-full cursor-pointer rounded-lg" />
          </div>
          <div class="mt-4">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.welcomeNote') }}</label>
            <textarea
              v-model="form.branding.welcomeNote"
              rows="3"
              class="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              :placeholder="t('appointments.welcomeNotePh')"
            />
          </div>
        </section>

        <div v-if="bookingUrl" class="rounded-xl bg-indigo-50 p-4 dark:bg-indigo-950/40">
          <p class="text-sm font-medium text-indigo-900 dark:text-indigo-200">{{ t('appointments.teamBookingLink') }}</p>
          <a :href="bookingUrl" target="_blank" rel="noopener" class="mt-1 block truncate text-sm text-indigo-600 hover:underline dark:text-indigo-400">{{ bookingUrl }}</a>
        </div>

        <AppointmentEmbedSnippet v-if="form.slug" :slug="form.slug" />
      </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useTabs } from '@/composables/useTabs';
import { useNotifications } from '@/composables/useNotifications';
import { slugifyClient } from '@/utils/appointmentFormatters';
import AppointmentCustomFieldsEditor from '@/components/appointments/AppointmentCustomFieldsEditor.vue';
import AppointmentEmbedSnippet from '@/components/appointments/AppointmentEmbedSnippet.vue';
import AppointmentBookingScheduleSection from '@/components/appointments/AppointmentBookingScheduleSection.vue';
import { useAuthStore } from '@/stores/authRegistry';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { openTab } = useTabs();
const { success: notifySuccess } = useNotifications();

const teamOwnerId = computed(() => (authStore.user?._id ? String(authStore.user._id) : null));

function goToPagesHub() {
  openTab('/appointments/pages', { title: t('appointments.hubTitle'), icon: '📅' });
  router.push({ name: 'appointments-pages' });
}

const teamId = computed(() => route.params.id || null);
const isEdit = computed(() => !!teamId.value);

const loading = ref(false);
const saving = ref(false);
const error = ref(null);
const slugAvailable = ref(true);
const savedConfig = ref(null);
const orgUsers = ref([]);
const usersLoading = ref(false);

const form = reactive({
  displayName: '',
  slug: '',
  enabled: true,
  memberUserIds: [],
  assignmentStrategy: 'round_robin',
  scheduleSource: 'legacy',
  businessHourSetId: null,
  availableDays: [1, 2, 3, 4, 5],
  workingHours: { start: '09:00', end: '18:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
  slotDurationMinutes: 30,
  bufferMinutes: 10,
  meetingType: 'offline',
  appointmentTypes: ['demo', 'consultation'],
  customFields: [],
  branding: { themeColor: '#4f46e5', welcomeNote: '', logoUrl: '' }
});

const bookingUrl = computed(() => {
  const slug = savedConfig.value?.slug || form.slug;
  if (!slug) return '';
  if (savedConfig.value?.bookingUrl) return savedConfig.value.bookingUrl;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/book/${slug}`;
});

function userLabel(u) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email || u.username || t('appointments.userFallback');
}

let slugDebounce;
function onSlugInput() {
  form.slug = slugifyClient(form.slug);
  clearTimeout(slugDebounce);
  slugDebounce = setTimeout(() => checkSlug(form.slug), 400);
}

async function checkSlug(slug) {
  const params = { slug };
  if (teamId.value) params.excludeId = teamId.value;
  const res = await apiClient.get('/appointments/config/slug-available', { params });
  slugAvailable.value = res.success && res.available;
}

function maybeAutoSlug() {
  if (!form.slug && form.displayName) {
    form.slug = slugifyClient(form.displayName);
    checkSlug(form.slug);
  }
}

async function fetchUsers() {
  usersLoading.value = true;
  try {
    const res = await apiClient.get('/users/list');
    orgUsers.value = Array.isArray(res)
      ? res
      : Array.isArray(res?.data)
        ? res.data
        : res?.data?.users || [];
  } catch {
    orgUsers.value = [];
  } finally {
    usersLoading.value = false;
  }
}

async function loadTeam() {
  if (!teamId.value) return;
  loading.value = true;
  try {
    const res = await apiClient.get(`/appointments/config/team/${teamId.value}`);
    if (res.success && res.data) {
      savedConfig.value = res.data;
      Object.assign(form, {
        displayName: res.data.displayName || '',
        slug: res.data.slug || '',
        enabled: res.data.enabled !== false,
        memberUserIds: (res.data.memberUserIds || []).map((id) => String(id._id || id)),
        assignmentStrategy: res.data.assignmentStrategy || 'round_robin',
        scheduleSource: res.data.scheduleSource || 'legacy',
        businessHourSetId: res.data.businessHourSetId ? String(res.data.businessHourSetId) : null,
        availableDays: [...(res.data.availableDays || [1, 2, 3, 4, 5])],
        workingHours: { ...form.workingHours, ...(res.data.workingHours || {}) },
        slotDurationMinutes: res.data.slotDurationMinutes ?? 30,
        bufferMinutes: res.data.bufferMinutes ?? 10,
        meetingType: res.data.meetingType || 'offline',
        appointmentTypes: res.data.appointmentTypes || ['demo', 'consultation'],
        customFields: (res.data.customFields || []).map((f) => ({ ...f, options: [...(f.options || [])] })),
        branding: { ...form.branding, ...(res.data.branding || {}) }
      });
    }
  } catch (e) {
    error.value = e.message || t('appointments.loadTeamFailed');
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  error.value = null;
  if (form.scheduleSource === 'legacy') {
    form.workingHours.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || form.workingHours.timezone;
  }
  try {
    const payload = { ...form };
    const res = isEdit.value
      ? await apiClient.put(`/appointments/config/team/${teamId.value}`, payload)
      : await apiClient.post('/appointments/config/team', payload);
    if (res.success) {
      savedConfig.value = res.data;
      notifySuccess(t('appointments.teamPageSaved'));
      if (!isEdit.value && res.data._id) {
        router.replace({ name: 'appointments-team-configure', params: { id: res.data._id } });
      }
    } else {
      throw new Error(res.message || t('appointments.saveFailed'));
    }
  } catch (e) {
    error.value = e.message || t('appointments.saveFailed');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await fetchUsers();
  if (isEdit.value) await loadTeam();
});
</script>
