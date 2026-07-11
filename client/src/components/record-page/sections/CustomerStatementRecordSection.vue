<template>
  <CustomerStatementPanel
    :organization-ref-id="organizationRefId"
    :default-currency="defaultCurrency"
  />
</template>

<script setup>
import { computed } from 'vue';
import CustomerStatementPanel from '@/components/payments/CustomerStatementPanel.vue';
import { resolveCurrencyCodeForField } from '@/utils/currencyOptions';

const props = defineProps({
  record: { type: Object, default: null }
});

const organizationRefId = computed(() => {
  const id = props.record?.organizationRefId;
  return id ? String(id) : null;
});

const defaultCurrency = computed(() => resolveCurrencyCodeForField({ record: props.record }));
</script>
