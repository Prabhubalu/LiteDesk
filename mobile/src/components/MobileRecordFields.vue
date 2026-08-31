<script setup lang="ts">
export type RecordFieldRow = {
  key: string
  label: string
  value?: string
}

defineProps<{
  rows: RecordFieldRow[]
  interactive?: boolean
}>()

defineEmits<{
  edit: [key: string]
}>()
</script>

<template>
  <div class="fields">
    <component
      :is="interactive ? 'button' : 'div'"
      v-for="row in rows"
      :key="row.key"
      class="field"
      :class="{ 'field--interactive': interactive }"
      v-bind="interactive ? { type: 'button' } : {}"
      @click="interactive ? $emit('edit', row.key) : undefined"
    >
      <span class="field__icon" aria-hidden="true">
        <slot :name="`${row.key}-icon`" />
      </span>
      <span class="field__label">{{ row.label }}</span>
      <div class="field__value">
        <slot :name="row.key" :row="row">
          <span v-if="row.value">{{ row.value }}</span>
          <span v-else class="field__empty">—</span>
        </slot>
      </div>
    </component>
  </div>
</template>

<style scoped>
.fields {
  display: grid;
  gap: 0.15rem;
}

.field {
  display: grid;
  grid-template-columns: 1.25rem 4.6rem minmax(0, 1fr);
  gap: 0.65rem;
  align-items: center;
  min-height: 2.35rem;
  padding: 0.28rem 0;
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  border-radius: 0.75rem;
  -webkit-tap-highlight-color: transparent;
}

.field__icon {
  display: flex;
  width: 1.25rem;
  height: 1.25rem;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.field__icon :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.field__icon :deep(.field-status-ring) {
  display: block;
  width: 0.85rem;
  height: 0.85rem;
  border: 1.5px solid currentColor;
  border-radius: 50%;
}

.field__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field__value {
  min-width: 0;
  font-size: 0.875rem;
  font-weight: 500;
  word-break: break-word;
}

.field__empty {
  color: var(--text-muted);
  font-weight: 400;
}
</style>
