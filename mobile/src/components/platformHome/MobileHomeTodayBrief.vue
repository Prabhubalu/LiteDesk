<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { BriefSignal } from '@/utils/platformHomeMobile'
import { mobilePathFromWebRoute } from '@/utils/platformHomeMobile'
import MobileHomeWidgetShell from '@/components/platformHome/MobileHomeWidgetShell.vue'

defineProps<{
  focusText: string
  signals: BriefSignal[]
}>()

const router = useRouter()

function openSignal(signal: BriefSignal) {
  const path = mobilePathFromWebRoute(signal.route || undefined)
  if (path) void router.push(path)
}
</script>

<template>
  <MobileHomeWidgetShell title="Today">
    <p class="focus">{{ focusText }}</p>
    <div v-if="signals.length" class="chips">
      <button
        v-for="signal in signals"
        :key="signal.id"
        type="button"
        class="chip"
        :class="`chip--${signal.severity || 'info'}`"
        @click="openSignal(signal)"
      >
        <span class="chip__dot" />
        <span class="chip__text">{{ signal.text }}</span>
      </button>
    </div>
  </MobileHomeWidgetShell>
</template>

<style scoped>
.focus {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--text);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.chip {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--bg-soft);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 500;
  text-align: left;
}

.chip__dot {
  width: 0.375rem;
  height: 0.375rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: #3b82f6;
}

.chip__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip--danger {
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
  color: #7f1d1d;
}

.chip--danger .chip__dot {
  background: var(--danger);
}

.chip--warning {
  border-color: rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.1);
  color: #78350f;
}

.chip--warning .chip__dot {
  background: var(--warning);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .chip--danger,
  :root[data-theme='dark'] .chip--danger {
    color: #fecaca;
    background: rgba(127, 29, 29, 0.35);
  }

  :root:not([data-theme='light']) .chip--warning,
  :root[data-theme='dark'] .chip--warning {
    color: #fde68a;
    background: rgba(120, 53, 15, 0.35);
  }
}

:root[data-theme='dark'] .chip--danger {
  color: #fecaca;
  background: rgba(127, 29, 29, 0.35);
}

:root[data-theme='dark'] .chip--warning {
  color: #fde68a;
  background: rgba(120, 53, 15, 0.35);
}
</style>
