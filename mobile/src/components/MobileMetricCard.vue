<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  label: string
  primary: string | number
  secondary?: string
  active?: boolean
  to?: string
}>()
</script>

<template>
  <RouterLink v-if="to" :to="to" class="metric-card card" :class="{ active }">
    <span class="metric-card__label">{{ label }}</span>
    <strong class="metric-card__primary">{{ primary }}</strong>
    <span v-if="secondary" class="metric-card__secondary">{{ secondary }}</span>
  </RouterLink>
  <div v-else class="metric-card card" :class="{ active }">
    <span class="metric-card__label">{{ label }}</span>
    <strong class="metric-card__primary">{{ primary }}</strong>
    <span v-if="secondary" class="metric-card__secondary">{{ secondary }}</span>
  </div>
</template>

<style scoped>
.metric-card {
  flex: 0 0 auto;
  width: 9.5rem;
  min-height: 5.5rem;
  padding: 0.85rem 0.95rem;
  display: grid;
  gap: 0.15rem;
  color: inherit;
}

.metric-card.active {
  background: rgba(96, 73, 231, 0.12);
  border-color: rgba(96, 73, 231, 0.35);
}

.metric-card:active {
  transform: scale(0.98);
}

.metric-card__label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-muted);
}

.metric-card.active .metric-card__label {
  color: var(--accent-strong);
}

.metric-card__primary {
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.metric-card__secondary {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.metric-card.active .metric-card__secondary {
  color: color-mix(in srgb, var(--accent-strong) 80%, var(--text-muted));
}
</style>
