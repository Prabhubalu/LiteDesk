<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <TelephonyNav />
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('telephony.ivrBuilderTitle') }}{{ flow?.name ? `: ${flow.name}` : '' }}
        </h1>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
            @click="addNode"
          >
            {{ t('telephony.ivrBuilderAddNode') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            :disabled="saving"
            @click="onSave"
          >
            {{ t('telephony.ivrBuilderSave') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            @click="onPublish"
          >
            {{ t('telephony.ivrPublish') }}
          </button>
        </div>
      </div>

      <p v-if="loading" class="mt-4 text-sm text-gray-500">{{ t('states.loading') }}</p>
      <p v-else-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
      <p v-if="message" class="mt-2 text-sm text-emerald-600">{{ message }}</p>

      <div v-if="flow" class="mt-4 grid gap-4 lg:grid-cols-2">
        <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 class="text-sm font-semibold">{{ t('telephony.ivrBuilderNodes') }}</h2>
          <div class="mt-3 space-y-3">
            <div
              v-for="(node, idx) in nodes"
              :key="node.id || idx"
              class="rounded-lg border border-gray-100 p-3 dark:border-gray-800"
            >
              <div class="flex gap-2">
                <input
                  v-model="node.id"
                  class="w-24 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
                  placeholder="id"
                />
                <select
                  v-model="node.type"
                  class="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
                >
                  <option v-for="opt in nodeTypes" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <button type="button" class="text-xs text-red-600" @click="nodes.splice(idx, 1)">×</button>
              </div>
              <input
                v-model="node.label"
                class="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                placeholder="label"
              />
              <textarea
                v-model="node.prompt"
                rows="2"
                class="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                placeholder="prompt / TTS"
              />
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 class="text-sm font-semibold">{{ t('telephony.ivrBuilderEdges') }}</h2>
          <p class="mt-1 text-xs text-gray-500">{{ t('telephony.ivrBuilderEdgesHint') }}</p>
          <textarea
            v-model="edgesJson"
            rows="16"
            class="mt-3 w-full rounded-lg border border-gray-300 px-2 py-1.5 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import TelephonyNav from '@/components/telephony/TelephonyNav.vue';
import { getIvrFlow, publishIvrFlow, updateIvrFlow } from '@/utils/telephonyApi';

const { t } = useI18n();
const route = useRoute();

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const message = ref('');
const flow = ref(null);
const nodes = ref([]);
const edgesJson = ref('[]');

const nodeTypes = computed(() => [
  { value: 'greeting', label: t('telephony.ivrNodeGreeting') },
  { value: 'menu', label: t('telephony.ivrNodeMenu') },
  { value: 'queue', label: t('telephony.ivrNodeQueue') },
  { value: 'agent', label: t('telephony.ivrNodeAgent') },
  { value: 'voicemail', label: t('telephony.ivrNodeVoicemail') },
  { value: 'disconnect', label: t('telephony.ivrNodeDisconnect') },
]);

function addNode() {
  const id = `node_${nodes.value.length + 1}`;
  nodes.value.push({ id, type: 'menu', label: 'Menu', prompt: '' });
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await getIvrFlow(route.params.flowId);
    flow.value = res?.data || null;
    nodes.value = Array.isArray(flow.value?.nodes)
      ? flow.value.nodes.map((n) => ({ ...n }))
      : [];
    edgesJson.value = JSON.stringify(flow.value?.edges || [], null, 2);
  } catch {
    error.value = t('telephony.ivrLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  message.value = '';
  error.value = '';
  try {
    let edges = [];
    try {
      edges = JSON.parse(edgesJson.value || '[]');
    } catch {
      error.value = t('telephony.ivrBuilderSaveFailed');
      return;
    }
    await updateIvrFlow(route.params.flowId, {
      name: flow.value?.name,
      nodes: nodes.value,
      edges,
    });
    message.value = t('telephony.ivrBuilderSaved');
  } catch {
    error.value = t('telephony.ivrBuilderSaveFailed');
  } finally {
    saving.value = false;
  }
}

async function onPublish() {
  try {
    await onSave();
    await publishIvrFlow(route.params.flowId);
    message.value = t('telephony.ivrPublished');
    await load();
  } catch {
    error.value = t('telephony.ivrPublishFailed');
  }
}

onMounted(load);
</script>
