<template>
  <main class="mx-auto max-w-6xl space-y-5 px-4 py-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <button type="button" class="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white" @click="router.back()">
          Back
        </button>
        <h1 class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">Quote revision compare</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ compare?.quoteNumber || 'Quote' }}
        </p>
      </div>
      <RouterLink
        v-if="quoteId"
        :to="{ name: 'quote-detail', params: { id: quoteId } }"
        class="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        Open quote
      </RouterLink>
    </div>

    <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label class="block">
          <span class="text-xs text-gray-500 dark:text-gray-400">From revision</span>
          <input v-model="filters.fromRevision" type="number" min="1" class="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </label>
        <label class="block">
          <span class="text-xs text-gray-500 dark:text-gray-400">To revision</span>
          <input v-model="filters.toRevision" type="number" min="1" class="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </label>
        <label class="block">
          <span class="text-xs text-gray-500 dark:text-gray-400">Impact area</span>
          <select v-model="filters.impactArea" class="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">All</option>
            <option v-for="area in impactAreas" :key="area" :value="area">{{ area }}</option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs text-gray-500 dark:text-gray-400">Change</span>
          <select v-model="filters.changeType" class="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">All</option>
            <option value="added">Added</option>
            <option value="removed">Removed</option>
            <option value="changed">Changed</option>
          </select>
        </label>
        <label class="block">
          <span class="text-xs text-gray-500 dark:text-gray-400">Customer visible</span>
          <select v-model="filters.customerVisible" class="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
        <div class="flex items-end">
          <button type="button" class="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700" @click="loadCompare">
            Apply
          </button>
        </div>
      </div>
    </section>

    <div v-if="loading" class="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
      Loading compare...
    </div>
    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-200">
      {{ error }}
    </div>
    <template v-else>
      <QuoteRevisionComparePanel :compare="compare" show-diffs />
      <QuoteApprovalHistory :rows="compare?.approvalHistory || []" />
    </template>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import QuoteRevisionComparePanel from '@/components/quotes/QuoteRevisionComparePanel.vue';
import QuoteApprovalHistory from '@/components/quotes/QuoteApprovalHistory.vue';

const route = useRoute();
const router = useRouter();
const quoteId = computed(() => String(route.params.id || ''));
const compare = ref(null);
const loading = ref(false);
const error = ref('');
const filters = reactive({
  fromRevision: route.query.fromRevision || '',
  toRevision: route.query.toRevision || '',
  impactArea: route.query.impactArea || '',
  changeType: route.query.changeType || '',
  customerVisible: route.query.customerVisible || ''
});

const impactAreas = computed(() => compare.value?.filters?.available?.includes('impactArea')
  ? ['pricing', 'discount', 'scope', 'terms', 'timing', 'customer', 'approval', 'structure', 'metadata']
  : []);

function buildParams() {
  const params = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value != null) params[key] = value;
  }
  return params;
}

async function loadCompare() {
  if (!quoteId.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get(`/quotes/${quoteId.value}/revisions/compare`, { params: buildParams() });
    if (!res?.success) {
      error.value = res?.message || 'Failed to load compare';
      compare.value = null;
      return;
    }
    compare.value = res.data;
  } catch (err) {
    error.value = err?.message || 'Failed to load compare';
    compare.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(loadCompare);
</script>
