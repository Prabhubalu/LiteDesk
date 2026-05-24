<template>
  <div class="related-records-embed">
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ relationship.label }}
          </h3>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            ({{ relationship.linkedRecords.length }})
          </span>
          <span
            v-if="relationship.required"
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          >{{ t('settings.coreModDetailRequired') }}</span>
        </div>
        <button
          v-if="canLink"
          @click="openLinkPicker"
          class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          <PlusIcon class="h-4 w-4 mr-1" />{{ t('settings.modFieldsPbResourceLink') }}</button>
      </div>

      <!-- Content -->
      <div v-if="relationship.linkedRecords.length === 0" class="text-center py-6">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          No {{ relationship.label.toLowerCase() }} linked
        </p>
        <button
          v-if="canLink"
          @click="openLinkPicker"
          class="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          <PlusIcon class="h-4 w-4 mr-1" />
          Link {{ relationship.label }}
        </button>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="record in relationship.linkedRecords"
          :key="record.id"
          class="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{ getRecordLabelForDisplay(record) }}
            </p>
            <p v-if="record.status" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ record.status }}
            </p>
          </div>
          <div class="flex items-center gap-2 ml-4">
            <button
              @click="viewRecord(record)"
              class="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >{{ t('common.viewRecord') }}</button>
            <button
              v-if="canUnlink"
              @click="handleUnlinkClick(record)"
              class="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >{{ t('records.relatedUnlink') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Link Picker Modal -->
    <RelationshipLinkPicker
      v-if="showLinkPicker"
      :is-open="showLinkPicker"
      :relationship="relationship"
      :source-record="sourceRecord"
      @close="showLinkPicker = false"
      @linked="handleLinked"
    />

    <!-- Unlink Confirmation Modal -->
    <RelationshipUnlinkConfirm
      v-if="showUnlinkConfirm && recordToUnlink"
      :is-open="showUnlinkConfirm"
      :relationship="relationship"
      :record="recordToUnlink"
      :source-record="sourceRecord"
      @close="showUnlinkConfirm = false"
      @confirmed="handleUnlinkConfirmed"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';
import { PlusIcon } from '@heroicons/vue/24/outline';
import { useTabs } from '@/composables/useTabs';
import RelationshipLinkPicker from './RelationshipLinkPicker.vue';
import RelationshipUnlinkConfirm from './RelationshipUnlinkConfirm.vue';

const props = defineProps({
  relationship: { type: Object, required: true },
  canLink: { type: Boolean, default: false },
  canUnlink: { type: Boolean, default: false },
  sourceRecord: { type: Object, required: true }
});

const { t } = useI18n();

const emit = defineEmits(['link', 'unlink', 'refresh']);

const { openTab } = useTabs();

const showLinkPicker = ref(false);
const showUnlinkConfirm = ref(false);
const recordToUnlink = ref(null);

import { getRecordLabel } from '@/utils/recordDisplay';

// Get display label for a record (re-exported from utils)
const getRecordLabelForDisplay = getRecordLabel;

// View record in a new tab
const viewRecord = (record) => {
  const appKey = record.appKey?.toLowerCase() || 'crm';
  const moduleKey = record.moduleKey || 'unknown';
  const path = `/${moduleKey}/${record.id}`;
  
  openTab(path, {
    title: getRecordLabelForDisplay(record),
    icon: 'document',
    insertAdjacent: true
  });
};

// Open link picker
const openLinkPicker = () => {
  showLinkPicker.value = true;
};

// Handle linked records
const handleLinked = () => {
  showLinkPicker.value = false;
  emit('refresh');
};

// Handle unlink click
const handleUnlinkClick = (record) => {
  recordToUnlink.value = record;
  showUnlinkConfirm.value = true;
};

// Handle unlink confirmed
const handleUnlinkConfirmed = async () => {
  if (!recordToUnlink.value) return;

  emit('unlink', props.relationship.relationshipKey, recordToUnlink.value);
  showUnlinkConfirm.value = false;
  recordToUnlink.value = null;
  emit('refresh');
};
</script>

<style scoped>
.related-records-embed {
  @apply w-full;
}
</style>

