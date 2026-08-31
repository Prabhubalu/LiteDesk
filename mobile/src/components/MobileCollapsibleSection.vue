<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronRightIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  title: string
  defaultOpen?: boolean
}>()

const open = ref(props.defaultOpen !== false)

watch(
  () => props.defaultOpen,
  (value) => {
    if (value !== undefined) open.value = value
  }
)
</script>

<template>
  <section class="collapse">
    <button type="button" class="collapse__head" @click="open = !open">
      <span class="collapse__title">{{ title }}</span>
      <ChevronRightIcon class="collapse__chev" :class="{ open }" aria-hidden="true" />
    </button>
    <div v-show="open" class="collapse__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.collapse {
  display: grid;
  gap: 0.35rem;
}

.collapse__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text);
  padding: 0.15rem 0;
}

.collapse__title {
  font-size: 0.95rem;
  font-weight: 700;
}

.collapse__chev {
  width: 1.125rem;
  height: 1.125rem;
  color: var(--text-muted);
  transition: transform 0.15s ease;
}

.collapse__chev.open {
  transform: rotate(90deg);
}

.collapse__body {
  display: grid;
  gap: 0.35rem;
}
</style>
