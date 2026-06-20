<template>
  <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('documents.lifecycleTitle') }}
      </h3>
      <p v-if="saving" class="text-xs text-gray-500 dark:text-gray-400">{{ t('documents.lifecycleSaving') }}</p>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('documents.lifecycleEffectiveDate') }}
        </label>
        <input
          v-model="localEffectiveDate"
          type="date"
          class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          :disabled="!canEdit || saving"
          @change="persistLifecycle"
        />
      </div>

      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('documents.lifecycleExpiryDate') }}
        </label>
        <input
          v-model="localExpiryDate"
          type="date"
          class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          :disabled="!canEdit || saving"
          @change="persistLifecycle"
        />
      </div>

      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('documents.lifecycleRenewalDate') }}
        </label>
        <input
          v-model="localRenewalDate"
          type="date"
          class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          :disabled="!canEdit || saving"
          @change="persistLifecycle"
        />
      </div>

      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('documents.lifecycleRetentionPolicy') }}
        </label>
        <input
          v-model="localRetentionPolicy"
          type="text"
          class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          :placeholder="t('documents.lifecycleRetentionPolicyPlaceholder')"
          :disabled="!canEdit || saving"
          @change="persistLifecycle"
        />
      </div>
    </div>

    <p
      v-if="isExpiringSoon"
      class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
    >
      {{ t('documents.lifecycleExpiringSoonHint') }}
    </p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const saving = ref(false);

const canEdit = computed(() => props.context?.canEditLifecycle === true);

const localEffectiveDate = ref('');
const localExpiryDate = ref('');
const localRenewalDate = ref('');
const localRetentionPolicy = ref('');

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function syncFromRecord() {
  localEffectiveDate.value = toDateInputValue(props.record?.effectiveDate);
  localExpiryDate.value = toDateInputValue(props.record?.expiryDate);
  localRenewalDate.value = toDateInputValue(props.record?.renewalDate);
  localRetentionPolicy.value = String(props.record?.retentionPolicy || '');
}

const isExpiringSoon = computed(() => {
  const expiry = props.record?.expiryDate;
  if (!expiry) return false;
  const expiryDate = new Date(expiry);
  if (Number.isNaN(expiryDate.getTime())) return false;
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 30);
  return expiryDate >= now && expiryDate <= horizon;
});

async function persistLifecycle() {
  if (!canEdit.value || !props.record?._id || typeof props.context?.onLifecycleSave !== 'function') return;
  saving.value = true;
  try {
    await props.context.onLifecycleSave({
      effectiveDate: localEffectiveDate.value || null,
      expiryDate: localExpiryDate.value || null,
      renewalDate: localRenewalDate.value || null,
      retentionPolicy: localRetentionPolicy.value.trim() || null
    });
  } finally {
    saving.value = false;
  }
}

watch(() => props.record, syncFromRecord, { deep: true, immediate: true });
</script>
