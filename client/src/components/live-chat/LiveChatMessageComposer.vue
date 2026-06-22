<template>
  <div
    ref="paneRef"
    class="flex shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
    :class="{ 'select-none': isResizing }"
    :style="{ height: `${height}px` }"
  >
    <div
      role="separator"
      aria-orientation="horizontal"
      :aria-label="t('liveChat.composerResize')"
      :title="t('liveChat.composerResize')"
      class="group flex h-2 shrink-0 cursor-row-resize touch-none items-center justify-center border-b border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
      @pointerdown="startResize"
    >
      <span
        class="h-1 w-10 rounded-full bg-gray-300 transition-colors group-hover:bg-gray-400 dark:bg-gray-600 dark:group-hover:bg-gray-500"
        aria-hidden="true"
      />
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="flex shrink-0 border-b border-gray-200 dark:border-gray-700">
      <button
        v-for="tab in composerTabs"
        :key="tab.id"
        type="button"
        class="relative px-4 py-2.5 text-sm font-medium transition"
        :class="composerMode === tab.id
          ? 'text-[#0b57d0] dark:text-primary-400'
          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'"
        @click="$emit('update:composerMode', tab.id)"
      >
        {{ tab.label }}
        <span
          v-if="composerMode === tab.id"
          class="absolute inset-x-0 bottom-0 h-0.5 bg-[#0b57d0] dark:bg-primary-500"
          aria-hidden="true"
        />
      </button>
    </div>

    <form class="flex min-h-0 flex-1 flex-col overflow-hidden" @submit.prevent="handleSend">
      <p v-if="error" class="shrink-0 px-4 pt-3 text-sm text-rose-600 dark:text-rose-300">{{ error }}</p>

      <textarea
        ref="textareaRef"
        :value="modelValue"
        class="min-h-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-500"
        :placeholder="composerMode === 'note' ? notePlaceholder : replyPlaceholder"
        :disabled="disabled || busy"
        @input="onInput"
        @keydown="onKeydown"
      />

      <ul v-if="pendingFiles.length" class="flex shrink-0 flex-wrap gap-2 px-4 pb-2">
        <li
          v-for="(file, idx) in pendingFiles"
          :key="`${file.name}-${idx}`"
          class="inline-flex max-w-full items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
        >
          <PaperClipIcon class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate">{{ file.name }}</span>
          <button
            type="button"
            class="shrink-0 text-gray-500 hover:text-rose-600"
            :aria-label="t('liveChat.composerRemoveAttachment', { name: file.name })"
            @click="removePendingFile(idx)"
          >
            <XMarkIcon class="h-3.5 w-3.5" />
          </button>
        </li>
      </ul>

      <div class="flex shrink-0 items-center gap-1 border-t border-gray-100 px-3 py-2 dark:border-gray-800">
        <input
          ref="fileInputRef"
          type="file"
          class="hidden"
          multiple
          @change="onFileSelected"
        />
        <input
          ref="imageInputRef"
          type="file"
          class="hidden"
          multiple
          accept="image/*"
          @change="onFileSelected"
        />
        <input
          ref="documentInputRef"
          type="file"
          class="hidden"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf"
          @change="onFileSelected"
        />

        <div class="relative flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
          <button
            ref="emojiButtonRef"
            type="button"
            class="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            :title="t('liveChat.composerEmoji')"
            :disabled="disabled || busy"
            @mousedown.prevent="toggleEmojiPicker"
          >
            <FaceSmileIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            :title="t('liveChat.composerAttachFile')"
            :disabled="disabled || busy"
            @mousedown.prevent="openFilePicker('file')"
          >
            <PaperClipIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            :title="t('liveChat.composerAttachImage')"
            :disabled="disabled || busy"
            @mousedown.prevent="openFilePicker('image')"
          >
            <PhotoIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            :title="t('liveChat.composerAttachDocument')"
            :disabled="disabled || busy"
            @mousedown.prevent="openFilePicker('document')"
          >
            <DocumentIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            :title="t('liveChat.composerInsertCode')"
            :disabled="disabled || busy"
            @mousedown.prevent="insertCodeBlock"
          >
            <CodeBracketIcon class="h-4 w-4" />
          </button>
          <CaseCannedResponseMenu
            :items="cannedResponses"
            :loading="cannedLoading"
            :disabled="disabled || busy"
            :active-channel="cannedChannel"
            @open="loadCannedResponses"
            @select="applyCannedResponse"
          />
          <Menu as="div" class="relative inline-flex">
            <MenuButton
              type="button"
              class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
              :disabled="disabled || busy"
              :title="t('liveChat.composerMoreActions')"
            >
              <EllipsisVerticalIcon class="h-4 w-4" />
            </MenuButton>
            <transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="transform scale-95 opacity-0"
              enter-to-class="transform scale-100 opacity-100"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="transform scale-100 opacity-100"
              leave-to-class="transform scale-95 opacity-0"
            >
              <MenuItems
                class="absolute bottom-full left-0 z-50 mb-1 w-48 origin-bottom-left rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-900"
              >
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    :class="[
                      'w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200',
                      active ? 'bg-gray-100 dark:bg-gray-800' : '',
                    ]"
                    @click="clearComposer"
                  >
                    {{ t('liveChat.composerClearDraft') }}
                  </button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>

        <button
          type="submit"
          class="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0b57d0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0842a0] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
          :disabled="disabled || busy || !canSend"
        >
          <span
            v-if="busy"
            class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
          />
          {{ busy ? t('liveChat.composerSending') : t('actions.send') }}
        </button>
      </div>
    </form>
    </div>

    <Teleport to="body">
      <div
        v-if="showEmojiPicker"
        ref="emojiPickerRef"
        class="fixed z-[100] rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        :style="emojiPickerStyle"
      >
        <emoji-picker
          :class="['live-chat-composer-emoji-picker', isDarkTheme ? 'dark' : 'light']"
          :theme="emojiPickerTheme"
          :style="{ colorScheme: emojiPickerColorScheme }"
          @emoji-click="handleEmojiSelect"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  CodeBracketIcon,
  DocumentIcon,
  EllipsisVerticalIcon,
  FaceSmileIcon,
  PaperClipIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';
import CaseCannedResponseMenu from '@/components/cases/CaseCannedResponseMenu.vue';
import { useCaseCannedResponses } from '@/composables/useCaseCannedResponses';
import { useVerticalPaneResize } from '@/composables/useVerticalPaneResize';
import { useAuthStore } from '@/stores/authRegistry';
import { resolveCannedResponse } from '@/utils/caseCannedResponses';
import 'emoji-picker-element';

const props = defineProps({
  modelValue: { type: String, default: '' },
  composerMode: { type: String, default: 'reply' },
  /** @deprecated Prefer sendMessage; kept for legacy parents that drive sending externally. */
  sending: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  error: { type: String, default: '' },
  visitor: { type: Object, default: null },
  replyPlaceholder: { type: String, default: '' },
  notePlaceholder: { type: String, default: '' },
  /** Async send handler; composer owns in-flight UI state while this runs. */
  sendMessage: { type: Function, default: null },
});

const emit = defineEmits([
  'update:modelValue',
  'update:composerMode',
  'send',
  'send-error',
  'typing',
]);

const { t } = useI18n();
const authStore = useAuthStore();
const { responses: cannedResponses, loading: cannedLoading, load: fetchCannedResponses } =
  useCaseCannedResponses();

const textareaRef = ref(null);
const fileInputRef = ref(null);
const imageInputRef = ref(null);
const documentInputRef = ref(null);
const emojiPickerRef = ref(null);
const emojiButtonRef = ref(null);
const showEmojiPicker = ref(false);
const emojiPickerStyle = ref({});
const pendingFiles = ref([]);
const isSending = ref(false);
let sendAbortController = null;

const busy = computed(() => isSending.value || props.sending);

const { height, isResizing, paneRef, startResize } = useVerticalPaneResize({
  storageKey: 'live-chat-composer-height',
  defaultHeight: 200,
  minHeight: 132,
  maxHeightRatio: 0.55,
  absoluteMaxHeight: 480,
  heightParentDepth: 2,
});

const composerTabs = computed(() => [
  { id: 'reply', label: t('liveChat.composerReply') },
  { id: 'note', label: t('liveChat.composerNote') },
]);

const cannedChannel = computed(() =>
  props.composerMode === 'note' ? 'internal' : 'email',
);

const canSend = computed(() =>
  Boolean(String(props.modelValue || '').trim()) || pendingFiles.value.length > 0,
);

const isDarkTheme = computed(() =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
);

const emojiPickerTheme = computed(() => (isDarkTheme.value ? 'dark' : 'light'));
const emojiPickerColorScheme = computed(() => (isDarkTheme.value ? 'dark' : 'light'));

const cannedContext = computed(() => {
  const visitor = props.visitor || {};
  const visitorName = String(visitor.name || '').trim() || t('liveChat.visitor');
  const agentUser = authStore.user;
  const agentName = agentUser
    ? [agentUser.firstName, agentUser.lastName].filter(Boolean).join(' ').trim()
      || String(agentUser.email || '').trim()
    : '';
  return {
    case: {
      id: '',
      caseId: '',
      title: '',
      status: '',
      priority: '',
      channel: 'chat',
    },
    contact: {
      firstName: visitorName.split(/\s+/)[0] || 'there',
      name: visitorName,
      email: String(visitor.email || '').trim(),
    },
    agent: {
      name: agentName,
      email: String(agentUser?.email || '').trim(),
    },
  };
});

function onInput(event) {
  emit('update:modelValue', event.target.value);
  if (!isSending.value) {
    emit('typing');
  }
}

function onKeydown(event) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    handleSend();
  }
}

function insertAtCursor(text) {
  const el = textareaRef.value;
  if (!el) {
    emit('update:modelValue', `${props.modelValue}${text}`);
    return;
  }
  const start = el.selectionStart ?? props.modelValue.length;
  const end = el.selectionEnd ?? props.modelValue.length;
  const next = `${props.modelValue.slice(0, start)}${text}${props.modelValue.slice(end)}`;
  emit('update:modelValue', next);
  nextTick(() => {
    el.focus();
    const cursor = start + text.length;
    el.setSelectionRange(cursor, cursor);
  });
}

function insertCodeBlock() {
  insertAtCursor('```\n\n```');
  nextTick(() => {
    const el = textareaRef.value;
    if (!el) return;
    const cursor = Math.max(0, (el.selectionStart ?? 0) - 4);
    el.setSelectionRange(cursor, cursor);
  });
}

function openFilePicker(kind) {
  const refMap = {
    file: fileInputRef,
    image: imageInputRef,
    document: documentInputRef,
  };
  refMap[kind]?.value?.click();
}

function onFileSelected(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  pendingFiles.value = [...pendingFiles.value, ...files];
  event.target.value = '';
}

function removePendingFile(index) {
  pendingFiles.value = pendingFiles.value.filter((_, idx) => idx !== index);
}

async function loadCannedResponses() {
  await fetchCannedResponses(cannedChannel.value, { includeAll: true });
}

function applyCannedResponse(item) {
  const resolved = resolveCannedResponse(item, cannedContext.value);
  const plain = String(resolved.body || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
  if (!plain) return;
  const current = String(props.modelValue || '').trim();
  emit('update:modelValue', current ? `${current}\n\n${plain}` : plain);
  nextTick(() => textareaRef.value?.focus());
}

function clearComposer() {
  emit('update:modelValue', '');
  pendingFiles.value = [];
}

function buildSendPayload() {
  return {
    body: String(props.modelValue || '').trim(),
    files: [...pendingFiles.value],
  };
}

async function handleSend() {
  if (!canSend.value || props.disabled || busy.value) return;

  const payload = buildSendPayload();
  if (typeof props.sendMessage === 'function') {
    isSending.value = true;
    sendAbortController?.abort();
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    sendAbortController = controller;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), 30000)
      : null;
    try {
      await props.sendMessage(payload, { signal: controller?.signal });
      emit('update:modelValue', '');
      resetAfterSend();
    } catch (err) {
      emit('send-error', err);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (sendAbortController === controller) {
        sendAbortController = null;
      }
      isSending.value = false;
    }
    return;
  }

  emit('send', payload);
}

function resetAfterSend() {
  pendingFiles.value = [];
}

function updateEmojiPickerPosition() {
  const button = emojiButtonRef.value;
  if (!button) return;
  const rect = button.getBoundingClientRect();
  emojiPickerStyle.value = {
    left: `${Math.max(8, rect.left)}px`,
    top: `${Math.max(8, rect.top - 420)}px`,
  };
}

function toggleEmojiPicker() {
  showEmojiPicker.value = !showEmojiPicker.value;
  if (showEmojiPicker.value) {
    nextTick(updateEmojiPickerPosition);
  }
}

function handleEmojiSelect(event) {
  const emoji = event?.detail?.unicode || event?.detail?.emoji?.unicode || '';
  if (!emoji) return;
  insertAtCursor(emoji);
  showEmojiPicker.value = false;
}

function closeEmojiPickerOnOutsideClick(event) {
  if (!showEmojiPicker.value) return;
  const target = event.target;
  if (emojiPickerRef.value?.contains(target)) return;
  showEmojiPicker.value = false;
}

defineExpose({ resetAfterSend });

watch(showEmojiPicker, (open) => {
  if (open) nextTick(updateEmojiPickerPosition);
});

onMounted(() => {
  document.addEventListener('click', closeEmojiPickerOnOutsideClick);
  window.addEventListener('resize', updateEmojiPickerPosition);
});

onBeforeUnmount(() => {
  sendAbortController?.abort();
  sendAbortController = null;
  isSending.value = false;
  document.removeEventListener('click', closeEmojiPickerOnOutsideClick);
  window.removeEventListener('resize', updateEmojiPickerPosition);
});
</script>

<style scoped>
.live-chat-composer-emoji-picker {
  --emoji-size: 1.125rem;
  --num-columns: 8;
  width: min(20rem, calc(100vw - 2rem));
  height: 18rem;
}
</style>
