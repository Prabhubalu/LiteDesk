<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/vue/24/outline'
import { completeTask } from '@/api/tasks'
import type { PlatformHomeAttentionItem, PlatformHomeSnapshot } from '@/types/platformHome'
import { formatUpcomingTime, mobilePathFromWebRoute } from '@/utils/platformHomeMobile'
import MobileHomeWidgetShell from '@/components/platformHome/MobileHomeWidgetShell.vue'

const props = defineProps<{
  snapshot: PlatformHomeSnapshot
}>()

const emit = defineEmits<{ refresh: [] }>()

const router = useRouter()

const hasItems = computed(() => {
  const shell = props.snapshot.shell
  return (
    props.snapshot.attention.total > 0 ||
    shell.approvalsPending > 0 ||
    Boolean(shell.nextEvent) ||
    shell.documents.pendingReview > 0 ||
    shell.documents.expiringSoon > 0 ||
    shell.documents.preview.length > 0
  )
})

const hasMoreAttention = computed(
  () => props.snapshot.attention.total > props.snapshot.attention.items.length
)

function openRoute(route: string | undefined) {
  const path = mobilePathFromWebRoute(route)
  if (path) void router.push(path)
}

function openAttention(item: PlatformHomeAttentionItem) {
  openRoute(item.routeTarget)
}

async function completeAttention(item: PlatformHomeAttentionItem) {
  if (item.kind !== 'task' || !item.allowComplete) return
  try {
    await completeTask(item.id)
    emit('refresh')
  } catch {
    /* non-blocking */
  }
}
</script>

<template>
  <MobileHomeWidgetShell title="Up next" flush>
    <template #actions>
      <button
        v-if="snapshot.attention.total > 0"
        type="button"
        class="header-link"
        @click="router.push('/tasks')"
      >
        View all
        <span v-if="hasMoreAttention">({{ snapshot.attention.total }})</span>
        <ArrowRightIcon class="header-link__icon" />
      </button>
    </template>

    <div v-if="!hasItems" class="empty">
      <CheckCircleIcon class="empty__icon" />
      <p class="empty__title">All clear</p>
      <p class="empty__hint">Nothing needs you right now.</p>
    </div>

    <div v-else class="list">
      <button
        v-if="snapshot.shell.nextEvent"
        type="button"
        class="row"
        @click="openRoute(snapshot.shell.nextEvent?.route)"
      >
        <span class="icon icon--event">
          <CalendarDaysIcon />
        </span>
        <span class="copy">
          <span class="copy__title">{{ snapshot.shell.nextEvent.title }}</span>
          <span class="copy__meta">
            {{ snapshot.shell.nextEvent.subtitle || 'Calendar' }}
            <template v-if="snapshot.shell.nextEvent.startAt">
              · {{ formatUpcomingTime(snapshot.shell.nextEvent.startAt) }}
            </template>
          </span>
        </span>
        <span class="badge">Next</span>
      </button>

      <button
        v-for="approval in snapshot.shell.approvalsPreview"
        :key="`approval-${approval.id}`"
        type="button"
        class="row"
        @click="openRoute(approval.route)"
      >
        <span class="icon icon--approval">
          <ClipboardDocumentCheckIcon />
        </span>
        <span class="copy">
          <span class="copy__title">{{ approval.title }}</span>
          <span v-if="approval.subtitle" class="copy__meta">{{ approval.subtitle }}</span>
        </span>
      </button>

      <button
        v-if="!snapshot.shell.approvalsPreview.length && snapshot.shell.approvalsPending > 0"
        type="button"
        class="row"
        @click="router.push('/apps')"
      >
        <span class="icon icon--approval">
          <ClipboardDocumentCheckIcon />
        </span>
        <span class="copy">
          <span class="copy__title">
            {{ snapshot.shell.approvalsPending === 1 ? '1 approval waiting' : `${snapshot.shell.approvalsPending} approvals waiting` }}
          </span>
        </span>
        <ArrowRightIcon class="row__arrow" />
      </button>

      <button
        v-for="doc in snapshot.shell.documents.preview"
        :key="`doc-${doc.id}`"
        type="button"
        class="row"
        @click="openRoute(doc.route)"
      >
        <span class="copy copy--flush">
          <span class="copy__title">{{ doc.title }}</span>
          <span v-if="doc.subtitle" class="copy__meta">{{ doc.subtitle }}</span>
        </span>
        <ArrowRightIcon class="row__arrow" />
      </button>

      <button
        v-if="!snapshot.shell.documents.preview.length && snapshot.shell.documents.pendingReview > 0"
        type="button"
        class="row"
      >
        <span class="copy copy--flush">
          <span class="copy__title">
            {{ snapshot.shell.documents.pendingReview === 1 ? '1 document pending review' : `${snapshot.shell.documents.pendingReview} documents pending review` }}
          </span>
        </span>
        <ArrowRightIcon class="row__arrow" />
      </button>

      <button
        v-if="snapshot.shell.documents.expiringSoon > 0"
        type="button"
        class="row"
      >
        <span class="copy copy--flush">
          <span class="copy__title">
            {{ snapshot.shell.documents.expiringSoon === 1 ? '1 document expiring soon' : `${snapshot.shell.documents.expiringSoon} documents expiring soon` }}
          </span>
        </span>
        <ArrowRightIcon class="row__arrow" />
      </button>

      <div
        v-for="item in snapshot.attention.items"
        :key="`${item.kind}-${item.id}`"
        class="row row--attention"
      >
        <button
          v-if="item.kind === 'task' && item.allowComplete"
          type="button"
          class="check"
          aria-label="Complete task"
          @click="completeAttention(item)"
        />
        <span v-else class="icon">
          <CalendarDaysIcon v-if="item.kind === 'event'" />
          <CheckCircleIcon v-else />
        </span>
        <button type="button" class="row__main" @click="openAttention(item)">
          <span class="copy">
            <span class="copy__title-row">
              <span class="copy__title">{{ item.title }}</span>
              <span v-if="item.attentionLabel" class="pill" :class="{ 'pill--danger': item.isOverdue }">
                {{ item.attentionLabel }}
              </span>
            </span>
            <span class="copy__meta">
              {{ item.sourceApp }}
              <template v-if="item.relatedLabel"> · {{ item.relatedLabel }}</template>
            </span>
          </span>
        </button>
      </div>
    </div>
  </MobileHomeWidgetShell>
</template>

<style scoped>
.header-link {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font-size: 0.75rem;
  font-weight: 500;
}

.header-link__icon,
.row__arrow {
  width: 0.75rem;
  height: 0.75rem;
  flex-shrink: 0;
  color: var(--text-muted);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.75rem 1.25rem;
  text-align: center;
}

.empty__icon {
  width: 1.5rem;
  height: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--success);
}

.empty__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
}

.empty__hint {
  margin: 0.25rem 0 0;
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

.row--attention {
  padding-right: 0.35rem;
}

.row__main {
  flex: 1;
  min-width: 0;
  border: none;
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

.icon :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.icon--event {
  background: #eff6ff;
  color: #1d4ed8;
}

.icon--approval {
  background: #f5f3ff;
  color: var(--accent-strong);
}

.check {
  width: 1rem;
  height: 1rem;
  margin: 0 0.5rem;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--bg-elevated);
}

.copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.1rem;
}

.copy--flush {
  padding-left: 0.25rem;
}

.copy__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

.copy__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
}

.copy__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.badge,
.pill {
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.625rem;
  font-weight: 500;
  padding: 0.1rem 0.4rem;
}

.pill--danger {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
}
</style>
