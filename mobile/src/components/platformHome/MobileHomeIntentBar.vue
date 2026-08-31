<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { useShellChrome } from '@/composables/useShellChrome'

const chrome = useShellChrome()
</script>

<template>
  <section class="intent card">
    <p class="intent__prompt">What do you need to do right now?</p>
    <div class="intent__row">
      <RouterLink to="/search" class="intent__search" @click="chrome.closeAllSheets()">
        <MagnifyingGlassIcon class="intent__icon" />
        <span>Search records, run commands…</span>
      </RouterLink>
      <button type="button" class="intent__create" @click="chrome.openQuickCreate()">
        <PlusIcon class="intent__plus" />
        Create
      </button>
    </div>
  </section>
</template>

<style scoped>
.intent {
  min-width: 0;
  max-width: 100%;
  padding: 1rem;
}

.intent__prompt {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
}

.intent__row {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.5rem;
}

.intent__search {
  display: inline-flex;
  min-height: 2.75rem;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  border-radius: 0.75rem;
  background: var(--bg-elevated);
  color: var(--text-muted);
  font-size: 0.875rem;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.03);
}

.intent__icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  color: var(--text-muted);
}

.intent__search span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.intent__create {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, white);
  border-radius: 0.75rem;
  background: var(--accent-strong);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
}

.intent__plus {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

@media (min-width: 22rem) {
  .intent__row {
    flex-direction: row;
    align-items: center;
  }

  .intent__search {
    flex: 1;
  }

  .intent__create {
    width: auto;
    flex-shrink: 0;
  }
}
</style>
