<template>
  <div
    v-if="visible"
    class="rounded-lg border px-3 py-2.5 text-sm"
    :class="bannerClass"
  >
    <div class="font-medium">{{ title }}</div>
    <div v-if="detail" class="text-xs mt-0.5 opacity-90">{{ detail }}</div>
    <div v-if="acceptedCount" class="text-xs mt-1 opacity-90">
      {{ t('records.quoteCustomerResponseLines', { count: acceptedCount }) }}
      <span v-if="acceptedTotal"> · {{ acceptedTotal }}</span>
    </div>
    <p v-if="comment" class="mt-2 text-xs italic opacity-90">“{{ comment }}”</p>
    <p v-if="signerName && !signatureDisplay" class="mt-1 text-xs opacity-80">
      {{ t('records.quoteCustomerResponseSigner', { name: signerName }) }}
    </p>
    <p v-if="signatureDisplay" class="mt-2 text-sm font-medium quote-signature-display">
      {{ signatureDisplay }}
    </p>
    <p v-if="signatureSignedAt" class="mt-0.5 text-xs opacity-80">
      {{ signatureSignedAt }}
    </p>
    <p v-if="agreedToTerms" class="mt-1 text-xs opacity-80">
      {{ t('records.quoteCustomerResponseAgreed') }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatQuoteMoney } from '@/utils/quoteMoney';

const props = defineProps({
  record: { type: Object, default: null }
});

const { t } = useI18n();

const response = computed(() => props.record?.customerResponse || null);

const visible = computed(() => {
  const type = String(response.value?.responseType || '').toLowerCase();
  return type === 'full' || type === 'partial' || type === 'rejected';
});

const title = computed(() => {
  const type = String(response.value?.responseType || '').toLowerCase();
  if (type === 'rejected') return t('records.quoteCustomerResponseRejected');
  if (type === 'partial') return t('records.quoteCustomerResponsePartial');
  if (type === 'full') return t('records.quoteCustomerResponseAccepted');
  return '';
});

const detail = computed(() => {
  const respondedAt = response.value?.respondedAt;
  if (!respondedAt) return '';
  try {
    return t('records.quoteCustomerResponseAt', {
      date: new Date(respondedAt).toLocaleString()
    });
  } catch {
    return '';
  }
});

const acceptedCount = computed(() => {
  const type = String(response.value?.responseType || '').toLowerCase();
  if (type !== 'partial' && type !== 'full') return 0;
  return (response.value?.acceptedLineIds || []).length;
});

const acceptedTotal = computed(() => {
  const gt = response.value?.acceptedGrandTotal;
  if (gt == null) return '';
  return formatQuoteMoney(gt, props.record?.currency);
});

const comment = computed(() => String(response.value?.comment || '').trim());
const signerName = computed(() => String(response.value?.signerName || '').trim());
const signatureDisplay = computed(() => {
  const sig = String(response.value?.signatureText || '').trim();
  if (sig) return sig;
  return '';
});
const signatureSignedAt = computed(() => {
  const at = response.value?.signatureSignedAt;
  if (!at) return '';
  try {
    return t('records.quoteCustomerResponseSignedAt', {
      date: new Date(at).toLocaleString()
    });
  } catch {
    return '';
  }
});
const agreedToTerms = computed(() => response.value?.agreedToTerms === true);

const bannerClass = computed(() => {
  const type = String(response.value?.responseType || '').toLowerCase();
  if (type === 'rejected') {
    return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100';
  }
  if (type === 'partial') {
    return 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 text-violet-900 dark:text-violet-100';
  }
  return 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100';
});
</script>

<style scoped>
.quote-signature-display {
  font-family: 'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive;
  font-size: 1.125rem;
  letter-spacing: 0.02em;
}
</style>
