<script setup>
defineProps({
  doc: { type: Object, default: null },
  /** Hide onFailure — shown only in FailureFixGuide on run detail */
  hideFailure: { type: Boolean, default: false },
  /** Hide summary — already in case row title */
  hideSummary: { type: Boolean, default: false },
});

function formatStatus(expected) {
  if (expected == null) return '—';
  if (Array.isArray(expected)) return expected.join(' or ');
  return String(expected);
}
</script>

<template>
  <div v-if="doc" class="text-sm space-y-3 mt-2">
    <p v-if="!hideSummary && doc.summary" class="text-slate-300">{{ doc.summary }}</p>

    <div v-if="doc.request || doc.expected" class="grid gap-3 sm:grid-cols-2 text-xs">
      <div v-if="doc.request" class="rounded-lg bg-slate-900/60 border border-slate-800 p-3">
        <div class="text-slate-500 uppercase tracking-wide text-[10px] mb-1.5">Request</div>
        <div class="font-mono text-slate-300">
          <span class="text-indigo-400">{{ doc.request.method }}</span>
          {{ doc.request.path }}
        </div>
        <div v-if="doc.request.auth" class="text-slate-500 mt-1">{{ doc.request.auth }}</div>
      </div>
      <div v-if="doc.expected" class="rounded-lg bg-slate-900/60 border border-slate-800 p-3">
        <div class="text-slate-500 uppercase tracking-wide text-[10px] mb-1.5">Expected</div>
        <div class="text-slate-300">
          Status <span class="font-mono">{{ formatStatus(doc.expected.status) }}</span>
        </div>
        <div v-if="doc.expected.behavior" class="text-slate-500 mt-1">{{ doc.expected.behavior }}</div>
      </div>
    </div>

    <details v-if="doc.howToRun?.length" class="text-xs">
      <summary class="text-slate-500 cursor-pointer hover:text-slate-300">How this case runs</summary>
      <ol class="mt-2 list-decimal list-inside text-slate-400 space-y-0.5 pl-1">
        <li v-for="(step, i) in doc.howToRun" :key="i">{{ step }}</li>
      </ol>
    </details>

    <details v-if="!hideFailure && doc.onFailure" class="text-xs">
      <summary class="text-amber-500/80 cursor-pointer hover:text-amber-400">If it fails</summary>
      <ol class="mt-2 list-decimal list-inside text-slate-400 space-y-0.5 pl-1">
        <li v-for="(item, i) in (doc.onFailure.howToFix || doc.onFailure.remediation || doc.onFailure.whatToFix || [])" :key="i">
          {{ item }}
        </li>
      </ol>
    </details>
  </div>
</template>
