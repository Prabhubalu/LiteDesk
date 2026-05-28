<template>
  <div class="mx-auto w-full max-w-6xl">
    <button
      type="button"
      class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
      @click="goToPagesHub"
    >
      {{ t('appointments.backToPages') }}
    </button>
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            {{ isAdminEdit ? t('appointments.adminBookingPage') : t('appointments.personalBookingPage') }}
          </p>
          <h1 class="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {{ isAdminEdit ? editUserLabel : t('appointments.bookingPageTitle') }}
          </h1>
          <p class="mt-2 max-w-xl text-gray-600 dark:text-gray-400">
            {{ isAdminEdit ? t('appointments.adminConfigureHint') : t('appointments.personalConfigureHint') }}
          </p>
          <RouterLink
            to="/settings/automation/automation-rules"
            class="mt-2 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {{ t('appointments.automationsLink') }}
          </RouterLink>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <span class="text-gray-600 dark:text-gray-300">{{ t('appointments.pageLive') }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="form.enabled"
              class="relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              :class="form.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'"
              @click="form.enabled = !form.enabled"
            >
              <span
                class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out"
                :class="form.enabled ? 'translate-x-5' : ''"
              />
            </button>
          </label>
          <button
            type="button"
            class="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all duration-200 hover:bg-indigo-700 hover:shadow-indigo-600/40 active:scale-[0.98] disabled:opacity-50"
            :disabled="saving || !slugAvailable"
            @click="handleSave"
          >
            {{ saving ? t('states.saving') : t('settings.saveChanges') }}
          </button>
        </div>
      </div>

      <Transition name="fade">
        <div v-if="error" class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {{ error }}
        </div>
      </Transition>

      <div v-if="loading" class="flex justify-center py-24">
        <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>

      <div v-else>
      <div class="grid gap-8 lg:grid-cols-5">
        <div class="space-y-6 lg:col-span-3">
          <section class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900/80">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('appointments.publicLinkHeading') }}</h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('appointments.publicLinkHint') }}</p>
            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.pageName') }}</label>
              <input
                v-model="form.displayName"
                type="text"
                class="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-gray-900 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800/50 dark:text-white"
                :placeholder="t('appointments.pageNamePh')"
                @blur="maybeAutoSlug"
              />
            </div>
            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.urlPath') }}</label>
              <div
                class="mt-1.5 flex overflow-hidden rounded-xl border transition-colors duration-200"
                :class="slugAvailable ? 'border-gray-200 dark:border-gray-600' : 'border-amber-400 ring-2 ring-amber-400/30'"
              >
                <span class="flex items-center bg-gray-100 px-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">/book/</span>
                <input
                  v-model="form.slug"
                  type="text"
                  class="min-w-0 flex-1 border-0 bg-white px-3 py-2.5 text-gray-900 focus:ring-0 dark:bg-gray-900 dark:text-white"
                  @input="onSlugInput"
                />
              </div>
              <p v-if="!slugAvailable" class="mt-1 text-xs text-amber-600 dark:text-amber-400">{{ t('appointments.slugTaken') }}</p>
            </div>
            <div v-if="bookingUrl" class="mt-4 flex items-center gap-2 rounded-xl bg-indigo-50/80 p-3 dark:bg-indigo-950/40">
              <LinkIcon class="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <a :href="bookingUrl" target="_blank" rel="noopener" class="min-w-0 truncate text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300">{{ bookingUrl }}</a>
              <button type="button" class="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-indigo-600 shadow-sm transition hover:bg-indigo-50 dark:bg-gray-800" @click="copyLink">{{ t('actions.copy') }}</button>
            </div>
          </section>

          <AppointmentEmbedSnippet v-if="form.slug" :slug="form.slug" />

          <AppointmentBookingScheduleSection
            v-model:schedule-source="form.scheduleSource"
            v-model:business-hour-set-id="form.businessHourSetId"
            v-model:available-days="form.availableDays"
            v-model:working-hours="form.workingHours"
            v-model:slot-duration-minutes="form.slotDurationMinutes"
            v-model:buffer-minutes="form.bufferMinutes"
            :inherit-user-id="inheritUserIdForSchedule"
          />

          <section class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/80">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('appointments.meetingFormat') }}</h2>
            <div class="mt-4 grid gap-3 sm:grid-cols-3">
              <button
                v-for="opt in meetingTypeOptions"
                :key="opt.value"
                type="button"
                class="rounded-xl border-2 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                :class="form.meetingType === opt.value
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-sm dark:bg-indigo-950/30'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'"
                @click="form.meetingType = opt.value"
              >
                <VideoCameraIcon v-if="opt.icon === 'video'" class="h-6 w-6 text-indigo-600" />
                <MapPinIcon v-else class="h-6 w-6 text-indigo-600" />
                <p class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{{ opt.label }}</p>
              </button>
            </div>
          </section>

          <section
            v-if="form.meetingType === 'ms_teams'"
            class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/80"
          >
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('appointments.msTeamsHeading') }}</h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('appointments.msTeamsHint') }}
            </p>
            <div
              v-if="calendarStatus.microsoft && !calendarStatus.microsoft.configured"
              class="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {{ t('appointments.msOAuthNotConfigured') }}
              <code class="text-xs">MICROSOFT_CALENDAR_CLIENT_ID</code> and
              <code class="text-xs">MICROSOFT_CALENDAR_CLIENT_SECRET</code>.
            </div>
            <div v-else-if="!config?._id" class="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {{ t('appointments.savePageFirstMs') }}
            </div>
            <div v-else class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p v-if="microsoftCalendarConnected" class="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {{ t('appointments.connectedAs', { email: calendarStatus.microsoft?.accountEmail }) }}
                </p>
                <p v-else class="text-sm text-gray-600 dark:text-gray-400">{{ t('appointments.notConnected') }}</p>
              </div>
              <div class="flex gap-2">
                <button
                  v-if="!microsoftCalendarConnected"
                  type="button"
                  class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  :disabled="microsoftCalendarConnecting || !calendarStatus.microsoft?.configured"
                  @click="connectMicrosoftCalendar"
                >
                  {{ microsoftCalendarConnecting ? t('appointments.opening') : t('appointments.connectMicrosoft') }}
                </button>
                <button
                  v-else
                  type="button"
                  class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
                  @click="disconnectMicrosoftCalendar"
                >
                  {{ t('appointments.disconnect') }}
                </button>
              </div>
            </div>
            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {{ t('appointments.msAzureHint') }}
              <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps" target="_blank" rel="noopener" class="text-indigo-600 underline">{{ t('appointments.msAzureLink') }}</a>
              {{ t('appointments.msAzureHintSuffix') }}
            </p>
            <p
              v-if="calendarStatus.microsoft?.redirectUri"
              class="mt-2 rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-700 break-all dark:bg-gray-800 dark:text-gray-300"
            >
              {{ t('appointments.msRedirectHint') }}<br />
              <span class="text-indigo-600 dark:text-indigo-400">{{ calendarStatus.microsoft.redirectUri }}</span>
            </p>
          </section>

          <section
            v-if="form.meetingType === 'google_meet'"
            class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/80"
          >
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('appointments.googleHeading') }}</h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('appointments.googleHint') }}
            </p>
            <div v-if="!config?._id" class="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {{ t('appointments.savePageFirstGoogle') }}
            </div>
            <div v-else class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p v-if="googleCalendarConnected" class="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {{ t('appointments.connectedAs', { email: calendarStatus.google?.accountEmail || calendarStatus.accountEmail }) }}
                </p>
                <p v-else class="text-sm text-gray-600 dark:text-gray-400">{{ t('appointments.notConnected') }}</p>
              </div>
              <div class="flex gap-2">
                <button
                  v-if="!googleCalendarConnected"
                  type="button"
                  class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  :disabled="calendarConnecting"
                  @click="connectGoogleCalendar"
                >
                  {{ calendarConnecting ? t('appointments.opening') : t('appointments.connectGoogle') }}
                </button>
                <button
                  v-else
                  type="button"
                  class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
                  @click="disconnectGoogleCalendar"
                >
                  {{ t('appointments.disconnect') }}
                </button>
              </div>
            </div>
            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {{ t('appointments.googleSetupHint') }}
              <strong>{{ t('appointments.googleCalendarApi') }}</strong>
              {{ t('appointments.googleSetupHint2') }}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener" class="text-indigo-600 underline">{{ t('appointments.googlePermissionsLink') }}</a>
              {{ t('appointments.googleSetupHint3') }}
            </p>
            <p
              v-if="calendarStatus.redirectUri"
              class="mt-2 rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-700 break-all dark:bg-gray-800 dark:text-gray-300"
            >
              {{ t('appointments.googleRedirectHint') }}<br />
              <span class="text-indigo-600 dark:text-indigo-400">{{ calendarStatus.redirectUri }}</span>
            </p>
          </section>

          <AppointmentCustomFieldsEditor v-model="form.customFields" />

          <section class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/80">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('appointments.branding') }}</h2>
            <div class="mt-4 flex items-center gap-4">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.accentColor') }}</label>
              <input v-model="form.branding.themeColor" type="color" class="h-10 w-14 cursor-pointer rounded-lg border-0" />
            </div>
            <div class="mt-4">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.welcomeMessage') }}</label>
              <textarea
                v-model="form.branding.welcomeNote"
                rows="3"
                class="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-2.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </section>
        </div>

        <div class="lg:col-span-2">
          <div class="sticky top-6">
            <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{{ t('appointments.livePreview') }}</p>
            <div
              class="overflow-hidden rounded-2xl border border-gray-200/80 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:border-gray-700"
              :style="{ '--accent': form.branding.themeColor || '#4f46e5' }"
            >
              <div class="h-2 bg-[var(--accent)]" />
              <div class="bg-white p-6 dark:bg-gray-900" :class="{ 'opacity-60': !form.enabled }">
                <div class="flex items-center gap-3">
                  <div class="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)]/15 text-lg font-bold text-[var(--accent)]">
                    {{ (form.displayName || 'Y')[0] }}
                  </div>
                  <div>
                    <p class="font-semibold text-gray-900 dark:text-white">{{ form.displayName || t('appointments.yourName') }}</p>
                    <p class="text-sm text-gray-500">{{ t('appointments.minMeeting', { minutes: form.slotDurationMinutes }) }}</p>
                  </div>
                </div>
                <p class="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {{ form.branding.welcomeNote || t('appointments.welcomePreviewPh') }}
                </p>
                <div class="mt-6 flex flex-wrap gap-2">
                  <span
                    v-for="i in 4"
                    :key="i"
                    class="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {{ previewSlot(i) }}
                  </span>
                </div>
                <p v-if="!form.enabled" class="mt-4 text-center text-xs font-medium text-amber-600">{{ t('appointments.pagePaused') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import { LinkIcon, VideoCameraIcon, MapPinIcon } from '@heroicons/vue/24/outline';
import { useAppointmentConfig } from '@/composables/useAppointmentConfig';
import { MEETING_TYPE_OPTIONS, slugifyClient } from '@/utils/appointmentFormatters';
import { useNotifications } from '@/composables/useNotifications';
import AppointmentCustomFieldsEditor from '@/components/appointments/AppointmentCustomFieldsEditor.vue';
import AppointmentEmbedSnippet from '@/components/appointments/AppointmentEmbedSnippet.vue';
import AppointmentBookingScheduleSection from '@/components/appointments/AppointmentBookingScheduleSection.vue';

const {
  config,
  loading,
  saving,
  error,
  slugAvailable,
  bookingUrl,
  fetchMyConfig,
  fetchUserConfig,
  saveUserConfig,
  saveConfig,
  checkSlug
} = useAppointmentConfig();

const { t } = useI18n();
const { success: notifySuccess, error: notifyError } = useNotifications();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const { openTab } = useTabs();
const editUserId = computed(() => route.params.userId || null);
const isAdminEdit = computed(
  () => editUserId.value && String(editUserId.value) !== String(authStore.user?._id)
);
const inheritUserIdForSchedule = computed(() => {
  if (isAdminEdit.value) return editUserId.value;
  return authStore.user?._id ? String(authStore.user._id) : null;
});
const editUserLabel = ref('');
const calendarStatus = ref({
  connected: false,
  accountEmail: null,
  google: { connected: false, accountEmail: null },
  microsoft: { connected: false, accountEmail: null, configured: false }
});
const calendarConnecting = ref(false);
const microsoftCalendarConnecting = ref(false);

const googleCalendarConnected = computed(
  () => calendarStatus.value.google?.connected || calendarStatus.value.connected
);
const microsoftCalendarConnected = computed(() => !!calendarStatus.value.microsoft?.connected);

const MEETING_TYPE_KEYS = {
  offline: 'meetInPerson',
  google_meet: 'meetGoogle',
  ms_teams: 'meetTeams'
};

const meetingTypeOptions = computed(() =>
  MEETING_TYPE_OPTIONS.map((o) => ({
    ...o,
    label: t(`appointments.${MEETING_TYPE_KEYS[o.value]}`)
  }))
);

const form = reactive({
  displayName: '',
  slug: '',
  enabled: true,
  scheduleSource: 'legacy',
  businessHourSetId: null,
  availableDays: [1, 2, 3, 4, 5],
  workingHours: { start: '09:00', end: '18:00', timezone: 'UTC' },
  slotDurationMinutes: 30,
  bufferMinutes: 10,
  meetingType: 'offline',
  appointmentTypes: ['demo', 'consultation'],
  customFields: [],
  branding: { themeColor: '#4f46e5', welcomeNote: '', logoUrl: '' }
});

let slugDebounce;
function onSlugInput() {
  form.slug = slugifyClient(form.slug);
  clearTimeout(slugDebounce);
  slugDebounce = setTimeout(() => checkSlug(form.slug, config.value?._id), 400);
}

function maybeAutoSlug() {
  if (!form.slug && form.displayName) {
    form.slug = slugifyClient(form.displayName);
    checkSlug(form.slug);
  }
}

function previewSlot(i) {
  const h = 9 + i;
  return `${h}:00 ${h < 12 ? 'AM' : 'PM'}`;
}

async function handleSave() {
  if (form.scheduleSource === 'legacy') {
    form.workingHours.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || form.workingHours.timezone;
  }
  if (isAdminEdit.value) {
    await saveUserConfig(editUserId.value, { ...form });
  } else {
    await saveConfig({ ...form });
  }
  notifySuccess(t('appointments.pageSaved'));
  await refreshCalendarStatus();
}

async function refreshCalendarStatus() {
  if (!config.value?._id) return;
  try {
    const res = await apiClient.get(`/appointments/calendar/${config.value._id}/status`);
    if (res.success) {
      const data = res.data || {};
      calendarStatus.value = {
        ...data,
        google: data.google || {
          connected: !!data.connected,
          accountEmail: data.accountEmail
        },
        microsoft: data.microsoft || { connected: false, configured: false }
      };
    }
  } catch {
    calendarStatus.value = {
      connected: false,
      accountEmail: null,
      google: { connected: false },
      microsoft: { connected: false, configured: false }
    };
  }
}

async function openCalendarOAuthPopup(url, popupName) {
  const w = 520;
  const h = 720;
  const left = Math.max(0, Math.round((window.screen.availWidth - w) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - h) / 2));
  const popup = window.open(
    url,
    popupName,
    `popup=yes,width=${w},height=${h},left=${left},top=${top}`
  );
  if (!popup) {
    window.location.href = url;
    return;
  }
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        resolve();
      }
    }, 500);
  });
}

async function connectGoogleCalendar() {
  if (!config.value?._id) return;
  calendarConnecting.value = true;
  try {
    const res = await apiClient.get(`/appointments/calendar/${config.value._id}/google/start`);
    if (!res.success || !res.data?.url) {
      notifyError(res.message || t('appointments.googleStartFailed'));
      return;
    }
    await openCalendarOAuthPopup(res.data.url, 'google-calendar-oauth');
    await fetchConfig();
    await refreshCalendarStatus();
  } catch (e) {
    notifyError(e?.message || t('appointments.connectionFailed'));
  } finally {
    calendarConnecting.value = false;
  }
}

async function disconnectGoogleCalendar() {
  if (!config.value?._id) return;
  await apiClient.delete(`/appointments/calendar/${config.value._id}/google`);
  calendarStatus.value.google = { connected: false, accountEmail: null };
  calendarStatus.value.connected = false;
  notifySuccess(t('appointments.googleDisconnected'));
}

async function connectMicrosoftCalendar() {
  if (!config.value?._id) return;
  microsoftCalendarConnecting.value = true;
  try {
    const res = await apiClient.get(`/appointments/calendar/${config.value._id}/microsoft/start`);
    if (!res.success || !res.data?.url) {
      notifyError(res.message || t('appointments.msStartFailed'));
      return;
    }
    await openCalendarOAuthPopup(res.data.url, 'microsoft-calendar-oauth');
    await fetchConfig();
    await refreshCalendarStatus();
  } catch (e) {
    notifyError(e?.message || t('appointments.connectionFailed'));
  } finally {
    microsoftCalendarConnecting.value = false;
  }
}

async function disconnectMicrosoftCalendar() {
  if (!config.value?._id) return;
  await apiClient.delete(`/appointments/calendar/${config.value._id}/microsoft`);
  calendarStatus.value.microsoft = { connected: false, accountEmail: null };
  notifySuccess(t('appointments.msDisconnected'));
}

async function fetchConfig() {
  if (isAdminEdit.value) {
    await fetchUserConfig(editUserId.value);
    editUserLabel.value = config.value?.displayName || t('appointments.userBookingPage');
  } else {
    await fetchMyConfig();
  }
}

function goToPagesHub() {
  openTab('/appointments/pages', { title: t('appointments.hubTitle'), icon: '📅' });
  router.push({ name: 'appointments-pages' });
}

async function copyLink() {
  if (!bookingUrl.value) return;
  await navigator.clipboard.writeText(bookingUrl.value);
  notifySuccess(t('appointments.linkCopied'));
}

watch(config, (c) => {
  if (!c) return;
  Object.assign(form, {
    displayName: c.displayName || '',
    slug: c.slug || '',
    enabled: c.enabled !== false,
    scheduleSource: c.scheduleSource || 'legacy',
    businessHourSetId: c.businessHourSetId ? String(c.businessHourSetId) : null,
    availableDays: [...(c.availableDays || [1, 2, 3, 4, 5])],
    workingHours: { ...form.workingHours, ...c.workingHours },
    slotDurationMinutes: c.slotDurationMinutes ?? 30,
    bufferMinutes: c.bufferMinutes ?? 10,
    meetingType: c.meetingType || 'offline',
    appointmentTypes: c.appointmentTypes || ['demo', 'consultation'],
    customFields: (c.customFields || []).map((f) => ({ ...f, options: [...(f.options || [])] })),
    branding: { ...form.branding, ...c.branding }
  });
  if (c.googleCalendar) {
    calendarStatus.value.google = {
      connected: !!c.googleCalendar.connected,
      accountEmail: c.googleCalendar.accountEmail || null
    };
    calendarStatus.value.connected = calendarStatus.value.google.connected;
    calendarStatus.value.accountEmail = calendarStatus.value.google.accountEmail;
  }
  if (c.microsoftCalendar) {
    calendarStatus.value.microsoft = {
      ...calendarStatus.value.microsoft,
      connected: !!c.microsoftCalendar.connected,
      accountEmail: c.microsoftCalendar.accountEmail || null
    };
  }
}, { immediate: true });

onMounted(async () => {
  await fetchConfig();
  await refreshCalendarStatus();
  if (route.query.calendar === 'connected') {
    const provider = route.query.provider === 'microsoft'
      ? t('appointments.providerMicrosoft')
      : t('appointments.providerGoogle');
    notifySuccess(t('appointments.calendarConnected', { provider }));
    router.replace({ query: {} });
  } else if (route.query.calendar === 'error') {
    const provider = route.query.provider === 'microsoft'
      ? t('appointments.providerMicrosoft')
      : t('appointments.providerGoogle');
    notifyError(route.query.message || t('appointments.calendarConnectFailed', { provider }));
    router.replace({ query: {} });
  }
});

watch(() => config.value?._id, () => refreshCalendarStatus());
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
