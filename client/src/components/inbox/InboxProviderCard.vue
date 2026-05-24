<template>
  <component
    :is="interactive ? 'button' : 'div'"
    :type="interactive ? 'button' : undefined"
    class="group relative flex flex-col items-center text-center transition-all"
    :class="[cardClasses, variant === 'picker' ? 'gap-3 rounded-xl border p-5' : 'gap-2.5 rounded-2xl border p-4']"
    :disabled="interactive && isDisabled"
    :title="titleAttr"
    @click="interactive ? $emit('select', provider.id) : undefined"
  >
    <span
      class="flex shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
      :class="[
        variant === 'picker' ? 'h-16 w-16 text-2xl' : 'h-14 w-14 text-xl',
        provider.iconBgClass
      ]"
      :style="provider.iconStyle || undefined"
      aria-hidden="true"
    >
      <EnvelopeIcon
        v-if="provider.iconType === 'icon'"
        :class="variant === 'picker' ? 'h-9 w-9 text-gray-500' : 'h-8 w-8 text-gray-400'"
      />
      <span v-else class="drop-shadow-sm">{{ provider.iconLetter }}</span>
    </span>

    <span class="min-w-0 w-full">
      <span
        class="block font-semibold leading-tight text-gray-900 dark:text-white"
        :class="variant === 'picker' ? 'text-sm' : 'text-sm'"
      >
        {{ provider.name }}
      </span>
      <template v-if="variant !== 'picker'">
        <span
          v-if="provider.subtitle"
          class="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400"
        >{{ provider.subtitle }}</span>
        <span class="mt-1 block text-[10px] leading-snug text-gray-400 dark:text-gray-500">
          {{ provider.integrationLabel }}
        </span>
      </template>
    </span>

    <span
      v-if="variant !== 'picker' && provider.status === 'available' && selected"
      class="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white"
      aria-hidden="true"
    >
      <CheckIcon class="h-3.5 w-3.5" />
    </span>
    <span
      v-else-if="variant !== 'picker' && provider.status === 'coming_soon'"
      class="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300"
    >{{ t('inbox.inboxProviderCardSoon') }}</span>
    <span
      v-else-if="variant !== 'picker' && provider.status === 'disabled'"
      class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
    >{{ t('appointments.publicUnavailable') }}</span>
  </component>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { CheckIcon, EnvelopeIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  provider: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  interactive: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  unavailableReason: { type: String, default: '' },
  /** `picker` — Vtiger-style tile (logo + name only) for inbox onboarding modal */
  variant: { type: String, default: 'default' }
});

const { t } = useI18n();

defineEmits(['select']);

const isDisabled = computed(() => {
  if (props.disabled) return true;
  if (props.variant === 'picker' && props.provider.status === 'coming_soon') return false;
  return props.provider.status !== 'available';
});

const cardClasses = computed(() => {
  const p = props.provider;
  if (props.variant === 'picker') {
    if (p.status === 'coming_soon') {
      return 'cursor-pointer border-gray-200 bg-white hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-950 dark:hover:border-gray-600';
    }
    if (props.selected) {
      return 'border-emerald-400 bg-white ring-2 ring-emerald-500/25 dark:border-emerald-700 dark:bg-gray-950';
    }
    if (props.disabled) {
      return 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-900/50';
    }
    return 'cursor-pointer border-gray-200 bg-white shadow-sm hover:border-emerald-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-950 dark:hover:border-emerald-800';
  }
  if (p.status === 'coming_soon' || p.status === 'disabled') {
    return 'cursor-default border-dashed border-gray-200 bg-gray-50/80 opacity-75 dark:border-gray-700 dark:bg-gray-900/40';
  }
  if (props.selected) {
    return 'border-emerald-400 bg-emerald-50/90 ring-2 ring-emerald-500/30 dark:border-emerald-700 dark:bg-emerald-950/40';
  }
  if (props.interactive && !props.disabled) {
    return 'cursor-pointer border-gray-200 bg-white shadow-sm hover:border-emerald-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-950 dark:hover:border-emerald-800';
  }
  return 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950';
});

const titleAttr = computed(() => {
  const name = props.provider.name;
  if (props.provider.status === 'coming_soon') {
    return t('inbox.inboxProviderComingSoonTitle', { name });
  }
  if (props.unavailableReason) return props.unavailableReason;
  if (props.provider.status !== 'available') {
    return t('inbox.inboxProviderNotAvailableTitle', { name });
  }
  return t('inbox.inboxProviderConnectTitle', { name });
});
</script>
