<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <TelephonyNav />
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('telephony.callDetailTitle') }}</h1>

      <p v-if="loading" class="mt-4 text-sm text-gray-500">{{ t('states.loading') }}</p>
      <p v-else-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>

      <template v-else-if="call">
        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between gap-2">
                <dt class="text-gray-500">{{ t('telephony.callsColFrom') }}</dt>
                <dd><PhoneLink :number="call.from" /></dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-gray-500">{{ t('telephony.callsColTo') }}</dt>
                <dd><PhoneLink :number="call.to" /></dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-gray-500">{{ t('telephony.callsColDirection') }}</dt>
                <dd>{{ call.direction }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-gray-500">{{ t('telephony.callsColStatus') }}</dt>
                <dd>{{ call.status }}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-gray-500">{{ t('telephony.callsColDuration') }}</dt>
                <dd>{{ call.durationSeconds ?? '—' }}s</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-gray-500">{{ t('telephony.postCallDisposition') }}</dt>
                <dd>{{ call.disposition || '—' }}</dd>
              </div>
            </dl>
          </section>

          <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('telephony.callDetailRecording') }}</h2>
            <audio
              v-if="recordingUrl"
              class="mt-3 w-full"
              controls
              :src="recordingUrl"
            />
            <p v-else class="mt-2 text-sm text-gray-500">{{ t('telephony.callDetailNoRecording') }}</p>
          </section>

          <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('telephony.callDetailTranscript') }}</h2>
            <p class="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
              {{ transcriptText || t('telephony.callDetailNoTranscript') }}
            </p>
          </section>

          <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('telephony.callDetailSummary') }}</h2>
            <p class="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
              {{ summaryText || t('telephony.callDetailNoSummary') }}
            </p>
          </section>

          <section class="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2 dark:border-gray-800 dark:bg-gray-900">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('telephony.callDetailNotes') }}</h2>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <textarea
                v-model="notes"
                rows="3"
                class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm sm:col-span-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                :placeholder="t('telephony.postCallNotes')"
              />
              <input
                v-model="disposition"
                type="text"
                class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                :placeholder="t('telephony.postCallDisposition')"
              />
              <input
                v-model="nextAction"
                type="text"
                class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                :placeholder="t('telephony.postCallNextAction')"
              />
              <input
                v-model="followUpDate"
                type="date"
                class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <button
                type="button"
                class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                :disabled="saving"
                @click="saveNotes"
              >
                {{ t('telephony.postCallSave') }}
              </button>
            </div>
            <p v-if="notesError" class="mt-2 text-sm text-red-600">{{ notesError }}</p>
            <p v-if="notesOk" class="mt-2 text-sm text-emerald-600">{{ notesOk }}</p>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import TelephonyNav from '@/components/telephony/TelephonyNav.vue';
import PhoneLink from '@/components/telephony/PhoneLink.vue';
import {
  attachCallNotes,
  getCall,
  getCallSummary,
  getCallTranscript,
  getRecording,
} from '@/utils/telephonyApi';
import { getApiUrlForFetch } from '@/config/apiBase';

const { t } = useI18n();
const route = useRoute();

const loading = ref(true);
const error = ref('');
const call = ref(null);
const recordingUrl = ref('');
const transcriptText = ref('');
const summaryText = ref('');
const notes = ref('');
const disposition = ref('');
const nextAction = ref('');
const followUpDate = ref('');
const saving = ref(false);
const notesError = ref('');
const notesOk = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getCall(route.params.callId);
    call.value = res?.data || null;
    disposition.value = call.value?.disposition || '';

    if (call.value?.recordingId) {
      try {
        const rec = await getRecording(call.value.recordingId);
        const sid = rec?.data?._id || call.value.recordingId;
        recordingUrl.value = getApiUrlForFetch(`/telephony/recordings/${sid}/download`);
      } catch {
        recordingUrl.value = '';
      }
    }

    if (call.value?.transcriptId || call.value?._id) {
      try {
        const tr = await getCallTranscript(call.value._id);
        transcriptText.value = tr?.data?.text || tr?.data?.transcript || '';
      } catch {
        transcriptText.value = '';
      }
    }

    if (call.value?.summaryId || call.value?._id) {
      try {
        const sm = await getCallSummary(call.value._id);
        summaryText.value = sm?.data?.summary || sm?.data?.text || '';
      } catch {
        summaryText.value = '';
      }
    }
  } catch {
    error.value = t('telephony.callDetailLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function saveNotes() {
  saving.value = true;
  notesError.value = '';
  notesOk.value = '';
  try {
    await attachCallNotes(route.params.callId, {
      notes: notes.value,
      disposition: disposition.value || null,
      followUpDate: followUpDate.value || null,
      nextAction: nextAction.value || null,
    });
    notesOk.value = t('telephony.postCallSave');
  } catch {
    notesError.value = t('telephony.postCallSaveFailed');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
