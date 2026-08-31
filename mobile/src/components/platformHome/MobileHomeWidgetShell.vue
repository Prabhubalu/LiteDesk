<script setup lang="ts">
defineProps<{
  title?: string
  flush?: boolean
}>()
</script>

<template>
  <section class="widget card">
    <header v-if="title || $slots.actions" class="widget__head">
      <h3 v-if="title">{{ title }}</h3>
      <div v-if="$slots.actions" class="widget__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="widget__body" :class="{ 'widget__body--flush': flush }">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.widget {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.widget__head {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.75rem;
  padding: 0.55rem 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
}

.widget__head h3 {
  margin: 0;
  min-width: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.widget__actions {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
}

.widget__body {
  min-width: 0;
  max-width: 100%;
  padding: 0.75rem 1rem 1rem;
}

.widget__body--flush {
  padding: 0.25rem 0.35rem 0.5rem;
}
</style>
