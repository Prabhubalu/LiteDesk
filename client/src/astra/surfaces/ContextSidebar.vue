<template>
  <aside class="astra-context-sidebar flex h-full min-h-0 w-full flex-col bg-white dark:bg-neutral-900">
    <header class="shrink-0 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
      <h2 class="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
        {{ t('astra.sidebarHeading') }}
      </h2>
    </header>

    <div class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <section>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('astra.nbaHeading') }}
        </p>

        <div v-if="loading" class="mt-3 text-xs text-gray-400 dark:text-gray-500">
          {{ t('astra.thinking') }}
        </div>

        <ul v-else-if="items.length" class="mt-3 space-y-2">
          <li v-for="item in items" :key="item.id">
            <button
              type="button"
              class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-left transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-800"
              :disabled="confirming"
              @click="onRun(item)"
            >
              <span class="block text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.label }}</span>
              <span v-if="item.rationale" class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                {{ item.rationale }}
              </span>
            </button>
          </li>
        </ul>

        <p v-else class="mt-3 text-xs text-gray-400 dark:text-gray-500">
          {{ t('astra.emptyFirstTime') }}
        </p>
      </section>

      <p v-if="error" class="mt-3 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAstraAsk, type AstraNbaItem } from '@/astra/composables/useAstraAsk';

const props = defineProps<{
  moduleKey?: string;
  recordId?: string;
}>();

const { t } = useI18n();
const { confirming, error, fetchNba, confirmProposal } = useAstraAsk('context_sidebar');

const items = ref<AstraNbaItem[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  items.value = await fetchNba({ moduleKey: props.moduleKey, recordId: props.recordId });
  loading.value = false;
}

async function onRun(item: AstraNbaItem) {
  const result = await confirmProposal({
    id: item.id,
    kind: item.kind,
    label: item.label,
    moduleKey: item.moduleKey,
    recordId: item.recordId,
  });
  if (result.ok) {
    items.value = items.value.filter((i) => i.id !== item.id);
  }
}

onMounted(load);
watch(() => [props.moduleKey, props.recordId], load);
</script>
