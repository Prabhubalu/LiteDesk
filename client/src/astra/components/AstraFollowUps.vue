<template>
  <div v-if="items.length" class="space-y-2">
    <p class="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
      {{ t('astra.suggestionsHeading') }}
    </p>
    <div class="flex flex-col items-start gap-2">
      <button
        v-for="(item, idx) in items"
        :key="`${keyPrefix}-${idx}`"
        type="button"
        class="inline-flex max-w-full items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-left text-[13px] font-medium leading-snug text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-white/20 dark:hover:bg-neutral-900"
        @click="emit('select', item.prompt)"
      >
        <ArrowUturnRightIcon class="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
        <span class="min-w-0">{{ item.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowUturnRightIcon } from '@heroicons/vue/24/outline';
import type { AstraSuggestion } from '@/astra/composables/useAstraAsk';

const props = withDefaults(
  defineProps<{
    suggestions: AstraSuggestion[];
    keyPrefix?: string;
  }>(),
  { keyPrefix: 'follow-up' },
);

const emit = defineEmits<{
  select: [prompt: string];
}>();

const { t } = useI18n();

const items = computed(() =>
  (props.suggestions || [])
    .map((suggestion) => {
      if (typeof suggestion === 'string') {
        const text = suggestion.trim();
        return text ? { label: text, prompt: text } : null;
      }
      const label = String(suggestion.label || suggestion.prompt || '').trim();
      const prompt = String(suggestion.prompt || suggestion.label || '').trim();
      if (!label && !prompt) return null;
      return { label: label || prompt, prompt: prompt || label };
    })
    .filter((row): row is { label: string; prompt: string } => row !== null),
);
</script>
