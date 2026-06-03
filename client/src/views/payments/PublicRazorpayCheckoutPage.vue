<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
    <div class="max-w-md w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-center space-y-3">
      <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
      <p v-else class="text-sm text-gray-600 dark:text-gray-300">{{ t('records.razorpayCheckoutOpening') }}</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';

const route = useRoute();
const { t } = useI18n();
const error = ref('');

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

onMounted(async () => {
  const orderId = route.query.orderId;
  const keyId = route.query.keyId;
  const successUrl = route.query.successUrl;
  const cancelUrl = route.query.cancelUrl;

  if (!orderId || !keyId) {
    error.value = t('records.razorpayCheckoutMissingParams');
    return;
  }

  try {
    const Razorpay = await loadRazorpayScript();
    const options = {
      key: keyId,
      order_id: orderId,
      handler() {
        if (successUrl) window.location.href = successUrl;
      },
      modal: {
        ondismiss() {
          if (cancelUrl) window.location.href = cancelUrl;
        }
      }
    };
    const rzp = new Razorpay(options);
    rzp.open();
  } catch (err) {
    error.value = err.message || t('records.razorpayCheckoutFailed');
  }
});
</script>
