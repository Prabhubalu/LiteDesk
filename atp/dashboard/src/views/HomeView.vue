<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { atpApi } from '@/api/atpClient';

const loading = ref(true);
const error = ref('');
const overview = ref(null);
const goNoGo = ref(null);
const running = ref(false);

onMounted(async () => {
  try {
    const [ov, gate] = await Promise.all([
      atpApi.overview(),
      atpApi.goNoGo().catch(() => null),
    ]);
    overview.value = ov;
    goNoGo.value = gate;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

async function runSuite(suiteKey, dryRun = false) {
  running.value = true;
  error.value = '';
  try {
    const data = await atpApi.executeRun({
      suiteKey,
      envKey: 'local',
      dryRun,
      triggeredBy: 'dashboard',
    });
    if (data?.runId) {
      window.location.href = `/runs/${data.runId}`;
    } else {
      window.location.href = '/runs';
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    running.value = false;
  }
}

function runSmoke(dryRun = false) {
  return runSuite('smoke', dryRun);
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
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Quality Command Center</h1>
        <p class="text-slate-400 mt-1">Live catalog coverage, run history, and suite triggers.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm disabled:opacity-50"
          :disabled="running"
          @click="runSmoke(true)"
        >
          Dry-run Smoke
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSmoke(false)"
        >
          Smoke
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('platform-gates')"
        >
          Platform
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('sales-api-core')"
        >
          Sales API
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('org-api-core')"
        >
          Org API
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('ui-smoke')"
        >
          UI Smoke
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('ui-sales')"
        >
          UI Sales
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('e2e-critical')"
        >
          E2E Critical
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('public-smoke')"
        >
          Public
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('security')"
        >
          Security
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('api-breadth')"
        >
          API Breadth
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('load-smoke')"
        >
          Load Smoke
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('perf-api')"
        >
          Perf API
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium disabled:opacity-50"
          :disabled="running"
          @click="runSuite('full')"
        >
          Full Functional
        </button>
      </div>
    </div>

    <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
    <p v-if="loading" class="text-slate-400">Loading…</p>

    <section
      v-if="goNoGo"
      class="rounded-xl border p-5"
      :class="goNoGo.status === 'go' ? 'border-emerald-800 bg-emerald-950/30' : 'border-red-800 bg-red-950/30'"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold">Release Go / No-Go</h2>
          <p class="text-sm text-slate-400 mt-0.5">Smoke 100% · E2E ≥95% · perf-api ≥90% when ATP_GO_NOGO_PERF=1</p>
        </div>
        <span
          class="text-2xl font-bold uppercase"
          :class="goNoGo.status === 'go' ? 'text-emerald-400' : 'text-red-400'"
        >
          {{ goNoGo.status }}
        </span>
      </div>
      <ul class="mt-4 space-y-2 text-sm">
        <li v-for="c in goNoGo.checks" :key="c.suiteKey" class="flex justify-between gap-4">
          <span>{{ c.label }}</span>
          <span :class="c.status === 'pass' ? 'text-emerald-400' : 'text-red-400'">{{ c.message }}</span>
        </li>
      </ul>
    </section>

    <div v-if="overview" class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="rounded-xl border border-slate-800 bg-[#121826] p-5">
        <div class="text-xs uppercase tracking-wider text-slate-500">Catalog cases</div>
        <div class="text-3xl font-bold mt-2">{{ overview.catalog?.total ?? '—' }}</div>
      </div>
      <div class="rounded-xl border border-slate-800 bg-[#121826] p-5">
        <div class="text-xs uppercase tracking-wider text-slate-500">Automated</div>
        <div class="text-3xl font-bold mt-2 text-emerald-400">{{ overview.catalog?.automated ?? '—' }}</div>
        <div v-if="overview.catalog?.total" class="text-xs text-slate-500 mt-1">
          {{ Math.round((overview.catalog.automated / overview.catalog.total) * 100) }}% coverage
        </div>
      </div>
      <div class="rounded-xl border border-slate-800 bg-[#121826] p-5">
        <div class="text-xs uppercase tracking-wider text-slate-500">Recent runs</div>
        <div class="text-3xl font-bold mt-2">{{ overview.recentRuns ?? 0 }}</div>
      </div>
      <div class="rounded-xl border border-slate-800 bg-[#121826] p-5">
        <div class="text-xs uppercase tracking-wider text-slate-500">Pass rate (last 10)</div>
        <div class="text-3xl font-bold mt-2">{{ overview.passRate7d != null ? `${overview.passRate7d}%` : '—' }}</div>
      </div>
    </div>

    <section v-if="overview?.lastRuns?.length" class="rounded-xl border border-slate-800 bg-[#121826] overflow-hidden">
      <div class="px-5 py-3 border-b border-slate-800 font-medium">Latest runs</div>
      <table class="w-full text-sm">
        <thead class="text-slate-500 text-left">
          <tr>
            <th class="px-5 py-2">Suite</th>
            <th class="px-5 py-2">Status</th>
            <th class="px-5 py-2">Stats</th>
            <th class="px-5 py-2">When</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in overview.lastRuns" :key="run.runId" class="border-t border-slate-800/80 hover:bg-slate-800/30">
            <td class="px-5 py-3">
              <RouterLink :to="`/runs/${run.runId}`" class="text-indigo-400 hover:underline">{{ run.suiteName || run.suiteKey }}</RouterLink>
            </td>
            <td class="px-5 py-3">
              <span :class="statusClass(run.status)">{{ run.status }}</span>
            </td>
            <td class="px-5 py-3 text-slate-400">
              <span v-if="run.stats">{{ run.stats.passed }}/{{ run.stats.total }} passed</span>
            </td>
            <td class="px-5 py-3 text-slate-500">{{ formatDate(run.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
