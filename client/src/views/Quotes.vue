<template>
  <div class="mx-auto w-full">
    <ModuleList
      ref="moduleListRef"
      module-key="quotes"
      app-key="PLATFORM"
      @create="openCreateDrawer"
      @row-click="handleRowClick"
      @edit="editQuoteFromList"
    >
      <template #cell-quoteNumber="{ value, row }">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="font-semibold text-gray-900 dark:text-white truncate">
              {{ value || row.quoteNumber }}
            </span>
            <span
              v-if="showRevisionBadge(row)"
              class="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >
              {{ t('records.quoteRevisionLabel', { n: revisionNumber(row) }) }}
            </span>
          </div>
          <div v-if="row.quoteTitle" class="text-xs text-gray-500 dark:text-gray-400 truncate">
            {{ row.quoteTitle }}
          </div>
        </div>
      </template>

      <template #cell-status="{ value }">
        <BadgeCell :value="value" />
      </template>
    </ModuleList>

    <CreateRecordDrawer
      :is-open="showCreateDrawer"
      module-key="quotes"
      @close="closeCreateDrawer"
      @saved="handleQuoteCreated"
    />

    <CreateRecordDrawer
      :is-open="showEditDrawer"
      module-key="quotes"
      :record="editingQuote"
      @close="closeEditDrawer"
      @saved="handleQuoteEditSaved"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ModuleList from '@/components/module-list/ModuleList.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const moduleListRef = ref(null);
const showCreateDrawer = ref(false);
const showEditDrawer = ref(false);
const editingQuote = ref(null);

function revisionNumber(row) {
  return Math.max(1, Number(row?.revisionNumber) || 1);
}

function showRevisionBadge(row) {
  return revisionNumber(row) > 1;
}

function openCreateDrawer() {
  showCreateDrawer.value = true;
}

function closeCreateDrawer() {
  showCreateDrawer.value = false;
  if (route.name === 'quotes-create') {
    router.replace({ name: 'quotes' });
  }
}

async function handleQuoteCreated() {
  showCreateDrawer.value = false;
  if (route.name === 'quotes-create') {
    await router.replace({ name: 'quotes' });
  }
  moduleListRef.value?.refresh?.();
}

watch(
  () => route.name,
  (name) => {
    if (name === 'quotes-create') {
      showCreateDrawer.value = true;
    }
  },
  { immediate: true }
);

function handleRowClick(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  router.push({ name: 'quote-detail', params: { id } });
}

function editQuoteFromList(row) {
  if (!row) return;
  editingQuote.value = row;
  showEditDrawer.value = true;
}

function closeEditDrawer() {
  showEditDrawer.value = false;
  editingQuote.value = null;
}

function handleQuoteEditSaved() {
  closeEditDrawer();
  moduleListRef.value?.refresh?.();
}
</script>

