<script setup lang="ts">
import { ref, watch } from 'vue'
import { getApiUrl } from '@/config/apiBase'
import { tapHaptic, errorHaptic, successHaptic } from '@/utils/haptics'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'

const props = defineProps<{
  open: boolean
  initialEmail?: string
}>()

const emit = defineEmits<{ close: [] }>()

const email = ref('')
const submitting = ref(false)
const submitted = ref(false)
const errorMessage = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    email.value = props.initialEmail?.trim() || ''
    submitting.value = false
    submitted.value = false
    errorMessage.value = null
  }
)

async function submit() {
  errorMessage.value = null
  submitting.value = true
  void tapHaptic()
  try {
    const response = await fetch(getApiUrl('/api/auth/forgot-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: email.value.trim() })
    })
    const body = (await response.json().catch(() => ({}))) as {
      success?: boolean
      message?: string
    }
    if (!response.ok || !body.success) {
      errorMessage.value = body.message || 'Unable to send reset email. Try again.'
      void errorHaptic()
      return
    }
    submitted.value = true
    void successHaptic()
  } catch {
    errorMessage.value = 'Network error. Check your connection and try again.'
    void errorHaptic()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <MobileBottomSheet
    :open="open"
    title="Reset password"
    aria-label="Reset password"
    compact
    @close="emit('close')"
  >
    <div v-if="submitted" class="forgot-success">
      <p class="forgot-success__title">Check your email</p>
      <p class="muted">
        If an account exists for <strong>{{ email }}</strong>, we sent a reset link. Open it on any
        device to choose a new password.
      </p>
      <button type="button" class="btn forgot-done" @click="emit('close')">Back to sign in</button>
    </div>

    <form v-else class="forgot-form" @submit.prevent="submit">
      <p class="muted forgot-lead">
        Enter your work email and we will send a secure link to reset your password.
      </p>

      <label class="field">
        <span>Email address</span>
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          inputmode="email"
          required
          placeholder="you@company.com"
        />
      </label>

      <p v-if="errorMessage" class="forgot-error">{{ errorMessage }}</p>

      <button class="btn forgot-submit" type="submit" :disabled="submitting">
        <span v-if="submitting" class="btn-spinner" aria-hidden="true" />
        {{ submitting ? 'Sending…' : 'Send reset link' }}
      </button>
    </form>
  </MobileBottomSheet>
</template>

<style scoped>
.forgot-form,
.forgot-success {
  display: grid;
  gap: 1rem;
}

.forgot-lead {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

.forgot-error {
  margin: 0;
  color: var(--danger);
  font-size: 0.875rem;
}

.forgot-success__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.forgot-submit,
.forgot-done {
  width: 100%;
}

.btn-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
