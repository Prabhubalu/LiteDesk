<script setup>
import { ref, computed, onMounted } from 'vue';
import { atpApi } from '@/api/atpClient';
import CaseDocPanel from '@/components/CaseDocPanel.vue';

const loading = ref(true);
const error = ref('');
const catalog = ref(null);
const filter = ref('');
const layer = ref('all');
const expandedId = ref(null);

onMounted(async () => {
  try {
    catalog.value = await atpApi.catalog();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

const entries = computed(() => {
  if (!catalog.value?.entries) return [];
  return catalog.value.entries.filter((e) => {
    if (layer.value !== 'all' && e.layer !== layer.value) return false;
    if (!filter.value) return true;
    const q = filter.value.toLowerCase();
    const doc = e.documentation?.summary || '';
    return (
      e.id.toLowerCase().includes(q) ||
      (e.title || '').toLowerCase().includes(q) ||
      doc.toLowerCase().includes(q)
    );
  });
});

const layers = computed(() => {
  const counts = catalog.value?.stats?.byLayer || {};
  return Object.keys(counts).sort();
});

function toggle(entry) {
  expandedId.value = expandedId.value === entry.id ? null : entry.id;
}

function displaySummary(entry) {
  return entry.documentation?.summary || entry.title || entry.id;
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-2xl font-bold">Test Catalog</h1>
      <p class="text-slate-400 text-sm mt-1">
        Human-readable steps, request, expected behavior, and remediation per case
      </p>
    </div>

    <div class="flex flex-wrap gap-3">
      <input
        v-model="filter"
        type="search"
        placeholder="Search ID, title, or summary…"
        class="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
      />
      <select v-model="layer" class="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm">
        <option value="all">All layers</option>
        <option v-for="l in layers" :key="l" :value="l">{{ l }}</option>
      </select>
    </div>

    <p v-if="error" class="text-red-400">{{ error }}</p>
    <p v-if="loading" class="text-slate-400">Loading catalog…</p>

    <div v-if="catalog" class="text-sm text-slate-500">
      Showing {{ entries.length }} of {{ catalog.stats.total }} · {{ catalog.stats.automated }} automated
    </div>

    <div class="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="bg-[#121826]/50 hover:bg-slate-900/40"
      >
        <button
          type="button"
          class="w-full text-left px-4 py-3 flex flex-wrap items-start gap-3"
          @click="toggle(entry)"
        >
          <span class="text-slate-500 shrink-0 w-4">{{ expandedId === entry.id ? '▼' : '▶' }}</span>
          <span class="font-mono text-xs text-indigo-300 shrink-0">{{ entry.id }}</span>
          <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">{{ entry.layer }}</span>
          <span
            v-if="entry.automated"
            class="text-xs text-emerald-400 shrink-0"
          >automated</span>
          <span class="flex-1 min-w-0 text-sm text-slate-300">{{ displaySummary(entry) }}</span>
        </button>
        <div
          v-if="expandedId === entry.id"
          class="px-4 pb-4 pl-11 border-t border-slate-800/80"
        >
          <p v-if="entry.title && entry.title !== displaySummary(entry)" class="text-xs text-slate-500 mb-3">
            Catalog: {{ entry.title }}
          </p>
          <CaseDocPanel :doc="entry.documentation" />
          <p v-if="!entry.documentation" class="text-sm text-slate-500">
            No documentation — run <code class="text-indigo-300">npm run catalog:sync</code>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
