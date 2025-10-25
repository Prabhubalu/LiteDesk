<template>
  <div class="flex gap-4">
    <!-- Import Button -->
    <PermissionButton
      v-if="showImport"
      :module="module"
      action="create"
      variant="secondary"
      icon="import"
      @click="$emit('import')"
    >
      Import
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
      Export
    </PermissionButton>

    <!-- Create Button -->
    <PermissionButton
      :module="module"
      action="create"
      variant="primary"
      icon="plus"
      @click="$emit('create')"
    >
      {{ createLabel }}
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

