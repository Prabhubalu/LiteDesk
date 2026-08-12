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
            class="flex shrink-0 items-center justify-between border-b border-neutral-200/80 bg-neutral-50/90 px-3.5 py-2.5 dark:border-gray-700 dark:bg-gray-800/90"
            :class="windowState === 'minimized' ? 'cursor-pointer' : ''"
            @click="windowState === 'minimized' ? setWindowState('normal') : undefined"
          >
            <h2 class="truncate text-sm font-semibold tracking-tight text-neutral-900 dark:text-gray-100">
              {{ headerTitle }}
            </h2>
            <div class="flex items-center gap-0.5">
              <button
                v-if="windowState !== 'minimized'"
                type="button"
                class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-800 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                :title="t('inbox.emailComposeWindowMinimize')"
                :aria-label="t('inbox.emailComposeWindowMinimize')"
                @click.stop="setWindowState('minimized')"
              >
                <MinusIcon class="size-4" aria-hidden="true" />
              </button>
              <button
                v-if="windowState === 'minimized'"
                type="button"
                class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-800 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                :title="t('inbox.emailComposeWindowRestore')"
                :aria-label="t('inbox.emailComposeWindowRestore')"
                @click.stop="setWindowState('normal')"
              >
                <ChevronUpIcon class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-800 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                :title="windowState === 'maximized' ? t('inbox.emailComposeWindowExitFullscreen') : t('inbox.emailComposeWindowMaximize')"
                :aria-label="windowState === 'maximized' ? t('inbox.emailComposeWindowExitFullscreen') : t('inbox.emailComposeWindowMaximize')"
                @click.stop="toggleMaximize"
              >
                <ArrowsPointingInIcon v-if="windowState === 'maximized'" class="size-4" aria-hidden="true" />
                <ArrowsPointingOutIcon v-else class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-800 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
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
            @submit.prevent="submitNow"
          >
            <div
              v-if="error"
              class="mx-3.5 mt-2.5 shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
            >
              {{ error }}
            </div>

            <!-- From / To / Subject stay pinned -->
            <div class="shrink-0">
              <!-- From -->
              <div class="border-b border-neutral-100 px-3.5 py-2 dark:border-gray-800">
                <div class="flex items-center gap-2.5">
                  <span class="w-10 shrink-0 text-xs font-medium text-neutral-500 dark:text-gray-400">
                    {{ t('settings.helpdeskAnalyticsFrom') }}
                  </span>
                  <Listbox
                    v-if="hasFromPicker"
                    as="div"
                    class="relative min-w-0 flex-1"
                    :model-value="selectedFromId"
                    :disabled="composePreviewLoading"
                    @update:model-value="selectFromIdentity"
                  >
                    <ListboxButton
                      class="group flex w-full items-center gap-1.5 rounded-full bg-neutral-100 py-1 pl-3 pr-2 text-left text-sm text-neutral-900 outline-none hover:bg-neutral-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-60 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                    >
                      <span class="min-w-0 flex-1 truncate">{{ selectedFromLabel }}</span>
                      <ChevronUpDownIcon
                        class="size-4 shrink-0 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-gray-300"
                        aria-hidden="true"
                      />
                    </ListboxButton>
                    <Transition
                      leave-active-class="transition duration-100 ease-in"
                      leave-from-class="opacity-100"
                      leave-to-class="opacity-0"
                    >
                      <ListboxOptions
                        class="absolute left-0 right-0 z-30 mt-1.5 max-h-56 overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black/10 focus:outline-none dark:bg-gray-800 dark:ring-white/10"
                      >
                        <ListboxOption
                          v-for="idty in sendIdentities"
                          :key="idty.id"
                          :value="idty.id"
                          as="template"
                          v-slot="{ active, selected }"
                        >
                          <li
                            class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                            :class="active
                              ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-100'
                              : 'text-neutral-900 dark:text-gray-100'"
                          >
                            <span
                              class="block truncate"
                              :class="selected ? 'font-semibold' : 'font-normal'"
                            >
                              {{ identityOptionLabel(idty) }}
                            </span>
                            <span
                              v-if="selected"
                              class="absolute inset-y-0 right-0 flex items-center pr-2.5 text-indigo-600 dark:text-indigo-300"
                            >
                              <CheckIcon class="size-4" aria-hidden="true" />
                            </span>
                          </li>
                        </ListboxOption>
                      </ListboxOptions>
                    </Transition>
                  </Listbox>
                  <span
                    v-else
                    class="min-w-0 flex-1 truncate rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {{ fromDisplayLine || (composePreviewLoading ? '…' : '—') }}
                  </span>
                </div>
                <div
                  v-if="needsSmtpSetup"
                  class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-800 dark:bg-amber-950/40"
                >
                  <p class="flex-1 text-[11px] text-amber-900 dark:text-amber-100">
                    {{ t('inbox.emailComposeNeedsSmtpCta') }}
                  </p>
                  <button
                    type="button"
                    class="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                    @click="openSmtpSetupFromCompose"
                  >
                    {{ t('inbox.emailComposeConnectEmail') }}
                  </button>
                </div>
                <div
                  v-else-if="needsOrgDomain"
                  class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  {{ t('inbox.emailComposeNeedsOrgCta') }}
                  <RouterLink
                    to="/settings?tab=integrations"
                    class="ml-1 font-semibold text-emerald-700 underline dark:text-emerald-400"
                  >
                    {{ t('inbox.emailComposeOpenIntegrations') }}
                  </RouterLink>
                </div>
                <p
                  v-else-if="!fromDisplayLine && sendingMailboxHint"
                  class="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300"
                >
                  {{ sendingMailboxHint }}
                </p>
              </div>

              <!-- To -->
              <div
                class="border-b px-3.5 py-2 dark:border-gray-800"
                :class="recipientFieldHint
                  ? 'border-red-300 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20'
                  : 'border-neutral-100'"
              >
                <div class="flex items-start gap-2.5">
                  <label class="mt-1.5 w-10 shrink-0 text-xs font-medium text-neutral-500 dark:text-gray-400">
                    {{ t('inbox.emailComposeLabelTo') }}
                  </label>
                  <div
                    class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-0.5"
                    @click="focusRecipientInput('to')"
                  >
                    <span
                      v-for="(token, idx) in toTokens"
                      :key="`to-${idx}-${token}`"
                      class="inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-100 py-1 pl-3 pr-1 text-sm text-neutral-800 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <span class="truncate">{{ chipLabelForToken(token) }}</span>
                      <button
                        type="button"
                        class="rounded-full p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 dark:hover:bg-gray-600"
                        :aria-label="t('inbox.emailDockedReplyRemoveRecipient')"
                        @click.stop="removeRecipientToken('to', idx)"
                      >
                        <XMarkIcon class="h-3.5 w-3.5" />
                      </button>
                    </span>
                    <input
                      ref="toInputRef"
                      v-model="toInputDraft"
                      type="text"
                      autocomplete="email"
                      spellcheck="false"
                      class="min-w-[7rem] flex-1 border-0 bg-transparent py-1 text-sm outline-none focus:ring-0"
                      :class="recipientFieldHint
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-neutral-900 dark:text-white'"
                      :placeholder="toTokens.length ? '' : t('inbox.emailComposeRecipientsPlaceholder')"
                      :aria-invalid="Boolean(recipientFieldHint)"
                      :aria-describedby="recipientFieldHint ? 'compose-to-hint' : undefined"
                      @keydown="onRecipientKeydown('to', $event)"
                      @blur="onToBlur"
                    />
                  </div>
                  <div v-if="!showCc || !showBcc" class="flex shrink-0 gap-2.5 pt-1.5 text-xs font-medium">
                    <button
                      v-if="!showCc"
                      type="button"
                      class="text-neutral-500 hover:text-indigo-700 dark:hover:text-indigo-400"
                      @click="enableCc"
                    >
                      {{ t('inbox.emailComposeLabelCc') }}
                    </button>
                    <button
                      v-if="!showBcc"
                      type="button"
                      class="text-neutral-500 hover:text-indigo-700 dark:hover:text-indigo-400"
                      @click="enableBcc"
                    >
                      {{ t('inbox.emailComposeLabelBcc') }}
                    </button>
                  </div>
                </div>
                <p
                  v-if="recipientFieldHint"
                  id="compose-to-hint"
                  class="mt-1 pl-12 text-xs text-red-600 dark:text-red-400"
                  role="alert"
                >
                  {{ recipientFieldHint }}
                </p>
              </div>

              <div
                v-if="showCc"
                class="flex items-start gap-2.5 border-b border-neutral-100 px-3.5 py-2 dark:border-gray-800"
              >
                <label class="mt-1.5 w-10 shrink-0 text-xs font-medium text-neutral-500 dark:text-gray-400">
                  {{ t('inbox.emailComposeLabelCc') }}
                </label>
                <div
                  class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-0.5"
                  @click="focusRecipientInput('cc')"
                >
                  <span
                    v-for="(token, idx) in ccTokens"
                    :key="`cc-${idx}-${token}`"
                    class="inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-100 py-1 pl-3 pr-1 text-sm text-neutral-800 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <span class="truncate">{{ chipLabelForToken(token) }}</span>
                    <button
                      type="button"
                      class="rounded-full p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 dark:hover:bg-gray-600"
                      :aria-label="t('inbox.emailDockedReplyRemoveRecipient')"
                      @click.stop="removeRecipientToken('cc', idx)"
                    >
                      <XMarkIcon class="h-3.5 w-3.5" />
                    </button>
                  </span>
                  <input
                    ref="ccInputRef"
                    v-model="ccInputDraft"
                    type="text"
                    class="min-w-[7rem] flex-1 border-0 bg-transparent py-1 text-sm text-neutral-900 outline-none focus:ring-0 dark:text-white"
                    :placeholder="ccTokens.length ? '' : t('inbox.emailComposeCcPlaceholder')"
                    @keydown="onRecipientKeydown('cc', $event)"
                    @blur="commitRecipientInput('cc')"
                  />
                </div>
              </div>

              <div
                v-if="showBcc"
                class="flex items-start gap-2.5 border-b border-neutral-100 px-3.5 py-2 dark:border-gray-800"
              >
                <label class="mt-1.5 w-10 shrink-0 text-xs font-medium text-neutral-500 dark:text-gray-400">
                  {{ t('inbox.emailComposeLabelBcc') }}
                </label>
                <div
                  class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-0.5"
                  @click="focusRecipientInput('bcc')"
                >
                  <span
                    v-for="(token, idx) in bccTokens"
                    :key="`bcc-${idx}-${token}`"
                    class="inline-flex max-w-full items-center gap-1 rounded-full bg-neutral-100 py-1 pl-3 pr-1 text-sm text-neutral-800 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <span class="truncate">{{ chipLabelForToken(token) }}</span>
                    <button
                      type="button"
                      class="rounded-full p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 dark:hover:bg-gray-600"
                      :aria-label="t('inbox.emailDockedReplyRemoveRecipient')"
                      @click.stop="removeRecipientToken('bcc', idx)"
                    >
                      <XMarkIcon class="h-3.5 w-3.5" />
                    </button>
                  </span>
                  <input
                    ref="bccInputRef"
                    v-model="bccInputDraft"
                    type="text"
                    class="min-w-[7rem] flex-1 border-0 bg-transparent py-1 text-sm text-neutral-900 outline-none focus:ring-0 dark:text-white"
                    :placeholder="bccTokens.length ? '' : t('inbox.emailComposeBccPlaceholder')"
                    @keydown="onRecipientKeydown('bcc', $event)"
                    @blur="commitRecipientInput('bcc')"
                  />
                </div>
              </div>

              <!-- Subject -->
              <div class="flex items-center gap-2.5 border-b border-neutral-100 px-3.5 py-2 dark:border-gray-800">
                <input
                  v-model="form.subject"
                  type="text"
                  required
                  class="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0 dark:text-white dark:placeholder:text-gray-500"
                  :placeholder="t('inbox.emailComposeDrawerSubject')"
                />
              </div>
            </div>

            <!-- Body fills remaining height; scrolls inside editor -->
            <div
              class="relative min-h-0 flex-1 cursor-text"
              @mousedown="onComposeBodyMouseDown"
            >
              <div class="absolute inset-0 flex flex-col px-1 pt-1 pb-0">
                <TaskDescriptionEditor
                  ref="bodyEditorRef"
                  v-model="form.body"
                  :placeholder="t('inbox.emailComposeBodyPlaceholder')"
                  :class="editorClasses"
                />
                <ul v-if="attachments.length" class="mt-1 shrink-0 space-y-1.5 px-2.5 pb-2">
                  <li
                    v-for="(att, idx) in attachments"
                    :key="idx"
                    class="inline-flex max-w-full items-center gap-2 rounded-lg border border-neutral-200/90 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <PaperClipIcon class="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                    <span class="min-w-0 truncate font-medium">{{ att.fileName }}</span>
                    <button
                      type="button"
                      class="shrink-0 rounded-md p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-red-600 dark:hover:bg-gray-700"
                      :title="t('inbox.emailComposeRemoveAttachment')"
                      :aria-label="t('inbox.emailComposeRemoveAttachment')"
                      @click="removeAttachment(idx)"
                    >
                      <XMarkIcon class="size-3.5" />
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Footer toolbar -->
            <div class="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1.5 border-t border-neutral-200/90 bg-neutral-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/40">
              <div class="relative isolate inline-flex h-9 shrink-0 items-stretch overflow-visible rounded-full bg-indigo-600 shadow-sm dark:bg-indigo-600">
                <button
                  type="submit"
                  class="inline-flex h-full items-center rounded-l-full px-4 pr-3.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-indigo-500"
                  :disabled="!sendEnabled"
                  :title="!sendEnabled && recipientFieldHint ? recipientFieldHint : undefined"
                >
                  {{ t('inbox.emailComposeDrawerSend') }}
                </button>
                <EmailScheduleSendPopover
                  class="h-full"
                  :disabled="!sendEnabled"
                  @schedule="onScheduleSend"
                />
              </div>
              <button
                type="button"
                class="rounded-full p-2 text-neutral-600 hover:bg-neutral-200/80 dark:text-gray-300 dark:hover:bg-gray-800"
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

              <!-- Follow-up reminder -->
              <div
                class="ml-0.5 flex min-w-0 flex-wrap items-center gap-1.5 rounded-full px-1 py-0.5 text-xs transition-colors"
                :class="reminderEnabled
                  ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200'
                  : 'text-neutral-600 dark:text-gray-300'"
              >
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 font-medium hover:bg-neutral-200/70 dark:hover:bg-gray-800"
                  :class="reminderEnabled ? 'hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40' : ''"
                  :aria-pressed="reminderEnabled"
                  :aria-label="t('inbox.emailComposeReminderLabel')"
                  @click="setReminderEnabled(!reminderEnabled)"
                >
                  <BellIcon class="size-4 shrink-0" aria-hidden="true" />
                  <span class="whitespace-nowrap">
                    {{ reminderEnabled ? t('inbox.emailComposeReminderIn') : t('inbox.emailComposeReminderLabel') }}
                  </span>
                </button>
                <template v-if="reminderEnabled">
                  <input
                    ref="reminderDaysInputRef"
                    :value="reminderDays"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    maxlength="3"
                    class="w-10 rounded-md border border-indigo-200 bg-white px-1.5 py-0.5 text-center text-xs font-medium tabular-nums text-neutral-900 outline-none ring-indigo-500 focus:ring-2 dark:border-indigo-800 dark:bg-gray-800 dark:text-white"
                    :aria-label="t('inbox.emailComposeReminderDaysAria')"
                    @input="onReminderDaysInput"
                  />
                  <span class="pr-1.5 text-neutral-500 dark:text-gray-400">{{ t('inbox.emailComposeReminderDays') }}</span>
                  <span
                    v-if="reminderDateHint"
                    class="hidden truncate pr-1.5 text-[11px] text-neutral-500 sm:inline dark:text-gray-400"
                    :title="reminderDateHint"
                  >
                    · {{ reminderDateHint }}
                  </span>
                </template>
              </div>

              <div class="flex-1" />
              <button
                type="button"
                class="rounded-full p-2 text-neutral-500 hover:bg-neutral-200/80 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-red-400"
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
import { ref, watch, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import {
  XMarkIcon,
  MinusIcon,
  ChevronUpIcon,
  ChevronUpDownIcon,
  CheckIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  PaperClipIcon,
  TrashIcon,
  BellIcon
} from '@heroicons/vue/24/outline';
import TaskDescriptionEditor from '@/components/record-page/TaskDescriptionEditor.vue';
import EmailScheduleSendPopover from '@/components/communications/EmailScheduleSendPopover.vue';
import { useEmailComposeForm } from '@/composables/useEmailComposeForm';
import { useSmtpSetupWizard } from '@/composables/useSmtpSetupWizard';
import {
  splitRecipientField,
  joinRecipientField,
  chipLabelForToken,
  extractEmailFromToken
} from '@/utils/emailRecipientField';
import { RouterLink } from 'vue-router';

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
const { openSmtpSetupWizard, smtpWizardOpen } = useSmtpSetupWizard();

const windowState = ref('normal'); // 'normal' | 'minimized' | 'maximized'
const composeRootRef = ref(null);
const bodyEditorRef = ref(null);

const toInputDraft = ref('');
const ccInputDraft = ref('');
const bccInputDraft = ref('');
const toInputRef = ref(null);
const ccInputRef = ref(null);
const bccInputRef = ref(null);

function onComposeBodyMouseDown(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('button, input, textarea, select, a, label, [data-tippy-root], .tippy-box')) {
    return;
  }
  // Let ProseMirror place the caret when clicking existing content
  if (target.closest('.ProseMirror')) return;
  event.preventDefault();
  bodyEditorRef.value?.focus?.();
}

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
  needsSmtpSetup,
  needsOrgDomain,
  sendIdentities,
  selectedFromId,
  hasFromPicker,
  identityOptionLabel,
  selectFromIdentity,
  composePreviewLoading,
  recipientFieldHint,
  markRecipientHint,
  canSend,
  loadComposePreview,
  isReply,
  close,
  handleFileSelect,
  removeAttachment,
  handleSend
} = useEmailComposeForm(props, emit);

const toTokens = computed(() => splitRecipientField(form.value.to));
const ccTokens = computed(() => splitRecipientField(form.value.cc));
const bccTokens = computed(() => splitRecipientField(form.value.bcc));

const draftRefByField = {
  to: toInputDraft,
  cc: ccInputDraft,
  bcc: bccInputDraft
};

const inputRefByField = {
  to: toInputRef,
  cc: ccInputRef,
  bcc: bccInputRef
};

function focusRecipientInput(field) {
  inputRefByField[field]?.value?.focus?.();
}

function removeRecipientToken(field, index) {
  const tokens = splitRecipientField(form.value[field]);
  tokens.splice(index, 1);
  form.value[field] = joinRecipientField(tokens);
}

function dedupeRecipientField(field) {
  const tokens = splitRecipientField(form.value[field]);
  const seen = new Set();
  const unique = [];
  for (const tok of tokens) {
    const email = extractEmailFromToken(tok);
    if (email && seen.has(email)) continue;
    if (email) seen.add(email);
    unique.push(tok);
  }
  form.value[field] = joinRecipientField(unique);
}

function commitRecipientInput(field) {
  const draft = String(draftRefByField[field].value || '').trim();
  if (draft) {
    const existing = splitRecipientField(form.value[field]);
    const additions = splitRecipientField(draft);
    const seen = new Set(
      existing.map((tok) => extractEmailFromToken(tok)).filter(Boolean)
    );
    const merged = [...existing];
    for (const tok of additions) {
      const email = extractEmailFromToken(tok);
      if (email && seen.has(email)) continue;
      if (email) seen.add(email);
      merged.push(tok);
    }
    form.value[field] = joinRecipientField(merged);
    draftRefByField[field].value = '';
  }
  dedupeRecipientField(field);
}

function onRecipientKeydown(field, event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    commitRecipientInput(field);
  }
  if (event.key === 'Backspace' && !draftRefByField[field].value) {
    const tokens = splitRecipientField(form.value[field]);
    if (tokens.length) removeRecipientToken(field, tokens.length - 1);
  }
}

function onToBlur() {
  commitRecipientInput('to');
  markRecipientHint();
}

function enableCc() {
  showCc.value = true;
  nextTick(() => focusRecipientInput('cc'));
}

function enableBcc() {
  showBcc.value = true;
  nextTick(() => focusRecipientInput('bcc'));
}

function commitAllRecipientDrafts() {
  commitRecipientInput('to');
  commitRecipientInput('cc');
  commitRecipientInput('bcc');
}

function submitNow() {
  commitAllRecipientDrafts();
  handleSend();
}

/** Enable Send while a To draft is typed but not yet committed to a chip. */
const sendEnabled = computed(() => {
  if (canSend.value) return true;
  if (needsSmtpSetup.value || needsOrgDomain.value) return false;
  if (!String(form.value.subject || '').trim()) return false;
  const pending = String(toInputDraft.value || '').trim();
  if (!pending) return false;
  return splitRecipientField(pending).length > 0;
});

const selectedFromLabel = computed(() => {
  const id = selectedFromId.value;
  const match = sendIdentities.value.find((i) => i.id === id);
  if (match) return identityOptionLabel(match);
  return fromDisplayLine.value || (composePreviewLoading.value ? '…' : '—');
});

function openSmtpSetupFromCompose() {
  const selected = sendIdentities.value.find((i) => i.id === selectedFromId.value);
  // Keep compose out of the way while the wizard is the primary surface
  if (windowState.value !== 'minimized') {
    setWindowState('minimized');
  }
  openSmtpSetupWizard({
    mailboxId: selected?.mailboxId || props.sendingMailbox?.id || '',
    email: selected?.emailAddress || props.sendingMailbox?.emailAddress || '',
    reason: 'compose',
    onConnected: () => {
      setWindowState('normal');
      void loadComposePreview();
    }
  });
}

watch(smtpWizardOpen, (open, wasOpen) => {
  // Restore compose when wizard is dismissed without connecting
  if (wasOpen && !open && props.isOpen && windowState.value === 'minimized') {
    setWindowState('normal');
  }
});

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
  commitAllRecipientDrafts();
  handleSend({ scheduledAt: iso });
}

const editorClasses = computed(() => [
  'compose-body-editor h-full min-h-0 flex-1 !flex !flex-col overflow-hidden',
  '!rounded-none !border-0 !outline-none focus-within:!outline-none',
  '[&_.tiptap]:!min-h-full [&_.tiptap]:h-full [&_.tiptap]:flex-1 [&_.tiptap]:overflow-y-auto',
  '[&_.tiptap]:!px-3 [&_.tiptap]:!py-2.5 [&_.tiptap]:arivu-scrollbar',
  '[&_.ProseMirror]:text-sm [&_.ProseMirror]:!min-h-full [&_.ProseMirror]:leading-relaxed'
].join(' '));

const panelClasses = computed(() => {
  if (windowState.value === 'maximized') {
    return [
      'absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
      'flex flex-col overflow-hidden',
      'w-[min(98vw,1600px)] h-[min(96dvh,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1.5rem)] rounded-xl'
    ];
  }
  if (windowState.value === 'minimized') {
    return [
      'fixed z-10 right-4 bottom-0 sm:right-6',
      'w-[min(100vw-2rem,520px)] rounded-t-xl'
    ];
  }
  return [
    'fixed z-10 right-4 bottom-0 sm:right-6',
    'flex flex-col overflow-hidden',
    'w-[min(100vw-2rem,520px)] h-[min(72vh,600px)] max-h-[min(72vh,600px)] rounded-t-xl'
  ];
});

watch(() => props.isOpen, (open) => {
  if (open) {
    windowState.value = 'normal';
    toInputDraft.value = '';
    ccInputDraft.value = '';
    bccInputDraft.value = '';
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
.compose-body-editor :deep(.tiptap),
.compose-body-editor :deep(.ProseMirror) {
  min-height: 100% !important;
  height: 100%;
}

.compose-body-editor.task-description-editor {
  border: none !important;
  outline: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

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
