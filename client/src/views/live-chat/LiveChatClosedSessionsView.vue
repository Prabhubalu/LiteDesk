<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <LiveChatWorkspaceNav />

    <div class="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
      <ListPageSkeleton v-if="!listReady" :body-rows="12" />

      <ListView
        v-else
        :title="t('liveChat.closedSessionsTitle')"
        :description="t('liveChat.closedSessionsDesc')"
        module-key="live-chat-closed"
        :search-placeholder="t('liveChat.closedSessionsSearchPlaceholder')"
        :data="displayRows"
        :columns="allColumns"
        :loading="loading"
        :show-create="false"
        :show-import="false"
        :show-export="false"
        :show-stats="false"
        :show-filters="false"
        :selectable="false"
        :has-actions="false"
        table-id="live-chat-closed-sessions-table"
        row-key="_id"
        :sort-field="sortField"
        :sort-order="sortOrder"
        :empty-title="emptyTitle"
        :empty-message="emptyMessage"
        infinite-scroll
        :loading-more="loadingMore"
        :parent-search-query="searchQuery"
        scroll-session-key="live-chat-closed-workspace"
        @update:searchQuery="handleSearchQueryUpdate"
        @search-submit="handleSearchQueryUpdate"
        @update:filters="handleFiltersUpdate"
        @update:sort="handleSortUpdate"
        @row-click="handleRowClick"
        @load-more="loadMore"
      >
        <template #cell="{ column, row }">
          <LiveChatSessionListCell :column-key="column.key" :row="row" />
        </template>
      </ListView>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ListView from '@/components/common/ListView.vue';
import ListPageSkeleton from '@/components/common/ListPageSkeleton.vue';
import LiveChatWorkspaceNav from '@/components/live-chat/LiveChatWorkspaceNav.vue';
import LiveChatSessionListCell from '@/components/live-chat/LiveChatSessionListCell.vue';
import { useLiveChatSessionFieldCatalog } from '@/composables/useLiveChatSessionFieldCatalog';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import { isFilterValueActive } from '@/platform/filters/filterValueUtils';
import {
  buildLiveChatClosedSessionSearchHaystack,
  filterLiveChatClosedSessionsByColumns,
} from '@/utils/liveChatClosedSessionListFilters';
import { liveChatVisitorLabel } from '@/utils/liveChatSessionDisplay';

const { t } = useI18n();
const { openLiveChatClosedSession } = useTabs();

const {
  allColumns,
  loadFieldCatalog,
} = useLiveChatSessionFieldCatalog();

const listReady = ref(false);
const loading = ref(true);
const loadingMore = ref(false);
const sessions = ref([]);
const searchQuery = ref('');
const columnFilters = ref({});
const total = ref(0);
const sortField = ref('endedAt');
const sortOrder = ref('desc');
const pageSize = 50;

const hasMore = computed(() => sessions.value.length < total.value);

const filteredSessions = computed(() => {
  const columnFiltered = filterLiveChatClosedSessionsByColumns(
    sessions.value,
    columnFilters.value,
    t,
  );

  const q = String(searchQuery.value || '').trim().toLowerCase();
  if (!q) return columnFiltered;

  return columnFiltered.filter((session) =>
    buildLiveChatClosedSessionSearchHaystack(session, t).includes(q),
  );
});

const displayRows = computed(() => {
  const rows = [...filteredSessions.value];
  const field = sortField.value;
  const dir = sortOrder.value === 'asc' ? 1 : -1;

  rows.sort((a, b) => {
    if (field === 'sessionKey') {
      return String(a.sessionKey || '').localeCompare(String(b.sessionKey || '')) * dir;
    }
    if (field === 'outcome') {
      return String(a.outcome || '').localeCompare(String(b.outcome || '')) * dir;
    }
    if (field === 'channel') {
      return String(a.channel || '').localeCompare(String(b.channel || '')) * dir;
    }
    if (field === 'lifecycleStatus') {
      return String(a.lifecycleStatus || '').localeCompare(String(b.lifecycleStatus || '')) * dir;
    }
    if (field === 'startedAt') {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return (aTime - bTime) * dir;
    }
    if (field === 'endedAt') {
      const aTime = new Date(a.endedAt || a.lastMessageAt || 0).getTime();
      const bTime = new Date(b.endedAt || b.lastMessageAt || 0).getTime();
      return (aTime - bTime) * dir;
    }
    if (field === 'csatScore' || field === 'messageCount' || field === 'transferCount'
      || field === 'visitorMessageCount' || field === 'agentMessageCount') {
      const aScore = Number(a[field]);
      const bScore = Number(b[field]);
      const aVal = Number.isFinite(aScore) ? aScore : -1;
      const bVal = Number.isFinite(bScore) ? bScore : -1;
      return (aVal - bVal) * dir;
    }
    if (field === 'sentiment' || field === 'intent' || field === 'visitorType' || field === 'priority') {
      return String(a[field] || '').localeCompare(String(b[field] || '')) * dir;
    }
    if (field === 'botInvolved' || field === 'consentGiven' || field === 'sessionArchived' || field === 'exported') {
      return (Number(Boolean(a[field])) - Number(Boolean(b[field]))) * dir;
    }
    return 0;
  });

  return rows;
});

const hasActiveListFilters = computed(() => {
  if (String(searchQuery.value || '').trim()) return true;
  return Object.entries(columnFilters.value).some(([key, value]) => (
    key !== 'filterQuery' && isFilterValueActive(value)
  ));
});

const emptyTitle = computed(() =>
  hasActiveListFilters.value ? t('liveChat.closedSessionsSearchEmpty') : t('liveChat.closedSessionsEmpty'),
);
const emptyMessage = computed(() =>
  hasActiveListFilters.value ? '' : t('liveChat.closedSessionsDesc'),
);

function sessionTitle(session) {
  return liveChatVisitorLabel(session, t);
}

async function fetchSessions({ append = false } = {}) {
  const skip = append ? sessions.value.length : 0;
  const res = await apiClient.get('/live-chat/sessions', {
    params: { status: 'closed', limit: pageSize, skip },
  });
  const rows = Array.isArray(res?.data) ? res.data : [];
  total.value = Number(res?.meta?.total) || rows.length;
  sessions.value = append ? [...sessions.value, ...rows] : rows;
}

async function loadSessions() {
  loading.value = true;
  try {
    await fetchSessions();
  } catch {
    sessions.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    await fetchSessions({ append: true });
  } finally {
    loadingMore.value = false;
  }
}

function handleSearchQueryUpdate(query) {
  searchQuery.value = String(query ?? '').trim();
}

function handleFiltersUpdate(filters) {
  columnFilters.value = { ...(filters || {}) };
}

function handleSortUpdate({ sortField: field, sortOrder: order }) {
  sortField.value = field || 'endedAt';
  sortOrder.value = order || 'desc';
}

function handleRowClick(row, event = null) {
  if (!row?._id) return;
  const openInBackground = event && (event.button === 1 || event.metaKey || event.ctrlKey);
  openLiveChatClosedSession(String(row._id), {
    title: sessionTitle(row),
    background: openInBackground,
    insertAdjacent: true,
  });
}

onMounted(async () => {
  await loadFieldCatalog();
  if (allColumns.value.length === 0) return;
  listReady.value = true;
  await nextTick();
  await loadSessions();
});
</script>
