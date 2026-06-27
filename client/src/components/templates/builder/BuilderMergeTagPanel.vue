<template>
  <VariablesPanel :module-scope="moduleScope" @insert="emit('insert', $event)" />
</template>

<script setup>
import VariablesPanel from '@/modules/template/components/VariablesPanel.vue';

defineProps({
  moduleScope: { type: String, default: '' }
});

const emit = defineEmits(['insert']);
</script>
