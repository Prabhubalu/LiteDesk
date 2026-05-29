<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900">
    <div class="px-4 sm:px-6 py-3">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">
            Live chat
          </p>
          <p v-if="visitorLabel" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
            {{ visitorLabel }}
          </p>
        </div>
        <p v-if="statusLabel" class="text-xs text-gray-500 dark:text-gray-400">
          {{ statusLabel }}
        </p>
      </div>
    </div>

    <div ref="scrollRef" class="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-2">
      <div v-if="loading" class="py-6 text-sm text-gray-500 dark:text-gray-400">Loading chat…</div>
      <div v-else-if="error" class="py-6 text-sm text-rose-600 dark:text-rose-300">{{ error }}</div>
      <div v-else-if="!messages.length" class="py-6 text-sm text-gray-500 dark:text-gray-400">
        No messages yet.
      </div>

      <div
        v-for="m in messages"
        :key="m._id"
        class="flex"
        :class="m.direction === 'inbound' ? '' : 'justify-end'"
      >
        <div
          class="max-w-[min(100%,42rem)] rounded-2xl border px-3 py-2 text-sm whitespace-pre-wrap break-words"
          :class="
            m.direction === 'inbound'
              ? 'border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100'
              : 'border-indigo-200 bg-indigo-50 text-gray-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-50'
          "
        >
          <p class="text-[11px] mb-1 opacity-70">
            {{ m.authorName || (m.direction === 'inbound' ? 'Visitor' : 'Agent') }}
            · {{ formatTime(m.createdAt) }}
          </p>
          <p>{{ m.body || '—' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch
} from 'vue';
import apiClient from '@/utils/apiClient';
import { withApiOrigin } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

const emit = defineEmits(['chat-updated', 'typing-label']);

const props = defineProps({
  caseId: { type: String, required: true },
  canReply: { type: Boolean, default: true }
});

const loading = ref(true);
const error = ref('');
const sessionId = ref(null);
const visitor = ref(null);
const sessionStatus = ref('');
const messages = ref([]);
const scrollRef = ref(null);
const typingLabel = ref('');

let es = null;
const visitorLabel = computed(() => {
  const v = visitor.value || {};
  const name = String(v.name || '').trim();
  const email = String(v.email || '').trim();
  if (name && email) return `${name} · ${email}`;
  return name || email || '';
});
const statusLabel = computed(() => {
  const s = String(sessionStatus.value || '').trim();
  return s ? `Status: ${s}` : '';
});

function formatTime(dt) {
  try {
    return new Date(dt || Date.now()).toLocaleString();
  } catch (_) {
    return '';
  }
}

async function scrollToBottom() {
  await nextTick();
  const el = scrollRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function closeStream() {
  try {
    es?.close?.();
  } catch (_) {}
  es = null;
}

function mergeMessages(rows) {
  if (!Array.isArray(rows) || !rows.length) return;
  const known = new Set(messages.value.map((m) => String(m._id)));
  const merged = [...messages.value];
  for (const r of rows) {
    if (!r || !r._id || known.has(String(r._id))) continue;
    merged.push(r);
  }
  merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  messages.value = merged;
  scrollToBottom();
}

function appendMessage(msg) {
  if (!msg?._id) return;
  mergeMessages([msg]);
}

async function refreshMessages() {
  if (!props.caseId) return;
  try {
    const msgsRes = await apiClient.get(`/helpdesk/cases/${props.caseId}/chat/messages`, {
      params: { limit: 500 }
    });
    if (msgsRes?.success) {
      messages.value = Array.isArray(msgsRes.data) ? msgsRes.data : [];
      await scrollToBottom();
    }
  } catch (_) {
    /* ignore */
  }
}

function openStream() {
  closeStream();
  if (!sessionId.value) return;
  const authStore = useAuthStore();
  const token = authStore.user?.token;
  if (!token) return;

  const after = Date.now();
  const url = withApiOrigin(
    `/api/helpdesk/cases/${props.caseId}/chat/stream?after=${after}&token=${encodeURIComponent(token)}`
  );
  es = new EventSource(url, { withCredentials: true });
  es.addEventListener('messages', (evt) => {
    try {
      const rows = JSON.parse(evt.data || '[]');
      mergeMessages(rows);
      scheduleChatUpdatedEmit();
    } catch (_) {}
  });
  es.addEventListener('typing', (evt) => {
    try {
      const t = JSON.parse(evt.data || '{}');
      const visitorTyping = t?.visitor;
      if (!visitorTyping || !visitorTyping.authorType) {
        typingLabel.value = '';
        emit('typing-label', '');
        return;
      }
      const name = visitorTyping.authorName || 'Visitor';
      typingLabel.value = `${name} is typing…`;
      emit('typing-label', typingLabel.value);
    } catch (_) {}
  });
}

let chatUpdatedEmitTimer = null;

function scheduleChatUpdatedEmit() {
  if (chatUpdatedEmitTimer) clearTimeout(chatUpdatedEmitTimer);
  chatUpdatedEmitTimer = setTimeout(() => {
    chatUpdatedEmitTimer = null;
    emit('chat-updated');
  }, 600);
}

async function load(options = {}) {
  const soft = options.soft === true;
  const hasCachedSession = soft && sessionId.value && messages.value.length > 0;

  if (!hasCachedSession) {
    loading.value = !messages.value.length;
    error.value = '';
    if (!soft) {
      messages.value = [];
      sessionId.value = null;
      visitor.value = null;
      sessionStatus.value = '';
      typingLabel.value = '';
      emit('typing-label', '');
    }
    closeStream();
  }

  try {
    const sessionRes = await apiClient.get(`/helpdesk/cases/${props.caseId}/chat/session`);
    if (!sessionRes?.success) {
      error.value = sessionRes?.message || 'Failed to load chat session';
      return;
    }
    sessionId.value = sessionRes.data?.sessionId || null;
    visitor.value = sessionRes.data?.visitor || null;
    sessionStatus.value = sessionRes.data?.status || '';

    const msgsRes = await apiClient.get(`/helpdesk/cases/${props.caseId}/chat/messages`, {
      params: { limit: 500 }
    });
    if (msgsRes?.success) {
      messages.value = Array.isArray(msgsRes.data) ? msgsRes.data : [];
    }
    await scrollToBottom();
    openStream();
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || 'Failed to load chat';
  } finally {
    loading.value = false;
  }
}

onMounted(() => load());
onBeforeUnmount(() => {
  closeStream();
  if (chatUpdatedEmitTimer) clearTimeout(chatUpdatedEmitTimer);
});

onDeactivated(closeStream);

onActivated(() => {
  if (sessionId.value) {
    openStream();
    refreshMessages();
    return;
  }
  if (props.caseId) load({ soft: true });
});

watch(
  () => props.caseId,
  (newId, oldId) => {
    if (newId && newId !== oldId) load();
  }
);

defineExpose({ appendMessage, refreshMessages });
</script>

