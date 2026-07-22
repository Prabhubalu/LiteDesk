<template>
  <Teleport to="body">
    <Transition name="astra-palette-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[10070] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
        @click.self="close"
      >
        <div
          class="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
          role="dialog"
          aria-modal="true"
        >
          <form class="border-b border-gray-100 px-4 py-3 dark:border-gray-800" @submit.prevent="onSubmit">
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('astra.commandPaletteHeading') }}
            </label>
            <input
              ref="inputEl"
              v-model="draft"
              type="text"
              class="mt-1.5 w-full border-0 bg-transparent p-0 text-base text-gray-900 focus:outline-none focus:ring-0 dark:text-gray-100"
              :placeholder="t('astra.askPrompt')"
              :disabled="asking"
            />
          </form>

          <div class="max-h-[50vh] overflow-y-auto px-4 py-3">
            <p v-if="asking" class="text-sm text-gray-500 dark:text-gray-400">{{ t('astra.thinking') }}</p>

            <template v-else-if="answer || proposals.length">
              <p v-if="answer" class="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-100">
                {{ answer }}
              </p>
              <div v-if="proposals.length" class="mt-3 space-y-2">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {{ t('astra.proposalsHeading') }}
                </p>
                <div
                  v-for="proposal in proposals"
                  :key="proposal.id"
                  class="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ proposal.label }}</p>
                      <p
                        v-if="proposal.rationale"
                        class="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-gray-500 dark:text-gray-400"
                      >
                        {{ proposal.rationale }}
                      </p>
                      <dl v-if="proposal.details?.length" class="mt-1.5 space-y-0.5">
                        <div
                          v-for="(row, dIdx) in proposal.details.slice(0, 4)"
                          :key="`${proposal.id}-d-${dIdx}`"
                          class="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 text-[11px]"
                        >
                          <dt class="text-gray-400">{{ row.label }}</dt>
                          <dd class="truncate text-gray-600 dark:text-gray-300">{{ row.value }}</dd>
                        </div>
                      </dl>
                    </div>
                    <button
                      type="button"
                      class="shrink-0 rounded-md bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                      :disabled="confirming"
                      @click="onConfirm(proposal)"
                    >
                      {{ t('astra.confirmAction') }}
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <p v-else class="text-sm text-gray-400 dark:text-gray-500">{{ t('astra.commandPaletteHelp') }}</p>

            <p v-if="error" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
          </div>

          <div class="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <button
              type="button"
              class="text-xs font-medium text-primary-700 transition hover:text-primary-900 dark:text-primary-300 dark:hover:text-primary-100"
              @click="openFullCopilot"
            >
              {{ t('astra.openCopilot') }}
            </button>
            <button
              type="button"
              class="rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
              @click="close"
            >
              {{ t('astra.dismissAction') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAstraAsk, type AstraProposal } from '@/astra/composables/useAstraAsk';

const { t } = useI18n();
const router = useRouter();
const { asking, confirming, error, askSync, confirmProposal } = useAstraAsk('command_palette');

const open = ref(false);
const draft = ref('');
const answer = ref('');
const proposals = ref<AstraProposal[]>([]);
const inputEl = ref<HTMLInputElement | null>(null);

function reset() {
  draft.value = '';
  answer.value = '';
  proposals.value = [];
  error.value = '';
}

async function openPalette() {
  open.value = true;
  await nextTick();
  inputEl.value?.focus();
}

function close() {
  open.value = false;
}

async function onSubmit() {
  const prompt = draft.value.trim();
  if (!prompt) return;
  answer.value = '';
  proposals.value = [];
  const result = await askSync(prompt);
  if (!result) return;
  answer.value = result.answer;
  proposals.value = result.proposals;
}

async function onConfirm(proposal: AstraProposal) {
  const result = await confirmProposal(proposal);
  if (result.ok) {
    proposals.value = proposals.value.filter((p) => p.id !== proposal.id);
  }
}

function openFullCopilot() {
  close();
  void router.push('/astra');
}

function handleKeydown(event: KeyboardEvent) {
  const isTrigger =
    (event.metaKey || event.ctrlKey) &&
    event.shiftKey &&
    String(event.key || '').toLowerCase() === 'k';
  if (isTrigger) {
    event.preventDefault();
    if (open.value) {
      close();
    } else {
      reset();
      void openPalette();
    }
    return;
  }
  if (event.key === 'Escape' && open.value) {
    close();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.astra-palette-fade-enter-active,
.astra-palette-fade-leave-active {
  transition: opacity 0.15s ease;
}

.astra-palette-fade-enter-from,
.astra-palette-fade-leave-to {
  opacity: 0;
}
</style>
