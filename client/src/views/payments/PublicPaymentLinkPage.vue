<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
    <div
      v-if="loading"
      class="text-sm text-gray-500"
    >
      {{ t('records.paymentLinkLoading') }}
    </div>

    <div
      v-else-if="error"
      class="max-w-md w-full rounded-lg border border-red-200 bg-white dark:bg-gray-900 p-6 text-center"
    >
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <div
      v-else-if="bankInstruction"
      class="max-w-md w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden"
    >
      <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('records.bankTransferTitle') }}</h1>
        <p class="text-sm text-gray-500 mt-1">{{ t('records.bankTransferPayPrompt') }}</p>
      </div>
      <div class="px-6 py-5 space-y-3 text-sm">
        <div class="flex justify-between"><span class="text-gray-500">{{ t('records.bankTransferBeneficiary') }}</span><span>{{ bankInstruction.beneficiaryName }}</span></div>
        <div v-if="bankInstruction.bankName" class="flex justify-between"><span class="text-gray-500">{{ t('records.bankTransferBank') }}</span><span>{{ bankInstruction.bankName }}</span></div>
        <div v-if="bankInstruction.accountNumberMasked" class="flex justify-between"><span class="text-gray-500">{{ t('records.bankTransferAccount') }}</span><span>{{ bankInstruction.accountNumberMasked }}</span></div>
        <div v-if="bankInstruction.routingOrIfsc" class="flex justify-between"><span class="text-gray-500">{{ t('records.bankTransferRouting') }}</span><span>{{ bankInstruction.routingOrIfsc }}</span></div>
        <div class="flex justify-between font-semibold"><span class="text-gray-500">{{ t('records.bankTransferReference') }}</span><span class="font-mono">{{ bankInstruction.referenceCode }}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">{{ t('records.paymentLinkAmount') }}</span><span class="tabular-nums">{{ formatMoney(bankInstruction.amount, bankInstruction.currency) }}</span></div>
        <p class="text-xs text-gray-500 pt-2">{{ t('records.bankTransferCustomerHint') }}</p>
        <button type="button" class="text-indigo-600 text-xs hover:underline" @click="bankInstruction = null">{{ t('records.bankTransferBackToMethods') }}</button>
      </div>
    </div>

    <div
      v-else-if="link"
      class="max-w-md w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden"
    >
      <div
        class="px-6 py-5 border-b border-gray-200 dark:border-gray-700"
        :style="accentStyle"
      >
        <img
          v-if="link.brandingSnapshot?.logoUrl"
          :src="link.brandingSnapshot.logoUrl"
          alt=""
          class="h-8 mb-3 object-contain"
        />
        <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {{ link.brandingSnapshot?.displayName || t('records.paymentLinkTitle') }}
        </h1>
        <p class="text-sm text-gray-500 mt-1">{{ t('records.paymentLinkPayPrompt') }}</p>
      </div>

      <div class="px-6 py-5 space-y-4">
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">{{ t('records.paymentLinkAmount') }}</span>
          <span class="font-semibold tabular-nums">{{ formatMoney(link.amount, link.currency) }}</span>
        </div>

        <button
          v-if="showCardPay"
          type="button"
          class="w-full rounded-md bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-sm font-medium disabled:opacity-50"
          :disabled="busy"
          @click="startCheckout"
        >
          {{ busy ? t('records.paymentLinkRedirecting') : t('records.paymentLinkPayNow') }}
        </button>

        <button
          v-if="showBankTransfer"
          type="button"
          class="w-full rounded-md border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-medium disabled:opacity-50"
          :disabled="busy"
          @click="startBankTransfer"
        >
          {{ busy ? t('records.bankTransferLoading') : t('records.bankTransferPayButton') }}
        </button>

        <p
          v-if="link.brandingSnapshot?.footerText"
          class="text-xs text-gray-500 text-center"
        >
          {{ link.brandingSnapshot.footerText }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { formatCurrencyValue } from '@/utils/currencyOptions';

const route = useRoute();
const { t } = useI18n();
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const link = ref(null);
const bankInstruction = ref(null);

const accentStyle = computed(() => {
  const color = link.value?.brandingSnapshot?.accentColor;
  return color ? { borderTopColor: color, borderTopWidth: '3px' } : {};
});

const showCardPay = computed(() => (link.value?.allowedMethods || ['card']).includes('card'));
const showBankTransfer = computed(() => (link.value?.allowedMethods || []).includes('bank_transfer'));

function formatMoney(amount, currency = 'USD') {
  return formatCurrencyValue(amount, { currencyCode: currency || 'USD' }) ?? '—';
}

async function loadLink() {
  loading.value = true;
  error.value = '';
  try {
    const token = route.params.publicToken;
    const res = await fetch(`/api/public/pay/${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Payment link unavailable');
    }
    link.value = json.data;
  } catch (err) {
    error.value = err.message || t('records.paymentLinkUnavailable');
  } finally {
    loading.value = false;
  }
}

async function startCheckout() {
  busy.value = true;
  try {
    const token = route.params.publicToken;
    const origin = window.location.origin;
    const res = await fetch(`/api/public/pay/${encodeURIComponent(token)}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        successUrl: `${origin}/pay/${token}/return?sessionId={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/pay/${token}?cancelled=1`
      })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Failed to start checkout');
    }
    if (json.data?.checkoutUrl) {
      window.location.href = json.data.checkoutUrl;
      return;
    }
    throw new Error('Checkout URL missing');
  } catch (err) {
    error.value = err.message;
    busy.value = false;
  }
}

async function startBankTransfer() {
  busy.value = true;
  try {
    const token = route.params.publicToken;
    const res = await fetch(`/api/public/pay/${encodeURIComponent(token)}/bank-transfer`, {
      method: 'POST',
      headers: { Accept: 'application/json' }
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Failed to create bank transfer instruction');
    }
    bankInstruction.value = json.data;
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}

onMounted(loadLink);
</script>
