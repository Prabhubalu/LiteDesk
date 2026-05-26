import { ref, watch, computed } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;

/**
 * Shared compose form state and send/upload logic for drawer and Gmail-style window.
 */
export function useEmailComposeForm(props, emit) {
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

  const fromDisplayLine = computed(() => {
    const email = String(fromEmailDisplay.value || '').trim();
    const name = String(fromNameDisplay.value || '').trim();
    if (!email) return '';
    if (name) return `${name} <${email}>`;
    return email;
  });

  const fromSourceHint = computed(() => {
    if (fromSource.value === 'mailbox') {
      return 'Sending from your connected mailbox.';
    }
    if (fromSource.value === 'tenant_config') {
      return 'Sending from your organization email (Settings → Integrations → Email).';
    }
    if (fromSource.value === 'user') {
      return 'Sending from your user account (fallback when no mailbox or org From is set).';
    }
    return 'From address is resolved when you send.';
  });

  function parseEmails(s) {
    const raw = String(s || '').trim();
    if (!raw) return [];

    const fromAngles = [];
    const angleRe = /<([^>]+)>/g;
    let match;
    while ((match = angleRe.exec(raw)) !== null) {
      const email = match[1].trim().toLowerCase();
      if (email.includes('@')) fromAngles.push(email);
    }
    if (fromAngles.length) return [...new Set(fromAngles)];

    return raw
      .split(/[,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes('@'));
  }

  const toRecipients = computed(() => parseEmails(form.value.to));

  const isReply = computed(() => Boolean(props.initialDraft?.parentCommunicationId));

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

    if (presetFrom && presetReplyTo) {
      fromEmailDisplay.value = presetFrom;
      fromNameDisplay.value = presetFromName;
      fromSource.value = props.sendingMailbox?.emailAddress ? 'mailbox' : 'tenant_config';
      replyToDisplay.value = presetReplyTo;
      replyToNote.value = '';
      composePreviewLoading.value = false;
      return;
    }

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
        replyToDisplay.value = presetReplyTo;
        composePreviewLoading.value = false;
        return;
      }
      const mbId = props.sendingMailbox?.id || props.initialDraft?.mailboxId;
      if (mbId) params.set('mailboxId', String(mbId));

      const data = await apiClient.get(`/communications/email/compose-preview?${params.toString()}`);
      fromEmailDisplay.value = data?.data?.fromEmail || presetFrom || '';
      fromNameDisplay.value = data?.data?.fromName || presetFromName || '';
      fromSource.value = data?.data?.fromSource || '';
      replyToDisplay.value = data?.data?.replyTo || presetReplyTo || '';
      replyToNote.value = data?.data?.replyToNote || data?.data?.note || '';
    } catch {
      fromEmailDisplay.value = presetFrom || String(props.sendingMailbox?.emailAddress || '').trim();
      fromNameDisplay.value = presetFromName || String(props.sendingMailbox?.label || '').trim();
      replyToDisplay.value = presetReplyTo;
      replyToNote.value = 'Could not load Reply-To address.';
    } finally {
      composePreviewLoading.value = false;
    }
  }

  function resetFormFromProps() {
    form.value.to = props.initialDraft?.to || props.initialTo || '';
    form.value.cc = props.initialDraft?.cc || '';
    form.value.bcc = props.initialDraft?.bcc || '';
    form.value.subject = props.initialDraft?.subject || '';
    form.value.body = props.initialDraft?.body || '';
    error.value = null;
    attachments.value = Array.isArray(props.initialDraft?.attachments)
      ? props.initialDraft.attachments.map((a) => ({ ...a }))
      : [];
    showCc.value = Boolean((props.initialDraft?.cc || '').trim());
    showBcc.value = Boolean((props.initialDraft?.bcc || '').trim());
    selectedTemplateId.value = '';
  }

  function clearPreviewFields() {
    fromEmailDisplay.value = '';
    fromNameDisplay.value = '';
    fromSource.value = '';
    replyToDisplay.value = '';
    replyToNote.value = '';
  }

  watch(() => props.isOpen, (open) => {
    if (open) {
      resetFormFromProps();
      loadTemplates();
      void loadComposePreview();
    } else {
      clearPreviewFields();
    }
  }, { immediate: true });

  watch(
    () => props.initialDraft,
    () => {
      if (props.isOpen) resetFormFromProps();
    },
    { deep: true }
  );

  function close() {
    emit('close');
  }

  async function handleFileSelect(event) {
    const files = event.target.files;
    if (!files?.length) return;
    const token = authStore.user?.token;
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
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/communications/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData
        });
        const result = await res.json();
        if (result.success) {
          const size = result.fileSize ?? file.size;
          attachments.value.push({
            fileName: result.fileName || file.name,
            fileType: result.fileType || file.type,
            fileSize: size,
            storagePath: result.storagePath
          });
          runningTotal += size;
        } else {
          error.value = result.message || result.error || 'Upload failed';
        }
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
      error.value = 'Total attachment size exceeds 25MB limit';
      return;
    }

    const toRaw =
      String(form.value.to || '').trim() ||
      String(props.initialDraft?.to || props.initialTo || '').trim();
    if (!form.value.to && toRaw) {
      form.value.to = toRaw;
    }

    const toList = parseEmails(toRaw);
    if (!toList.length) {
      error.value = 'Add at least one valid recipient email';
      return;
    }

    if (props.standaloneMode) {
      emit('submit', {
        standalone: true,
        to: toList,
        cc: parseEmails(form.value.cc),
        bcc: parseEmails(form.value.bcc),
        subject: form.value.subject.trim(),
        body: form.value.body,
        attachments: attachments.value.length ? attachments.value : [],
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
      to: toList,
      cc: parseEmails(form.value.cc),
      bcc: parseEmails(form.value.bcc),
      subject: form.value.subject.trim(),
      body: form.value.body,
      attachments: attachments.value.length ? attachments.value : [],
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
    fromDisplayLine,
    fromSourceHint,
    replyToDisplay,
    replyToNote,
    composePreviewLoading,
    toRecipients,
    isReply,
    handleTemplateChange,
    close,
    handleFileSelect,
    removeAttachment,
    handleSend
  };
}
