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
              <div
                class="border-b px-3 py-2 dark:border-gray-700"
                :class="recipientFieldHint
                  ? 'border-red-300 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20'
                  : 'border-gray-200'"
              >
                <div class="flex items-center gap-2">
                  <label class="shrink-0 text-sm text-gray-500 dark:text-gray-400">To</label>
                  <input
                    v-model="form.to"
                    type="text"
                    required
                    autocomplete="email"
                    spellcheck="false"
                    class="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0"
                    :class="recipientFieldHint
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-gray-900 dark:text-white'"
                    :placeholder="t('inbox.emailComposeDrawerRecipientExampleComCommaSeparatedFor')"
                    :aria-invalid="Boolean(recipientFieldHint)"
                    :aria-describedby="recipientFieldHint ? 'compose-to-hint' : undefined"
                    @blur="markRecipientHint"
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
                <p
                  v-if="recipientFieldHint"
                  id="compose-to-hint"
                  class="mt-1 pl-7 text-xs text-red-600 dark:text-red-400"
                  role="alert"
                >
                  {{ recipientFieldHint }}
                </p>
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
                    <label class="font-medium text-gray-600 dark:text-gray-300" :for="'compose-from-' + _uid">
                      {{ t('settings.helpdeskAnalyticsFrom') }}:
                    </label>
                    <select
                      v-if="hasFromPicker"
                      :id="'compose-from-' + _uid"
                      class="mt-1 block w-full rounded border border-gray-200 bg-white px-2 py-1.5 font-mono text-[12px] text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                      :value="selectedFromId"
                      @change="selectFromIdentity($event.target.value)"
                    >
                      <option
                        v-for="idty in sendIdentities"
                        :key="idty.id"
                        :value="idty.id"
                      >
                        {{ identityOptionLabel(idty) }}
                      </option>
                    </select>
                    <span v-else class="ml-1 font-mono">{{ fromDisplayLine || (composePreviewLoading ? '…' : '—') }}</span>
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
            <div class="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1.5 border-t border-gray-200 px-3 py-2 dark:border-gray-700">
              <div class="relative isolate inline-flex h-9 shrink-0 items-stretch overflow-visible rounded-full bg-[#0b57d0] shadow-sm dark:bg-indigo-600">
                <button
                  type="submit"
                  class="inline-flex h-full items-center rounded-l-full px-4 pr-3.5 text-sm font-medium text-white hover:bg-[#0842a0] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-indigo-500"
                  :disabled="!canSend"
                  :title="!canSend && recipientFieldHint ? recipientFieldHint : undefined"
                >
                  {{ t('inbox.emailComposeDrawerSend') }}
                </button>
                <EmailScheduleSendPopover
                  class="h-full"
                  :disabled="!canSend"
                  @schedule="onScheduleSend"
                />
              </div>
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

              <!-- Follow-up reminder: progressive disclosure beside Send actions -->
              <div
                class="ml-0.5 flex min-w-0 flex-wrap items-center gap-1.5 rounded-full px-1.5 py-0.5 text-xs text-gray-600 transition-colors dark:text-gray-300"
                :class="reminderEnabled ? 'bg-blue-50 dark:bg-indigo-950/40' : ''"
              >
                <label class="inline-flex cursor-pointer select-none items-center gap-1.5">
                  <input
                    type="checkbox"
                    class="size-3.5 shrink-0 rounded border-gray-300 text-[#0b57d0] focus:ring-[#0b57d0] dark:border-gray-600 dark:bg-gray-800 dark:text-indigo-500"
                    :checked="reminderEnabled"
                    :aria-label="t('inbox.emailComposeReminderLabel')"
                    @change="setReminderEnabled($event.target.checked)"
                  />
                  <span class="whitespace-nowrap font-medium text-gray-700 dark:text-gray-200">
                    {{ reminderEnabled ? t('inbox.emailComposeReminderIn') : t('inbox.emailComposeReminderLabel') }}
                  </span>
                </label>
                <template v-if="reminderEnabled">
                  <input
                    ref="reminderDaysInputRef"
                    :value="reminderDays"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    maxlength="3"
                    class="w-10 rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-center text-xs font-medium tabular-nums text-gray-900 outline-none ring-[#0b57d0] focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    :aria-label="t('inbox.emailComposeReminderDaysAria')"
                    @input="onReminderDaysInput"
                  />
                  <span class="text-gray-500 dark:text-gray-400">{{ t('inbox.emailComposeReminderDays') }}</span>
                  <span
                    v-if="reminderDateHint"
                    class="hidden truncate text-[11px] text-gray-500 sm:inline dark:text-gray-400"
                    :title="reminderDateHint"
                  >
                    · {{ reminderDateHint }}
                  </span>
                </template>
              </div>

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
import EmailScheduleSendPopover from '@/components/communications/EmailScheduleSendPopover.vue';
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
const _uid = `w${Math.random().toString(36).slice(2, 9)}`;

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
  reminderEnabled,
  reminderDays,
  reminderDaysInputRef,
  setReminderEnabled,
  onReminderDaysInput,
  fromDisplayLine,
  fromSourceHint,
  sendIdentities,
  selectedFromId,
  hasFromPicker,
  identityOptionLabel,
  selectFromIdentity,
  replyToDisplay,
  replyToNote,
  composePreviewLoading,
  recipientFieldHint,
  markRecipientHint,
  canSend,
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

/** Soft confirmation of absolute reminder date (Gmail/Superhuman polish). */
const reminderDateHint = computed(() => {
  if (!reminderEnabled.value) return '';
  const n = typeof reminderDays.value === 'number'
    ? reminderDays.value
    : parseInt(String(reminderDays.value).trim(), 10);
  if (!Number.isInteger(n) || n < 1) return '';
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(d);
  } catch {
    return d.toDateString();
  }
});

const dialogLabel = computed(() => headerTitle.value);

function onScheduleSend(iso) {
  handleSend({ scheduledAt: iso });
}

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
