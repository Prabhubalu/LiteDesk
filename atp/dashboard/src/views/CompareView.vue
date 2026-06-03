<script setup>
import { ref } from 'vue';
import { atpApi } from '@/api/atpClient';

const runA = ref('');
const runB = ref('');
const loading = ref(false);
const error = ref('');
const diff = ref(null);

async function compare() {
  loading.value = true;
  error.value = '';
  diff.value = null;
  try {
    const data = await atpApi.compareRuns(runA.value.trim(), runB.value.trim());
    diff.value = data.diff;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function reportUrl(id, template) {
  const key = import.meta.env.VITE_ATP_API_KEY || 'dev-atp-key-change-me';
  return `/atp/runs/${id}/report?template=${template}&key=${encodeURIComponent(key)}`;
}

function compareHtmlUrl() {
  const key = import.meta.env.VITE_ATP_API_KEY || 'dev-atp-key-change-me';
  return `/atp/runs/compare?runA=${encodeURIComponent(runA.value)}&runB=${encodeURIComponent(runB.value)}&format=html&key=${encodeURIComponent(key)}`;
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Compare runs</h1>
      <p class="text-slate-400 mt-1 text-sm">Diff case status across environments or consecutive runs</p>
    </div>

    <div class="flex flex-wrap gap-3 items-end">
      <label class="text-sm">
        <span class="text-slate-500 block mb-1">Run A</span>
        <input v-model="runA" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 font-mono text-sm w-72" placeholder="run UUID" />
      </label>
      <label class="text-sm">
        <span class="text-slate-500 block mb-1">Run B</span>
        <input v-model="runB" class="bg-slate-900 border border-slate-700 rounded px-3 py-2 font-mono text-sm w-72" placeholder="run UUID" />
      </label>
      <button
        class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm disabled:opacity-50"
        :disabled="loading || !runA || !runB"
        @click="compare"
      >
        Compare
      </button>
      <a
        v-if="runA && runB"
        :href="compareHtmlUrl()"
        target="_blank"
        rel="noopener"
        class="px-4 py-2 rounded-lg bg-slate-800 text-sm"
      >
        HTML report
      </a>
    </div>

    <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>

    <div v-if="diff" class="rounded-xl border border-slate-800 bg-[#121826] p-5 space-y-4">
      <div class="flex flex-wrap gap-6 text-sm">
        <div>
          <div class="text-slate-500">Run A</div>
          <div>{{ diff.runA.envKey }} · {{ diff.runA.status }} · {{ diff.runA.stats?.passed }}/{{ diff.runA.stats?.total }}</div>
        </div>
        <div>
          <div class="text-slate-500">Run B</div>
          <div>{{ diff.runB.envKey }} · {{ diff.runB.status }} · {{ diff.runB.stats?.passed }}/{{ diff.runB.stats?.total }}</div>
        </div>
        <div>
          <div class="text-slate-500">Changed</div>
          <div>{{ diff.summary.changed }} / {{ diff.summary.totalCases }} cases</div>
        </div>
      </div>
      <table v-if="diff.changes.length" class="w-full text-sm">
        <thead class="text-slate-500 text-left">
          <tr>
            <th class="py-2">Case</th>
            <th class="py-2">A</th>
            <th class="py-2">B</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in diff.changes" :key="c.caseId" class="border-t border-slate-800/80">
            <td class="py-2 font-mono text-xs">{{ c.caseId }}</td>
            <td class="py-2">{{ c.statusA || '—' }}</td>
            <td class="py-2">{{ c.statusB || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="text-slate-400 text-sm">No status changes between runs.</p>
    </div>
  </div>
</template>
