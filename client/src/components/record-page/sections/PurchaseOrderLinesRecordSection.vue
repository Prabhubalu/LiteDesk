<template>
  <QuoteLinesRecordSection
    :record="normalizedRecord"
    :context="context"
    :adapter="purchaseOrderCommercialLinesAdapter"
    :draft-mode="draftMode"
    @updated="emit('updated', $event)"
  />
</template>

<script setup>
/**
 * Purchase Order lines — shared commercial Lines workspace (PO capability subset).
 */
import { computed } from 'vue';
import QuoteLinesRecordSection from '@/components/record-page/sections/QuoteLinesRecordSection.vue';
import { purchaseOrderCommercialLinesAdapter } from '@/platform/commercialLines/adapters';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) },
  draftMode: { type: Boolean, default: false }
});

const emit = defineEmits(['updated']);

/** QuoteLines expects `quantity`; PO stores `quantityOrdered`. */
const normalizedRecord = computed(() => {
  const rec = props.record;
  if (!rec) return null;
  const lines = Array.isArray(rec.lines)
    ? rec.lines.map((line) => ({
        ...line,
        quantity: line.quantity ?? line.quantityOrdered,
        purchaseOrderLineId: line.purchaseOrderLineId || line._id
      }))
    : rec.lines;
  return { ...rec, lines };
});
</script>
