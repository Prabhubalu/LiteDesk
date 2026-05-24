<template>
  <div class="space-y-4">
    <!-- Drag and Drop Area -->
    <div
      @drop.prevent="readOnly ? null : handleDrop"
      @dragover.prevent="readOnly ? null : (isDragging = true)"
      @dragleave.prevent="readOnly ? null : (isDragging = false)"
      @dragend.prevent="readOnly ? null : (isDragging = false)"
      @click="readOnly ? null : triggerFileInput"
      :class="[
        'relative border-2 border-dashed rounded-lg p-8 transition-colors',
        readOnly 
          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 cursor-not-allowed opacity-60'
          : isDragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 cursor-pointer'
            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-gray-800 cursor-pointer'
      ]"
    >
      <input
        :id="question.questionId"
        ref="fileInput"
        type="file"
        @change="handleFileChange"
        :required="question.mandatory"
        :multiple="question.attachmentAllowance"
        class="hidden"
      />
      
      <div class="text-center">
        <!-- Upload Icon -->
        <div class="inline-flex items-center justify-center mb-4">
          <ArrowUpTrayIcon class="h-16 w-16 text-gray-400 dark:text-gray-500" />
        </div>
        
        <p class="text-sm text-gray-900 dark:text-gray-100 mb-2">
          {{ t('forms.fileDragDropOr') }}
          <label
            :for="question.questionId"
            class="font-semibold text-indigo-600 dark:text-indigo-400 underline cursor-pointer hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            {{ t('forms.fileChooseFile') }}
          </label>
        </p>
        
        <!-- File Format and Size Info -->
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <span>{{ supportedFormatsLabel }}</span>
          <span>{{ t('forms.fileMaxSize') }}</span>
        </div>
      </div>
    </div>

    <!-- File Preview List -->
    <div v-if="files.length > 0" class="space-y-3">
      <div
        v-for="(file, index) in files"
        :key="index"
        class="flex items-center gap-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
      >
        <!-- Image Preview -->
        <div v-if="file.preview" class="flex-shrink-0">
          <img
            :src="file.preview"
            :alt="file.name"
            class="h-16 w-16 object-cover rounded-lg"
          />
        </div>
        <!-- File Icon for non-images -->
        <div v-else class="flex-shrink-0">
          <div class="h-16 w-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <svg class="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        
        <!-- File Info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ file.name }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatFileSize(file.size) }}
          </p>
        </div>
        
        <!-- Remove Button -->
        <button
          v-if="!readOnly && files.length > 0"
          type="button"
          @click.stop="removeFile(index)"
          class="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
          :title="t('forms.fileRemoveAria')"
          :aria-label="t('forms.fileRemoveAria')"
        >
          <XMarkIcon class="w-5 h-5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowUpTrayIcon, XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  question: {
    type: Object,
    required: true
  },
  value: {
    type: [String, Array],
    default: ''
  },
  readOnly: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update']);

const { t } = useI18n();

const supportedFormatsLabel = computed(() =>
  t('forms.fileSupportedFormats', {
    formats: props.question.attachmentAllowance
      ? t('forms.fileSupportedMultiple')
      : t('forms.fileSupportedAllTypes')
  })
);

const fileInput = ref(null);
const isDragging = ref(false);
const files = ref([]);

const triggerFileInput = () => {
  if (!props.readOnly && fileInput.value) {
    fileInput.value.click();
  }
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const createFilePreview = (file) => {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    file: file,
    preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
  };
};

const processFiles = (fileList) => {
  const newFiles = Array.from(fileList).map(createFilePreview);
  
  if (props.question.attachmentAllowance) {
    // Multiple files allowed - add to existing
    files.value = [...files.value, ...newFiles];
  } else {
    // Single file - replace existing
    // Clean up old preview URLs
    files.value.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    files.value = newFiles;
  }
  
  // Emit update
  if (props.question.attachmentAllowance) {
    emit('update', files.value.map(f => f.name));
  } else {
    emit('update', files.value.length > 0 ? files.value[0].name : '');
  }
};

const handleFileChange = (event) => {
  if (event.target.files && event.target.files.length > 0) {
    processFiles(event.target.files);
  }
};

const handleDrop = (event) => {
  isDragging.value = false;
  if (props.readOnly) return;
  
  const droppedFiles = event.dataTransfer.files;
  if (droppedFiles && droppedFiles.length > 0) {
    processFiles(droppedFiles);
  }
};

const removeFile = (index) => {
  if (props.readOnly) return;
  
  // Clean up preview URL
  if (files.value[index].preview) {
    URL.revokeObjectURL(files.value[index].preview);
  }
  
  files.value.splice(index, 1);
  
  // Emit update
  if (props.question.attachmentAllowance) {
    emit('update', files.value.map(f => f.name));
  } else {
    emit('update', files.value.length > 0 ? files.value[0].name : '');
  }
  
  // Reset file input
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

// Watch for external value changes (e.g., form reset)
watch(() => props.value, (newValue) => {
  if (!newValue || (Array.isArray(newValue) && newValue.length === 0)) {
    // Clean up preview URLs
    files.value.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    files.value = [];
  } else if (newValue && files.value.length === 0) {
    // If we have a value but no files, create file objects from the value
    // This handles the case where the component receives a filename string
    if (Array.isArray(newValue)) {
      files.value = newValue.map(filename => ({
        name: filename,
        size: 0, // Size unknown from filename alone
        type: '',
        file: null,
        preview: null
      }));
    } else if (typeof newValue === 'string' && newValue.trim()) {
      files.value = [{
        name: newValue,
        size: 0,
        type: '',
        file: null,
        preview: null
      }];
    }
  }
}, { immediate: true });

// Cleanup on unmount
onBeforeUnmount(() => {
  files.value.forEach(file => {
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
  });
});
</script>
