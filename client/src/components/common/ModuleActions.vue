<template>
  <div class="flex flex-wrap gap-2 sm:gap-3 md:gap-4">
    <!-- Import Button -->
    <PermissionButton
      v-if="showImport"
      :module="module"
      action="create"
      variant="secondary"
      icon="import"
      @click="$emit('import')"
    >
      <span class="hidden sm:inline">Import</span>
    </PermissionButton>

    <!-- Export Button -->
    <PermissionButton
      v-if="showExport"
      :module="module"
      action="exportData"
      variant="secondary"
      icon="export"
      @click="$emit('export')"
    >
      <span class="hidden sm:inline">Export</span>
    </PermissionButton>

    <!-- Create Button -->
    <PermissionButton
      :module="module"
      action="create"
      variant="primary"
      icon="plus"
      @click="$emit('create')"
    >
      <span class="sm:hidden">{{ createLabel.replace(/^New\s+/, '') }}</span>
      <span class="hidden sm:inline">{{ createLabel }}</span>
    </PermissionButton>
  </div>
</template>

<script setup>
import PermissionButton from './PermissionButton.vue';

defineProps({
  module: {
    type: String,
    required: true
  },
  createLabel: {
    type: String,
    default: 'New'
  },
  showImport: {
    type: Boolean,
    default: true
  },
  showExport: {
    type: Boolean,
    default: true
  }
});

defineEmits(['create', 'import', 'export']);
</script>

