<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import draggable from 'vuedraggable'

type KanbanItem = Record<string, unknown>

const props = withDefaults(
  defineProps<{
    items: KanbanItem[]
    stages: string[]
    stageKey: string
    itemIdKey?: string
    loading?: boolean
    loadingLabel?: string
    getStageColor?: (stage: string) => string | null
    formatStageLabel?: (stage: string) => string
    cardSize?: 'small' | 'medium' | 'large'
    statsOpen?: boolean
  }>(),
  {
    itemIdKey: '_id',
    loading: false,
    loadingLabel: 'Loading board…',
    getStageColor: () => null,
    formatStageLabel: (stage: string) => stage,
    cardSize: 'medium',
    statsOpen: false
  }
)

const emit = defineEmits<{
  update: [
    payload: {
      item: KanbanItem
      previousStage: string
      newStage: string
      newIndex: number
      previousIndex?: number
    }
  ]
  'card-click': [payload: { item: KanbanItem; event: MouseEvent }]
}>()

const hasVisibleItems = computed(() => Array.isArray(props.items) && props.items.length > 0)

const columnWidthPx = computed(() => {
  if (props.cardSize === 'small') return '280px'
  if (props.cardSize === 'large') return '360px'
  return '300px'
})

function hexToRgba(hex: string, alpha: number): string | null {
  const h = hex.replace('#', '')
  if (h.length < 6) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return null
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function stageColor(stage: string): string | null {
  return props.getStageColor?.(stage) || null
}

function columnBgStyle(stage: string): Record<string, string> {
  const color = stageColor(stage)
  if (!color) return {}
  const bg = hexToRgba(color, 0.03)
  return bg ? { backgroundColor: bg } : {}
}

function syncFromItems(): Record<string, KanbanItem[]> {
  const next: Record<string, KanbanItem[]> = {}
  for (const stage of props.stages) {
    next[stage] = props.items
      .filter((item) => String(item[props.stageKey] ?? '') === stage)
      .slice()
  }
  return next
}

const columnLists = ref<Record<string, KanbanItem[]>>(syncFromItems())

onMounted(() => {
  columnLists.value = syncFromItems()
})

watch(
  () => [props.items, props.stages, props.stageKey] as const,
  () => {
    columnLists.value = syncFromItems()
  },
  { deep: false }
)

type DragChange =
  | { added: { element: KanbanItem; newIndex: number }; removed?: { oldIndex: number } }
  | { moved: { element: KanbanItem; newIndex: number; oldIndex: number } }
  | Record<string, never>

function onListChange(evt: DragChange, stage: string) {
  if ('added' in evt && evt.added) {
    const item = evt.added.element
    const previousStage = String(item[props.stageKey] ?? '')
    item[props.stageKey] = stage
    emit('update', {
      item,
      previousStage,
      newStage: stage,
      newIndex: evt.added.newIndex,
      previousIndex: evt.removed?.oldIndex
    })
  } else if ('moved' in evt && evt.moved) {
    emit('update', {
      item: evt.moved.element,
      previousStage: stage,
      newStage: stage,
      newIndex: evt.moved.newIndex,
      previousIndex: evt.moved.oldIndex
    })
  }
}
</script>

<template>
  <div class="kanban">
    <div v-if="loading && !hasVisibleItems" class="kanban__loading">{{ loadingLabel }}</div>
    <div
      v-else
      class="kanban__row"
      :class="{ 'kanban__row--busy': loading && hasVisibleItems }"
    >
      <div
        v-for="(stage, idx) in stages"
        :key="stage"
        class="kanban-col"
        :style="{
          ...columnBgStyle(stage),
          width: columnWidthPx,
          minWidth: columnWidthPx,
          maxWidth: columnWidthPx
        }"
        :data-stage="stage"
        :data-stage-index="idx"
      >
        <div
          class="kanban-col__head"
          :style="stageColor(stage) ? { backgroundColor: stageColor(stage)! } : undefined"
          :class="{ 'kanban-col__head--plain': !stageColor(stage) }"
        >
          <div
            class="kanban-col__pill"
            :class="{ 'kanban-col__pill--on-color': Boolean(stageColor(stage)) }"
          >
            <span class="kanban-col__title">{{ formatStageLabel(stage) }}</span>
            <span class="kanban-col__count">{{ (columnLists[stage] || []).length }}</span>
          </div>
        </div>

        <div
          class="kanban-col__body"
          :class="{ 'kanban-col__body--stats': statsOpen }"
          :style="columnBgStyle(stage)"
        >
          <draggable
            :list="columnLists[stage]"
            :item-key="itemIdKey"
            :group="{ name: 'mobile-tasks-kanban', pull: true, put: true }"
            class="kanban-col__list"
            ghost-class="kanban-ghost"
            drag-class="kanban-drag"
            chosen-class="kanban-chosen"
            :delay="180"
            :delay-on-touch-only="true"
            :touch-start-threshold="8"
            @change="(evt: DragChange) => onListChange(evt, stage)"
          >
            <template #item="{ element }">
              <div
                class="kanban-card"
                :data-id="String(element[itemIdKey] ?? '')"
                @click="(e) => emit('card-click', { item: element, event: e })"
              >
                <slot name="card" :item="element" :stage="stage" />
              </div>
            </template>
            <template #footer>
              <div
                v-if="!(columnLists[stage] || []).length"
                class="kanban-col__empty"
              >
                <slot name="empty" :stage="stage">
                  <p>No tasks in this status</p>
                </slot>
              </div>
            </template>
          </draggable>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kanban {
  --kanban-edge: 1rem;
  margin: 0 calc(var(--kanban-edge) * -1);
  overflow: hidden;
}

.kanban__loading {
  display: grid;
  place-items: center;
  min-height: 16rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.kanban__row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  overflow-x: auto;
  padding: 0.15rem var(--kanban-edge) 1rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.kanban__row::-webkit-scrollbar {
  display: none;
}

.kanban__row--busy {
  opacity: 0.7;
  pointer-events: none;
}

.kanban-col {
  flex: none;
  display: flex;
  flex-direction: column;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

.kanban-col__head {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  flex-shrink: 0;
}

.kanban-col__head--plain {
  background: var(--bg-soft);
}

.kanban-col__pill {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  max-width: 100%;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--text);
}

.kanban-col__pill--on-color {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.kanban-col__title {
  font-size: 0.875rem;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kanban-col__count {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  opacity: 0.9;
}

.kanban-col__body {
  padding: 0.75rem;
  overflow-y: auto;
  max-height: calc(100vh - 14.5rem - var(--mobile-bottom-offset, 4rem));
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
}

.kanban-col__body--stats {
  max-height: calc(100vh - 20rem - var(--mobile-bottom-offset, 4rem));
}

.kanban-col__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 3rem;
}

.kanban-col__empty {
  display: grid;
  place-items: center;
  padding: 2.5rem 0.5rem;
  color: var(--text-muted);
  font-size: 0.85rem;
  pointer-events: none;
}

.kanban-col__empty p {
  margin: 0;
}

.kanban-card {
  min-width: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  cursor: grab;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
  touch-action: manipulation;
}

.kanban-card:active {
  cursor: grabbing;
}

:global(.kanban-ghost) {
  opacity: 0.5;
  background: rgba(96, 73, 231, 0.12);
  transform: rotate(1deg);
}

:global(.kanban-drag) {
  opacity: 1;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

:global(.kanban-chosen) {
  cursor: grabbing;
}
</style>
