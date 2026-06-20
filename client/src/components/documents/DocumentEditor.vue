<template>
  <div
    class="document-editor"
    :class="fullPage ? 'document-editor--full-page flex min-h-0 flex-1 flex-col' : ''"
  >
    <TaskDescriptionEditor
      ref="editorRef"
      v-model="localValue"
      :placeholder="placeholder"
      :auto-focus="autoFocus"
      variant="document"
      :full-page="fullPage"
      @blur="$emit('blur', localValue)"
      @cancel="$emit('cancel')"
      @image-uploaded="$emit('image-uploaded', $event)"
      @inline-comment-request="$emit('inline-comment-request', $event)"
      @update:model-value="handleUpdate"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import TaskDescriptionEditor from '@/components/record-page/TaskDescriptionEditor.vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  autoFocus: { type: Boolean, default: false },
  fullPage: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'blur', 'cancel', 'image-uploaded', 'inline-comment-request']);

const localValue = ref(props.modelValue || '');
const editorRef = ref(null);

watch(() => props.modelValue, (value) => {
  localValue.value = String(value || '');
});

function handleUpdate(value) {
  localValue.value = value;
  emit('update:modelValue', value);
}

function focus() {
  editorRef.value?.focus?.();
}

defineExpose({ focus });
</script>

<style scoped>
.document-editor--full-page :deep(.task-description-editor) {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  border: 0;
  outline: none;
  box-shadow: none;
}

.document-editor--full-page :deep(.tiptap) {
  min-height: calc(100vh - 14rem);
}
</style>
