<script setup lang="ts">
import { computed } from 'vue'
import { PencilSquareIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { useShellChrome } from '@/composables/useShellChrome'
import { tapHaptic } from '@/utils/haptics'

const chrome = useShellChrome()

const isCompose = computed(() => chrome.primaryActionLabel.value.toLowerCase().includes('compose'))
const ariaLabel = computed(() => chrome.primaryActionLabel.value)

function onFabClick() {
  void tapHaptic()
  chrome.runPrimaryAction()
}
</script>

<template>
  <button
    type="button"
    class="fab"
    :class="{ 'fab--compose': isCompose }"
    :aria-label="ariaLabel"
    @click="onFabClick"
  >
    <PencilSquareIcon v-if="isCompose" class="fab__icon fab__icon--compose" aria-hidden="true" />
    <PlusIcon v-else class="fab__icon" aria-hidden="true" />
  </button>
</template>

<style scoped>
.fab {
  flex: 0 0 auto;
  width: 3.5rem;
  height: 3.5rem;
  border: none;
  border-radius: var(--radius-pill);
  display: grid;
  place-items: center;
  color: color-mix(in srgb, var(--text) 78%, transparent);
  background: color-mix(in srgb, var(--bg-elevated) 55%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  box-shadow: var(--shadow-float), inset 0 1px 0 rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
}

.fab--compose {
  color: #fff;
  background: var(--accent-strong);
  border-color: transparent;
  box-shadow: 0 8px 22px rgba(96, 73, 231, 0.38);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .fab:not(.fab--compose) {
    background: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
  }
}

.fab:active {
  transform: scale(0.96);
}

.fab__icon {
  width: 1.625rem;
  height: 1.625rem;
}

.fab__icon--compose {
  width: 1.375rem;
  height: 1.375rem;
}
</style>
