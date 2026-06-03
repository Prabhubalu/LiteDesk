<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { atpApi, subscribeRunStream } from '@/api/atpClient';
import CaseDocPanel from '@/components/CaseDocPanel.vue';
import FailureFixGuide from '@/components/FailureFixGuide.vue';
import MetricsPanel from '@/components/MetricsPanel.vue';
import FlowTracePanel from '@/components/FlowTracePanel.vue';

function resultMetrics(result) {
  return result.metrics || result.error?.metrics || null;
}

const expandedCase = ref(null);
/** @type {import('vue').Ref<'all' | 'passed' | 'failed' | 'skipped' | 'pending'>} */
const statusFilter = ref('all');
const caseSearch = ref('');

const route = useRoute();
const loading = ref(true);
const error = ref('');
const run = ref(null);
let unsubscribe = null;
let pollTimer = null;

async function loadRun() {
  const data = await atpApi.run(route.params.runId);
  run.value = data.run;
}

onMounted(async () => {
  try {
    await loadRun();
    unsubscribe = subscribeRunStream(route.params.runId, async (msg) => {
      if (msg.type === 'run-update' && msg.run) {
        run.value = msg.run;
      }
    });
    pollTimer = setInterval(async () => {
      if (run.value?.status === 'running' || run.value?.status === 'queued') {
        try {
          await loadRun();
        } catch {
          /* ignore poll errors */
        }
      }
    }, 2000);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  unsubscribe?.();
  if (pollTimer) clearInterval(pollTimer);
});

function statusClass(status) {
  if (status === 'passed') return 'text-emerald-400';
  if (status === 'failed') return 'text-red-400';
  if (status === 'skipped') return 'text-amber-400';
  return 'text-slate-400';
}

function reportHref(template) {
  const key = import.meta.env.VITE_ATP_API_KEY || 'dev-atp-key-change-me';
  return `/atp/runs/${route.params.runId}/report?template=${template}&key=${encodeURIComponent(key)}`;
}

const resultCounts = computed(() => {
  const results = run.value?.results || [];
  return {
    all: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    pending: results.filter((r) => r.status === 'pending').length,
  };
});

const filteredResults = computed(() => {
  let list = run.value?.results || [];
  if (statusFilter.value !== 'all') {
    list = list.filter((r) => r.status === statusFilter.value);
  }
  const q = caseSearch.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (r) =>
        (r.caseId || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.documentation?.summary || '').toLowerCase().includes(q)
    );
  }
  return list;
});

function setStatusFilter(next) {
  if (next === 'all') {
    statusFilter.value = 'all';
    return;
  }
  statusFilter.value = statusFilter.value === next ? 'all' : next;
  if (next === 'failed' && statusFilter.value === 'failed') {
    const first = (run.value?.results || []).find((r) => r.status === 'failed');
    if (first?.caseId) expandedCase.value = first.caseId;
  }
}

function filterBtnClass(key) {
  const active = statusFilter.value === key;
  const base = 'rounded-lg p-3 text-center text-sm transition-colors cursor-pointer border';
  if (key === 'all') {
    return active
      ? `${base} bg-slate-800 border-indigo-500/60 ring-1 ring-indigo-500/40`
      : `${base} bg-slate-900 border-slate-800 hover:border-slate-600`;
  }
  if (key === 'passed') {
    return active
      ? `${base} bg-emerald-950/50 border-emerald-500/60 ring-1 ring-emerald-500/40`
      : `${base} bg-slate-900 border-slate-800 hover:border-emerald-900/60`;
  }
  if (key === 'failed') {
    return active
      ? `${base} bg-red-950/50 border-red-500/60 ring-1 ring-red-500/40`
      : `${base} bg-slate-900 border-slate-800 hover:border-red-900/60`;
  }
  if (key === 'skipped') {
    return active
      ? `${base} bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/40`
      : `${base} bg-slate-900 border-slate-800 hover:border-amber-900/60`;
  }
  return `${base} bg-slate-900 border-slate-800`;
}
</script>

<template>
  <div class="space-y-4">
    <RouterLink to="/runs" class="text-sm text-indigo-400 hover:underline">← Runs</RouterLink>

    <p v-if="error" class="text-red-400">{{ error }}</p>
    <p v-if="loading" class="text-slate-400">Loading run…</p>

    <template v-if="run">
      <div class="flex flex-wrap items-center gap-4">
        <h1 class="text-2xl font-bold">{{ run.suiteName || run.suiteKey }}</h1>
        <span class="px-2 py-1 rounded bg-slate-800 text-sm">{{ run.status }}</span>
        <span class="text-slate-500 text-sm font-mono">{{ run.runId }}</span>
        <a :href="reportHref('executive')" target="_blank" rel="noopener" class="text-sm text-indigo-400 hover:underline">Executive report</a>
        <a :href="reportHref('sprint')" target="_blank" rel="noopener" class="text-sm text-indigo-400 hover:underline">Sprint report</a>
      </div>

      <div
        v-if="run.stats"
        class="grid gap-3 text-center text-sm"
        :class="resultCounts.pending > 0 ? 'grid-cols-2 sm:grid-cols-5 max-w-3xl' : 'grid-cols-2 sm:grid-cols-4 max-w-2xl'"
      >
        <button type="button" :class="filterBtnClass('all')" @click="setStatusFilter('all')">
          <div class="text-2xl font-bold">{{ resultCounts.all }}</div>
          <div class="text-slate-500">All</div>
        </button>
        <button type="button" :class="filterBtnClass('passed')" @click="setStatusFilter('passed')">
          <div class="text-2xl font-bold text-emerald-400">{{ resultCounts.passed }}</div>
          <div class="text-slate-500">Passed</div>
        </button>
        <button type="button" :class="filterBtnClass('failed')" @click="setStatusFilter('failed')">
          <div class="text-2xl font-bold text-red-400">{{ resultCounts.failed }}</div>
          <div class="text-slate-500">Failed</div>
        </button>
        <button type="button" :class="filterBtnClass('skipped')" @click="setStatusFilter('skipped')">
          <div class="text-2xl font-bold text-amber-400">{{ resultCounts.skipped }}</div>
          <div class="text-slate-500">Skipped</div>
        </button>
        <button
          v-if="resultCounts.pending > 0"
          type="button"
          :class="filterBtnClass('pending')"
          @click="setStatusFilter('pending')"
        >
          <div class="text-2xl font-bold text-slate-300">{{ resultCounts.pending }}</div>
          <div class="text-slate-500">Pending</div>
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model="caseSearch"
          type="search"
          placeholder="Search case ID or summary…"
          class="flex-1 min-w-[200px] max-w-md px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm"
        />
        <span class="text-sm text-slate-500">
          Showing {{ filteredResults.length }} of {{ resultCounts.all }}
          <template v-if="statusFilter !== 'all'"> · {{ statusFilter }} only</template>
        </span>
        <button
          v-if="statusFilter !== 'all' || caseSearch"
          type="button"
          class="text-sm text-indigo-400 hover:underline"
          @click="statusFilter = 'all'; caseSearch = ''"
        >
          Clear filters
        </button>
      </div>

      <p v-if="filteredResults.length === 0" class="text-sm text-slate-500 py-6 text-center rounded-xl border border-slate-800">
        No cases match the current filter.
      </p>

      <div v-if="filteredResults.length" class="rounded-xl border border-slate-800 divide-y divide-slate-800 overflow-hidden">
        <div
          v-for="result in filteredResults"
          :key="result.caseId || result._id"
          class="px-4 py-3 bg-[#121826]/50"
          :class="result.status === 'failed' ? 'border-l-2 border-l-red-500/70' : ''"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <button
                type="button"
                class="text-left w-full"
                @click="expandedCase = expandedCase === result.caseId ? null : result.caseId"
              >
                <div class="font-mono text-xs text-indigo-300">
                  {{ expandedCase === result.caseId ? '▼' : '▶' }} {{ result.caseId }}
                </div>
                <div class="text-sm text-slate-300 mt-0.5">
                  {{ result.documentation?.summary || result.title }}
                </div>
              </button>
              <p
                v-if="result.status === 'failed' && expandedCase !== result.caseId && result.error?.message"
                class="mt-1 text-xs text-red-300/90 truncate"
              >
                {{ result.error.message }}
              </p>
            </div>
            <div class="text-right shrink-0 tabular-nums">
              <div :class="statusClass(result.status)" class="font-medium text-sm">{{ result.status }}</div>
              <div v-if="result.durationMs" class="text-sm text-slate-400">
                {{ (result.durationMs / 1000).toFixed(1) }}s
              </div>
            </div>
          </div>

          <div v-if="expandedCase === result.caseId" class="mt-3 space-y-2 border-t border-slate-800/80 pt-3">
            <FailureFixGuide v-if="result.status === 'failed'" :result="result" />

            <CaseDocPanel
              v-if="result.documentation"
              :doc="result.documentation"
              hide-failure
              hide-summary
            />

            <details v-if="result.trace?.steps?.length" open class="group">
              <summary class="text-xs text-slate-500 cursor-pointer hover:text-slate-300">
                Trace ({{ result.trace.steps.length }} steps)
              </summary>
              <FlowTracePanel class="mt-2" :trace="result.trace" />
            </details>

            <details v-if="resultMetrics(result)" class="group">
              <summary class="text-xs text-slate-500 cursor-pointer hover:text-slate-300">
                Metrics
              </summary>
              <MetricsPanel
                class="mt-2"
                :metrics="resultMetrics(result)"
                :has-trace="!!result.trace?.steps?.length"
                compact
              />
            </details>

            <details v-if="result.error?.message" class="group">
              <summary class="text-xs text-slate-500 cursor-pointer hover:text-slate-300">
                Raw error
              </summary>
              <pre
                class="mt-2 text-xs bg-red-950/40 border border-red-900/50 rounded p-3 overflow-x-auto text-red-200"
              >{{ result.error.message }}
{{ result.error.response ? JSON.stringify(result.error.response, null, 2) : '' }}</pre>
            </details>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
