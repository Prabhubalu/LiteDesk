<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[10100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smtp-wizard-title"
      @click.self="onCancel"
    >
      <div
        class="relative flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        @click.stop
      >
        <div class="border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6">
          <div class="flex items-start gap-3">
            <button
              v-if="step > 0"
              type="button"
              class="mt-0.5 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="t('actions.back')"
              @click="goBack"
            >
              <ArrowLeftIcon class="h-5 w-5" />
            </button>
            <div class="min-w-0 flex-1">
              <h2 id="smtp-wizard-title" class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ stepTitle }}
              </h2>
              <p class="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {{ stepSubtitle }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="t('actions.close')"
              @click="onCancel"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div class="mt-4 flex items-center gap-2" role="list" :aria-label="t('inbox.smtpWizardSteps')">
            <span
              v-for="(label, idx) in stepLabels"
              :key="label"
              class="flex items-center gap-2 text-[11px] font-medium"
              role="listitem"
            >
              <span
                class="flex h-6 w-6 items-center justify-center rounded-full"
                :class="step >= idx
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'"
              >{{ idx + 1 }}</span>
              <span
                class="hidden sm:inline"
                :class="step >= idx ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
              >{{ label }}</span>
              <span
                v-if="idx < stepLabels.length - 1"
                class="mx-1 h-px w-4 bg-gray-200 dark:bg-gray-700 sm:w-6"
                aria-hidden="true"
              />
            </span>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <!-- Step 1: email -->
          <template v-if="step === 0">
            <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">
              {{ t('inbox.smtpWizardEmailLabel') }}
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                :placeholder="t('inbox.smtpWizardEmailPlaceholder')"
                :aria-invalid="emailTouched && !emailValid"
                @blur="emailTouched = true"
              >
            </label>
            <p v-if="emailTouched && !emailValid" class="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {{ t('validation.emailInvalid') }}
            </p>
          </template>

          <!-- Step 2: credentials -->
          <template v-else-if="step === 1">
            <div
              class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
            >
              {{ t('inbox.smtpWizardDetected', { provider: providerLabel }) }}
            </div>

            <ol
              v-if="provider !== 'custom'"
              class="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-gray-700 dark:text-gray-300"
            >
              <li>{{ t(`inbox.smtpWizardInstr${providerKey}1`) }}</li>
              <li>{{ t(`inbox.smtpWizardInstr${providerKey}2`) }}</li>
              <li>{{ t(`inbox.smtpWizardInstr${providerKey}3`) }}</li>
            </ol>

            <div v-if="helpLinks" class="mb-4 flex flex-wrap gap-2">
              <a
                v-if="helpLinks.appPassword"
                :href="helpLinks.appPassword"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {{ t('inbox.smtpWizardOpenAppPassword') }}
              </a>
              <a
                v-if="helpLinks.security"
                :href="helpLinks.security"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {{ t('inbox.smtpWizardOpenSecurity') }}
              </a>
            </div>

            <template v-if="provider === 'custom'">
              <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ t('inbox.smtpWizardHost') }}
                <input
                  v-model="customHost"
                  type="text"
                  class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  placeholder="smtp.example.com"
                >
              </label>
              <div class="mt-3 grid grid-cols-2 gap-3">
                <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">
                  {{ t('inbox.smtpWizardPort') }}
                  <input
                    v-model.number="customPort"
                    type="number"
                    class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  >
                </label>
                <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">
                  {{ t('inbox.smtpWizardEncryption') }}
                  <select
                    v-model="customSecure"
                    class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  >
                    <option :value="false">{{ t('inbox.smtpWizardStarttls') }}</option>
                    <option :value="true">{{ t('inbox.smtpWizardSsl') }}</option>
                  </select>
                </label>
              </div>
            </template>

            <label class="mt-4 block text-sm font-medium text-gray-800 dark:text-gray-200">
              {{ provider === 'custom' ? t('inbox.smtpWizardPassword') : t('inbox.smtpWizardAppPassword') }}
              <input
                v-model="password"
                type="password"
                autocomplete="new-password"
                class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                :placeholder="t('inbox.smtpWizardAppPasswordPlaceholder')"
              >
            </label>
          </template>

          <!-- Step 3: test -->
          <template v-else-if="step === 2">
            <div v-if="testing" class="space-y-3 py-6 text-center" aria-live="polite">
              <div class="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('inbox.smtpWizardTesting') }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ testPhaseLabel }}</p>
            </div>
            <div v-else-if="testOk" class="space-y-3 py-4 text-center" role="status">
              <CheckCircleIcon class="mx-auto h-12 w-12 text-emerald-600" />
              <p class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('inbox.smtpWizardTestSuccess') }}
              </p>
            </div>
            <div v-else class="space-y-3 py-4" role="alert">
              <p class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('inbox.smtpWizardTestFailedTitle') }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ friendlyError }}</p>
              <ul class="list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
                <li>{{ t('inbox.smtpWizardHintPassword') }}</li>
                <li>{{ t('inbox.smtpWizardHint2fa') }}</li>
                <li>{{ t('inbox.smtpWizardHintAppPassword') }}</li>
              </ul>
            </div>
          </template>

          <!-- Step 4: confirm -->
          <template v-else>
            <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
              {{ t('inbox.smtpWizardConfirmBody', { email }) }}
            </p>
            <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">
              {{ t('inbox.smtpWizardDisplayName') }}
              <input
                v-model="displayName"
                type="text"
                class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              >
            </label>
            <label class="mt-4 flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
              <input v-model="useAsDefault" type="checkbox" class="mt-1 rounded border-gray-300">
              <span>{{ t('inbox.smtpWizardUseAsDefault') }}</span>
            </label>
          </template>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            @click="onCancel"
          >
            {{ t('actions.cancel') }}
          </button>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="step === 0"
              type="button"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              :disabled="!emailValid"
              @click="goToCredentials"
            >
              {{ t('actions.next') }}
            </button>
            <button
              v-else-if="step === 1"
              type="button"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              :disabled="!canContinueCredentials"
              @click="startTest"
            >
              {{ t('actions.next') }}
            </button>
            <button
              v-else-if="step === 2 && !testing && !testOk"
              type="button"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              @click="startTest"
            >
              {{ t('inbox.smtpWizardRetry') }}
            </button>
            <button
              v-else-if="step === 2 && testOk"
              type="button"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              @click="step = 3"
            >
              {{ t('actions.next') }}
            </button>
            <button
              v-else-if="step === 3"
              type="button"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              :disabled="saving"
              @click="finish"
            >
              {{ saving ? t('states.saving') : t('inbox.smtpWizardFinish') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowLeftIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useMailboxConnection } from '@/composables/useMailboxConnection';
import { useNotifications } from '@/composables/useNotifications';
import {
  detectSmtpProvider,
  resolveSmtpPreset,
  SMTP_PRESETS,
  SMTP_PROVIDER_HELP_LINKS,
  isValidEmailFormat
} from '@/utils/smtpProviderPresets';
import {
  captureSmtpWizardStarted,
  captureSmtpProviderDetected,
  captureSmtpConnectionTestStarted,
  captureSmtpConnectionSuccess,
  captureSmtpConnectionFailure,
  captureSmtpWizardCompleted,
  captureSmtpWizardDropOff
} from '@/config/posthogSmtp';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mailboxId: { type: String, default: '' },
  initialEmail: { type: String, default: '' },
  reason: { type: String, default: 'compose' }
});

const emit = defineEmits(['update:modelValue', 'connected']);

const { t } = useI18n();
const notifications = useNotifications();
const { ensurePersonalMailbox, refreshMailboxes } = useMailboxConnection();

const step = ref(0);
const email = ref('');
const emailTouched = ref(false);
const password = ref('');
const provider = ref('custom');
const customHost = ref('');
const customPort = ref(587);
const customSecure = ref(false);
const displayName = ref('');
const useAsDefault = ref(true);
const testing = ref(false);
const testOk = ref(false);
const testStatus = ref('');
const testError = ref('');
const testPhase = ref(0);
const saving = ref(false);
const startedAt = ref(0);
const resolvedMailboxId = ref('');

const stepLabels = computed(() => [
  t('inbox.smtpWizardStepEmail'),
  t('inbox.smtpWizardStepConnect'),
  t('inbox.smtpWizardStepTest'),
  t('inbox.smtpWizardStepDone')
]);

const emailValid = computed(() => isValidEmailFormat(email.value));

const providerLabel = computed(() => {
  const p = SMTP_PRESETS[provider.value];
  return p?.label || t('inbox.smtpWizardCustomProvider');
});

const providerKey = computed(() => {
  const map = {
    gmail: 'Gmail',
    outlook: 'Outlook',
    yahoo: 'Yahoo',
    zoho: 'Zoho',
    icloud: 'Icloud'
  };
  return map[provider.value] || 'Custom';
});

const helpLinks = computed(() => SMTP_PROVIDER_HELP_LINKS[provider.value] || null);

const canContinueCredentials = computed(() => {
  if (!password.value || password.value.replace(/\s/g, '').length < 8) return false;
  if (provider.value === 'custom' && !String(customHost.value || '').trim()) return false;
  return true;
});

const stepTitle = computed(() => {
  if (step.value === 0) return t('inbox.smtpWizardTitleConnect');
  if (step.value === 1) return t('inbox.smtpWizardTitleCredentials');
  if (step.value === 2) return t('inbox.smtpWizardTitleTest');
  return t('inbox.smtpWizardTitleDone');
});

const stepSubtitle = computed(() => {
  if (step.value === 0) return t('inbox.smtpWizardSubtitleConnect');
  if (step.value === 1) return t('inbox.smtpWizardSubtitleCredentials');
  if (step.value === 2) return t('inbox.smtpWizardSubtitleTest');
  return t('inbox.smtpWizardSubtitleDone');
});

const testPhaseLabel = computed(() => {
  const phases = [
    t('inbox.smtpWizardPhaseResolve'),
    t('inbox.smtpWizardPhaseConnect'),
    t('inbox.smtpWizardPhaseTls'),
    t('inbox.smtpWizardPhaseAuth')
  ];
  return phases[Math.min(testPhase.value, phases.length - 1)];
});

const friendlyError = computed(() => {
  const s = String(testStatus.value || '');
  if (s === 'INVALID_CREDENTIALS' || s === 'AUTH_REQUIRED') {
    return t('inbox.smtpWizardErrAuth');
  }
  if (s === 'TLS_ERROR') return t('inbox.smtpWizardErrTls');
  if (s === 'HOST_NOT_FOUND') return t('inbox.smtpWizardErrHost');
  if (s === 'TIMEOUT' || s === 'NETWORK_ERROR') return t('inbox.smtpWizardErrNetwork');
  return testError.value || t('inbox.smtpWizardErrUnknown');
});

function resetState() {
  step.value = 0;
  email.value = String(props.initialEmail || '').trim();
  emailTouched.value = false;
  password.value = '';
  provider.value = detectSmtpProvider(email.value);
  const preset = resolveSmtpPreset(provider.value);
  customHost.value = preset.host;
  customPort.value = preset.port;
  customSecure.value = preset.secure;
  displayName.value = '';
  useAsDefault.value = true;
  testing.value = false;
  testOk.value = false;
  testStatus.value = '';
  testError.value = '';
  testPhase.value = 0;
  saving.value = false;
  resolvedMailboxId.value = String(props.mailboxId || '');
  startedAt.value = Date.now();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      resetState();
      captureSmtpWizardStarted({ reason: props.reason });
    }
  }
);

function close() {
  emit('update:modelValue', false);
}

function onCancel() {
  captureSmtpWizardDropOff({
    reason: props.reason,
    step: step.value,
    provider: provider.value
  });
  close();
}

function goBack() {
  if (step.value === 2) {
    testOk.value = false;
    testing.value = false;
  }
  if (step.value > 0) step.value -= 1;
}

function goToCredentials() {
  emailTouched.value = true;
  if (!emailValid.value) return;
  provider.value = detectSmtpProvider(email.value);
  const preset = resolveSmtpPreset(provider.value);
  if (provider.value !== 'custom') {
    customHost.value = preset.host;
    customPort.value = preset.port;
    customSecure.value = preset.secure;
  }
  captureSmtpProviderDetected({ provider: provider.value });
  if (!displayName.value) {
    displayName.value = email.value.split('@')[0] || '';
  }
  step.value = 1;
}

async function ensureMailbox() {
  if (resolvedMailboxId.value) return resolvedMailboxId.value;
  const mb = await ensurePersonalMailbox({
    label: displayName.value || email.value.split('@')[0] || 'My mailbox',
    emailAddress: email.value
  });
  if (!mb?.id) throw new Error('mailbox_create_failed');
  resolvedMailboxId.value = String(mb.id);
  return resolvedMailboxId.value;
}

async function startTest() {
  testing.value = true;
  testOk.value = false;
  testError.value = '';
  testStatus.value = '';
  testPhase.value = 0;
  step.value = 2;
  captureSmtpConnectionTestStarted({ provider: provider.value });

  const phaseTimer = setInterval(() => {
    if (testPhase.value < 3) testPhase.value += 1;
  }, 700);

  try {
    const body = {
      emailAddress: email.value.trim().toLowerCase(),
      password: password.value,
      provider: provider.value,
      smtpHost: provider.value === 'custom' ? customHost.value : undefined,
      smtpPort: provider.value === 'custom' ? customPort.value : undefined,
      smtpSecure: provider.value === 'custom' ? customSecure.value === true : undefined
    };
    const data = await apiClient.post('/mailboxes/outbound/smtp/verify', body);
    clearInterval(phaseTimer);
    testPhase.value = 3;
    if (data?.success || data?.status === 'CONNECTED') {
      testOk.value = true;
      testStatus.value = 'CONNECTED';
      captureSmtpConnectionSuccess({ provider: provider.value });
    } else {
      testOk.value = false;
      testStatus.value = data?.status || data?.code || 'UNKNOWN';
      testError.value = data?.message || '';
      captureSmtpConnectionFailure({ provider: provider.value, status: testStatus.value });
    }
  } catch (err) {
    clearInterval(phaseTimer);
    testOk.value = false;
    testStatus.value = err?.response?.data?.status || err?.response?.data?.code || 'UNKNOWN';
    testError.value = err?.response?.data?.message || err?.message || '';
    captureSmtpConnectionFailure({ provider: provider.value, status: testStatus.value });
  } finally {
    testing.value = false;
  }
}

async function finish() {
  if (!testOk.value) return;
  saving.value = true;
  try {
    const mailboxId = await ensureMailbox();
    const body = {
      emailAddress: email.value.trim().toLowerCase(),
      password: password.value,
      provider: provider.value,
      displayName: displayName.value || undefined,
      smtpHost: provider.value === 'custom' ? customHost.value : undefined,
      smtpPort: provider.value === 'custom' ? customPort.value : undefined,
      smtpSecure: provider.value === 'custom' ? customSecure.value === true : undefined
    };
    const data = await apiClient.post(`/mailboxes/${mailboxId}/outbound/smtp/connect`, body);
    if (!data?.success) {
      throw new Error(data?.message || 'connect_failed');
    }
    if (useAsDefault.value && mailboxId) {
      try {
        await apiClient.put('/communications/email/default-outbound-mailbox', {
          mailboxId
        });
      } catch {
        /* non-blocking */
      }
    }
    await refreshMailboxes();
    const elapsedMs = Date.now() - startedAt.value;
    captureSmtpWizardCompleted({
      provider: provider.value,
      reason: props.reason,
      elapsedMs
    });
    notifications.success(t('inbox.smtpWizardSavedToast'));
    emit('connected', data?.data?.mailbox || { id: mailboxId, emailAddress: email.value });
    close();
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || t('inbox.smtpWizardSaveFailed'));
  } finally {
    saving.value = false;
  }
}
</script>
