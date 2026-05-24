<template>
  <div class="related-records-renderer">
    <!-- Required Relationship Warning Banner -->
    <div
      v-if="hasUnsatisfiedRequired"
      class="mb-4 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4"
    >
      <div class="flex items-start">
        <ExclamationTriangleIcon class="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
        <div class="flex-1">
          <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">{{ t('records.relatedRecordsRendererRequiredRelationshipsMissing') }}</h3>
          <div class="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            <p>{{ t('records.relatedRecordsRendererTheFollowingRequiredRelationshipsMustBe') }}</p>
            <ul class="mt-1 list-disc list-inside">
              <li v-for="rel in requiredRelationships" :key="rel.relationshipKey">
                {{ rel.ui?.label || rel.label || rel.relationshipKey }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Relationship Groups -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="text-center py-8 text-sm text-red-600 dark:text-red-400">
      Error loading relationships: {{ error.message }}
    </div>

    <div v-else-if="!hasAnyRelationships" class="text-center py-8 text-sm text-gray-500 dark:text-gray-400">{{ t('records.relatedRecordsRendererNoRelationshipsConfiguredForThisRecord') }}</div>

    <div v-else class="space-y-6">
      <!-- TAB Relationships -->
      <RelatedRecordsTab
        v-for="group in relatedGroups.tabs"
        :key="`tab-${group.relationshipKey}`"
        :relationship="group"
        :can-link="canLink"
        :can-unlink="canUnlink"
        :source-record="sourceRecord"
        @link="handleLink"
        @unlink="handleUnlink"
        @refresh="handleRefresh"
      />

      <!-- EMBED Relationships -->
      <RelatedRecordsEmbed
        v-for="group in relatedGroups.embeds"
        :key="`embed-${group.relationshipKey}`"
        :relationship="group"
        :can-link="canLink"
        :can-unlink="canUnlink"
        :source-record="sourceRecord"
        @link="handleLink"
        @unlink="handleUnlink"
        @refresh="handleRefresh"
      />

      <!-- INLINE Relationships -->
      <RelatedRecordsInline
        v-for="group in relatedGroups.inlines"
        :key="`inline-${group.relationshipKey}`"
        :relationship="group"
        :can-link="canLink"
        :can-unlink="canUnlink"
        :source-record="sourceRecord"
        @link="handleLink"
        @unlink="handleUnlink"
        @refresh="handleRefresh"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, onMounted, watch } from 'vue';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { useRecordContext } from '@/composables/useRecordContext';
import RelatedRecordsTab from './RelatedRecordsTab.vue';
import RelatedRecordsEmbed from './RelatedRecordsEmbed.vue';
import RelatedRecordsInline from './RelatedRecordsInline.vue';

const props = defineProps({
  appKey: { type: String, required: true },
  moduleKey: { type: String, required: true },
  recordId: { type: [String, Object], required: true }
});

const { t } = useI18n();

const emit = defineEmits(['required-relationship-unsatisfied', 'required-relationship-satisfied']);

// Use the composable
const {
  loading,
  error,
  relatedGroups,
  requiredRelationships,
  hasUnsatisfiedRequired,
  canLink,
  canUnlink,
  load,
  refresh
} = useRecordContext(
  () => props.appKey,
  () => props.moduleKey,
  () => props.recordId
);

// Source record for linking
const sourceRecord = computed(() => ({
  appKey: props.appKey,
  moduleKey: props.moduleKey,
  recordId: props.recordId
}));

// Check if there are any relationships to display
const hasAnyRelationships = computed(() => {
  const groups = relatedGroups.value;
  return groups.tabs.length > 0 || groups.embeds.length > 0 || groups.inlines.length > 0;
});

// Watch for required relationship changes
watch(hasUnsatisfiedRequired, (unsatisfied) => {
  if (unsatisfied) {
    emit('required-relationship-unsatisfied', requiredRelationships.value);
  } else {
    emit('required-relationship-satisfied');
  }
}, { immediate: true });

// Handle link action
const handleLink = async (relationshipKey, targetRecord) => {
  await refresh();
};

// Handle unlink action
const handleUnlink = async (relationshipKey, targetRecord) => {
  await refresh();
};

// Handle refresh request
const handleRefresh = () => {
  refresh();
};

// Load context on mount
onMounted(() => {
  load();
});

// Reload when props change
watch([() => props.appKey, () => props.moduleKey, () => props.recordId], () => {
  load(true);
}, { deep: true });
</script>

<style scoped>
.related-records-renderer {
  @apply w-full;
}
</style>

