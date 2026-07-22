<template>
  <section class="astra-record-panel rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <header class="flex items-center justify-between gap-2 px-4 py-2.5">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('astra.recordSummary') }}
      </h3>
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs font-medium text-primary-700 transition hover:bg-primary-50 disabled:opacity-50 dark:text-primary-300 dark:hover:bg-primary-500/10"
        :disabled="asking"
        @click="onAsk(defaultPrompt)"
      >
        {{ asking ? t('astra.thinking') : t('astra.openCopilot') }}
      </button>
    </header>

    <div v-if="answer || proposals.length || error" class="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
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
          class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50"
        >
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ proposal.label }}</p>
          <p v-if="proposal.rationale" class="mt-0.5 whitespace-pre-line text-xs text-gray-500 dark:text-gray-400">
            {{ proposal.rationale }}
          </p>
          <dl
            v-if="proposal.status !== 'completed' && proposal.details?.length"
            class="mt-2 space-y-1 border-t border-gray-200 pt-2 dark:border-gray-700"
          >
            <div
              v-for="(row, dIdx) in proposal.details"
              :key="`${proposal.id}-d-${dIdx}`"
              class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 text-xs"
            >
              <dt class="text-gray-400">{{ row.label }}</dt>
              <dd class="truncate text-gray-700 dark:text-gray-200" :title="row.value">{{ row.value }}</dd>
            </div>
          </dl>
          <div class="mt-2 flex items-center gap-2">
            <template v-if="proposal.status === 'completed'">
              <button
                v-if="proposal.href"
                type="button"
                class="rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-primary-700"
                @click="onNavigate(proposal.href)"
              >
                {{ proposal.navigateLabel || t('astra.viewRecord') }}
              </button>
              <span class="text-xs text-emerald-600 dark:text-emerald-400">{{ t('astra.actionCompleted') }}</span>
            </template>
            <template v-else>
              <button
                type="button"
                class="rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                :disabled="confirming"
                @click="onConfirm(proposal)"
              >
                {{ t('astra.confirmAction') }}
              </button>
              <button
                type="button"
                class="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                @click="onDismiss(proposal)"
              >
                {{ t('astra.dismissAction') }}
              </button>
            </template>
          </div>
        </div>
      </div>

      <p v-if="error" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAstraAsk, type AstraProposal } from '@/astra/composables/useAstraAsk';
import { captureAstraActionRejected } from '@/config/posthogAi';

const props = defineProps<{
  moduleKey: string;
  recordId: string;
  sourceType?: string;
}>();

const { t } = useI18n();
const router = useRouter();
const { asking, confirming, error, askSync, confirmProposal } = useAstraAsk('record_panel');

const answer = ref('');
const proposals = ref<AstraProposal[]>([]);

const defaultPrompt = computed(() => t('astra.recordSummary'));

async function onAsk(prompt: string) {
  const result = await askSync(prompt, { moduleKey: props.moduleKey, recordId: props.recordId });
  if (!result) return;
  answer.value = result.answer;
  proposals.value = result.proposals;
}

async function onConfirm(proposal: AstraProposal) {
  const result = await confirmProposal(proposal);
  if (!result.ok) return;
  proposals.value = proposals.value.map((p) => {
    if (p.id !== proposal.id) return p;
    return {
      ...p,
      status: 'completed',
      href: result.href || p.href,
      recordId: result.recordId || p.recordId,
      navigateLabel: result.navigateLabel || p.navigateLabel,
      rationale: result.message || p.rationale,
    };
  });
  if (result.message) answer.value = result.message;
}

function onNavigate(href?: string) {
  const path = String(href || '').trim();
  if (!path) return;
  void router.push(path);
}

function onDismiss(proposal: AstraProposal) {
  proposals.value = proposals.value.filter((p) => p.id !== proposal.id);
  captureAstraActionRejected({ surface: 'record_panel', actionKind: proposal.kind, actionId: proposal.id });
}
</script>
