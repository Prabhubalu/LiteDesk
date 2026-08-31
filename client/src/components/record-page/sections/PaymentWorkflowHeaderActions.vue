<template>
  <div class="flex items-center gap-2">
    <button
      v-if="canRefund"
      type="button"
      class="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
      @click="openRefundWizard"
    >
      {{ t('records.paymentIssueRefund') }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  record: { type: Object, default: null }
});

const { t } = useI18n();
const auth = useAuthStore();

const canRefund = computed(() => {
  const max = Number(props.record?.maxRefundable ?? props.record?.amount ?? 0) -
    Number(props.record?.amountRefunded ?? 0);
  const refundable = Number(props.record?.maxRefundable ?? max);
  if (refundable <= 0 && Number(props.record?.amountUnallocated ?? 0) <= 0) return false;
  if (auth.isOwner) return true;
  return auth.can('payments', 'refund');
});

function openRefundWizard() {
  window.dispatchEvent(
    new CustomEvent('arivu:payment-open-refund', {
      detail: { paymentMongoId: props.record?._id, paymentId: props.record?.paymentId }
    })
  );
}
</script>
