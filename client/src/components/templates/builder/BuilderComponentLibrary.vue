<template>
  <aside
    class="flex h-full w-60 shrink-0 flex-col border-r"
    :class="[ui.panelMuted, ui.border]"
  >
    <div class="border-b px-3 py-3" :class="ui.border">
      <h2 :class="[ui.meta, 'mb-2']">{{ t('templates.builderComponentLibrary') }}</h2>
      <div class="relative">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          v-model="query"
          type="search"
          :placeholder="t('templates.builderSearchComponents')"
          :class="[ui.input, 'pl-8 py-1.5 text-sm']"
        />
      </div>
      <p class="mt-2 px-1 text-meta" :class="ui.textMuted">{{ t('templates.builderDragHint') }}</p>
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-5">
      <section v-for="[groupKey, items] in filteredGroups" :key="groupKey">
        <h3 :class="[ui.label, 'mb-2 px-1']">{{ t(groupKey) }}</h3>

        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="item in items"
            :key="item.type"
            role="button"
            tabindex="0"
            draggable="true"
            class="flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-center transition-colors cursor-grab active:cursor-grabbing"
            :class="[ui.panel, ui.border, 'hover:border-primary-400 hover:bg-primary-50/50 dark:hover:border-primary-600 dark:hover:bg-primary-950/20']"
            @click="onItemClick(item)"
            @keydown.enter="onItemClick(item)"
            @dragstart="onNativeDragStart(item, $event)"
            @dragend="onNativeDragEnd"
          >
            <component :is="resolveBuilderIcon(item.type)" class="h-5 w-5 text-primary-600 dark:text-primary-400" />
            <span class="text-xs leading-tight text-neutral-700 dark:text-neutral-200">{{ t(item.labelKey) }}</span>
          </div>
        </div>
      </section>

      <p v-if="!filteredGroups.length" class="px-1 text-sm" :class="ui.textMuted">
        {{ t('templates.builderSearchNoResults') }}
      </p>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { BUILDER_CATALOG, getCatalogGroups } from '@/constants/templateBuilderCatalog';
import { resolveBuilderIcon } from '@/constants/templateBuilderIcons';
import { BUILDER_DRAG_TYPES, setBuilderDragPayload } from '@/constants/builderDragTypes';
import { BUILDER_LAYOUT_MODES } from '@/utils/builderLayout';
import { useBuilderUi } from '@/composables/useBuilderUi';

defineProps({
  layoutMode: { type: String, default: BUILDER_LAYOUT_MODES.FLOW }
});

const emit = defineEmits(['add']);

const { t } = useI18n();
const ui = useBuilderUi();
const query = ref('');
const suppressNextClick = ref(false);

const filteredGroups = computed(() => {
  const normalized = query.value.trim().toLowerCase();
  const entries = getCatalogGroups(BUILDER_CATALOG);

  if (!normalized) return entries;

  return entries
    .map(([groupKey, items]) => {
      const filtered = items.filter((item) => {
        const label = t(item.labelKey).toLowerCase();
        return label.includes(normalized) || item.type.toLowerCase().includes(normalized);
      });
      return [groupKey, filtered];
    })
    .filter(([, items]) => items.length);
});

function onItemClick(item) {
  if (suppressNextClick.value) {
    suppressNextClick.value = false;
    return;
  }
  emit('add', item);
}

function onNativeDragStart(item, event) {
  suppressNextClick.value = true;
  setBuilderDragPayload(event, BUILDER_DRAG_TYPES.COMPONENT, {
    kind: 'component',
    type: item.type
  });
  if (event.dataTransfer) {
    event.dataTransfer.setDragImage(event.currentTarget, 40, 24);
  }
}

function onNativeDragEnd() {
  window.setTimeout(() => {
    suppressNextClick.value = false;
  }, 0);
}
</script>
