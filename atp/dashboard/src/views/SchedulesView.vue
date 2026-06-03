<script setup>
import { ref, onMounted } from 'vue';
import { atpApi } from '@/api/atpClient';

const loading = ref(true);
const error = ref('');
const schedules = ref([]);
const suites = ref({});
const saving = ref(false);

const form = ref({
  name: 'Nightly smoke',
  suiteKey: 'nightly',
  envKey: 'local',
  cronExpression: '0 2 * * *',
  enabled: true,
  slackWebhookUrl: '',
});

onMounted(async () => {
  try {
    const [s, sch] = await Promise.all([atpApi.suites(), atpApi.schedules()]);
    suites.value = s;
    schedules.value = sch.schedules || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

async function createSchedule() {
  saving.value = true;
  error.value = '';
  try {
    await atpApi.createSchedule({ ...form.value });
    schedules.value = (await atpApi.schedules()).schedules || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function toggleSchedule(sch) {
  await atpApi.updateSchedule(sch.scheduleId, { enabled: !sch.enabled });
  schedules.value = (await atpApi.schedules()).schedules || [];
}

async function removeSchedule(id) {
  if (!confirm('Delete this schedule?')) return;
  await atpApi.deleteSchedule(id);
  schedules.value = (await atpApi.schedules()).schedules || [];
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Schedules</h1>
      <p class="text-slate-400 mt-1 text-sm">Cron-triggered suite runs · Slack alert on failure</p>
    </div>

    <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
    <p v-if="loading" class="text-slate-400">Loading…</p>

    <section class="rounded-xl border border-slate-800 bg-[#121826] p-5 max-w-xl space-y-3">
      <h2 class="font-medium">New schedule</h2>
      <input v-model="form.name" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm" placeholder="Name" />
      <select v-model="form.suiteKey" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm">
        <option v-for="(suite, key) in suites" :key="key" :value="key">{{ suite.name }} ({{ key }})</option>
      </select>
      <input v-model="form.envKey" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm" placeholder="envKey (local, uat, ci)" />
      <input v-model="form.cronExpression" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm font-mono" placeholder="Cron (UTC) e.g. 0 2 * * *" />
      <input v-model="form.slackWebhookUrl" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm" placeholder="Slack webhook URL (optional)" />
      <button
        class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm disabled:opacity-50"
        :disabled="saving"
        @click="createSchedule"
      >
        Create
      </button>
    </section>

    <section v-if="schedules.length" class="rounded-xl border border-slate-800 bg-[#121826] overflow-hidden">
      <table class="w-full text-sm">
        <thead class="text-slate-500 text-left border-b border-slate-800">
          <tr>
            <th class="px-5 py-2">Name</th>
            <th class="px-5 py-2">Suite</th>
            <th class="px-5 py-2">Cron</th>
            <th class="px-5 py-2">Last</th>
            <th class="px-5 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in schedules" :key="s.scheduleId" class="border-t border-slate-800/80">
            <td class="px-5 py-3">{{ s.name }}</td>
            <td class="px-5 py-3 text-slate-400">{{ s.suiteKey }} · {{ s.envKey }}</td>
            <td class="px-5 py-3 font-mono text-xs">{{ s.cronExpression }}</td>
            <td class="px-5 py-3">
              <span v-if="s.lastStatus" :class="s.lastStatus === 'passed' ? 'text-emerald-400' : 'text-red-400'">{{ s.lastStatus }}</span>
              <span v-else class="text-slate-500">—</span>
            </td>
            <td class="px-5 py-3 text-right space-x-2">
              <button class="text-xs text-indigo-400" @click="toggleSchedule(s)">{{ s.enabled ? 'Pause' : 'Enable' }}</button>
              <button class="text-xs text-red-400" @click="removeSchedule(s.scheduleId)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
