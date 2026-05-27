<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div v-if="loading" class="flex flex-1 items-center justify-center py-12">
      <span class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
    <div v-else-if="!tasks.length" class="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <ClipboardDocumentListIcon class="h-10 w-10 text-gray-300 dark:text-gray-600" />
      <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">{{ t('cases.recordTasksEmpty') }}</p>
      <button
        v-if="canEdit"
        type="button"
        class="mt-4 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        @click="$emit('link-task')"
      >
        {{ t('cases.recordTasksLink') }}
      </button>
    </div>
    <ul v-else class="flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
      <li
        v-for="task in tasks"
        :key="task.recordId"
        class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60"
      >
        <button type="button" class="min-w-0 flex-1 text-left" @click="$emit('open-record', task)">
          <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ task.label }}</p>
        </button>
        <ChevronRightIcon class="h-4 w-4 shrink-0 text-gray-400" />
      </li>
    </ul>
    <div v-if="canEdit && tasks.length" class="shrink-0 border-t border-gray-200 p-3 dark:border-gray-700">
      <button
        type="button"
        class="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-300"
        @click="$emit('link-task')"
      >
        {{ t('cases.recordTasksLink') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ClipboardDocumentListIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import { useRecordContext } from '@/composables/useRecordContext';

const props = defineProps({
  caseId: { type: String, required: true },
  canEdit: { type: Boolean, default: false }
});

defineEmits(['open-record', 'link-task']);

const { t } = useI18n();

const { context, loading, load } = useRecordContext(
  () => 'HELPDESK',
  () => 'cases',
  () => props.caseId
);

const taskRelationship = computed(() => {
  const rels = context.value?.relationships || [];
  return rels.find((r) => String(r.relationshipKey || '').toLowerCase().includes('task')) || null;
});

const tasks = computed(() =>
  (taskRelationship.value?.records || []).map((rec) => ({
    recordId: rec.recordId || rec.id,
    appKey: rec.appKey || 'SALES',
    moduleKey: rec.moduleKey || 'tasks',
    label: rec.displayName || rec.label || rec.title || String(rec.recordId || rec.id)
  }))
);

onMounted(() => load());
watch(() => props.caseId, () => load());
</script>
