<template>
  <div class="related-records-inline">
    <div class="flex items-center justify-between py-2">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <h4 class="text-sm font-medium text-gray-900 dark:text-white">
          {{ relationship.label }}
        </h4>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          ({{ relationship.linkedRecords.length }})
        </span>
        <span
          v-if="relationship.required"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        >{{ t('settings.coreModDetailRequired') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <div v-if="relationship.linkedRecords.length > 0" class="flex items-center gap-1">
          <span
            v-for="(record, index) in relationship.linkedRecords.slice(0, 3)"
            :key="record.id"
            class="text-xs text-gray-600 dark:text-gray-400"
          >
            {{ getRecordLabelForDisplay(record) }}<span v-if="index < Math.min(2, relationship.linkedRecords.length - 1)">,</span>
          </span>
          <span
            v-if="relationship.linkedRecords.length > 3"
            class="text-xs text-gray-500 dark:text-gray-400"
          >
            +{{ relationship.linkedRecords.length - 3 }} more
          </span>
        </div>
        <div v-else class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.settingsBhNone') }}</div>
        <button
          v-if="canLink"
          @click="openLinkPicker"
          class="ml-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >{{ t('settings.modFieldsPbResourceLink') }}</button>
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
      @close="showUnlinkConfirm = false"
      @confirmed="handleUnlinkConfirmed"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';
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

const showLinkPicker = ref(false);
const showUnlinkConfirm = ref(false);
const recordToUnlink = ref(null);

import { getRecordLabel } from '@/utils/recordDisplay';

// Get display label for a record (re-exported from utils)
const getRecordLabelForDisplay = getRecordLabel;

// Open link picker
const openLinkPicker = () => {
  showLinkPicker.value = true;
};

// Handle linked records
const handleLinked = () => {
  showLinkPicker.value = false;
  emit('refresh');
};

// Handle unlink click (for inline, we might show a dropdown or modal)
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
.related-records-inline {
  @apply w-full;
}
</style>

