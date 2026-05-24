<template>
  <div class="editable-title w-full min-w-0">
    <input
      v-if="isEditing && canEdit"
      ref="inputRef"
      v-model="localTitle"
      @blur="handleBlur"
      @keydown.enter="handleBlur"
      @keydown.esc="handleCancel"
      class="editable-title__input block text-2xl font-semibold text-gray-900 dark:text-white bg-transparent border border-gray-200 dark:border-gray-600 outline-none w-full rounded px-2 py-1 -mx-2 -my-1 m-0 box-border"
      type="text"
    />
    <h1
      v-else
      @click="handleClick"
      :class="[
        'editable-title__display block w-full text-2xl font-semibold text-gray-900 dark:text-white m-0',
        canEdit ? 'cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 py-1 -mx-2 -my-1 transition-colors border border-transparent' : ''
      ]"
    >
      {{ title || 'Untitled' }}
    </h1>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  canEdit: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:title', 'save']);

const { t } = useI18n();

const isEditing = ref(false);
const localTitle = ref(props.title);
const inputRef = ref(null);

watch(() => props.title, (newTitle) => {
  // Only update localTitle if not currently editing to avoid overwriting user input
  if (!isEditing.value) {
    localTitle.value = newTitle;
  }
});

const handleClick = () => {
  if (props.canEdit) {
    isEditing.value = true;
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.focus();
      }
    });
  }
};

const handleBlur = async () => {
  if (!isEditing.value) return;
  
  isEditing.value = false;
  
  const trimmedTitle = localTitle.value.trim();
  
  // Only save if title changed
  if (trimmedTitle !== props.title && trimmedTitle !== '') {
    emit('update:title', trimmedTitle);
    emit('save', trimmedTitle);
  } else {
    // Reset to original if empty or unchanged
    localTitle.value = props.title;
  }
};

const handleCancel = () => {
  isEditing.value = false;
  localTitle.value = props.title;
};
</script>

<style scoped>
.editable-title__input {
  min-width: 0;
}

.editable-title__display {
  word-break: break-word;
}
</style>
