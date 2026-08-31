<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { lockBodyScroll, unlockBodyScroll } from '@/utils/sheetBodyLock'

const props = defineProps<{
  open: boolean
  title?: string
  /** Dialog label when header title is omitted */
  ariaLabel?: string
  /** Match web NotificationSheet height when true */
  tall?: boolean
  /** Shrink to content instead of filling to max-height */
  compact?: boolean
  /** Stack above full-screen overlays (e.g. Astra sheet). */
  elevated?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const isNative = Capacitor.isNativePlatform()

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) lockBodyScroll()
    else unlockBodyScroll()
  }
)

onBeforeUnmount(() => {
  if (props.open) unlockBodyScroll()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="sheet-root"
      :class="{ 'sheet-root--native': isNative, 'sheet-root--elevated': elevated }"
    >
      <button type="button" class="sheet-backdrop" aria-label="Close" @click="emit('close')" />
      <section
        class="sheet-panel"
        :class="{
          'sheet-panel--tall': tall,
          'sheet-panel--compact': compact
        }"
        role="dialog"
        aria-modal="true"
        :aria-label="ariaLabel || title || 'Panel'"
        @click.stop
      >
        <div class="sheet-handle" aria-hidden="true" />
        <header v-if="$slots.header" class="sheet-header sheet-header--custom">
          <slot name="header" />
        </header>
        <header v-else-if="title || $slots['header-actions']" class="sheet-header">
          <h2 v-if="title">{{ title }}</h2>
          <div class="sheet-header__actions">
            <slot name="header-actions" />
            <button type="button" class="sheet-close" aria-label="Close" @click="emit('close')">
              <XMarkIcon class="sheet-close__icon" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div v-if="$slots.toolbar" class="sheet-toolbar">
          <slot name="toolbar" />
        </div>
        <div class="sheet-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="sheet-footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet-root {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet-root--elevated {
  z-index: 110;
}

.sheet-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: rgba(9, 9, 14, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: sheet-fade 0.24s ease-out;
  cursor: default;
  -webkit-tap-highlight-color: transparent;
}

.sheet-root--native .sheet-backdrop {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  background: rgba(9, 9, 14, 0.62);
}

.sheet-panel {
  position: relative;
  z-index: 1;
  width: min(100%, 520px);
  max-height: min(82dvh, 640px);
  background: var(--bg-elevated);
  border-radius: 1.5rem 1.5rem 0 0;
  border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  box-shadow: 0 -24px 60px -20px rgba(9, 9, 14, 0.45), var(--shadow-float);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: sheet-up 0.34s cubic-bezier(0.32, 0.72, 0, 1);
  touch-action: manipulation;
}

.sheet-panel--tall {
  height: min(85dvh, 780px);
  max-height: 92dvh;
}

.sheet-panel--compact {
  height: auto;
  max-height: min(75dvh, 560px);
}

.sheet-panel--compact .sheet-body {
  flex: 0 1 auto;
  overflow-y: auto;
  padding-top: 0.35rem;
  padding-bottom: calc(0.85rem + var(--safe-bottom));
}

.sheet-handle {
  width: 2.25rem;
  height: 0.3rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--text-muted) 35%, transparent);
  margin: 0.6rem auto 0;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1.15rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  flex-shrink: 0;
}

.sheet-header--custom {
  display: block;
  padding: 0.35rem 1.15rem 0.85rem;
}

.sheet-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.sheet-header__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}

.sheet-close {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--bg-soft);
  color: var(--text-muted);
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.sheet-close:active {
  transform: scale(0.92);
  color: var(--text);
}

.sheet-close__icon {
  width: 1.1rem;
  height: 1.1rem;
  stroke-width: 2;
}

.sheet-toolbar {
  padding: 0 1.15rem 0.75rem;
  flex-shrink: 0;
}

.sheet-body {
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 0.85rem 1.15rem calc(1.15rem + var(--safe-bottom));
  min-height: 0;
  flex: 1;
}

.sheet-panel:has(.sheet-footer) .sheet-body {
  padding-bottom: 0.85rem;
}

.sheet-footer {
  flex-shrink: 0;
  padding: 0.75rem 1.15rem calc(0.85rem + var(--safe-bottom));
  border-top: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
  background: color-mix(in srgb, var(--bg-elevated) 92%, var(--bg-soft));
}

.sheet-root:not(.sheet-root--native) .sheet-footer {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

@keyframes sheet-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes sheet-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sheet-panel,
  .sheet-backdrop {
    animation: none;
  }
}
</style>
