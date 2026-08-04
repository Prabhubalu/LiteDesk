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
  draftMode: { type: Boolean, default: false },
  /**
   * Absorbed from SectionStack (`:adapter="recordAdapter"`). Must not fall through —
   * that overwrites the commercial PO lines adapter with the record-page adapter
   * and applies quote capabilities (tax/bundles/reorder).
   */
  adapter: { type: Object, default: null }
});

const emit = defineEmits(['updated']);

/** Quote lines editor expects `quantity` + `unitPriceSnapshot`; PO stores `quantityOrdered` + `unitPrice`.
 * Also alias overall* discount fields to global* for shared totals UI.
 */
const normalizedRecord = computed(() => {
  const rec = props.record;
  if (!rec) return null;
  const lines = Array.isArray(rec.lines)
    ? rec.lines.map((line) => {
        const unit = Number(line.unitPriceSnapshot ?? line.unitPrice);
        return {
          ...line,
          quantity: line.quantity ?? line.quantityOrdered,
          unitPriceSnapshot: Number.isFinite(unit) ? unit : 0,
          purchaseOrderLineId: line.purchaseOrderLineId || line._id
        };
      })
    : rec.lines;
  return {
    ...rec,
    lines,
    globalDiscountType: rec.globalDiscountType ?? rec.overallDiscountType ?? null,
    globalDiscountValue: rec.globalDiscountValue ?? rec.overallDiscountValue ?? 0,
    globalDiscountTotal: rec.globalDiscountTotal ?? rec.overallDiscountTotal ?? 0,
    transactionTaxSnapshot:
      rec.transactionTaxSnapshot ||
      (rec.taxDocumentSnapshot?.transactionTaxes
        ? { taxes: rec.taxDocumentSnapshot.transactionTaxes }
        : rec.transactionTaxSnapshot) ||
      { taxes: [] },
    chargeDocumentSnapshot: rec.chargeDocumentSnapshot || { charges: [] },
    adjustmentTotal: rec.adjustmentTotal ?? 0
  };
});
</script>
