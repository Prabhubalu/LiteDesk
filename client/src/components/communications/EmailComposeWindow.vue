<template>
  <Teleport to="body">
    <Transition name="email-compose-window">
      <div
        v-if="isOpen"
        ref="composeRootRef"
        tabindex="-1"
        class="fixed inset-0 z-[10000] pointer-events-none outline-none"
        @keydown.esc.prevent="requestClose"
      >
        <!-- Backdrop (maximized only) -->
        <div
          v-if="windowState === 'maximized'"
          class="absolute inset-0 z-0 bg-black/35 pointer-events-auto"
          aria-hidden="true"
          @click="setWindowState('normal')"
        />

        <!-- Compose panel -->
        <div
          class="pointer-events-auto flex flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-black/10 dark:bg-gray-900 dark:ring-white/10 transition-[width,height,border-radius] duration-200 ease-out"
          :class="panelClasses"
          role="dialog"
          aria-modal="true"
          :aria-label="dialogLabel"
        >
          <!-- Header -->
          <div
            class="flex shrink-0 items-center justify-between border-b border-gray-200/80 bg-[#f2f6fc] px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800"
            :class="windowState === 'minimized' ? 'cursor-pointer' : ''"
            @click="windowState === 'minimized' ? setWindowState('normal') : undefined"
          >
            <h2 class="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
              {{ headerTitle }}
            </h2>
            <div class="flex items-center gap-0.5">
              <button
                v-if="windowState !== 'minimized'"
                type="button"
                class="rounded p-1.5 text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
                :title="t('inbox.emailComposeWindowMinimize')"
                :aria-label="t('inbox.emailComposeWindowMinimize')"
                @click.stop="setWindowState('minimized')"
              >
                <MinusIcon class="size-4" aria-hidden="true" />
              </button>
              <button
                v-if="windowState === 'minimized'"
                type="button"
                class="rounded p-1.5 text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
                :title="t('inbox.emailComposeWindowRestore')"
                :aria-label="t('inbox.emailComposeWindowRestore')"
                @click.stop="setWindowState('normal')"
              >
                <ChevronUpIcon class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="rounded p-1.5 text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
                :title="windowState === 'maximized' ? t('inbox.emailComposeWindowExitFullscreen') : t('inbox.emailComposeWindowMaximize')"
                :aria-label="windowState === 'maximized' ? t('inbox.emailComposeWindowExitFullscreen') : t('inbox.emailComposeWindowMaximize')"
                @click.stop="toggleMaximize"
              >
                <ArrowsPointingInIcon v-if="windowState === 'maximized'" class="size-4" aria-hidden="true" />
                <ArrowsPointingOutIcon v-else class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="rounded p-1.5 text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
                :title="t('settings.roleDrawerCloseSr')"
                :aria-label="t('settings.roleDrawerCloseSr')"
                @click.stop="requestClose"
              >
                <XMarkIcon class="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <form
            v-show="windowState !== 'minimized'"
            class="flex min-h-0 flex-1 flex-col"
            @submit.prevent="handleSend"
          >
            <div class="min-h-0 flex-1 overflow-y-auto arivu-scrollbar">
              <div
                v-if="error"
                class="mx-3 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
              >
                {{ error }}
              </div>

              <!-- To row -->
              <div class="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
                <label class="shrink-0 text-sm text-gray-500 dark:text-gray-400">To</label>
                <input
                  v-model="form.to"
                  type="text"
                  required
                  class="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 outline-none focus:ring-0 dark:text-white"
                  :placeholder="t('inbox.emailComposeDrawerRecipientExampleComCommaSeparatedFor')"
                />
                <div v-if="!showCc || !showBcc" class="flex shrink-0 gap-2 text-xs">
                  <button
                    v-if="!showCc"
                    type="button"
                    class="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    @click="showCc = true"
                  >
                    Cc
                  </button>
                  <button
                    v-if="!showBcc"
                    type="button"
                    class="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    @click="showBcc = true"
                  >
                    Bcc
                  </button>
                </div>
              </div>

              <div v-if="showCc" class="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
                <label class="shrink-0 text-sm text-gray-500 dark:text-gray-400">Cc</label>
                <input
                  v-model="form.cc"
                  type="text"
                  class="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 outline-none focus:ring-0 dark:text-white"
                  :placeholder="t('inbox.emailComposeDrawerCcExampleComCommaSeparated')"
                />
              </div>

              <div v-if="showBcc" class="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
                <label class="shrink-0 text-sm text-gray-500 dark:text-gray-400">Bcc</label>
                <input
                  v-model="form.bcc"
                  type="text"
                  class="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 outline-none focus:ring-0 dark:text-white"
                  :placeholder="t('inbox.emailComposeDrawerBccExampleComCommaSeparated')"
                />
              </div>

              <!-- Subject -->
              <div class="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
                <input
                  v-model="form.subject"
                  type="text"
                  required
                  class="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0 dark:text-white dark:placeholder:text-gray-500"
                  :placeholder="t('inbox.emailComposeDrawerSubject')"
                />
              </div>

              <!-- Body -->
              <div class="px-1 py-2">
                <TaskDescriptionEditor
                  v-model="form.body"
                  placeholder="Write your message..."
                  :class="editorClasses"
                />
              </div>

              <!-- Attachments -->
              <ul v-if="attachments.length" class="space-y-1 px-3 pb-2">
                <li
                  v-for="(att, idx) in attachments"
                  :key="idx"
                  class="flex items-center justify-between gap-2 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  <span class="truncate">{{ att.fileName }}</span>
                  <button
                    type="button"
                    class="shrink-0 text-gray-500 hover:text-red-600"
                    :title="t('settings.assignRulesRemoveTitle')"
                    @click="removeAttachment(idx)"
                  >
                    <XMarkIcon class="size-3.5" />
                  </button>
                </li>
              </ul>

              <!-- From / Reply-To (collapsed details) -->
              <details class="mx-3 mb-2 text-xs text-gray-500 dark:text-gray-400">
                <summary class="cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-300">
                  {{ t('inbox.emailComposeWindowSendingDetails') }}
                </summary>
                <div class="mt-2 space-y-2 rounded-md bg-gray-50 p-2 dark:bg-gray-800/60">
                  <div>
                    <span class="font-medium text-gray-600 dark:text-gray-300">{{ t('settings.helpdeskAnalyticsFrom') }}:</span>
                    <span class="ml-1 font-mono">{{ fromDisplayLine || (composePreviewLoading ? '…' : '—') }}</span>
                    <p class="mt-0.5 text-[11px]">{{ fromSourceHint }}</p>
                  </div>
                  <div>
                    <span class="font-medium text-gray-600 dark:text-gray-300">{{ t('settings.integrationsReplyTo') }}:</span>
                    <span class="ml-1 font-mono">{{ replyToDisplay || (composePreviewLoading ? '…' : '—') }}</span>
                  </div>
                  <p v-if="replyToNote" class="text-amber-700 dark:text-amber-300">{{ replyToNote }}</p>
                  <p v-if="!fromDisplayLine && sendingMailboxHint" class="text-amber-700 dark:text-amber-300">
                    {{ sendingMailboxHint }}
                  </p>
                </div>
              </details>
            </div>

            <!-- Footer toolbar -->
            <div class="flex shrink-0 items-center gap-1 border-t border-gray-200 px-3 py-2 dark:border-gray-700">
              <button
                type="submit"
                class="inline-flex items-center gap-1 rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-medium text-white hover:bg-[#0842a0] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                :disabled="!toRecipients.length || !form.subject?.trim()"
              >
                {{ t('inbox.emailComposeDrawerSend') }}
              </button>
              <button
                type="button"
                class="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                :title="t('inbox.emailComposeDrawerAttachments')"
                :disabled="uploading"
                @click="fileInputRef?.click()"
              >
                <PaperClipIcon class="size-5" aria-hidden="true" />
              </button>
              <input
                ref="fileInputRef"
                type="file"
                class="hidden"
                multiple
                @change="handleFileSelect"
              />
              <div class="flex-1" />
              <button
                type="button"
                class="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                :title="t('inbox.emailComposeWindowDiscardDraft')"
                :aria-label="t('inbox.emailComposeWindowDiscardDraft')"
                @click="requestClose"
              >
                <TrashIcon class="size-5" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  XMarkIcon,
  MinusIcon,
  ChevronUpIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  PaperClipIcon,
  TrashIcon
} from '@heroicons/vue/24/outline';
import TaskDescriptionEditor from '@/components/record-page/TaskDescriptionEditor.vue';
import { useEmailComposeForm } from '@/composables/useEmailComposeForm';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  standaloneMode: { type: Boolean, default: false },
  relatedTo: { type: Object, default: null },
  initialTo: { type: String, default: '' },
  initialDraft: { type: Object, default: null },
  sendingMailbox: { type: Object, default: null },
  sendingMailboxHint: { type: String, default: '' },
  initialReplyTo: { type: String, default: '' },
  initialFrom: { type: String, default: '' },
  initialFromName: { type: String, default: '' }
});

const emit = defineEmits(['close', 'sent', 'submit']);

const { t } = useI18n();

const windowState = ref('normal'); // 'normal' | 'minimized' | 'maximized'
const composeRootRef = ref(null);

const {
  form,
  showCc,
  showBcc,
  error,
  attachments,
  uploading,
  fileInputRef,
  fromDisplayLine,
  fromSourceHint,
  replyToDisplay,
  replyToNote,
  composePreviewLoading,
  toRecipients,
  isReply,
  close,
  handleFileSelect,
  removeAttachment,
  handleSend
} = useEmailComposeForm(props, emit);

const headerTitle = computed(() => {
  if (isReply.value) return t('inbox.emailComposeWindowReply');
  return t('inbox.emailComposeWindowNewMessage');
});

const dialogLabel = computed(() => headerTitle.value);

const editorClasses = computed(() => {
  const base = '[&_.tiptap]:px-2 [&_.ProseMirror]:text-sm';
  if (windowState.value === 'maximized') {
    return `${base} [&_.tiptap]:min-h-[min(58vh,640px)]`;
  }
  return `${base} [&_.tiptap]:min-h-[200px]`;
});

const panelClasses = computed(() => {
  if (windowState.value === 'maximized') {
    return [
      'absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
      'w-[min(98vw,1600px)] h-[min(96dvh,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1.5rem)] rounded-xl'
    ];
  }
  if (windowState.value === 'minimized') {
    return [
      'fixed z-10 right-4 bottom-0 sm:right-6',
      'w-[min(100vw-2rem,500px)] rounded-t-xl'
    ];
  }
  return [
    'fixed z-10 right-4 bottom-0 sm:right-6',
    'w-[min(100vw-2rem,500px)] h-[min(70vh,560px)] rounded-t-xl'
  ];
});

watch(() => props.isOpen, (open) => {
  if (open) {
    windowState.value = 'normal';
    requestAnimationFrame(() => composeRootRef.value?.focus());
  }
});

function setWindowState(state) {
  windowState.value = state;
}

function toggleMaximize() {
  windowState.value = windowState.value === 'maximized' ? 'normal' : 'maximized';
}

function requestClose() {
  close();
}
</script>

<style scoped>
.email-compose-window-enter-active > div:last-child,
.email-compose-window-enter-active .pointer-events-auto.flex {
  transition: transform 0.25s ease-out, opacity 0.2s ease-out;
}

.email-compose-window-enter-from .pointer-events-auto.flex {
  transform: translateY(100%);
  opacity: 0;
}

.email-compose-window-leave-active .pointer-events-auto.flex {
  transition: transform 0.2s ease-in, opacity 0.15s ease-in;
}

.email-compose-window-leave-to .pointer-events-auto.flex {
  transform: translateY(100%);
  opacity: 0;
}
</style>
