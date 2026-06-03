<script setup>
import { ref, onMounted } from 'vue';
import { atpApi } from '@/api/atpClient';

const loading = ref(true);
const error = ref('');
const runs = ref([]);

onMounted(load);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await atpApi.runs(50);
    runs.value = data.runs || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function statusClass(status) {
  const base = 'px-2 py-0.5 rounded text-xs font-medium ';
  if (status === 'passed') return base + 'bg-emerald-500/20 text-emerald-400';
  if (status === 'failed') return base + 'bg-red-500/20 text-red-400';
  if (status === 'running') return base + 'bg-indigo-500/20 text-indigo-300';
  return base + 'bg-slate-700 text-slate-300';
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Test Runs</h1>
        <p class="text-slate-400 text-sm">History from control plane</p>
      </div>
      <button class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700" @click="load">Refresh</button>
    </div>

    <p v-if="error" class="text-red-400">{{ error }}</p>
    <p v-if="loading" class="text-slate-400">Loading…</p>

    <div class="rounded-xl border border-slate-800 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-[#121826] text-slate-500 text-left">
          <tr>
            <th class="px-4 py-3">Run ID</th>
            <th class="px-4 py-3">Suite</th>
            <th class="px-4 py-3">Env</th>
            <th class="px-4 py-3">Status</th>
            <th class="px-4 py-3">Results</th>
            <th class="px-4 py-3">Started</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!runs.length && !loading">
            <td colspan="6" class="px-4 py-8 text-center text-slate-500">No runs yet — trigger from Home or CLI</td>
          </tr>
          <tr
            v-for="run in runs"
            :key="run.runId"
            class="border-t border-slate-800/80 hover:bg-slate-900/50"
          >
            <td class="px-4 py-3 font-mono text-xs">
              <RouterLink :to="`/runs/${run.runId}`" class="text-indigo-400 hover:underline">{{ run.runId.slice(0, 8) }}</RouterLink>
            </td>
            <td class="px-4 py-3">{{ run.suiteName || run.suiteKey }}</td>
            <td class="px-4 py-3 text-slate-400">{{ run.envKey }}</td>
            <td class="px-4 py-3"><span :class="statusClass(run.status)">{{ run.status }}</span></td>
            <td class="px-4 py-3 text-slate-400">
              <span v-if="run.stats">{{ run.stats.passed }}✓ {{ run.stats.failed }}✗ {{ run.stats.skipped }}−</span>
            </td>
            <td class="px-4 py-3 text-slate-500">{{ formatDate(run.startedAt || run.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { RouterLink } from 'vue-router';
export default { components: { RouterLink } };
</script>
