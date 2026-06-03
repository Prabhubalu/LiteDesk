<template>
  <CustomerStatementPanel
    :organization-ref-id="organizationRefId"
    :default-currency="defaultCurrency"
  />
</template>

<script setup>
import { computed } from 'vue';
import CustomerStatementPanel from '@/components/payments/CustomerStatementPanel.vue';

const props = defineProps({
  record: { type: Object, default: null }
});

const organizationRefId = computed(() => {
  const id = props.record?.organizationRefId;
  return id ? String(id) : null;
});

const defaultCurrency = computed(() => props.record?.paymentCurrency || props.record?.currency || 'USD');
</script>
