<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <TelephonyNav />
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('telephony.phoneNumbersTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('telephony.phoneNumbersDesc') }}</p>

      <p v-if="loading" class="mt-4 text-sm text-gray-500">{{ t('states.loading') }}</p>
      <p v-else-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
      <p v-else-if="!rows.length" class="mt-4 text-sm text-gray-500">{{ t('telephony.phoneNumbersEmpty') }}</p>

      <ul v-else class="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
        <li
          v-for="(row, idx) in rows"
          :key="row._id || row.phoneNumber || row.number || idx"
          class="flex items-center justify-between px-4 py-3 text-sm"
        >
          <PhoneLink :number="row.phoneNumber || row.number || row.e164 || row" />
          <span class="text-gray-500">{{ row.friendlyName || row.label || row.providerKey || '' }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import TelephonyNav from '@/components/telephony/TelephonyNav.vue';
import PhoneLink from '@/components/telephony/PhoneLink.vue';
import { listPhoneNumbers } from '@/utils/telephonyApi';

const { t } = useI18n();
const loading = ref(true);
const error = ref('');
const rows = ref([]);

onMounted(async () => {
  try {
    const res = await listPhoneNumbers();
    const data = res?.data;
    rows.value = Array.isArray(data) ? data : Array.isArray(data?.numbers) ? data.numbers : [];
  } catch {
    error.value = t('telephony.phoneNumbersLoadFailed');
  } finally {
    loading.value = false;
  }
});
</script>
