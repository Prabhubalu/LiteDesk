<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { CANVAS_TYPES, type CanvasMeta } from '@/astraStudio/types';
import { createCanvas, getStatus, listCanvases } from '@/astraStudio/api/studioApi';

const { t } = useI18n();
const router = useRouter();

const loading = ref(true);
const creating = ref(false);
const canvases = ref<CanvasMeta[]>([]);
const prompt = ref('');
const canvasType = ref<string>('blank');
const templates = ref<Array<{ key: string; labelKey?: string; canvasType?: string; label?: string }>>([]);
const error = ref('');

const TYPE_LABEL_KEYS: Record<string, string> = {
  meeting_preparation: 'astraStudio.typeMeetingPrep',
  executive_report: 'astraStudio.typeExecutiveReport',
  customer_360: 'astraStudio.typeCustomer360',
  opportunity_war_room: 'astraStudio.typeWarRoom',
  account_planning: 'astraStudio.typeAccountPlan',
  quarterly_business_review: 'astraStudio.typeQbr',
  customer_success_plan: 'astraStudio.typeCsPlan',
  renewal_workspace: 'astraStudio.typeRenewal',
  support_investigation: 'astraStudio.typeSupport',
  project_workspace: 'astraStudio.typeProject',
  workflow_design: 'astraStudio.typeWorkflow',
  brainstorming: 'astraStudio.typeBrainstorm',
  strategy_workspace: 'astraStudio.typeStrategy',
  blank: 'astraStudio.typeBlank',
};

function typeLabel(ct: string): string {
  const key = TYPE_LABEL_KEYS[ct];
  return key ? t(key) : ct;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const status = await getStatus();
    templates.value = (status.templates || []).map((row) => ({
      key: row.canvasType,
      canvasType: row.canvasType,
      label: row.label,
      labelKey: undefined,
    }));
    const list = await listCanvases({ limit: 50 });
    canvases.value = list.items || [];
  } catch (err: unknown) {
    const e = err as { message?: string };
    error.value = e?.message || t('astraStudio.loadFailed');
  } finally {
    loading.value = false;
  }
}

async function onCreate(): Promise<void> {
  if (creating.value) return;
  creating.value = true;
  error.value = '';
  try {
    const { canvas } = await createCanvas({
      title: prompt.value.trim() || t('astraStudio.untitledCanvas'),
      canvasType: canvasType.value,
      generate: Boolean(prompt.value.trim()) || canvasType.value !== 'blank',
      prompt: prompt.value.trim() || undefined,
    });
    await router.push({ name: 'astra-studio-editor', params: { canvasId: canvas._id } });
  } catch (err: unknown) {
    const e = err as { message?: string };
    error.value = e?.message || t('astraStudio.createFailed');
  } finally {
    creating.value = false;
  }
}

function openCanvas(id: string): void {
  void router.push({ name: 'astra-studio-editor', params: { canvasId: id } });
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="mx-auto flex h-full max-w-4xl flex-col gap-6 overflow-y-auto p-6">
    <header>
      <h1 class="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        {{ t('astraStudio.listTitle') }}
      </h1>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{{ t('astraStudio.listSubtitle') }}</p>
    </header>

    <section class="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <h2 class="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{{ t('astraStudio.createHeading') }}</h2>
      <textarea
        v-model="prompt"
        class="mt-3 w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-white/10 dark:bg-neutral-950"
        rows="3"
        :placeholder="t('astraStudio.createPromptPlaceholder')"
      />
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <label class="text-sm text-neutral-600 dark:text-neutral-400">
          {{ t('astraStudio.templateLabel') }}
          <select
            v-model="canvasType"
            class="ml-2 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-neutral-950"
          >
            <option v-for="ct in CANVAS_TYPES" :key="ct" :value="ct">
              {{ typeLabel(ct) }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="creating"
          @click="onCreate"
        >
          {{ creating ? t('astraStudio.creating') : t('astraStudio.createCanvas') }}
        </button>
      </div>
      <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
    </section>

    <section>
      <h2 class="mb-3 text-sm font-semibold text-neutral-800 dark:text-neutral-100">{{ t('astraStudio.recentCanvases') }}</h2>
      <p v-if="loading" class="text-sm text-neutral-500">{{ t('astraStudio.loading') }}</p>
      <ul v-else class="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-neutral-900">
        <li v-if="!canvases.length" class="p-4 text-sm text-neutral-500">{{ t('astraStudio.noCanvases') }}</li>
        <li
          v-for="c in canvases"
          :key="c._id"
          class="flex cursor-pointer items-center justify-between gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-white/5"
          @click="openCanvas(c._id)"
        >
          <div>
            <p class="font-medium text-neutral-900 dark:text-neutral-100">{{ c.title }}</p>
            <p class="text-xs text-neutral-500">{{ typeLabel(c.canvasType) }} · {{ c.status }}</p>
          </div>
          <span class="text-xs text-indigo-600 dark:text-indigo-400">{{ t('astraStudio.open') }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
