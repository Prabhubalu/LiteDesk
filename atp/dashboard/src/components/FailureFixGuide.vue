<script setup>
import { computed } from 'vue';

const props = defineProps({
  result: { type: Object, required: true },
});

const err = computed(() => props.result.error || {});
const doc = computed(() => props.result.documentation || {});
const onFailure = computed(() => doc.value.onFailure || {});

const actualStatus = computed(() => {
  const body = err.value.response;
  if (body && typeof body.status === 'number') return body.status;
  const m = (err.value.message || '').match(/got (\d{3})/i);
  return m ? Number(m[1]) : null;
});

const expectedStatus = computed(() => {
  const s = doc.value.expected?.status;
  if (s == null) return null;
  if (Array.isArray(s)) return s.join(', ');
  return String(s);
});

const fixSteps = computed(() => {
  const seen = new Set();
  const add = (text) => {
    const t = String(text || '').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  const out = [];

  if (expectedStatus.value && actualStatus.value != null) {
    add(`HTTP ${actualStatus.value} — expected ${expectedStatus.value}`);
  }
  for (const item of onFailure.value.whatToFix || []) add(item);
  for (const item of onFailure.value.likelyCauses || []) add(item);
  if (!onFailure.value.whatToFix?.length && doc.value.expected?.behavior) {
    add(doc.value.expected.behavior);
  }
  for (const item of onFailure.value.howToFix || onFailure.value.remediation || []) add(item);
  if (!onFailure.value.howToFix?.length && !onFailure.value.remediation?.length) {
    for (const item of inferRemediation(actualStatus.value, doc.value)) add(item);
  }
  if (!out.length && err.value.message) add(err.value.message);
  return out;
});

function inferRemediation(status, documentation) {
  const msg = err.value.message || '';
  const steps = [];
  if (status === 401 || msg.includes('401')) {
    steps.push('Set owner credentials in atp/fixtures/personas.json or ATP_PERSONA_OWNER_*.');
  }
  if (status === 403 || msg.includes('403')) {
    steps.push('Check role, app entitlements, and RBAC for this route.');
  }
  if (status === 404 || msg.includes('404')) {
    steps.push('Confirm API path in catalog matches the server route; seed data for placeholders.');
  }
  if (status === 429) steps.push('Retry after rate limit or use a non-throttled env.');
  if ((status != null && status >= 500) || msg.includes('503')) {
    steps.push('Check SUT logs and GET /health/ready (Mongo, Redis, workers).');
  }
  if (props.result.layer === 'ui') {
    steps.push('Start client on ATP_SUT_CLIENT_URL; run npm run playwright:install in atp/.');
  }
  if (!steps.length) {
    steps.push('Verify SUT at ATP_SUT_API_URL and re-run this case.');
  }
  return steps;
}
</script>

<template>
  <div class="mt-2 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2.5">
    <p class="text-sm text-red-200 font-mono break-words">{{ err.message || 'Test failed' }}</p>
    <ol v-if="fixSteps.length" class="mt-2 text-sm text-slate-300 space-y-1 list-decimal list-inside">
      <li v-for="(step, i) in fixSteps" :key="i">{{ step }}</li>
    </ol>
  </div>
</template>
