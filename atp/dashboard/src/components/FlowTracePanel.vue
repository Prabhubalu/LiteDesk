<script setup>
import { computed } from 'vue';

const props = defineProps({
  trace: { type: Object, default: null },
});

const steps = computed(() => props.trace?.steps || []);

function statusClass(status) {
  if (status === 'cached') return 'text-violet-400';
  const n = Number(status);
  if (!n) return 'text-slate-500';
  if (n >= 400) return 'text-red-400';
  return 'text-emerald-400';
}

const kindClass = {
  api: 'text-cyan-400',
  ui: 'text-emerald-400',
  auth: 'text-violet-400',
  perf: 'text-indigo-400',
  load: 'text-orange-400',
  setup: 'text-amber-400',
  case: 'text-slate-500',
};
</script>

<template>
  <div v-if="trace && steps.length" class="text-xs">
    <div class="overflow-x-auto rounded-lg border border-slate-800">
      <table class="w-full text-left">
        <thead class="text-slate-500 bg-slate-900/80">
          <tr>
            <th class="px-2 py-1.5 w-8">#</th>
            <th class="px-2 py-1.5 w-12">ms</th>
            <th class="px-2 py-1.5 w-14">type</th>
            <th class="px-2 py-1.5">step</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="s in steps"
            :key="s.step"
            class="border-t border-slate-800/80"
          >
            <td class="px-2 py-1 text-slate-600 tabular-nums">{{ s.step }}</td>
            <td class="px-2 py-1 tabular-nums text-white">{{ s.durationMs }}</td>
            <td class="px-2 py-1 uppercase" :class="kindClass[s.kind] || 'text-slate-400'">{{ s.kind }}</td>
            <td class="px-2 py-1 text-slate-300">
              {{ s.label }}
              <span v-if="s.path" class="block text-slate-500 font-mono truncate max-w-lg">
                {{ s.method ? `${s.method} ` : '' }}{{ s.path }}
                <span v-if="s.status != null" :class="statusClass(s.status)"> · {{ s.status }}</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-slate-600 mt-1 tabular-nums">
      {{ steps.length }} steps · {{ (trace.totalMs / 1000).toFixed(2) }}s wall
    </p>
  </div>
</template>
