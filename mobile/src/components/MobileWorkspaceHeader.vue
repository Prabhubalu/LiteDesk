<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDownIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useShellChrome } from '@/composables/useShellChrome'
import { useUserStatus } from '@/composables/useUserStatus'

const auth = useAuthStore()
const chrome = useShellChrome()

const { currentPreset, displayLabel } = useUserStatus()

const orgInitial = computed(() => {
  const name = auth.organization?.name || auth.displayName || 'W'
  return name.charAt(0).toUpperCase()
})

const workspaceLabel = computed(() => {
  const name = auth.organization?.name || 'Workspace'
  return name.length > 22 ? `${name.slice(0, 20)}…` : name
})
</script>

<template>
  <header class="workspace-header">
    <button type="button" class="workspace-switcher" @click="chrome.openProfileMenu()">
      <span class="workspace-avatar">{{ orgInitial }}</span>
      <span class="workspace-name">{{ workspaceLabel }}</span>
      <ChevronDownIcon class="workspace-chevron" aria-hidden="true" />
    </button>

    <button
      type="button"
      class="profile-btn"
      :aria-label="`Account — ${displayLabel}`"
      @click="chrome.openProfileMenu()"
    >
      <span class="profile-avatar">{{ auth.displayName.charAt(0).toUpperCase() }}</span>
      <span
        class="profile-status"
        :style="{ background: currentPreset.color }"
        aria-hidden="true"
      />
    </button>
  </header>
</template>

<style scoped>
.workspace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: calc(0.35rem + var(--safe-top)) 1rem 0.35rem;
}

.workspace-switcher {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  background: transparent;
  color: var(--text);
  min-width: 0;
  padding: 0;
}

.workspace-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 0.85rem;
  color: white;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  flex-shrink: 0;
}

.workspace-name {
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-chevron {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--text-muted);
}

.profile-btn {
  position: relative;
  border: none;
  background: transparent;
  padding: 0;
}

.profile-status {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 0.62rem;
  height: 0.62rem;
  border-radius: var(--radius-pill);
  border: 2px solid var(--bg-elevated);
}

.profile-avatar {
  width: 2.15rem;
  height: 2.15rem;
  border-radius: var(--radius-pill);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--accent-strong);
  background: rgba(96, 73, 231, 0.14);
  border: 2px solid var(--bg-elevated);
  box-shadow: 0 0 0 1px var(--border);
}
</style>
