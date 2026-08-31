<script setup lang="ts">
import { ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/vue/24/outline'
import type { PlatformHomeAlert } from '@/types/platformHome'
import MobileHomeWidgetShell from '@/components/platformHome/MobileHomeWidgetShell.vue'

defineProps<{
  alerts: PlatformHomeAlert[]
}>()
</script>

<template>
  <MobileHomeWidgetShell title="Alerts">
    <p v-if="!alerts.length" class="empty">No alerts right now.</p>
    <div v-else class="stack">
      <div
        v-for="(alert, index) in alerts"
        :key="`${alert.title}-${index}`"
        class="alert"
        :class="`alert--${alert.type}`"
      >
        <component
          :is="alert.type === 'error' ? ExclamationTriangleIcon : InformationCircleIcon"
          class="alert__icon"
        />
        <div class="alert__copy">
          <p class="alert__title">{{ alert.title }}</p>
          <p class="alert__message">{{ alert.message }}</p>
        </div>
      </div>
    </div>
  </MobileHomeWidgetShell>
</template>

<style scoped>
.empty {
  margin: 0;
  padding: 0.5rem 0.25rem 0.75rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.stack {
  display: grid;
  gap: 0.75rem;
}

.alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-radius: var(--radius);
}

.alert__icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.alert__copy {
  min-width: 0;
}

.alert__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
}

.alert__message {
  margin: 0.15rem 0 0;
  font-size: 0.875rem;
}

.alert--error {
  background: rgba(239, 68, 68, 0.1);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
}

.alert--error .alert__icon,
.alert--error .alert__title {
  color: #b91c1c;
}

.alert--error .alert__message {
  color: #dc2626;
}

.alert--warning {
  background: rgba(245, 158, 11, 0.12);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
}

.alert--warning .alert__icon,
.alert--warning .alert__title {
  color: #b45309;
}

.alert--warning .alert__message {
  color: #d97706;
}

:root[data-theme='dark'] .alert--error {
  background: rgba(127, 29, 29, 0.35);
}

:root[data-theme='dark'] .alert--error .alert__icon,
:root[data-theme='dark'] .alert--error .alert__title {
  color: #fecaca;
}

:root[data-theme='dark'] .alert--error .alert__message {
  color: #fca5a5;
}

:root[data-theme='dark'] .alert--warning {
  background: rgba(120, 53, 15, 0.35);
}

:root[data-theme='dark'] .alert--warning .alert__icon,
:root[data-theme='dark'] .alert--warning .alert__title {
  color: #fde68a;
}

:root[data-theme='dark'] .alert--warning .alert__message {
  color: #fcd34d;
}
</style>
