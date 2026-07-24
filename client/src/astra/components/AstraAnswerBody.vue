<template>
  <div
    v-if="sections.length"
    class="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900/80"
  >
    <div class="space-y-0 divide-y divide-neutral-100 dark:divide-white/[0.06]">
      <template v-for="(section, idx) in sections" :key="`${section.type}-${idx}`">
        <!-- Prose -->
        <div
          v-if="section.type === 'prose'"
          class="astra-answer-prose px-4 py-3.5 text-[15px] leading-7 text-neutral-800 dark:text-neutral-100"
          v-html="section.html"
        />

        <!-- Steps -->
        <div
          v-else-if="section.type === 'steps'"
          class="px-4 py-3.5"
        >
          <p class="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            {{ t('astra.answerNextSteps') }}
          </p>
          <ol class="space-y-2">
            <li
              v-for="(item, stepIdx) in section.items"
              :key="stepIdx"
              class="flex gap-3 rounded-xl bg-neutral-50/90 px-3 py-2.5 dark:bg-neutral-950/60"
            >
              <span
                class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300"
              >
                {{ stepIdx + 1 }}
              </span>
              <span class="min-w-0 text-sm leading-6 text-neutral-800 dark:text-neutral-100">{{ item }}</span>
            </li>
          </ol>
        </div>

        <!-- CRM inventory (list answers — not next steps) -->
        <div
          v-else-if="section.type === 'inventory'"
          class="px-4 py-3.5"
        >
          <ul class="space-y-2">
            <li
              v-for="(item, invIdx) in section.items"
              :key="invIdx"
              class="flex gap-3 rounded-xl bg-neutral-50/90 px-3 py-2.5 dark:bg-neutral-950/60"
            >
              <span
                class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-neutral-200/80 text-[11px] font-semibold tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {{ invIdx + 1 }}
              </span>
              <span class="min-w-0 text-sm leading-6 text-neutral-800 dark:text-neutral-100">{{ item }}</span>
            </li>
          </ul>
        </div>

        <!-- Draft -->
        <Disclosure
          v-else-if="section.type === 'draft'"
          v-slot="{ open }"
          :default-open="true"
          as="div"
          class="px-4 py-3"
        >
          <div class="overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-50/80 dark:border-white/10 dark:bg-neutral-950/50">
            <div class="flex items-center gap-2 border-b border-neutral-200/70 px-3 py-2 dark:border-white/[0.08]">
              <DisclosureButton
                class="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <ChevronRightIcon
                  class="h-4 w-4 shrink-0 text-neutral-400 transition-transform"
                  :class="open ? 'rotate-90' : ''"
                />
                <span class="truncate text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {{ section.title && section.title.toLowerCase() !== 'draft'
                    ? section.title
                    : t('astra.answerDraft') }}
                </span>
              </DisclosureButton>
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition hover:border-primary-300 hover:text-primary-700 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-primary-500/40 dark:hover:text-primary-300"
                @click="onCopy(section.body, idx)"
              >
                <ClipboardDocumentIcon class="h-3.5 w-3.5" />
                {{ copiedIdx === idx ? t('astra.draftCopied') : t('astra.copyDraft') }}
              </button>
            </div>
            <DisclosurePanel>
              <pre
                class="max-h-72 overflow-auto whitespace-pre-wrap break-words px-3.5 py-3 font-mono text-[12.5px] leading-5 text-neutral-700 dark:text-neutral-200"
              >{{ section.body }}</pre>
            </DisclosurePanel>
          </div>
        </Disclosure>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import { ChevronRightIcon, ClipboardDocumentIcon } from '@heroicons/vue/24/outline';
import { parseAstraAnswer } from '@/astra/utils/parseAstraAnswer';

const props = defineProps<{
  body: string;
}>();

const { t } = useI18n();
const copiedIdx = ref<number | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const sections = computed(() => parseAstraAnswer(props.body || ''));

async function onCopy(text: string, idx: number) {
  try {
    await navigator.clipboard.writeText(text);
    copiedIdx.value = idx;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copiedIdx.value = null;
    }, 1600);
  } catch {
    /* ignore */
  }
}
</script>

<style scoped>
.astra-answer-prose :deep(p) {
  margin: 0;
}
.astra-answer-prose :deep(p + p) {
  margin-top: 0.75rem;
}
.astra-answer-prose :deep(strong) {
  font-weight: 600;
  color: inherit;
}
</style>
