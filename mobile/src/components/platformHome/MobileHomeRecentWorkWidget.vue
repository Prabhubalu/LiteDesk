<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowRightIcon } from '@heroicons/vue/24/outline'
import type { PlatformHomeResumeItem } from '@/types/platformHome'
import { formatRelativeTime, mobilePathFromWebRoute } from '@/utils/platformHomeMobile'
import ModuleIcon from '@/components/ModuleIcon.vue'
import MobileHomeWidgetShell from '@/components/platformHome/MobileHomeWidgetShell.vue'

defineProps<{
  items: PlatformHomeResumeItem[]
}>()

const router = useRouter()

function openItem(item: PlatformHomeResumeItem) {
  const path = mobilePathFromWebRoute(item.route)
  if (path) void router.push(path)
}
</script>

<template>
  <MobileHomeWidgetShell title="Recent" flush>
    <p v-if="!items.length" class="empty">
      Tasks, events, and alerts from your apps will appear here as you get started.
    </p>
    <div v-else class="list">
      <button
        v-for="item in items"
        :key="`${item.moduleKey}-${item.id}`"
        type="button"
        class="row"
        @click="openItem(item)"
      >
        <span class="icon">
          <ModuleIcon :module-key="item.moduleKey" :size="16" />
        </span>
        <span class="copy">
          <span class="copy__title">{{ item.title }}</span>
          <span class="copy__meta">
            {{ item.sourceApp }}
            <template v-if="item.updatedAt"> · {{ formatRelativeTime(item.updatedAt) }}</template>
          </span>
        </span>
        <ArrowRightIcon class="row__arrow" />
      </button>
    </div>
  </MobileHomeWidgetShell>
</template>

<style scoped>
.empty {
  margin: 0;
  padding: 1.75rem 1.25rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.list {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 0.75rem;
  background: transparent;
  color: inherit;
  text-align: left;
}

.icon {
  display: flex;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  background: var(--bg-soft);
  color: var(--text-muted);
}

.copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.1rem;
}

.copy__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
}

.copy__meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  overflow: hidden;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.row__arrow {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--border);
  opacity: 0.7;
}
</style>
