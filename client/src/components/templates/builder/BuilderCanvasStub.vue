<template>
  <div
    class="rounded-md border border-dashed px-3 py-2"
    :class="[
      hiddenClass,
      isSelected
        ? 'border-primary-400 bg-primary-50/40 ring-1 ring-primary-400/50 dark:border-primary-600 dark:bg-primary-950/20'
        : 'border-neutral-300 bg-neutral-50/80 dark:border-neutral-600 dark:bg-neutral-900/40'
    ]"
    @click.stop="emit('select', nodeId)"
  >
    <p class="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{{ label }}</p>
    <p v-if="preview" class="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">{{ preview }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  nodeId: { type: String, required: true },
  node: { type: Object, required: true },
  isSelected: { type: Boolean, default: false },
  hiddenClass: { type: String, default: '' }
});

const emit = defineEmits(['select']);

const label = computed(() => String(props.node?.name || props.node?.type || 'Component'));

const preview = computed(() => {
  const bindings = props.node?.bindings || {};
  const candidates = [
    bindings.text,
    bindings.html,
    bindings.label,
    bindings.path,
    bindings.expression,
    bindings.value,
    bindings.format
  ];
  const hit = candidates.find((value) => value != null && String(value).trim());
  return hit != null ? String(hit).trim() : '';
});
</script>
