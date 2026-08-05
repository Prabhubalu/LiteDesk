import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import { uploadCommunicationAttachment } from '@/utils/communicationAttachments';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;

/** Pragmatic address check: local@domain.tld (TLD ≥ 2 chars; rejects `test@`, `test@test.c`). */
const EMAIL_ADDRESS_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i;

/**
 * Shared compose form state and send/upload logic for drawer and Gmail-style window.
 */
export function useEmailComposeForm(props, emit) {
  const authStore = useAuthStore();
  const { t } = useI18n();
  const DEFAULT_REMINDER_DAYS = 3;
  const MAX_REMINDER_DAYS = 365;

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
  /** Follow-up reminder (compose): off by default; progressive disclosure in toolbar */
  const reminderEnabled = ref(false);
  const reminderDays = ref(DEFAULT_REMINDER_DAYS);
  const reminderDaysInputRef = ref(null);
  const fromEmailDisplay = ref('');
  const fromNameDisplay = ref('');
  const fromSource = ref('');
  const replyToDisplay = ref('');
  const replyToNote = ref('');
  const composePreviewLoading = ref(false);
  /** True after To blur or failed send — gates inline recipient hints. */
  const recipientHintActive = ref(false);
  /** @type {import('vue').Ref<object[]>} */
  const sendIdentities = ref([]);
  /** Selected identity id (mailbox:… | tenant_config) */
  const selectedFromId = ref('');
  const selectedMailboxId = ref('');

  const fromDisplayLine = computed(() => {
    const email = String(fromEmailDisplay.value || '').trim();
    const name = String(fromNameDisplay.value || '').trim();
    if (!email) return '';
    if (name) return `${name} <${email}>`;
    return email;
  });

  const hasFromPicker = computed(() => sendIdentities.value.length > 1);

  function identityOptionLabel(identity) {
    if (!identity) return '';
    const email = String(identity.emailAddress || '').trim();
    const label = String(identity.label || '').trim();
    if (label && label.toLowerCase() !== email.toLowerCase()) {
      return `${label} <${email}>`;
    }
    return email;
  }

  const fromSourceHint = computed(() => {
    if (fromSource.value === 'mailbox') {
      return t('inbox.emailComposeFromHintMailbox');
    }
    if (fromSource.value === 'tenant_config') {
      return t('inbox.emailComposeFromHintOrg');
    }
    if (fromSource.value === 'user') {
      return t('inbox.emailComposeFromHintUser');
    }
    return t('inbox.emailComposeFromHintPending');
  });

  function isValidEmailAddress(email) {
    const s = String(email || '').trim();
    if (!s || s.length > 254) return false;
    return EMAIL_ADDRESS_RE.test(s);
  }

  /**
   * Tokenize To/Cc/Bcc input into valid addresses and invalid fragments.
   * Supports `Name <user@host.tld>` and comma/semicolon lists.
   */
  function analyzeAddresses(s) {
    const raw = String(s || '').trim();
    if (!raw) return { valid: [], invalid: [] };

    const valid = [];
    const invalid = [];

    // Strip "Name <email>" pairs; remaining text is re-tokenized
    let rest = raw;
    const angleRe = /([^,;<>]*?)\s*<([^<>]+)>\s*/g;
    const consumed = [];
    let match;
    while ((match = angleRe.exec(raw)) !== null) {
      const email = match[2].trim().toLowerCase();
      if (isValidEmailAddress(email)) valid.push(email);
      else invalid.push(email || match[0].trim());
      consumed.push(match[0]);
    }
    for (const c of consumed) {
      rest = rest.replace(c, ' ');
    }

    for (const part of rest.split(/[,;]+/)) {
      const token = part.trim();
      if (!token) continue;
      // Bare name leftovers after angle extraction — ignore pure names without @
      if (!token.includes('@')) {
        if (/[^\s]/.test(token)) invalid.push(token);
        continue;
      }
      const email = token.toLowerCase();
      if (isValidEmailAddress(email)) valid.push(email);
      else invalid.push(token);
    }

    return {
      valid: [...new Set(valid)],
      invalid: [...new Set(invalid)]
    };
  }

  function parseEmails(s) {
    return analyzeAddresses(s).valid;
  }

  const toAnalysis = computed(() => analyzeAddresses(form.value.to));
  const ccAnalysis = computed(() => analyzeAddresses(form.value.cc));
  const bccAnalysis = computed(() => analyzeAddresses(form.value.bcc));
  const toRecipients = computed(() => toAnalysis.value.valid);

  const invalidRecipients = computed(() => [
    ...toAnalysis.value.invalid,
    ...ccAnalysis.value.invalid,
    ...bccAnalysis.value.invalid
  ]);

  const canSend = computed(() => {
    if (!toRecipients.value.length) return false;
    if (invalidRecipients.value.length) return false;
    if (!String(form.value.subject || '').trim()) return false;
    return true;
  });

  /** Contextual To-row message (shown after blur/submit attempt). */
  const recipientFieldHint = computed(() => {
    if (!recipientHintActive.value) return '';
    if (toAnalysis.value.invalid.length) {
      const list = toAnalysis.value.invalid.slice(0, 3).join(', ');
      return t('inbox.emailComposeInvalidRecipients', { list });
    }
    const raw = String(form.value.to || '').trim();
    if (raw && !toRecipients.value.length) {
      return t('inbox.emailComposeNeedValidRecipient');
    }
    return '';
  });

  const isReply = computed(() => Boolean(props.initialDraft?.parentCommunicationId));

  function markRecipientHint() {
    recipientHintActive.value = true;
  }

  watch(
    () => props.initialTo,
    (val) => {
      const next = String(val || '').trim();
      if (!next) return;
      if (props.alwaysActive) {
        if (!String(form.value.to || '').trim()) form.value.to = next;
        return;
      }
      form.value.to = next;
    },
    { immediate: true }
  );

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
    const tpl = templates.value.find((x) => x.id === selectedTemplateId.value);
    if (tpl) {
      form.value.subject = tpl.subject || form.value.subject;
      form.value.body = tpl.body || '';
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
      } else if (props.sendingMailbox?.id || props.initialDraft?.mailboxId) {
        // Context-free: still resolve identities with standalone for mailbox pickers
        params.set('standalone', 'true');
      } else {
        applyIdentityFallback(presetFrom, presetFromName, presetReplyTo);
        composePreviewLoading.value = false;
        return;
      }
      const mbId =
        selectedMailboxId.value
        || props.sendingMailbox?.id
        || props.initialDraft?.mailboxId;
      if (mbId) params.set('mailboxId', String(mbId));

      const data = await apiClient.get(`/communications/email/compose-preview?${params.toString()}`);
      applyPreviewPayload(data?.data, { presetFrom, presetFromName, presetReplyTo });
    } catch {
      applyIdentityFallback(presetFrom, presetFromName, presetReplyTo);
      replyToNote.value = t('inbox.emailComposeReplyToLoadError');
    } finally {
      composePreviewLoading.value = false;
    }
  }

  function applyIdentityFallback(presetFrom, presetFromName, presetReplyTo) {
    const mb = props.sendingMailbox;
    if (mb?.id && mb.emailAddress) {
      sendIdentities.value = [{
        id: `mailbox:${mb.id}`,
        mailboxId: String(mb.id),
        emailAddress: mb.emailAddress,
        label: mb.label || mb.emailAddress,
        source: 'mailbox',
        kind: 'personal',
        viaSmtp: Boolean(mb.viaSmtp)
      }];
      selectedFromId.value = `mailbox:${mb.id}`;
      selectedMailboxId.value = String(mb.id);
      fromEmailDisplay.value = mb.emailAddress;
      fromNameDisplay.value = mb.label || '';
      fromSource.value = 'mailbox';
    } else {
      sendIdentities.value = [];
      selectedFromId.value = '';
      selectedMailboxId.value = '';
      fromEmailDisplay.value = presetFrom || '';
      fromNameDisplay.value = presetFromName || '';
      fromSource.value = presetFrom ? 'tenant_config' : '';
    }
    replyToDisplay.value = presetReplyTo || '';
  }

  function applyPreviewPayload(payload, presets = {}) {
    const {
      presetFrom = '',
      presetFromName = '',
      presetReplyTo = ''
    } = presets;
    const list = Array.isArray(payload?.identities) ? payload.identities : [];
    sendIdentities.value = list;

    fromEmailDisplay.value = payload?.fromEmail || presetFrom || '';
    fromNameDisplay.value = payload?.fromName || presetFromName || '';
    fromSource.value = payload?.fromSource || '';
    replyToDisplay.value = payload?.replyTo || presetReplyTo || '';
    replyToNote.value = payload?.replyToNote || payload?.note || '';

    const resolvedMb = payload?.mailboxId ? String(payload.mailboxId) : '';
    selectedMailboxId.value = resolvedMb;

    if (list.length) {
      const match =
        list.find((i) => resolvedMb && String(i.mailboxId || '') === resolvedMb)
        || list.find((i) => i.source === payload?.fromSource)
        || list[0];
      selectedFromId.value = match?.id || '';
      if (match) {
        fromEmailDisplay.value = match.emailAddress || fromEmailDisplay.value;
        fromNameDisplay.value =
          match.label && match.label !== match.emailAddress
            ? match.label
            : (payload?.fromName || '');
        fromSource.value = match.source || fromSource.value;
        selectedMailboxId.value = match.mailboxId ? String(match.mailboxId) : '';
      }
    } else {
      selectedFromId.value = '';
    }
  }

  async function selectFromIdentity(identityId) {
    const id = String(identityId || '').trim();
    const identity = sendIdentities.value.find((i) => i.id === id);
    if (!identity) return;
    selectedFromId.value = identity.id;
    selectedMailboxId.value = identity.mailboxId ? String(identity.mailboxId) : '';
    fromEmailDisplay.value = identity.emailAddress || '';
    fromNameDisplay.value =
      identity.label && identity.label !== identity.emailAddress ? identity.label : '';
    fromSource.value = identity.source || '';

    if (identity.mailboxId) {
      try {
        await apiClient.put('/communications/email/default-outbound-mailbox', {
          mailboxId: identity.mailboxId
        });
      } catch {
        /* non-blocking preference write */
      }
    }
  }

  function mailboxIdForSubmit() {
    if (selectedMailboxId.value) return selectedMailboxId.value;
    if (props.sendingMailbox?.id) return String(props.sendingMailbox.id);
    if (props.initialDraft?.mailboxId) return String(props.initialDraft.mailboxId);
    return null;
  }

  function resetFormFromProps() {
    form.value.to = props.initialDraft?.to || props.initialTo || '';
    form.value.cc = props.initialDraft?.cc || '';
    form.value.bcc = props.initialDraft?.bcc || '';
    form.value.subject = props.initialDraft?.subject || '';
    form.value.body = props.initialDraft?.body || '';
    error.value = null;
    recipientHintActive.value = false;
    attachments.value = Array.isArray(props.initialDraft?.attachments)
      ? props.initialDraft.attachments.map((a) => ({ ...a }))
      : [];
    showCc.value = Boolean((props.initialDraft?.cc || '').trim());
    showBcc.value = Boolean((props.initialDraft?.bcc || '').trim());
    selectedTemplateId.value = '';
    reminderEnabled.value = false;
    reminderDays.value = DEFAULT_REMINDER_DAYS;
  }

  function setReminderEnabled(on) {
    reminderEnabled.value = Boolean(on);
    if (reminderEnabled.value) {
      const n = Number(reminderDays.value);
      if (!Number.isInteger(n) || n < 1) reminderDays.value = DEFAULT_REMINDER_DAYS;
      requestAnimationFrame(() => reminderDaysInputRef.value?.focus?.());
    }
  }

  function onReminderDaysInput(event) {
    const raw = String(event?.target?.value ?? '').replace(/\D/g, '');
    if (raw === '') {
      reminderDays.value = '';
      return;
    }
    const n = Math.min(MAX_REMINDER_DAYS, Math.max(1, parseInt(raw, 10)));
    reminderDays.value = Number.isFinite(n) ? n : DEFAULT_REMINDER_DAYS;
  }

  function reminderPayloadOrError() {
    if (!reminderEnabled.value) return { ok: true, days: null };
    const n = typeof reminderDays.value === 'number'
      ? reminderDays.value
      : parseInt(String(reminderDays.value).trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > MAX_REMINDER_DAYS) {
      return { ok: false, message: 'Enter a reminder of at least 1 day' };
    }
    return { ok: true, days: n };
  }

  function clearPreviewFields() {
    fromEmailDisplay.value = '';
    fromNameDisplay.value = '';
    fromSource.value = '';
    replyToDisplay.value = '';
    replyToNote.value = '';
    sendIdentities.value = [];
    selectedFromId.value = '';
    selectedMailboxId.value = '';
  }

  const isComposeActive = computed(() => Boolean(props.alwaysActive || props.isOpen));

  function activateComposeForm() {
    resetFormFromProps();
    loadTemplates();
    void loadComposePreview();
  }

  watch(isComposeActive, (active) => {
    if (active) {
      activateComposeForm();
    } else if (!props.alwaysActive) {
      clearPreviewFields();
    }
  }, { immediate: true });

  /** Inline composers: merge addressing fields only — never wipe body while TipTap is mounted. */
  function mergeDraftFromProps() {
    const draft = props.initialDraft || {};
    form.value.to = draft.to || props.initialTo || form.value.to || '';
    form.value.cc = draft.cc ?? form.value.cc ?? '';
    form.value.bcc = draft.bcc ?? form.value.bcc ?? '';
    if (draft.subject) form.value.subject = draft.subject;
    if ((draft.cc || '').trim()) showCc.value = true;
    if ((draft.bcc || '').trim()) showBcc.value = true;
  }

  watch(
    () => props.sendingMailbox?.id,
    (id, prev) => {
      if (!isComposeActive.value || !id || id === prev) return;
      void loadComposePreview();
    }
  );

  watch(
    () => props.relatedTo?.recordId,
    (recordId, prevId) => {
      if (!isComposeActive.value || !recordId || recordId === prevId) return;
      resetFormFromProps();
      void loadComposePreview();
    }
  );

  watch(
    () => props.initialTo,
    (to) => {
      if (!isComposeActive.value || props.alwaysActive) return;
      if (to) form.value.to = to;
    }
  );

  watch(
    () => props.initialDraft,
    () => {
      if (!isComposeActive.value) return;
      if (props.alwaysActive) {
        mergeDraftFromProps();
        return;
      }
      resetFormFromProps();
    },
    { deep: true }
  );

  function close() {
    emit('close');
  }

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

  function clearAfterSend() {
    form.value.body = '';
    attachments.value = [];
    selectedTemplateId.value = '';
    error.value = null;
    reminderEnabled.value = false;
    reminderDays.value = DEFAULT_REMINDER_DAYS;
  }

  function handleSend(options = {}) {
    const totalSize = attachments.value.reduce((sum, a) => sum + (a.fileSize || 0), 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      error.value = 'Total attachment size exceeds 25MB limit';
      return;
    }

    const toRaw =
      String(form.value.to || '').trim() ||
      String(props.initialDraft?.to || props.initialTo || '').trim();
    if (!form.value.to && toRaw) {
      form.value.to = toRaw;
    }

    markRecipientHint();

    const to = analyzeAddresses(toRaw);
    const cc = analyzeAddresses(form.value.cc);
    const bcc = analyzeAddresses(form.value.bcc);

    const allInvalid = [...to.invalid, ...cc.invalid, ...bcc.invalid];
    if (allInvalid.length) {
      const list = allInvalid.slice(0, 3).join(', ');
      error.value = t('inbox.emailComposeInvalidRecipients', { list });
      return;
    }

    if (!to.valid.length) {
      error.value = t('inbox.emailComposeNeedValidRecipient');
      return;
    }

    if (!String(form.value.subject || '').trim()) {
      error.value = t('inbox.emailComposeSubjectRequired');
      return;
    }

    const reminder = reminderPayloadOrError();
    if (!reminder.ok) {
      error.value = reminder.message;
      return;
    }

    const reminderFields =
      reminder.days != null
        ? { reminderEnabled: true, followUpReminderDays: reminder.days }
        : {};

    let scheduledFields = {};
    if (options?.scheduledAt) {
      const at = options.scheduledAt instanceof Date
        ? options.scheduledAt
        : new Date(String(options.scheduledAt));
      if (!Number.isFinite(at.getTime()) || at.getTime() < Date.now() + 60 * 1000) {
        error.value = 'Choose a time at least 1 minute in the future';
        return;
      }
      scheduledFields = { scheduledAt: at.toISOString() };
    }

    error.value = null;

    const mbFields = (() => {
      const id = mailboxIdForSubmit();
      return id ? { mailboxId: id } : {};
    })();

    if (props.standaloneMode) {
      emit('submit', {
        standalone: true,
        to: to.valid,
        cc: cc.valid,
        bcc: bcc.valid,
        subject: form.value.subject.trim(),
        body: form.value.body,
        attachments: attachments.value.length ? attachments.value : [],
        ...reminderFields,
        ...scheduledFields,
        ...mbFields,
        ...(props.initialDraft?.parentCommunicationId
          ? { parentCommunicationId: props.initialDraft.parentCommunicationId }
          : {})
      });
      return;
    }

    if (!props.relatedTo?.moduleKey || !props.relatedTo?.recordId) {
      error.value = 'Invalid record context';
      return;
    }

    emit('submit', {
      relatedTo: props.relatedTo,
      to: to.valid,
      cc: cc.valid,
      bcc: bcc.valid,
      subject: form.value.subject.trim(),
      body: form.value.body,
      attachments: attachments.value.length ? attachments.value : [],
      ...reminderFields,
      ...scheduledFields,
      ...mbFields,
      ...(props.initialDraft?.parentCommunicationId
        ? { parentCommunicationId: props.initialDraft.parentCommunicationId }
        : {})
    });
  }

  return {
    form,
    showCc,
    showBcc,
    templates,
    selectedTemplateId,
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
    toRecipients,
    toAnalysis,
    invalidRecipients,
    recipientFieldHint,
    markRecipientHint,
    canSend,
    isReply,
    handleTemplateChange,
    close,
    handleFileSelect,
    removeAttachment,
    handleSend,
    clearAfterSend,
    activateComposeForm
  };
}
