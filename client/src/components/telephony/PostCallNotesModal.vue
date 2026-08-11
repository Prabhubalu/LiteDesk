<template>
  <div
    v-if="postCallCallId"
    class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
    role="dialog"
    aria-modal="true"
  >
    <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-900">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ t('telephony.postCallTitle') }}
      </h2>

      <div class="mt-4 space-y-3">
        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('telephony.postCallNotes') }}</span>
          <textarea
            v-model="notes"
            rows="3"
            class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>

        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('telephony.postCallDisposition') }}</span>
          <select
            v-model="disposition"
            class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">—</option>
            <option v-for="opt in dispositionOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>

        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('telephony.postCallFollowUp') }}</span>
          <input
            v-model="followUpDate"
            type="date"
            class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>

        <label class="block text-sm">
          <span class="text-gray-700 dark:text-gray-300">{{ t('telephony.postCallNextAction') }}</span>
          <input
            v-model="nextAction"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>

        <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
          @click="onSkip"
        >
          {{ t('telephony.postCallSkip') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="saving"
          @click="onSave"
        >
          {{ t('telephony.postCallSave') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTelephonySoftphone } from '@/composables/useTelephonySoftphone';
import { attachCallNotes } from '@/utils/telephonyApi';

const { t } = useI18n();
const { postCallCallId } = useTelephonySoftphone();

const notes = ref('');
const disposition = ref('');
const followUpDate = ref('');
const nextAction = ref('');
const saving = ref(false);
const error = ref('');

const dispositionOptions = computed(() => [
  { value: 'connected', label: t('telephony.dispositionConnected') },
  { value: 'voicemail', label: t('telephony.dispositionVoicemail') },
  { value: 'no_answer', label: t('telephony.dispositionNoAnswer') },
  { value: 'busy', label: t('telephony.dispositionBusy') },
  { value: 'wrong_number', label: t('telephony.dispositionWrongNumber') },
  { value: 'callback', label: t('telephony.dispositionCallback') },
  { value: 'interested', label: t('telephony.dispositionInterested') },
  { value: 'not_interested', label: t('telephony.dispositionNotInterested') },
]);

watch(postCallCallId, () => {
  notes.value = '';
  disposition.value = '';
  followUpDate.value = '';
  nextAction.value = '';
  error.value = '';
});

function onSkip() {
  postCallCallId.value = null;
}

async function onSave() {
  if (!postCallCallId.value) return;
  saving.value = true;
  error.value = '';
  try {
    await attachCallNotes(postCallCallId.value, {
      notes: notes.value,
      disposition: disposition.value || null,
      followUpDate: followUpDate.value || null,
      nextAction: nextAction.value || null,
    });
    postCallCallId.value = null;
  } catch {
    error.value = t('telephony.postCallSaveFailed');
  } finally {
    saving.value = false;
  }
}
</script>
