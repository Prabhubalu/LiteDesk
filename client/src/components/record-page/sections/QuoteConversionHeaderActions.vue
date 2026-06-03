<template>
  <div v-if="canConvert" class="flex flex-col items-end gap-2 min-w-[12rem]">
    <input
      v-model="externalRef"
      type="text"
      class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100"
      :placeholder="t('records.conversionExternalRefPlaceholder')"
    />
    <button
      type="button"
      class="inline-flex items-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-sm w-full justify-center"
      :disabled="busy"
      @click="convert"
    >
      {{ t('records.conversionConvert') }}
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/auth';
import { getQuoteConversionEligibility, resolveConversionTypeForQuote } from '@/utils/quoteConversionEligibility';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const notifications = useNotifications();
const auth = useAuthStore();
const busy = ref(false);
const externalRef = ref('');

const canOverrideExpired = computed(() => {
  if (auth.isOwner) return true;
  const role = String(auth.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin';
});

const eligibility = computed(() =>
  getQuoteConversionEligibility(props.record, { overrideExpired: canOverrideExpired.value })
);

const canConvert = computed(() => eligibility.value.allowed === true);

async function convert() {
  if (!props.record?._id || !canConvert.value) return;

  const conversionType = resolveConversionTypeForQuote(props.record);
  const typeLabel =
    conversionType === 'partial'
      ? t('records.conversionTypePartial')
      : t('records.conversionTypeFull');
  const msg = eligibility.value.usedExpiredOverride
    ? t('records.conversionConfirmOverride', { type: typeLabel })
    : t('records.conversionConfirm', { type: typeLabel });
  if (!window.confirm(msg)) return;

  busy.value = true;
  try {
    const body = {
      conversionType,
      targetExternalRef: externalRef.value?.trim() || null
    };
    const res = await apiClient.post(`/quotes/${props.record._id}/convert`, body);
    if (res?.success) {
      const soNumber = res?.data?.salesOrderNumber;
      notifications.success(
        soNumber
          ? t('records.conversionSuccessWithOrder', { number: soNumber })
          : t('records.conversionSuccess')
      );
      const quotePatch = res?.data
        ? {
          status: res.data.status ?? props.record?.status,
          converted: res.data.converted === true,
          conversionStatus: res.data.conversionStatus ?? res.data.status
        }
        : null;
      const payload = quotePatch
        ? { type: 'quote-updated', quote: quotePatch }
        : { type: 'soft-refresh' };
      if (typeof props.context?.onSectionUpdated === 'function') {
        props.context.onSectionUpdated({ sectionKey: 'conversion', payload });
      }
      return;
    }
    notifications.error(res?.message || t('records.conversionFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.conversionFailed'));
  } finally {
    busy.value = false;
  }
}
</script>
