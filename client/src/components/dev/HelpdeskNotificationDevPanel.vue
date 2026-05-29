<template>
  <div
    v-if="showPanel"
    class="fixed bottom-4 right-4 z-[9999] max-w-xs"
  >
    <button
      type="button"
      class="mb-2 ml-auto flex rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-amber-600"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Hide alert test' : 'Test helpdesk alerts' }}
    </button>

    <div
      v-if="expanded"
      class="rounded-lg border border-amber-200 bg-white p-3 text-xs shadow-xl dark:border-amber-800 dark:bg-neutral-900"
    >
      <p class="mb-2 font-semibold text-neutral-800 dark:text-neutral-100">
        Helpdesk notification simulator
      </p>
      <p class="mb-3 text-neutral-600 dark:text-neutral-400">
        Stay on a <code class="text-[10px]">/helpdesk/</code> page. Click once on the page first so sound can play.
      </p>

      <p class="mb-1 font-medium text-neutral-700 dark:text-neutral-300">UI only (instant)</p>
      <div class="mb-3 flex flex-wrap gap-1">
        <button
          v-for="evt in events"
          :key="`ui-${evt}`"
          type="button"
          class="rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          @click="simulateClient(evt)"
        >
          {{ shortLabel(evt) }}
        </button>
      </div>

      <p class="mb-1 font-medium text-neutral-700 dark:text-neutral-300">Server + SSE</p>
      <div class="mb-2 flex flex-wrap gap-1">
        <button
          v-for="evt in events"
          :key="`srv-${evt}`"
          type="button"
          class="rounded bg-primary-100 px-2 py-1 text-primary-900 hover:bg-primary-200 disabled:opacity-50 dark:bg-primary-900/40 dark:text-primary-100"
          :disabled="serverBusy"
          @click="simulateServer(evt)"
        >
          {{ shortLabel(evt) }}
        </button>
      </div>

      <label class="mb-2 block text-neutral-600 dark:text-neutral-400">
        Case ID (pipeline only)
        <input
          v-model="caseId"
          type="text"
          placeholder="optional Mongo case _id"
          class="mt-0.5 w-full rounded border border-neutral-200 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800"
        />
      </label>

      <button
        type="button"
        class="w-full rounded border border-neutral-300 py-1 hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
        :disabled="serverBusy || !caseId.trim()"
        @click="simulateServer('CASE_CREATED', 'pipeline')"
      >
        Pipeline: CASE_CREATED
      </button>

      <p
        v-if="statusMessage"
        class="mt-2 text-[11px] text-neutral-600 dark:text-neutral-400"
      >
        {{ statusMessage }}
      </p>

    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotificationStore } from '@/stores/notifications';

const events = [
  'CASE_CREATED',
  'CASE_EMAIL_RECEIVED',
  'CASE_CHAT_MESSAGE_RECEIVED'
];

const route = useRoute();
const authStore = useAuthStore();
const store = useNotificationStore();

const expanded = ref(false);
const serverBusy = ref(false);
const statusMessage = ref('');
const caseId = ref('');

const showPanel = computed(() => {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.VITE_ENABLE_HELPDESK_NOTIFICATION_DEV_PANEL !== 'true') return false;
  if (!authStore.isAuthenticated) return false;
  return (route.path || '').startsWith('/helpdesk/');
});

function shortLabel(eventType) {
  if (eventType === 'CASE_CREATED') return 'New case';
  if (eventType === 'CASE_EMAIL_RECEIVED') return 'Email';
  return 'Chat';
}

function caseIdFromRoute() {
  const match = String(route.path || '').match(/\/helpdesk\/cases\/([^/]+)/);
  const raw = match?.[1];
  if (!raw || raw === 'new') return null;
  return raw;
}

function buildSampleNotification(eventType) {
  const id = `dev-${eventType}-${Date.now()}`;
  const caseEntityId = caseIdFromRoute() || '000000000000000000000001';
  const samples = {
    CASE_CREATED: {
      title: 'New case',
      body: 'SIM-TEST-001 was created (client simulation).',
      entity: { type: 'Case', id: caseEntityId, caseId: 'SIM-TEST-001', title: 'Simulated support case' }
    },
    CASE_EMAIL_RECEIVED: {
      title: 'Customer email',
      body: 'New email on SIM-TEST-001 from customer@example.com: [Simulated] Support request',
      entity: {
        type: 'Case',
        id: caseEntityId,
        caseId: 'SIM-TEST-001',
        fromAddress: 'customer@example.com',
        subject: '[Simulated] Support request',
        preview: 'Thanks — I still need help with my order.'
      }
    },
    CASE_CHAT_MESSAGE_RECEIVED: {
      title: 'Live chat message',
      body: 'New chat on SIM-TEST-001 from Simulated Visitor: Hello, I need help.',
      entity: {
        type: 'Case',
        id: caseEntityId,
        caseId: 'SIM-TEST-001',
        authorName: 'Simulated Visitor',
        preview: 'Hello, I need help with my order.'
      }
    }
  };
  const copy = samples[eventType] || { title: 'Helpdesk', body: 'Simulated notification', entity: { type: 'Case', id: caseEntityId } };
  return {
    id,
    appKey: 'HELPDESK',
    eventType,
    title: copy.title,
    body: copy.body,
    priority: 'HIGH',
    entity: copy.entity,
    createdAt: new Date().toISOString()
  };
}

function simulateClient(eventType) {
  store.handleIncomingNotification(buildSampleNotification(eventType));
  statusMessage.value = `UI-only: ${shortLabel(eventType)} — check bell, toast, and sound.`;
}

async function simulateServer(eventType, mode = 'self') {
  serverBusy.value = true;
  statusMessage.value = 'Sending…';
  try {
    const token = authStore.user?.token;
    const res = await fetch('/api/notifications/dev/simulate', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        eventType,
        mode,
        caseId: caseId.value.trim() || undefined
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      statusMessage.value = data.message || `Server error (${res.status})`;
      return;
    }
    statusMessage.value = data.message || 'Sent — watch bell / toast / sound.';
  } catch (err) {
    statusMessage.value = err?.message || 'Request failed';
  } finally {
    serverBusy.value = false;
  }
}
</script>
