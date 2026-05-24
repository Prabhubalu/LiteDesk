<template>
  <div class="w-full space-y-2">
    <div class="flex items-center justify-between gap-3">
      <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">
        {{ label }} ({{ completedCount }}/{{ totalCount }})
      </label>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-all hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-900 cursor-pointer"
        :aria-label="t('tasks.taskSubtasksFieldAddSubtask4')"
        :title="t('tasks.taskSubtasksFieldAddSubtask3')"
        @click="addSubtask"
      >
        <PlusIcon class="h-3.5 w-3.5" aria-hidden="true" />
        <span>{{ t('tasks.taskSubtasksFieldAddSubtask2') }}</span>
      </button>
    </div>

    <div v-if="totalCount > 0" class="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50">
        <span class="w-4 shrink-0" aria-hidden="true" />
        <span class="flex-1">{{ t('settings.settingsBhFieldName') }}</span>
        <span class="w-7 shrink-0" aria-hidden="true" />
      </div>

      <div
        v-for="(subtask, index) in localList"
        :key="subtask._id || `subtask-${index}`"
        class="group/subtask flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 last:border-b-0"
      >
        <HeadlessCheckbox
          :checked="!!subtask.completed"
          checkbox-class="w-4 h-4 shrink-0"
          @change="toggleCompleted(index)"
        />
        <input
          type="text"
          :value="subtask.title"
          :placeholder="t('tasks.taskSubtasksFieldSubtaskTitle')"
          class="flex-1 min-w-0 px-2 py-1.5 text-sm border border-transparent rounded bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-800 focus:border focus:border-gray-300 dark:focus:border-gray-600"
          :class="subtask.completed ? 'line-through text-gray-500 dark:text-gray-400' : ''"
          @input="updateTitle(index, ($event.target || {}).value)"
        />
        <button
          type="button"
          class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
          :aria-label="t('records.subtasksDeleteAria')"
          :title="t('records.subtasksDeleteAria')"
          @click.stop.prevent="removeSubtask(index)"
        >
          <TrashIcon class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.subtasksEmpty') }}<button
        type="button"
        class="ml-1 text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
        @click="addSubtask"
      >{{ t('tasks.taskSubtasksFieldAddSubtask') }}</button>
    </p>

    <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { PlusIcon, TrashIcon } from '@heroicons/vue/24/outline';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  label: {
    type: String,
    default: 'Subtasks'
  },
  error: {
    type: String,
    default: null
  }
});

const { t } = useI18n();

const emit = defineEmits(['update:modelValue']);

const localList = computed(() => {
  const list = Array.isArray(props.modelValue) ? props.modelValue : [];
  return list.map((st) => ({
    _id: st._id,
    title: st && typeof st.title === 'string' ? st.title : '',
    completed: Boolean(st && st.completed)
  }));
});

const totalCount = computed(() => localList.value.length);
const completedCount = computed(() => localList.value.filter((st) => st.completed).length);

function emitUpdate(next) {
  const normalized = (next || []).map((st) => ({
    ...(st._id ? { _id: st._id } : {}),
    title: st && typeof st.title === 'string' ? st.title : '',
    completed: Boolean(st && st.completed)
  }));
  emit('update:modelValue', normalized);
}

function addSubtask() {
  emitUpdate([...localList.value, { title: '', completed: false }]);
}

function removeSubtask(index) {
  const next = localList.value.filter((_, i) => i !== index);
  emitUpdate(next);
}

function toggleCompleted(index) {
  const next = localList.value.map((st, i) =>
    i === index ? { ...st, completed: !st.completed } : st
  );
  emitUpdate(next);
}

function updateTitle(index, value) {
  const next = localList.value.map((st, i) =>
    i === index ? { ...st, title: value == null ? '' : String(value) } : st
  );
  emitUpdate(next);
}
</script>
