<template>
  <component :is="embedded ? 'div' : 'aside'" v-bind="shellAttrs">
    <div v-show="embedded || open" :class="innerClass">
      <div v-if="!embedded" class="shrink-0 border-b px-2.5 py-2" :class="ui.border">
        <h2 class="mb-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-100">
          {{ t('templates.builderComponentLibrary') }}
        </h2>
        <div class="relative">
          <MagnifyingGlassIcon
            class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          />
          <input
            v-model="query"
            type="search"
            :placeholder="t('templates.builderSearchComponents')"
            :class="[ui.input, 'py-1.5 pl-8 text-sm']"
          />
        </div>
        <p class="mt-1.5 text-[11px] leading-relaxed" :class="ui.textMuted">{{ t('templates.builderDragHint') }}</p>
      </div>

      <div v-else class="shrink-0 border-b px-3 py-2.5" :class="ui.border">
        <div class="relative">
          <MagnifyingGlassIcon
            class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          />
          <input
            v-model="query"
            type="search"
            :placeholder="t('templates.builderSearchBlocks')"
            :class="[ui.input, 'py-2 pl-8 text-sm']"
          />
        </div>
      </div>

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <Disclosure
          v-for="[groupKey, items] in filteredGroups"
          :key="groupKey"
          v-slot="{ open: groupOpen }"
          as="section"
          :default-open="true"
        >
          <DisclosureButton :class="ui.disclosureBtn">
            <span :class="ui.disclosureTitle">{{ t(groupKey) }}</span>
            <ChevronDownIcon
              class="h-3.5 w-3.5 text-neutral-400 transition-transform duration-200"
              :class="groupOpen ? 'rotate-180' : ''"
            />
          </DisclosureButton>

          <DisclosurePanel class="grid grid-cols-2 gap-2.5 pb-1">
            <button
              v-for="item in items"
              :key="item.id"
              type="button"
              draggable="true"
              :disabled="!editorReady"
              :class="[
                ui.blockCard,
                ui.panel,
                ui.border,
                editorReady ? ui.blockCardEnabled : ui.blockCardDisabled
              ]"
              @click="onItemClick(item.id)"
              @dragstart="onDragStart(item.id, $event)"
              @drag="onDrag($event)"
              @dragend="onDragEnd"
            >
              <component
                :is="resolveBuilderIcon(item.iconType)"
                class="h-6 w-6 text-primary-600 dark:text-primary-400"
              />
              <span class="text-[11px] font-medium leading-tight text-neutral-700 dark:text-neutral-200">
                {{ t(item.labelKey) }}
              </span>
            </button>
          </DisclosurePanel>
        </Disclosure>

        <p v-if="!filteredGroups.length" class="px-1 text-sm" :class="ui.textMuted">
          {{ t('templates.builderSearchNoResults') }}
        </p>
      </div>
    </div>
  </component>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { resolveBuilderIcon } from '@/constants/templateBuilderIcons';
import { getBlockCatalogGroups } from '../editor/blockCatalog';

const props = defineProps({
  open: { type: Boolean, default: true },
  embedded: { type: Boolean, default: false },
  editorReady: { type: Boolean, default: false },
  outputFormat: { type: String, default: 'pdf' },
  dragStart: { type: Function, default: null },
  dragMove: { type: Function, default: null },
  dragEnd: { type: Function, default: null }
});

const emit = defineEmits(['add']);

const { t } = useI18n();
const ui = useBuilderUi();
const query = ref('');
const suppressNextClick = ref(false);

const shellAttrs = computed(() => (
  props.embedded
    ? { class: 'flex h-full min-h-0 flex-col overflow-hidden' }
    : {
      class: [
        'flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 ease-out',
        ui.panelMuted,
        ui.border,
        props.open ? 'w-60 xl:w-64' : 'w-0 overflow-hidden border-r-0'
      ]
    }
));

const innerClass = computed(() => (
  props.embedded
    ? 'flex h-full min-h-0 flex-col overflow-hidden'
    : 'flex h-full min-h-0 w-60 flex-col overflow-hidden xl:w-64'
));

const filteredGroups = computed(() => {
  const normalized = query.value.trim().toLowerCase();
  const entries = getBlockCatalogGroups(props.outputFormat);

  if (!normalized) return entries;

  return entries
    .map(([groupKey, items]) => {
      const filtered = items.filter((item) => {
        const label = t(item.labelKey).toLowerCase();
        return label.includes(normalized) || item.id.toLowerCase().includes(normalized);
      });
      return [groupKey, filtered];
    })
    .filter(([, items]) => items.length);
});

function onItemClick(blockId) {
  if (!props.editorReady) return;
  if (suppressNextClick.value) {
    suppressNextClick.value = false;
    return;
  }
  emit('add', blockId);
}

function onDragStart(blockId, event) {
  if (!props.editorReady) {
    event.preventDefault();
    return;
  }
  suppressNextClick.value = true;
  const started = props.dragStart?.(blockId, event);
  if (started === false) {
    event.preventDefault();
    suppressNextClick.value = false;
  }
}

function onDrag(event) {
  if (!props.editorReady) return;
  props.dragMove?.(event);
}

function onDragEnd() {
  props.dragEnd?.();
  window.setTimeout(() => {
    suppressNextClick.value = false;
  }, 0);
}
</script>
