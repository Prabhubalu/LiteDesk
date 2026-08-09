import { ref } from 'vue';

const smtpWizardOpen = ref(false);
const smtpWizardMailboxId = ref('');
const smtpWizardInitialEmail = ref('');
const smtpWizardReason = ref('compose');
/** @type {import('vue').Ref<((mailbox: object) => void) | null>} */
const smtpWizardOnConnected = ref(null);

/**
 * Global SMTP setup wizard (mounted in GlobalSurfacesProvider).
 */
export function useSmtpSetupWizard() {
  function openSmtpSetupWizard(options = {}) {
    smtpWizardMailboxId.value = options.mailboxId ? String(options.mailboxId) : '';
    smtpWizardInitialEmail.value = options.email ? String(options.email) : '';
    smtpWizardReason.value = options.reason || 'compose';
    smtpWizardOnConnected.value = typeof options.onConnected === 'function' ? options.onConnected : null;
    smtpWizardOpen.value = true;
  }

  function closeSmtpSetupWizard() {
    smtpWizardOpen.value = false;
  }

  return {
    smtpWizardOpen,
    smtpWizardMailboxId,
    smtpWizardInitialEmail,
    smtpWizardReason,
    smtpWizardOnConnected,
    openSmtpSetupWizard,
    closeSmtpSetupWizard
  };
}
