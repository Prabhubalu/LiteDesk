<template>
  <button
    v-if="formatted"
    type="button"
    class="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
    :aria-label="t('telephony.phoneLinkAria', { number: formatted })"
    :title="t('telephony.callsClickToCall')"
    @click="onClick"
  >
    <PhoneIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span>{{ display || formatted }}</span>
  </button>
  <span v-else class="text-gray-400">—</span>
</template>

<script setup>
/**
 * Clickable phone number. Usage:
 *   <PhoneLink :number="record.phone" />
 * Optionally wire into phone field display components via this export.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhoneIcon } from '@heroicons/vue/24/outline';
import { clickToCall, formatPhoneForDial } from '@/utils/clickToCall';

const props = defineProps({
  number: { type: [String, Number], default: '' },
  display: { type: String, default: '' },
});

const { t } = useI18n();

const formatted = computed(() => formatPhoneForDial(props.number));

async function onClick() {
  await clickToCall(formatted.value);
}
</script>
