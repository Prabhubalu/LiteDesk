<template>
  <aside class="flex h-full w-full flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('webforms.builderFieldLibrary') }}</h3>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('webforms.builderModuleFieldsDragHint') }}</p>
    </div>

    <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <div class="relative">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          v-model="query"
          type="search"
          :class="WEBFORM_SEARCH_INPUT_CLASS"
          :placeholder="t('webforms.builderFieldLibrarySearch')"
        />
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <p class="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {{ t('webforms.builderModuleFields') }}
      </p>
      <div v-if="loading" class="px-2 py-6 text-center text-xs text-gray-400">
        {{ t('webforms.builderFieldLibraryLoading') }}
      </div>
      <div v-else-if="!filteredPalette.length" class="px-2 py-6 text-center text-xs text-gray-400">
        {{ t('webforms.builderModuleFieldsEmpty') }}
      </div>
      <draggable
        v-if="availablePalette.length"
        :list="availablePalette"
        :group="{ name: 'webform-fields', pull: 'clone', put: false }"
        :sort="false"
        :clone="clonePaletteItem"
        item-key="key"
        tag="ul"
        class="space-y-1"
      >
        <template #item="{ element: item }">
          <li>
            <div
              role="button"
              tabindex="0"
              :class="WEBFORM_FIELD_LIBRARY_ITEM_CLASS"
              @click="$emit('add-field', item.key)"
              @keydown.enter="$emit('add-field', item.key)"
            >
              <Bars3Icon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <component :is="iconForType(item.dataType)" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium">{{ item.label }}</span>
                <span class="block truncate text-[11px] text-gray-400">{{ item.dataType }}</span>
              </span>
              <span
                v-if="item.required"
                class="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-red-500"
              >
                *
              </span>
            </div>
          </li>
        </template>
      </draggable>

      <div v-if="onCanvasPalette.length" class="mt-4">
        <p class="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {{ t('webforms.builderModuleFieldsOnForm') }}
        </p>
        <ul class="space-y-1">
          <li
            v-for="item in onCanvasPalette"
            :key="item.key"
            class="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2 text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-500"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-400 dark:bg-gray-800">
              <component :is="iconForType(item.dataType)" class="h-4 w-4" />
            </span>
            <span class="min-w-0 flex-1 truncate font-medium">{{ item.label }}</span>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import draggable from 'vuedraggable';
import { Bars3Icon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { buildWebformFieldPalette } from '@/constants/webformBuilderFields';
import { fieldTypeSettingsLabelKey } from '@/constants/moduleFieldTypes';
import { WEBFORM_FIELD_LIBRARY_ITEM_CLASS, WEBFORM_SEARCH_INPUT_CLASS } from '@/utils/webformUiClasses';

const props = defineProps({
  createField: { type: Function, required: true },
  palette: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
});

defineEmits(['add-field']);

const { t } = useI18n();
const query = ref('');

const typeIcons = computed(() => {
  const labelForType = (type) => {
    const key = fieldTypeSettingsLabelKey(type);
    return key ? t(`settings.${key}`) : String(type || '');
  };
  return new Map(
    buildWebformFieldPalette(
      props.palette.map((row) => ({ type: row.dataType, category: 'text' })),
      labelForType
    ).map((row) => [row.type, row.icon])
  );
});

const filteredPalette = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.palette;
  return props.palette.filter((item) =>
    String(item.label || '').toLowerCase().includes(q)
    || String(item.key || '').toLowerCase().includes(q)
    || String(item.dataType || '').toLowerCase().includes(q)
  );
});

const availablePalette = computed(() => filteredPalette.value.filter((item) => !item.onCanvas));
const onCanvasPalette = computed(() => filteredPalette.value.filter((item) => item.onCanvas));

function iconForType(dataType) {
  return typeIcons.value.get(dataType) || typeIcons.value.get('Text');
}

function clonePaletteItem(item) {
  return props.createField(item.key);
}
</script>
