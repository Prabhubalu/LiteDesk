<template>
  <PortalPageShell
    :title="t('cases.portalCasesTitle')"
    :subtitle="t('cases.portalCasesSubtitle')"
    :error="error"
  >
    <template #actions>
      <button
        v-if="canCreateCase"
        type="button"
        class="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        @click="showCreate = true"
      >
        <PlusIcon class="h-4 w-4" />
        {{ t('cases.portalCasesNew') }}
      </button>
    </template>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-24" :class="PLATFORM_HOME_SKELETON_CLASS" />
    </div>

    <template v-else>
      <PortalCaseListToolbar
        v-if="cases.length"
        v-model:search="searchQuery"
        v-model:filter="activeFilter"
        class="mb-4"
        :open-count="openCount"
        :action-count="actionCount"
        :unread-count="unreadTotal"
      />

      <div
        v-if="cases.length === 0"
        :class="['p-10 text-center sm:p-12', PLATFORM_HOME_CARD_CLASS]"
      >
        <h3 class="text-lg font-medium text-neutral-900 dark:text-white">{{ t('cases.portalCasesEmptyTitle') }}</h3>
        <p class="mt-2 text-neutral-600 dark:text-neutral-400">{{ t('cases.portalCasesEmptyMessage') }}</p>
        <button
          v-if="canCreateCase"
          type="button"
          class="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          @click="showCreate = true"
        >
          {{ t('cases.portalCasesNew') }}
        </button>
        <p v-else class="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          {{
            portalAudience === 'partner'
              ? t('cases.portalCasesPartnerNoCreate')
              : t('cases.portalCasesCreateDisabled')
          }}
        </p>
      </div>

      <div
        v-else-if="filteredCases.length === 0"
        :class="['p-8 text-center', PLATFORM_HOME_CARD_CLASS]"
      >
        <p class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('cases.portalCasesNoMatches') }}</p>
      </div>

      <div v-else class="space-y-3">
        <button
          v-for="item in filteredCases"
          :key="item._id"
          type="button"
          class="group w-full rounded-2xl p-4 text-left transition-colors hover:border-primary-200/70 dark:hover:border-primary-500/25"
          :class="[
            PLATFORM_HOME_CARD_CLASS,
            isCaseUnread(item) ? 'ring-1 ring-primary-200/80 dark:ring-primary-500/30' : ''
          ]"
          @click="openCase(item._id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-xs font-mono text-neutral-500 dark:text-neutral-400">{{ item.caseId }}</p>
                <span
                  v-if="isCaseUnread(item)"
                  class="inline-flex h-2 w-2 shrink-0 rounded-full bg-primary-500"
                  :aria-label="t('cases.portalCasesUnread')"
                />
              </div>
              <h3 class="mt-0.5 truncate text-base font-semibold text-neutral-900 dark:text-white">
                {{ item.title }}
              </h3>
              <p v-if="item.description" class="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                {{ item.description }}
              </p>
            </div>
            <PortalCaseStatusBadge :status="item.status" />
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{{ t('cases.portalCasesUpdated', { date: formatDate(item.updatedAt) }) }}</span>
            <span
              v-if="item.needsCustomerAction"
              class="inline-flex rounded-full bg-warning-100 px-2 py-0.5 font-medium text-warning-800 dark:bg-warning-900/30 dark:text-warning-400"
            >
              {{ t('cases.portalDashboardNeedsReply') }}
            </span>
          </div>
        </button>
      </div>
    </template>

    <PortalCaseCreateDrawer
      :open="showCreate"
      :kb-enabled="kbEnabled"
      :allow-attachments="allowAttachments"
      @close="showCreate = false"
      @created="handleCreated"
    />
  </PortalPageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { PlusIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import { usePortalCases } from '@/composables/usePortalCases';
import { usePortalCaseReadState } from '@/composables/usePortalCaseReadState';
import portalApiClient from '@/utils/portalApiClient';
import { filterPortalCases } from '@/utils/portalCaseUtils';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import PortalCaseListToolbar from '@/components/portal/PortalCaseListToolbar.vue';
import PortalCaseStatusBadge from '@/components/portal/PortalCaseStatusBadge.vue';
import PortalCaseCreateDrawer from '@/components/portal/PortalCaseCreateDrawer.vue';
import { PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_SKELETON_CLASS } from '@/utils/platformHomeLayout';
import { formatUserDate } from '@/utils/localeFormat';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { listCases } = usePortalCases();
const { isCaseUnread, unreadCount } = usePortalCaseReadState();

const loading = ref(true);
const error = ref(null);
const cases = ref([]);
const canCreateCase = ref(false);
const portalAudience = ref('customer');
const allowAttachments = ref(false);
const kbEnabled = ref(true);
const showCreate = ref(false);
const searchQuery = ref('');
const activeFilter = ref('all');

const filteredCases = computed(() =>
  filterPortalCases(cases.value, { search: searchQuery.value, filter: activeFilter.value })
);

const openCount = computed(() => cases.value.filter((item) => !item.isClosed).length);
const actionCount = computed(() => cases.value.filter((item) => item.needsCustomerAction).length);
const unreadTotal = computed(() => unreadCount(cases.value));

function formatDate(value) {
  if (!value) return '';
  return formatUserDate(value) || '—';
}

function openCase(id) {
  router.push({ name: 'portal-case-detail', params: { id } });
}

function handleCreated(data) {
  void fetchCases();
  if (data?._id) {
    router.push({ name: 'portal-case-detail', params: { id: data._id } });
  }
}

async function fetchCases() {
  if (!authStore.isAuthenticated || !authStore.user?.token) {
    error.value = t('cases.portalCasesAuthRequired');
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;
  try {
    const res = await listCases({ limit: 50 });
    if (res.success) {
      cases.value = Array.isArray(res.data) ? res.data : [];
    } else {
      error.value = res.message || t('cases.portalCasesLoadFailed');
    }
  } catch (err) {
    if (err.status === 401) {
      error.value = t('cases.portalCasesSessionExpired');
    } else if (err.status === 403) {
      error.value = t('cases.portalCasesAccessDenied');
    } else {
      error.value = err.message || t('cases.portalCasesLoadFailed');
    }
  } finally {
    loading.value = false;
  }
}

async function loadPortalCapabilities() {
  try {
    const res = await portalApiClient.get('/me');
    if (res.success) {
      portalAudience.value = res.data?.portalCapabilities?.audience
        || res.data?.portalAudience
        || 'customer';
    }
    const mailroomAllowsCreate = res.success && res.data?.portalCapabilities
      ? res.data.portalCapabilities.allowCreateCase === true
      : false;
    canCreateCase.value = mailroomAllowsCreate && authStore.can('cases', 'create');
    if (res.success && res.data?.portalCapabilities) {
      allowAttachments.value = res.data.portalCapabilities.allowAttachments === true;
    }
    kbEnabled.value = authStore.can('documents', 'read');
  } catch {
    canCreateCase.value = authStore.can('cases', 'create');
    kbEnabled.value = authStore.can('documents', 'read');
  }
}

onMounted(async () => {
  await Promise.all([loadPortalCapabilities(), fetchCases()]);
  if (route.query.create === '1' && canCreateCase.value) {
    showCreate.value = true;
  }
});
</script>
