<template>
  <div
    v-if="dockOpen"
    class="fixed bottom-4 right-4 z-[60] w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
  >
    <div class="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-800">
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('telephony.softphoneTitle') }}
        </p>
        <p class="truncate text-xs text-gray-500 dark:text-gray-400">
          {{ statusLabel }}
          <span v-if="status === 'in-call'" class="ml-1 font-mono">{{ elapsedLabel }}</span>
        </p>
      </div>
      <button
        type="button"
        class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        :aria-label="dockMinimized ? t('telephony.softphoneExpand') : t('telephony.softphoneMinimize')"
        @click="dockMinimized = !dockMinimized"
      >
        <span class="text-xs">{{ dockMinimized ? '▴' : '▾' }}</span>
      </button>
    </div>

    <div v-show="!dockMinimized" class="space-y-3 p-3">
      <p v-if="!deviceReady" class="text-xs text-amber-700 dark:text-amber-300">
        {{ t('telephony.softphoneDeviceOffline') }}
      </p>
      <p v-if="lastError" class="text-xs text-red-600 dark:text-red-400">{{ lastError }}</p>

      <div class="flex gap-2">
        <input
          v-model="dialNumber"
          type="tel"
          class="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          :placeholder="t('telephony.softphoneNumberPlaceholder')"
          @keydown.enter.prevent="onDial"
        />
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="!dialNumber || status === 'connecting'"
          @click="onDial"
        >
          {{ t('telephony.softphoneDial') }}
        </button>
      </div>

      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="digit in pad"
          :key="digit"
          type="button"
          class="rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
          @click="dialNumber = `${dialNumber || ''}${digit}`"
        >
          {{ digit }}
        </button>
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-medium dark:border-gray-600"
          :disabled="status !== 'in-call'"
          @click="toggleMute"
        >
          {{ muted ? t('telephony.softphoneUnmute') : t('telephony.softphoneMute') }}
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-medium dark:border-gray-600"
          :disabled="status !== 'in-call'"
          @click="toggleHold"
        >
          {{ onHold ? t('telephony.softphoneResume') : t('telephony.softphoneHold') }}
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          :disabled="status === 'idle'"
          @click="hangup"
        >
          {{ t('telephony.softphoneHangup') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTelephonySoftphone } from '@/composables/useTelephonySoftphone';

const { t } = useI18n();
const {
  dockOpen,
  dockMinimized,
  dialNumber,
  status,
  muted,
  onHold,
  elapsedLabel,
  lastError,
  deviceReady,
  connectDevice,
  connectStream,
  disconnectStream,
  dial,
  hangup,
  toggleMute,
  toggleHold,
} = useTelephonySoftphone();

const pad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const statusLabel = computed(() => {
  if (status.value === 'connecting') return t('telephony.softphoneStatusConnecting');
  if (status.value === 'ringing') return t('telephony.softphoneStatusRinging');
  if (status.value === 'in-call') return t('telephony.softphoneStatusInCall');
  return t('telephony.softphoneStatusIdle');
});

async function onDial() {
  try {
    await dial(dialNumber.value);
  } catch {
    /* lastError set in composable */
  }
}

onMounted(async () => {
  connectStream();
  await connectDevice();
});

onBeforeUnmount(() => {
  disconnectStream();
});

watch(dockOpen, (open) => {
  if (open) connectStream();
  else disconnectStream();
});
</script>
