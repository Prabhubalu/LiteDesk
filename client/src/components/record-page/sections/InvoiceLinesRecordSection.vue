<template>
  <QuoteLinesRecordSection
    :record="record"
    :context="context"
    :adapter="invoiceCommercialLinesAdapter"
    :draft-mode="draftMode"
    @updated="emit('updated', $event)"
  />
</template>

<script setup>
/**
 * Invoice lines — shared commercial Lines workspace (draft-capable subset).
 */
import QuoteLinesRecordSection from '@/components/record-page/sections/QuoteLinesRecordSection.vue';
import { invoiceCommercialLinesAdapter } from '@/platform/commercialLines/adapters';

defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) },
  draftMode: { type: Boolean, default: false }
});

const emit = defineEmits(['updated']);
</script>
