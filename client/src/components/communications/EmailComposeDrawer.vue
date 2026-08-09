<template>
  <Teleport to="body">
    <Transition name="email-compose-drawer">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[10000] flex justify-end overflow-x-hidden"
        @keydown.esc.prevent="close"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 z-0 bg-black/40 backdrop-blur-sm"
          @click="close"
          aria-hidden="true"
        />

        <!-- Drawer panel -->
        <aside
          class="rounded-tl-xl overflow-hidden relative z-10 w-full sm:w-[36rem] max-w-[95vw] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col max-h-screen"
          role="dialog"
          aria-modal="true"
          :aria-label="t('inbox.emailComposeDrawerSendEmail2')"
        >
          <!-- Header: matches CreateRecordDrawer / TaskEditDrawer -->
          <div class="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-6 sm:px-6">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{{ t('inbox.emailComposeDrawerSendEmail') }}</h2>
              <button
                type="button"
                @click="close"
                class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer"
                :aria-label="t('settings.roleDrawerCloseSr')"
              >
                <span class="absolute -inset-2.5" />
                <span class="sr-only">{{ t('forms.previewClosePanelSr') }}</span>
                <XMarkIcon class="size-6" aria-hidden="true" />
              </button>
            </div>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              <template v-if="standaloneMode">{{ t('inbox.emailComposeDrawerSendFromYourWorkspaceRepliesRoute') }}</template>
              <template v-else>{{ t('inbox.emailComposeDrawerComposeAndSendAnEmailFrom') }}</template>
            </p>
          </div>

          <!-- Body -->
          <form @submit.prevent="handleSend" class="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
              <!-- Error -->
              <div
                v-if="error"
                class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300"
              >
                {{ error }}
              </div>

              <!-- From (identity picker) -->
              <div>
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('settings.helpdeskAnalyticsFrom') }}</label>
                <div class="relative mt-2">
                  <select
                    v-if="hasFromPicker"
                    class="block w-full appearance-none rounded-md bg-white dark:bg-gray-800 px-3 py-2 pr-9 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300 dark:outline-white/10 sm:text-sm/6 font-mono text-[13px]"
                    :value="selectedFromId"
                    :disabled="composePreviewLoading"
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
                  <input
                    v-else
                    :value="fromDisplayLine"
                    type="text"
                    readonly
                    class="block w-full rounded-md bg-gray-50 dark:bg-gray-800/80 px-3 py-2 text-gray-700 dark:text-gray-300 text-base outline-1 -outline-offset-1 outline-gray-300/20 sm:text-sm/6 dark:outline-white/10 cursor-default font-mono text-[13px]"
                    :placeholder="composePreviewLoading ? 'Loading…' : '—'"
                  >
                  <span
                    v-if="hasFromPicker"
                    class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-gray-400"
                    aria-hidden="true"
                  >
                    <svg class="size-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
                    </svg>
                  </span>
                </div>
                <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ fromSourceHint }}
                  <span v-if="sendingMailbox?.viaSmtp" class="text-gray-400 dark:text-gray-500"> · Gmail SMTP</span>
                </p>
                <div
                  v-if="needsSmtpSetup"
                  class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40"
                >
                  <p class="flex-1 text-xs text-amber-900 dark:text-amber-100">
                    {{ t('inbox.emailComposeNeedsSmtpCta') }}
                  </p>
                  <button
                    type="button"
                    class="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    @click="openSmtpSetupFromCompose"
                  >
                    {{ t('inbox.emailComposeConnectEmail') }}
                  </button>
                </div>
                <div
                  v-else-if="needsOrgDomain"
                  class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
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
                  v-if="!fromDisplayLine && sendingMailboxHint"
                  class="mt-1 text-xs text-amber-700 dark:text-amber-300"
                >
                  {{ sendingMailboxHint }}
                </p>
              </div>

              <!-- Reply-To (matches From) -->
              <div>
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('settings.integrationsReplyTo') }}</label>
                <input
                  :value="replyToDisplay"
                  type="text"
                  readonly
                  class="block w-full mt-2 rounded-md bg-gray-50 dark:bg-gray-800/80 px-3 py-2 text-gray-700 dark:text-gray-300 text-base outline-1 -outline-offset-1 outline-gray-300/20 sm:text-sm/6 dark:outline-white/10 cursor-default font-mono text-[13px]"
                  :placeholder="composePreviewLoading ? 'Loading…' : '—'"
                >
              </div>

              <!-- To (editable, pre-filled) -->
              <div>
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">To</label>
                <input
                  v-model="form.to"
                  type="email"
                  required
                  class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                  :placeholder="t('inbox.emailComposeDrawerRecipientExampleComCommaSeparatedFor')"
                />
              </div>

              <!-- Cc / Bcc toggle -->
              <div class="flex gap-3 text-sm">
                <button
                  type="button"
                  @click="showCc = !showCc"
                  class="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  {{ showCc ? '− Cc' : '+ Cc' }}
                </button>
                <button
                  type="button"
                  @click="showBcc = !showBcc"
                  class="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  {{ showBcc ? '− Bcc' : '+ Bcc' }}
                </button>
              </div>

              <!-- Cc (optional) -->
              <div v-if="showCc">
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">Cc</label>
                <input
                  v-model="form.cc"
                  type="text"
                  class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                  :placeholder="t('inbox.emailComposeDrawerCcExampleComCommaSeparated')"
                />
              </div>

              <!-- Bcc (optional) -->
              <div v-if="showBcc">
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">Bcc</label>
                <input
                  v-model="form.bcc"
                  type="text"
                  class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                  :placeholder="t('inbox.emailComposeDrawerBccExampleComCommaSeparated')"
                />
              </div>

              <!-- Subject -->
              <div>
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('inbox.emailComposeDrawerSubject') }}</label>
                <input
                  v-model="form.subject"
                  type="text"
                  required
                  class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                  :placeholder="t('inbox.emailComposeDrawerEmailSubject')"
                />
              </div>

              <!-- Template -->
              <div>
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsPbResourceTemplate') }}</label>
                <Listbox
                  :model-value="selectedTemplateId"
                  @update:model-value="handleTemplateChange"
                  as="div"
                  class="mt-2 relative"
                >
                  <ListboxButton
                    class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 cursor-default text-left relative"
                  >
                    <span :class="['block truncate', !selectedTemplateId && 'text-gray-500 dark:text-gray-400']">
                      {{ selectedTemplateId ? (templates.find((t) => t.id === selectedTemplateId)?.name ?? selectedTemplateId) : '— No template —' }}
                    </span>
                    <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                    </span>
                  </ListboxButton>
                  <Transition
                    leave-active-class="transition duration-100 ease-in"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                  >
                    <ListboxOptions
                      class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
                    >
                      <ListboxOption
                        :value="''"
                        v-slot="{ active, selected }"
                      >
                        <li
                          :class="[
                            'relative cursor-default select-none py-2 pl-4 pr-10',
                            active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                          ]"
                        >
                          <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">— No template —</span>
                          <span
                            v-if="selected"
                            class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                          >
                            <CheckIcon class="h-5 w-5" aria-hidden="true" />
                          </span>
                        </li>
                      </ListboxOption>
                      <ListboxOption
                        v-for="t in templates"
                        :key="t.id"
                        :value="t.id"
                        v-slot="{ active, selected }"
                      >
                        <li
                          :class="[
                            'relative cursor-default select-none py-2 pl-4 pr-10',
                            active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                          ]"
                        >
                          <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">{{ t.name }}</span>
                          <span
                            v-if="selected"
                            class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                          >
                            <CheckIcon class="h-5 w-5" aria-hidden="true" />
                          </span>
                        </li>
                      </ListboxOption>
                    </ListboxOptions>
                  </Transition>
                </Listbox>
              </div>

              <!-- Body (rich text) -->
              <div>
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('settings.modFieldsMessageLabel') }}</label>
                <div class="mt-2">
                  <TaskDescriptionEditor
                    v-model="form.body"
                    placeholder="Write your message... (type '/' for formatting)"
                    class="[&_.tiptap]:min-h-[160px]"
                  />
                </div>
              </div>

              <!-- Attachments -->
              <div>
                <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">{{ t('inbox.emailComposeDrawerAttachments') }}<span class="font-normal text-gray-500 dark:text-gray-400">(max 10MB per file, 25MB total)</span></label>
                <input
                  ref="fileInputRef"
                  type="file"
                  class="hidden"
                  multiple
                  @change="handleFileSelect"
                />
                <button
                  type="button"
                  @click="fileInputRef?.click()"
                  :disabled="uploading"
                  class="mt-2 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-900 dark:text-white rounded-md bg-gray-100 dark:bg-gray-700 outline-1 -outline-offset-1 outline-gray-300/20 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:outline-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {{ uploading ? 'Uploading...' : 'Attach file' }}
                </button>
                <ul v-if="attachments.length" class="mt-2 space-y-2">
                  <li
                    v-for="(att, idx) in attachments"
                    :key="idx"
                    class="flex items-center justify-between gap-2 py-1.5 px-3 bg-gray-100 dark:bg-gray-700/50 rounded-md text-sm text-gray-900 dark:text-gray-300"
                  >
                    <span class="truncate text-gray-700 dark:text-gray-300">{{ att.fileName }}</span>
                    <button
                      type="button"
                      @click="removeAttachment(idx)"
                      class="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                      :title="t('settings.assignRulesRemoveTitle')"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                type="button"
                @click="close"
                class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >{{ t('performance.cancelWizard') }}</button>
              <button
                type="submit"
                class="rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!canSendCompose"
              >{{ t('inbox.emailComposeDrawerSend') }}</button>
            </div>
          </form>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, watch, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import { ChevronUpDownIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import { uploadCommunicationAttachment } from '@/utils/communicationAttachments';
import TaskDescriptionEditor from '@/components/record-page/TaskDescriptionEditor.vue';
import { useSmtpSetupWizard } from '@/composables/useSmtpSetupWizard';
const props = defineProps({
  isOpen: { type: Boolean, default: false },
  /** When true, send with `standalone: true` (workspace-scoped); `relatedTo` is not required. */
  standaloneMode: { type: Boolean, default: false },
  relatedTo: {
    type: Object,
    default: null
  },
  initialTo: { type: String, default: '' },
  initialDraft: {
    type: Object,
    default: null
  },
  /** Connected mailbox used for provider send (Gmail API). */
  sendingMailbox: {
    type: Object,
    default: null
  },
  /** Shown when no mailbox is selected but provider send may be required. */
  sendingMailboxHint: {
    type: String,
    default: ''
  },
  /** Pre-resolved Reply-To (skips preview fetch when set). */
  initialReplyTo: {
    type: String,
    default: ''
  },
  /** Pre-resolved From email (optional). */
  initialFrom: {
    type: String,
    default: ''
  },
  initialFromName: {
    type: String,
    default: ''
  }
});

const { t } = useI18n();
const { openSmtpSetupWizard } = useSmtpSetupWizard();

const emit = defineEmits(['close', 'sent', 'submit']);

const authStore = useAuthStore();
const form = ref({
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  body: ''
});
const showCc = ref(false);
const showBcc = ref(false);
const templates = ref([]);
const selectedTemplateId = ref('');
const error = ref(null);
const attachments = ref([]);
const uploading = ref(false);
const fileInputRef = ref(null);
const fromEmailDisplay = ref('');
const fromNameDisplay = ref('');
const fromSource = ref('');
const replyToDisplay = ref('');
const replyToNote = ref('');
const composePreviewLoading = ref(false);
const sendIdentities = ref([]);
const selectedFromId = ref('');
const selectedMailboxId = ref('');
const payloadDeliveryMode = ref('');

const fromDisplayLine = computed(() => {
  const email = String(fromEmailDisplay.value || '').trim();
  const name = String(fromNameDisplay.value || '').trim();
  if (!email) return '';
  if (name) return `${name} <${email}>`;
  return email;
});

const hasFromPicker = computed(() => sendIdentities.value.length >= 1);

const deliveryMode = computed(() => {
  const selected = sendIdentities.value.find((i) => i.id === selectedFromId.value);
  if (selected?.deliveryMode) return selected.deliveryMode;
  return payloadDeliveryMode.value || '';
});
const needsSmtpSetup = computed(() => deliveryMode.value === 'needs_smtp_setup');
const needsOrgDomain = computed(() => deliveryMode.value === 'needs_org_domain');

function identityOptionLabel(identity) {
  if (!identity) return '';
  const email = String(identity.emailAddress || '').trim();
  const label = String(identity.label || '').trim();
  if (identity.source === 'tenant_config') {
    return label && label.toLowerCase() !== email.toLowerCase()
      ? `${label} <${email}>`
      : email;
  }
  if (label && email && label.toLowerCase() !== email.toLowerCase()) {
    return `${label} <${email}>`;
  }
  return email || label || '';
}

const fromSourceHint = computed(() => {
  const mode = deliveryMode.value;
  if (mode === 'needs_smtp_setup') return t('inbox.emailComposeFromHintNeedsSmtp');
  if (mode === 'needs_org_domain') return t('inbox.emailComposeFromHintNeedsOrg');
  if (fromSource.value === 'mailbox' || mode === 'mailbox_smtp') {
    return t('inbox.emailComposeFromHintMailbox');
  }
  if (fromSource.value === 'tenant_config' || mode === 'org_provider') {
    return t('inbox.emailComposeFromHintOrg');
  }
  if (fromSource.value === 'user') {
    return t('inbox.emailComposeFromHintUser');
  }
  return t('inbox.emailComposeFromHintPending');
});

const EMAIL_ADDRESS_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i;

function isValidEmailAddress(email) {
  const s = String(email || '').trim();
  if (!s || s.length > 254) return false;
  return EMAIL_ADDRESS_RE.test(s);
}

function parseEmails(s) {
  return (s || '')
    .split(/[,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && isValidEmailAddress(e));
}

function hasInvalidEmails(s) {
  const raw = String(s || '').trim();
  if (!raw) return false;
  return raw
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter(Boolean)
    .some((e) => !isValidEmailAddress(e));
}

const toRecipients = computed(() => parseEmails(form.value.to));
const canSendCompose = computed(
  () =>
    toRecipients.value.length > 0 &&
    Boolean(form.value.subject?.trim?.() || form.value.subject) &&
    !hasInvalidEmails(form.value.to) &&
    !hasInvalidEmails(form.value.cc) &&
    !hasInvalidEmails(form.value.bcc) &&
    !needsSmtpSetup.value &&
    !needsOrgDomain.value
);

watch(() => props.initialTo, (val) => {
  form.value.to = val || '';
}, { immediate: true });

async function loadTemplates() {
  try {
    const data = await apiClient.get('/communications/templates');
    if (data?.success && data?.data?.templates) {
      templates.value = data.data.templates;
    }
  } catch {
    templates.value = [];
  }
}

function applyTemplate() {
  const t = templates.value.find((x) => x.id === selectedTemplateId.value);
  if (t) {
    form.value.subject = t.subject || form.value.subject;
    form.value.body = t.body || '';
  }
}

function handleTemplateChange(v) {
  selectedTemplateId.value = v;
  applyTemplate();
}

async function loadComposePreview() {
  const presetFrom = String(props.initialFrom || props.initialDraft?.from || '').trim();
  const presetFromName = String(props.initialFromName || props.initialDraft?.fromName || '').trim();
  const presetReplyTo = String(props.initialReplyTo || props.initialDraft?.replyTo || '').trim();

  composePreviewLoading.value = true;
  replyToNote.value = '';
  try {
    const params = new URLSearchParams();
    if (props.standaloneMode) {
      params.set('standalone', 'true');
    } else if (props.relatedTo?.moduleKey && props.relatedTo?.recordId) {
      params.set('moduleKey', String(props.relatedTo.moduleKey));
      params.set('recordId', String(props.relatedTo.recordId));
    } else {
      fromEmailDisplay.value = presetFrom || String(props.sendingMailbox?.emailAddress || '').trim();
      fromNameDisplay.value = presetFromName || String(props.sendingMailbox?.label || '').trim();
      fromSource.value = fromEmailDisplay.value ? (props.sendingMailbox ? 'mailbox' : '') : '';
      if (props.sendingMailbox?.id && props.sendingMailbox.emailAddress) {
        sendIdentities.value = [{
          id: `mailbox:${props.sendingMailbox.id}`,
          mailboxId: String(props.sendingMailbox.id),
          emailAddress: props.sendingMailbox.emailAddress,
          label: props.sendingMailbox.label || props.sendingMailbox.emailAddress,
          source: 'mailbox',
          kind: 'personal',
          viaSmtp: Boolean(props.sendingMailbox.viaSmtp)
        }];
        selectedFromId.value = `mailbox:${props.sendingMailbox.id}`;
        selectedMailboxId.value = String(props.sendingMailbox.id);
      } else {
        sendIdentities.value = [];
        selectedFromId.value = '';
        selectedMailboxId.value = '';
      }
      replyToDisplay.value = fromEmailDisplay.value || presetReplyTo || '';
      replyToNote.value = '';
      composePreviewLoading.value = false;
      return;
    }
    const mbId = selectedMailboxId.value || props.sendingMailbox?.id || props.initialDraft?.mailboxId;
    if (mbId) params.set('mailboxId', String(mbId));

    const data = await apiClient.get(`/communications/email/compose-preview?${params.toString()}`);
    const payload = data?.data || {};
    const list = Array.isArray(payload.identities) ? payload.identities : [];
    sendIdentities.value = list;
    fromEmailDisplay.value = payload.fromEmail || presetFrom || '';
    fromNameDisplay.value = payload.fromName || presetFromName || '';
    fromSource.value = payload.fromSource || '';
    payloadDeliveryMode.value = payload.deliveryMode || '';
    selectedMailboxId.value = payload.mailboxId ? String(payload.mailboxId) : '';
    if (list.length) {
      const match =
        list.find((i) => payload.mailboxId && String(i.mailboxId || '') === String(payload.mailboxId))
        || list[0];
      selectedFromId.value = match?.id || '';
      if (match) {
        fromEmailDisplay.value = match.emailAddress || fromEmailDisplay.value;
        fromNameDisplay.value =
          match.fromName
          || (match.label && match.label !== match.emailAddress ? match.label : '')
          || (payload.fromName || '');
        fromSource.value = match.source || fromSource.value;
        selectedMailboxId.value = match.mailboxId ? String(match.mailboxId) : '';
      }
    } else {
      selectedFromId.value = '';
    }
    replyToDisplay.value = fromEmailDisplay.value || presetReplyTo || '';
    replyToNote.value = '';
  } catch {
    fromEmailDisplay.value = presetFrom || String(props.sendingMailbox?.emailAddress || '').trim();
    fromNameDisplay.value = presetFromName || String(props.sendingMailbox?.label || '').trim();
    replyToDisplay.value = fromEmailDisplay.value || presetReplyTo;
    replyToNote.value = '';
  } finally {
    composePreviewLoading.value = false;
  }
}

async function selectFromIdentity(identityId) {
  const identity = sendIdentities.value.find((i) => i.id === String(identityId || ''));
  if (!identity) return;
  selectedFromId.value = identity.id;
  selectedMailboxId.value = identity.mailboxId ? String(identity.mailboxId) : '';
  fromEmailDisplay.value = identity.emailAddress || '';
  if (identity.source === 'tenant_config') {
    fromNameDisplay.value =
      identity.fromName
      || (identity.label && identity.label !== identity.emailAddress ? identity.label : '')
      || '';
  } else if (identity.viaSmtp && identity.fromName) {
    fromNameDisplay.value = identity.fromName;
  } else if (identity.kind === 'group') {
    fromNameDisplay.value =
      identity.fromName
      || (identity.label && identity.label !== identity.emailAddress ? identity.label : '')
      || '';
  } else {
    fromNameDisplay.value = identity.fromName || '';
  }
  fromSource.value = identity.source || '';
  replyToDisplay.value = fromEmailDisplay.value || '';
  replyToNote.value = '';
  if (identity.mailboxId) {
    try {
      await apiClient.put('/communications/email/default-outbound-mailbox', {
        mailboxId: identity.mailboxId
      });
    } catch {
      /* non-blocking */
    }
  }
}

function openSmtpSetupFromCompose() {
  const selected = sendIdentities.value.find((i) => i.id === selectedFromId.value);
  openSmtpSetupWizard({
    mailboxId: selected?.mailboxId || props.sendingMailbox?.id || '',
    email: selected?.emailAddress || props.sendingMailbox?.emailAddress || fromEmailDisplay.value || '',
    reason: 'compose',
    onConnected: () => {
      void loadComposePreview();
    }
  });
}

watch(() => props.isOpen, (open) => {
  if (open) {
    form.value.to = props.initialDraft?.to || props.initialTo || '';
    form.value.cc = props.initialDraft?.cc || '';
    form.value.bcc = props.initialDraft?.bcc || '';
    form.value.subject = props.initialDraft?.subject || '';
    form.value.body = props.initialDraft?.body || '';
    error.value = null;
    attachments.value = [];
    showCc.value = Boolean((props.initialDraft?.cc || '').trim());
    showBcc.value = Boolean((props.initialDraft?.bcc || '').trim());
    selectedTemplateId.value = '';
    loadTemplates();
    void loadComposePreview();
  } else {
    fromEmailDisplay.value = '';
    fromNameDisplay.value = '';
    fromSource.value = '';
    replyToDisplay.value = '';
    replyToNote.value = '';
    sendIdentities.value = [];
    selectedFromId.value = '';
    selectedMailboxId.value = '';
  }
});

function close() {
  emit('close');
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total

async function handleFileSelect(event) {
  const files = event.target.files;
  if (!files?.length) return;
  let runningTotal = attachments.value.reduce((sum, a) => sum + (a.fileSize || 0), 0);
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      error.value = `"${file.name}" exceeds 10MB per-file limit`;
      event.target.value = '';
      return;
    }
    if (runningTotal + file.size > MAX_TOTAL_SIZE) {
      error.value = `Total attachments would exceed 25MB limit (${file.name} not added)`;
      event.target.value = '';
      return;
    }
    uploading.value = true;
    try {
      const result = await uploadCommunicationAttachment(file);
      const size = result.fileSize ?? file.size;
      attachments.value.push({
        fileName: result.fileName || file.name,
        fileType: result.fileType || file.type,
        fileSize: size,
        storagePath: result.storagePath
      });
      runningTotal += size;
    } catch (err) {
      error.value = err.message || 'Upload failed';
    } finally {
      uploading.value = false;
    }
  }
  event.target.value = '';
}

function removeAttachment(idx) {
  attachments.value.splice(idx, 1);
}

function handleSend() {
  const totalSize = attachments.value.reduce((sum, a) => sum + (a.fileSize || 0), 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    error.value = `Total attachment size exceeds 25MB limit`;
    return;
  }

  const toTokens = String(form.value.to || '')
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const invalid = toTokens.filter((e) => !isValidEmailAddress(e));
  if (invalid.length) {
    error.value = t('inbox.emailComposeInvalidRecipients', { list: invalid.slice(0, 3).join(', ') });
    return;
  }

  const toList = parseEmails(form.value.to);
  if (!toList.length) {
    error.value = t('inbox.emailComposeNeedValidRecipient');
    return;
  }

  if (props.standaloneMode) {
    const payload = {
      standalone: true,
      to: toList,
      cc: parseEmails(form.value.cc),
      bcc: parseEmails(form.value.bcc),
      subject: form.value.subject.trim(),
      body: form.value.body,
      attachments: attachments.value.length ? attachments.value : [],
      fromSource: fromSource.value || undefined,
      fromEmail: fromEmailDisplay.value || undefined,
      fromName: fromNameDisplay.value || undefined,
      ...(selectedMailboxId.value ? { mailboxId: selectedMailboxId.value } : {}),
      ...(props.initialDraft?.parentCommunicationId
        ? { parentCommunicationId: props.initialDraft.parentCommunicationId }
        : {})
    };
    emit('submit', payload);
    return;
  }

  if (!props.relatedTo?.moduleKey || !props.relatedTo?.recordId) {
    error.value = 'Invalid record context';
    return;
  }

  const payload = {
    relatedTo: props.relatedTo,
    to: toList,
    cc: parseEmails(form.value.cc),
    bcc: parseEmails(form.value.bcc),
    subject: form.value.subject.trim(),
    body: form.value.body,
    attachments: attachments.value.length ? attachments.value : [],
    fromSource: fromSource.value || undefined,
    fromEmail: fromEmailDisplay.value || undefined,
    fromName: fromNameDisplay.value || undefined,
    ...(selectedMailboxId.value ? { mailboxId: selectedMailboxId.value } : {}),
    ...(props.initialDraft?.parentCommunicationId
      ? { parentCommunicationId: props.initialDraft.parentCommunicationId }
      : {})
  };

  emit('submit', payload);
}
</script>

<style scoped>
.email-compose-drawer-enter-active aside {
  transition: transform 0.3s ease-out;
}

.email-compose-drawer-enter-from aside {
  transform: translateX(100%);
}

.email-compose-drawer-leave-active {
  transition: opacity 0.2s ease-out;
}

.email-compose-drawer-leave-active aside {
  transition: transform 0.25s ease-out;
}

.email-compose-drawer-leave-to {
  opacity: 0;
}

.email-compose-drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
