<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-inbox-title"
      @click.self="close"
    >
      <div
        class="relative flex max-h-[min(90vh,560px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        @click.stop
      >
        <div class="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 id="connect-inbox-title" class="text-lg font-semibold text-gray-900 dark:text-white">
              Connect {{ provider.name }}
            </h2>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ provider.integrationLabel }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            :aria-label="t('settings.roleDrawerCloseSr')"
            @click="close"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">{{ t('inbox.connectInboxWizardWorkEmailAddress') }}<span class="text-red-600 dark:text-red-400">*</span>
            <input
              v-model="emailHint"
              type="email"
              autocomplete="email"
              class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              :placeholder="provider.emailPlaceholder || 'you@company.com'"
            >
          </label>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-500">
            {{ provider.connectHint }}
          </p>
          <div
            class="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-xs leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
          >
            <p class="font-medium text-gray-900 dark:text-white">{{ t('inbox.connectInboxWizardBeforeYouApproveAccess') }}</p>
            <p class="mt-2">{{ t('inbox.connectInboxWizardGoogleMayShowAWarningFor') }}<span class="font-medium">{{ t('settings.settingsRelDrawerAdvanced') }}</span>{{ t('inbox.connectInboxWizardToProceedIfYouTrustThis') }}</p>
            <p class="mt-2 text-gray-600 dark:text-gray-400">{{ t('inbox.connectInboxWizardLitedeskUsesAReadOnlyGmail') }}</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            @click="close"
          >{{ t('performance.cancelWizard') }}</button>
          <button
            type="button"
            class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            :disabled="loading || !emailLooksValid"
            @click="submitConnect"
          >
            {{ loading ? 'Opening Google…' : `Continue with ${provider.name}` }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch } from 'vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { getInboxProvider } from '@/constants/inboxProviders';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  initialEmail: { type: String, default: '' },
  providerId: { type: String, default: 'google' }
});

const { t } = useI18n();

const emit = defineEmits(['update:modelValue', 'connect']);

const emailHint = ref('');

const provider = computed(() => getInboxProvider(props.providerId) || getInboxProvider('google'));

const emailLooksValid = computed(() => {
  const s = String(emailHint.value || '').trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      emailHint.value = String(props.initialEmail || '').trim();
    }
  }
);

watch(
  () => props.initialEmail,
  (v) => {
    if (props.modelValue && !emailHint.value) {
      emailHint.value = String(v || '').trim();
    }
  }
);

function close() {
  emit('update:modelValue', false);
}

function submitConnect() {
  if (!emailLooksValid.value) return;
  emit('connect', { loginHint: String(emailHint.value).trim(), providerId: props.providerId });
}
</script>
