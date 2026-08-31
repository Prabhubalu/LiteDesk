<script setup lang="ts">
import { FingerPrintIcon } from '@heroicons/vue/24/outline'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'

defineProps<{
  open: boolean
  label: string
}>()

const emit = defineEmits<{ enable: []; skip: [] }>()
</script>

<template>
  <MobileBottomSheet
    :open="open"
    :title="`Enable ${label}?`"
    aria-label="Enable biometric unlock"
    compact
    @close="emit('skip')"
  >
    <div class="bio-prompt">
      <div class="bio-prompt__icon" aria-hidden="true">
        <FingerPrintIcon />
      </div>
      <p class="bio-prompt__copy">
        Sign in faster next time. Your session stays on this device and {{ label }} keeps it
        private when you leave the app.
      </p>
      <button type="button" class="btn bio-prompt__enable" @click="emit('enable')">
        Enable {{ label }}
      </button>
      <button type="button" class="bio-prompt__skip" @click="emit('skip')">Not now</button>
    </div>
  </MobileBottomSheet>
</template>

<style scoped>
.bio-prompt {
  display: grid;
  gap: 1rem;
  justify-items: center;
  text-align: center;
}

.bio-prompt__icon {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: var(--radius);
  display: grid;
  place-items: center;
  background: rgba(96, 73, 231, 0.12);
  color: var(--accent-strong);
}

.bio-prompt__icon :deep(svg) {
  width: 1.65rem;
  height: 1.65rem;
}

.bio-prompt__copy {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.bio-prompt__enable {
  width: 100%;
}

.bio-prompt__skip {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.35rem;
}
</style>
