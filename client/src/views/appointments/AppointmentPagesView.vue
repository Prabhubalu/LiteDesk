<template>
  <div class="mx-auto w-full max-w-5xl">
    <header class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm font-medium text-indigo-600 dark:text-indigo-400">{{ t('appointments.hubEyebrow') }}</p>
        <h1 class="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          {{ t('appointments.hubTitle') }}
        </h1>
        <p class="mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-400">
          {{ t('appointments.hubHint') }}
        </p>
      </div>
      <div v-if="hasPages" class="flex flex-wrap gap-2">
        <button
          v-if="!hasPersonalPage"
          type="button"
          class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          @click="createPersonalPage"
        >
          {{ t('appointments.personalPageBtn') }}
        </button>
        <button
          v-if="isAdmin"
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          @click="createTeamPage"
        >
          {{ t('appointments.teamPageBtn') }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="flex justify-center py-24">
      <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
    >
      {{ error }}
    </div>

    <div
      v-else-if="!hasPages"
      class="rounded-2xl border border-dashed border-gray-300 bg-gradient-to-b from-white to-indigo-50/40 px-6 py-14 text-center dark:border-gray-700 dark:from-gray-900 dark:to-indigo-950/20 sm:px-10"
    >
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-3xl dark:bg-indigo-900/50">
        📅
      </div>
      <h2 class="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
        {{ t('appointments.emptyTitle') }}
      </h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
        {{ t('appointments.emptyHint') }}
      </p>
      <div class="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
        <button
          type="button"
          class="group rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md active:scale-[0.98] dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-600"
          @click="createPersonalPage"
        >
          <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-xl dark:bg-indigo-900/60">👤</span>
          <h3 class="mt-4 font-semibold text-gray-900 dark:text-white">{{ t('appointments.cardPersonalTitle') }}</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('appointments.cardPersonalHint') }}
          </p>
          <span class="mt-4 inline-flex text-sm font-semibold text-indigo-600 group-hover:underline dark:text-indigo-400">
            {{ t('appointments.setupMyPage') }}
          </span>
        </button>
        <button
          v-if="isAdmin"
          type="button"
          class="group rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md active:scale-[0.98] dark:border-gray-700 dark:bg-gray-900 dark:hover:border-violet-600"
          @click="createTeamPage"
        >
          <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-xl dark:bg-violet-900/60">👥</span>
          <h3 class="mt-4 font-semibold text-gray-900 dark:text-white">{{ t('appointments.cardTeamTitle') }}</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('appointments.cardTeamHint') }}
          </p>
          <span class="mt-4 inline-flex text-sm font-semibold text-violet-600 group-hover:underline dark:text-violet-400">
            {{ t('appointments.createTeamPage') }}
          </span>
        </button>
        <p
          v-else
          class="flex items-center justify-center rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-6 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400"
        >
          {{ t('appointments.teamAdminOnly') }}
        </p>
      </div>
    </div>

    <div v-else class="space-y-3">
      <article
        v-for="page in pages"
        :key="page._id"
        class="group flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-800 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="truncate text-base font-semibold text-gray-900 dark:text-white">
              {{ pageLabel(page) }}
            </h3>
            <span
              class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
              :class="page.ownerType === 'team'
                ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'"
            >
              {{ page.ownerType === 'team' ? t('appointments.badgeTeam') : t('appointments.badgePersonal') }}
            </span>
            <span
              class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
              :class="page.enabled
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'"
            >
              {{ page.enabled ? t('appointments.badgeLive') : t('appointments.badgePaused') }}
            </span>
          </div>
          <p class="mt-1 truncate font-mono text-sm text-gray-500 dark:text-gray-400">
            /book/{{ page.slug }}
          </p>
        </div>
        <div
          class="hidden max-md:flex md:group-hover:flex md:group-focus-within:flex shrink-0 flex-wrap items-center gap-2 md:rounded-lg md:bg-white md:pl-1 md:dark:bg-gray-900"
        >
          <button
            type="button"
            class="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            :disabled="!page.slug"
            @click="copyPageLink(page)"
          >
            {{ copiedPageId === page._id ? t('appointments.copied') : t('appointments.copyLink') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            :disabled="!page.slug"
            @click="viewPageLink(page)"
          >
            {{ t('common.viewRecord') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            :disabled="!page.slug"
            @click="openShareModal(page)"
          >
            {{ t('appointments.share') }}
          </button>
          <button
            v-if="canEditPage(page)"
            type="button"
            class="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
            @click="editPage(page)"
          >
            {{ t('actions.edit') }}
          </button>
        </div>
      </article>
    </div>

    <ShareBookingPageModal
      :is-open="shareModalOpen"
      :page-title="shareContext.title"
      :booking-url="shareContext.url"
      @close="closeShareModal"
      @compose="handleShareCompose"
    />

    <EmailComposeDrawer
      :key="emailDraft?.to || 'booking-share-compose'"
      :is-open="emailDrawerOpen"
      standalone-mode
      :initial-draft="emailDraft"
      @close="emailDrawerOpen = false"
      @submit="handleEmailSubmit"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import { useNotifications } from '@/composables/useNotifications';
import { buildBookingPageUrl } from '@/utils/appointmentFormatters';
import ShareBookingPageModal from '@/components/appointments/ShareBookingPageModal.vue';
import EmailComposeDrawer from '@/components/communications/EmailComposeDrawer.vue';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { openTab } = useTabs();
const { success: notifySuccess, error: notifyError } = useNotifications();

const pages = ref([]);
const loading = ref(true);
const error = ref(null);
const copiedPageId = ref(null);
const shareModalOpen = ref(false);
const shareContext = ref({ title: '', url: '' });
const emailDrawerOpen = ref(false);
const emailDraft = ref(null);

const isAdmin = computed(() => authStore.isAdminLike);
const hasPages = computed(() => pages.value.length > 0);
const hasPersonalPage = computed(() =>
  pages.value.some((p) => p.ownerType === 'user' && isOwnedByMe(p))
);

function isOwnedByMe(page) {
  const ownerId = page.ownerId?._id || page.ownerId;
  return String(ownerId) === String(authStore.user?._id);
}

function ownerName(page) {
  const u = page.ownerId;
  if (u && typeof u === 'object') {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return name || u.email || u.username || t('appointments.userFallback');
  }
  return page.displayName || t('appointments.userFallback');
}

function pageLabel(page) {
  if (page.ownerType === 'team') {
    const count = page.memberUserIds?.length || 0;
    return page.displayName || t('appointments.teamPageMembers', { count });
  }
  if (isOwnedByMe(page)) return page.displayName || t('appointments.myBookingPage');
  return page.displayName || ownerName(page);
}

function canEditPage(page) {
  if (page.ownerType === 'team') return isAdmin.value;
  return isOwnedByMe(page) || isAdmin.value;
}

function createPersonalPage() {
  openTab('/appointments/configure', { title: t('appointments.tabPersonalPage'), icon: '📅' });
  router.push({ name: 'appointments-configure' });
}

function createTeamPage() {
  openTab('/appointments/team/configure', { title: t('appointments.tabTeamNew'), icon: '👥' });
  router.push({ name: 'appointments-team-configure-new' });
}

function editPage(page) {
  if (page.ownerType === 'team') {
    const path = `/appointments/team/configure/${page._id}`;
    openTab(path, { title: page.displayName || t('appointments.tabTeamPage'), icon: '👥' });
    router.push({ name: 'appointments-team-configure', params: { id: page._id } });
    return;
  }
  const userId = page.ownerId?._id || page.ownerId;
  if (isOwnedByMe(page)) {
    openTab('/appointments/configure', { title: page.displayName || t('appointments.tabPersonalShort'), icon: '📅' });
    router.push({ name: 'appointments-configure' });
    return;
  }
  const path = `/appointments/configure/user/${userId}`;
  openTab(path, { title: t('appointments.tabUserBooking', { name: ownerName(page) }), icon: '📅' });
  router.push({ name: 'appointments-configure-user', params: { userId } });
}

function pageBookingUrl(page) {
  if (!page?.slug) return '';
  return page.bookingUrl || buildBookingPageUrl(page.slug);
}

async function copyPageLink(page) {
  const url = pageBookingUrl(page);
  if (!url) return;
  await navigator.clipboard.writeText(url);
  copiedPageId.value = page._id;
  notifySuccess(t('appointments.bookingLinkCopied'));
  setTimeout(() => {
    if (copiedPageId.value === page._id) copiedPageId.value = null;
  }, 2000);
}

function viewPageLink(page) {
  const url = pageBookingUrl(page);
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openShareModal(page) {
  const url = pageBookingUrl(page);
  if (!url) return;
  shareContext.value = { title: pageLabel(page), url };
  shareModalOpen.value = true;
}

function closeShareModal() {
  shareModalOpen.value = false;
}

function handleShareCompose(draft) {
  shareModalOpen.value = false;
  emailDraft.value = {
    to: draft.to,
    subject: draft.subject,
    body: draft.body
  };
  emailDrawerOpen.value = true;
}

async function handleEmailSubmit(payload) {
  emailDrawerOpen.value = false;
  emailDraft.value = null;
  try {
    const res = await apiClient.post('/communications/email', payload);
    if (res?.success) {
      notifySuccess(res?.queued ? t('appointments.emailQueued') : t('appointments.emailSent'));
    } else {
      notifyError(res?.message || t('appointments.emailSendFailed'));
    }
  } catch (e) {
    notifyError(e?.response?.data?.message || e?.message || t('appointments.emailSendFailed'));
  }
}

async function fetchPages() {
  loading.value = true;
  error.value = null;
  try {
    const res = await apiClient.get('/appointments/config/pages');
    if (res.success) pages.value = Array.isArray(res.data) ? res.data : [];
    else error.value = res.message || t('appointments.loadPagesFailed');
  } catch (e) {
    error.value = e?.message || t('appointments.loadPagesFailed');
    pages.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(fetchPages);
</script>
