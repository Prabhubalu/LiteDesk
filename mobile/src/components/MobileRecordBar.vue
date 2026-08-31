<script setup lang="ts">
import { computed } from 'vue'
import {
  ChevronLeftIcon,
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  TagIcon
} from '@heroicons/vue/24/outline'
import { tapHaptic } from '@/utils/haptics'

export type RecordBarTab = {
  id: string
  label: string
}

const props = defineProps<{
  title: string
  showEdit?: boolean
  showTag?: boolean
  showMore?: boolean
  hasTags?: boolean
  tabs?: RecordBarTab[]
  activeTab?: string
}>()

const emit = defineEmits<{
  back: []
  edit: []
  tag: []
  more: []
  'update:activeTab': [id: string]
}>()

const tabIndex = computed(() => {
  const tabs = props.tabs || []
  const index = tabs.findIndex((tab) => tab.id === props.activeTab)
  return index < 0 ? 0 : index
})

function selectTab(id: string) {
  if (id === props.activeTab) return
  void tapHaptic()
  emit('update:activeTab', id)
}
</script>

<template>
  <header class="record-bar" :class="{ 'has-tabs': Boolean(tabs?.length) }">
    <div class="record-bar__toolbar">
      <div class="record-bar__side">
        <button type="button" class="icon-btn" aria-label="Back" @click="emit('back')">
          <ChevronLeftIcon class="icon-btn__icon" aria-hidden="true" />
        </button>
      </div>

      <h1 v-if="!tabs?.length" class="record-bar__title">{{ title }}</h1>

      <div class="record-bar__side record-bar__side--end">
        <button
          v-if="showEdit"
          type="button"
          class="icon-btn"
          aria-label="Edit"
          @click="emit('edit')"
        >
          <PencilSquareIcon class="icon-btn__icon" />
        </button>
        <button
          v-if="showTag"
          type="button"
          class="icon-btn"
          :class="{ 'is-on': hasTags }"
          aria-label="Tags"
          @click="emit('tag')"
        >
          <TagIcon class="icon-btn__icon" />
          <span v-if="hasTags" class="icon-btn__dot" />
        </button>
        <button
          v-if="showMore"
          type="button"
          class="icon-btn"
          aria-label="More"
          @click="emit('more')"
        >
          <EllipsisHorizontalIcon class="icon-btn__icon" />
        </button>
      </div>
    </div>

    <nav
      v-if="tabs?.length"
      class="record-tabs"
      role="tablist"
      :style="{ '--tab-count': String(tabs.length), '--tab-index': String(tabIndex) }"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="record-tabs__btn"
        :class="{ 'is-active': activeTab === tab.id }"
        :aria-selected="activeTab === tab.id"
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
      <span class="record-tabs__ink" aria-hidden="true" />
    </nav>
  </header>
</template>

<style scoped>
.record-bar {
  flex-shrink: 0;
  padding-top: var(--safe-top);
  background: color-mix(in srgb, var(--bg-elevated) 94%, transparent);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
}

.record-bar__toolbar {
  display: flex;
  align-items: center;
  min-height: var(--header-height);
  padding: 0 0.3rem 0 0.15rem;
}

.record-bar.has-tabs .record-bar__toolbar {
  min-height: 2.7rem;
}

.record-bar__side {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.record-bar__side--end {
  margin-left: auto;
}

.record-bar__title {
  flex: 1;
  min-width: 0;
  margin: 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--tab-count, 2), minmax(0, 1fr));
  margin-top: 0.28rem;
}

.record-tabs__btn {
  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 0.94rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  padding: 0.2rem 0.75rem 0.72rem;
  transition: color 180ms ease;
}

.record-tabs__btn:active,
.record-tabs__btn:focus,
.record-tabs__btn:focus-visible {
  background: transparent;
  outline: none;
}

.record-tabs__btn.is-active {
  color: var(--text);
}

.record-tabs__ink {
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 50%;
  height: 2px;
  border-radius: 999px;
  background: var(--text);
  transform: translate3d(calc(var(--tab-index) * 100%), 0, 0);
  transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1);
}

.icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.45rem;
  height: 2.45rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  padding: 0;
}

.icon-btn.is-on {
  color: var(--accent-strong);
}

.icon-btn__icon {
  width: 1.32rem;
  height: 1.32rem;
}

.icon-btn__dot {
  position: absolute;
  top: 0.52rem;
  right: 0.52rem;
  width: 0.38rem;
  height: 0.38rem;
  border-radius: 999px;
  background: var(--accent);
}

@media (prefers-reduced-motion: reduce) {
  .record-tabs__btn,
  .record-tabs__ink {
    transition: none;
  }
}
</style>
