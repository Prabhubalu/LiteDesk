<template>
  <aside class="flex h-full w-full flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderFieldLibrary') }}</h3>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderFieldLibraryDragHint') }}</p>
    </div>

    <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <div class="relative">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          v-model="query"
          type="search"
          class="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          :placeholder="t('webforms.builderFieldLibrarySearch')"
        />
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <p class="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {{ t('webforms.builderStandardFields') }}
      </p>
      <div v-if="!palette.length" class="px-2 py-6 text-center text-xs text-gray-400">
        {{ t('webforms.builderFieldLibraryLoading') }}
      </div>
      <draggable
        v-else
        :list="filteredPalette"
        :group="{ name: 'webform-fields', pull: 'clone', put: false }"
        :sort="false"
        :clone="clonePaletteItem"
        item-key="type"
        tag="ul"
        class="space-y-1"
      >
        <template #item="{ element: item }">
          <li>
            <div
              role="button"
              tabindex="0"
              class="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-gray-100 px-2.5 py-2 text-left text-sm text-gray-700 transition hover:border-blue-200 hover:bg-blue-50 active:cursor-grabbing dark:border-gray-800 dark:text-gray-200 dark:hover:border-blue-900/50 dark:hover:bg-blue-950/30"
              @click="$emit('add-field', item.type)"
              @keydown.enter="$emit('add-field', item.type)"
            >
              <Bars3Icon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <component :is="item.icon" class="h-4 w-4" />
              </span>
              <span class="font-medium">{{ item.label }}</span>
            </div>
          </li>
        </template>
      </draggable>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import draggable from 'vuedraggable';
import { Bars3Icon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  createField: { type: Function, required: true },
  palette: { type: Array, default: () => [] }
});

defineEmits(['add-field']);

const { t } = useI18n();
const query = ref('');

const filteredPalette = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.palette;
  return props.palette.filter((item) =>
    String(item.label || '').toLowerCase().includes(q)
    || String(item.type || '').toLowerCase().includes(q)
  );
});

function clonePaletteItem(item) {
  return props.createField(item.type);
}
</script>
