<script setup>
import { computed } from 'vue';

const props = defineProps({
  metrics: { type: Object, default: null },
  durationMs: { type: Number, default: null },
  status: { type: String, default: '' },
  /** Trace panel already lists per-request timing */
  hasTrace: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
});

const m = computed(() => props.metrics || {});

const isLoad = computed(() => m.value.kind === 'load');
const isPerf = computed(() => m.value.kind === 'perf');
const isApi = computed(() => m.value.kind === 'api');
const isUi = computed(() => m.value.kind === 'ui');
const requestRows = computed(() => m.value.requests || []);

const errorPct = computed(() => {
  if (m.value.errorRate == null) return null;
  return `${(m.value.errorRate * 100).toFixed(1)}%`;
});

function msClass(ms, warn = 800, bad = 2000) {
  if (ms == null) return 'text-slate-300';
  if (ms >= bad) return 'text-red-400';
  if (ms >= warn) return 'text-amber-400';
  return 'text-emerald-400';
}
</script>

<template>
  <div
    v-if="metrics"
    class="rounded-lg border border-indigo-500/20 bg-indigo-950/15 p-3"
    :class="compact ? '' : 'mt-2'"
  >
    <div v-if="!compact" class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <span class="text-[10px] font-semibold uppercase tracking-wide text-indigo-400">
        {{
          isLoad ? 'Load' : isPerf ? 'Perf' : isUi ? 'UI' : isApi ? 'API' : 'Metrics'
        }}
      </span>
    </div>

    <div v-if="!hasTrace && requestRows.length > 1" class="mb-3 overflow-x-auto">
      <table class="w-full text-xs text-left">
        <thead class="text-slate-500">
          <tr>
            <th class="py-1 pr-2">Step</th>
            <th class="py-1 pr-2">Path</th>
            <th class="py-1">ms</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in requestRows" :key="i" class="border-t border-slate-800/60">
            <td class="py-1 pr-2 text-slate-400">{{ row.action || row.method || i + 1 }}</td>
            <td class="py-1 pr-2 truncate max-w-[240px]">{{ row.path }}</td>
            <td class="py-1 tabular-nums" :class="msClass(row.latencyMs ?? row.ms)">
              {{ row.latencyMs ?? row.ms }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="!hasTrace && (isApi || isUi) && metrics.latencyMs != null && !metrics.p95Ms"
      class="mb-2 text-sm text-slate-400"
    >
      Last request <span class="font-bold tabular-nums text-white" :class="msClass(metrics.latencyMs)">{{ metrics.latencyMs }}ms</span>
    </div>

    <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
      <div v-if="isLoad && metrics.rps != null" class="rounded bg-slate-900/80 px-2 py-1.5 text-center">
        <div class="text-lg font-bold tabular-nums text-cyan-300">{{ metrics.rps.toFixed(1) }}</div>
        <div class="text-[10px] text-slate-500">RPS</div>
      </div>

      <div v-if="metrics.p95Ms != null" class="rounded bg-slate-900/80 px-2 py-1.5 text-center">
        <div class="text-lg font-bold tabular-nums" :class="msClass(metrics.p95Ms)">{{ metrics.p95Ms }}</div>
        <div class="text-[10px] text-slate-500">p95</div>
      </div>

      <div v-if="metrics.p99Ms != null" class="rounded bg-slate-900/80 px-2 py-1.5 text-center">
        <div class="text-lg font-bold tabular-nums" :class="msClass(metrics.p99Ms, 1200, 2500)">{{ metrics.p99Ms }}</div>
        <div class="text-[10px] text-slate-500">p99</div>
      </div>

      <div v-if="errorPct != null" class="rounded bg-slate-900/80 px-2 py-1.5 text-center">
        <div
          class="text-lg font-bold tabular-nums"
          :class="metrics.errorRate > 0.05 ? 'text-red-400' : 'text-emerald-400'"
        >
          {{ errorPct }}
        </div>
        <div class="text-[10px] text-slate-500">err</div>
      </div>

      <div v-if="isLoad && metrics.vus != null" class="rounded bg-slate-900/80 px-2 py-1.5 text-center">
        <div class="text-lg font-bold tabular-nums text-violet-300">{{ metrics.vus }}</div>
        <div class="text-[10px] text-slate-500">VUs</div>
      </div>
    </div>
  </div>
</template>
