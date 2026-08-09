<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <TelephonyNav />
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('telephony.providerTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('telephony.providerDesc') }}</p>

      <form class="mt-6 max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900" @submit.prevent="onSave">
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('telephony.providerKey') }}</span>
          <select
            v-model="providerKey"
            class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option v-for="key in providerOptions" :key="key" :value="key">{{ key }}</option>
          </select>
        </label>

        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('telephony.providerAccountSid') }}</span>
          <input v-model="accountSid" type="text" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </label>
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('telephony.providerAuthToken') }}</span>
          <input v-model="authToken" type="password" autocomplete="off" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </label>
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('telephony.providerApiKey') }}</span>
          <input v-model="apiKey" type="text" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </label>
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('telephony.providerApiSecret') }}</span>
          <input v-model="apiSecret" type="password" autocomplete="off" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </label>
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('telephony.providerTwimlAppSid') }}</span>
          <input v-model="twimlAppSid" type="text" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </label>
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('telephony.providerFromNumber') }}</span>
          <input v-model="fromNumber" type="tel" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </label>

        <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input v-model="isActive" type="checkbox" class="rounded border-gray-300" />
          {{ t('telephony.providerActive') }}
        </label>

        <div class="flex flex-wrap gap-2">
          <button
            type="submit"
            class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="saving"
          >
            {{ t('telephony.providerSave') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
            :disabled="!providerKey || healthLoading"
            @click="onHealth"
          >
            {{ t('telephony.providerHealthCheck') }}
          </button>
        </div>

        <p v-if="message" class="text-sm text-emerald-600">{{ message }}</p>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import TelephonyNav from '@/components/telephony/TelephonyNav.vue';
import { listProviders, providerHealthCheck, upsertProvider } from '@/utils/telephonyApi';

const { t } = useI18n();

const providerOptions = ref(['twilio', 'exotel', 'plivo', 'knowlarity', 'generic_sip']);
const providerKey = ref('twilio');
const accountSid = ref('');
const authToken = ref('');
const apiKey = ref('');
const apiSecret = ref('');
const twimlAppSid = ref('');
const fromNumber = ref('');
const isActive = ref(true);
const saving = ref(false);
const healthLoading = ref(false);
const message = ref('');
const error = ref('');

onMounted(async () => {
  try {
    const res = await listProviders();
    const registered = res?.meta?.registered;
    if (Array.isArray(registered) && registered.length) {
      providerOptions.value = registered;
    }
    const rows = Array.isArray(res?.data) ? res.data : [];
    const active = rows.find((r) => r.isActive) || rows[0];
    if (active) {
      providerKey.value = active.providerKey || 'twilio';
      accountSid.value = active.credentials?.accountSid || active.externalAccountId || '';
      apiKey.value = active.credentials?.apiKey || '';
      twimlAppSid.value = active.credentials?.twimlAppSid || '';
      fromNumber.value = active.settings?.fromNumber || active.credentials?.fromNumber || '';
      isActive.value = active.isActive !== false;
    }
  } catch {
    /* empty form is fine */
  }
});

async function onSave() {
  saving.value = true;
  message.value = '';
  error.value = '';
  try {
    await upsertProvider({
      providerKey: providerKey.value,
      enabled: true,
      isActive: isActive.value,
      credentials: {
        accountSid: accountSid.value,
        authToken: authToken.value || undefined,
        apiKey: apiKey.value,
        apiSecret: apiSecret.value || undefined,
        twimlAppSid: twimlAppSid.value,
        fromNumber: fromNumber.value,
      },
      settings: {
        fromNumber: fromNumber.value,
      },
    });
    message.value = t('telephony.providerSaved');
  } catch {
    error.value = t('telephony.providerSaveFailed');
  } finally {
    saving.value = false;
  }
}

async function onHealth() {
  healthLoading.value = true;
  message.value = '';
  error.value = '';
  try {
    await providerHealthCheck(providerKey.value);
    message.value = t('telephony.providerHealthOk');
  } catch {
    error.value = t('telephony.providerHealthFailed');
  } finally {
    healthLoading.value = false;
  }
}
</script>
