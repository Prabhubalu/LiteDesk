<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { SHELL_TAB_ICONS } from '@/utils/navigationIcons'

const HomeIcon = SHELL_TAB_ICONS.home
const InboxIcon = SHELL_TAB_ICONS.inbox
const TasksIcon = SHELL_TAB_ICONS.tasks
const AppsIcon = SHELL_TAB_ICONS.apps

const route = useRoute()

const tabs = [
  { to: '/', label: 'Home', match: (p: string) => p === '/' || p === '' },
  { to: '/inbox', label: 'Inbox', match: (p: string) => p.startsWith('/inbox') },
  { to: '/tasks', label: 'Tasks', match: (p: string) => p.startsWith('/tasks') },
  {
    to: '/apps',
    label: 'Apps',
    match: (p: string) =>
      p.startsWith('/apps') || p.startsWith('/modules') || p.startsWith('/more')
  }
] as const

const activePath = computed(() => route.path)
</script>

<template>
  <nav class="tabbar" aria-label="Primary">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="tab"
      :class="{ active: tab.match(activePath) }"
    >
      <span class="tab-icon" aria-hidden="true">
        <HomeIcon v-if="tab.label === 'Home'" class="tab-icon__svg" />
        <InboxIcon v-else-if="tab.label === 'Inbox'" class="tab-icon__svg" />
        <TasksIcon v-else-if="tab.label === 'Tasks'" class="tab-icon__svg" />
        <AppsIcon v-else class="tab-icon__svg" />
      </span>
      <span class="tab-label">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.15rem;
  padding: 0.35rem 0.5rem calc(0.35rem + var(--safe-bottom));
  background: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(12px);
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  min-height: 3.25rem;
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 600;
}

.tab.active {
  color: var(--accent-strong);
  background: rgba(96, 73, 231, 0.1);
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-icon__svg {
  width: 1.375rem;
  height: 1.375rem;
}

.tab-label {
  line-height: 1;
}
</style>
