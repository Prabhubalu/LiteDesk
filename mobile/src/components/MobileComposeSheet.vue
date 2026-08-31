<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { sendEmail, type Mailbox } from '@/api/inbox'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import { tapHaptic } from '@/utils/haptics'

const props = defineProps<{
  open: boolean
  mailboxes: Mailbox[]
  defaultMailboxId?: string | null
}>()

const emit = defineEmits<{ close: []; sent: [] }>()

const to = ref('')
const subject = ref('')
const body = ref('')
const mailboxId = ref('')
const sending = ref(false)
const error = ref<string | null>(null)

const sendableMailboxes = computed(() =>
  props.mailboxes.filter((mailbox) => mailbox.kind !== 'group' || Boolean(mailbox.emailAddress))
)

const recipients = computed(() =>
  to.value
    .split(/[,;\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
)

const recipientsValid = computed(
  () => recipients.value.length > 0 && recipients.value.every((value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
)

const canSend = computed(
  () => !sending.value && recipientsValid.value && Boolean(subject.value.trim()) && Boolean(body.value.trim())
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = null
    mailboxId.value = props.defaultMailboxId || sendableMailboxes.value[0]?.id || ''
  }
)

async function onSend() {
  if (!canSend.value) return
  sending.value = true
  error.value = null
  try {
    const res = await sendEmail({
      to: recipients.value,
      subject: subject.value.trim(),
      body: body.value.trim(),
      mailboxId: mailboxId.value || undefined
    })
    const ok = (res as { success?: boolean })?.success
    if (ok === false) throw new Error('Message could not be sent')

    to.value = ''
    subject.value = ''
    body.value = ''
    void tapHaptic()
    emit('sent')
    emit('close')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Message could not be sent'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <MobileBottomSheet :open="open" title="New message" @close="emit('close')">
    <form class="compose" @submit.prevent="onSend">
      <div v-if="error" class="banner banner-error">{{ error }}</div>

      <label v-if="sendableMailboxes.length > 1" class="field">
        <span class="field__label">From</span>
        <select v-model="mailboxId" class="compose__select">
          <option v-for="mailbox in sendableMailboxes" :key="mailbox.id" :value="mailbox.id">
            {{ mailbox.label }}{{ mailbox.emailAddress ? ` · ${mailbox.emailAddress}` : '' }}
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field__label">To</span>
        <input
          v-model="to"
          type="email"
          inputmode="email"
          autocapitalize="none"
          autocomplete="email"
          placeholder="name@company.com"
          multiple
        />
        <span v-if="to && !recipientsValid" class="field__hint field__hint--error">
          Enter valid email addresses, separated by commas.
        </span>
      </label>

      <label class="field">
        <span class="field__label">Subject</span>
        <input v-model="subject" type="text" placeholder="What is this about?" />
      </label>

      <label class="field">
        <span class="field__label">Message</span>
        <textarea v-model="body" rows="6" placeholder="Write your message…" />
      </label>

      <div class="compose__actions">
        <button class="btn btn-ghost" type="button" :disabled="sending" @click="emit('close')">
          Cancel
        </button>
        <button class="btn" type="submit" :disabled="!canSend">
          {{ sending ? 'Sending…' : 'Send' }}
        </button>
      </div>
    </form>
  </MobileBottomSheet>
</template>

<style scoped>
.compose {
  display: grid;
  gap: 0.75rem;
  padding-bottom: 0.5rem;
}

.field__label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.field__hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.field__hint--error {
  color: var(--danger);
}

.compose__select {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.8rem 0.9rem;
  appearance: none;
}

.compose textarea {
  resize: vertical;
  min-height: 8rem;
}

.compose__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.25rem;
}
</style>
