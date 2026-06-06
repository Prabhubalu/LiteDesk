<template>
  <div
    class="list-column-filter w-full min-w-0"
    :class="inline ? 'list-column-filter--inline' : ''"
  >
    <!-- Active user chip (inline) -->
    <div
      v-if="inline && filter.filterType === 'user' && isActive && selectedUserLabel"
      :class="inlineFieldShellClass"
    >
      <Avatar
        v-if="selectedUserRecord"
        :user="selectedUserRecord"
        size="sm"
        class="flex-shrink-0"
      />
      <span
        class="min-w-0 flex-1 truncate text-sm"
        :class="inlineValueClass"
      >
        {{ selectedUserLabel }}
      </span>
      <button
        type="button"
        :class="inlineClearChipButtonClass"
        :aria-label="clearAriaLabel"
        @mousedown.prevent
        @click.stop="onClear"
      >
        <XMarkIcon class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- Text / number -->
    <div
      v-else-if="filter.filterType === 'text' || filter.filterType === 'number'"
      class="relative min-w-0"
    >
      <input
        :value="textValue"
        type="text"
        :placeholder="inputPlaceholder"
        :aria-label="ariaLabel"
        :class="[inputClass, showInlineClearButton ? 'pr-8' : '']"
        @input="onTextInput"
        @keydown.enter.prevent="$emit('commit')"
        @keydown.escape.prevent="onClear"
      />
      <button
        v-if="showInlineClearButton"
        type="button"
        :class="inlineClearButtonClass"
        :aria-label="clearAriaLabel"
        @mousedown.prevent
        @click.stop="onClear"
      >
        <XMarkIcon class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- Date -->
    <div
      v-else-if="filter.filterType === 'date'"
      class="relative min-w-0"
    >
      <DateFilterDropdown
        :model-value="modelValue"
        :filter-key="filter.key"
        :filter-label="filter.label || filter.key"
        :button-class="dateButtonClass"
        :options-class="dateOptionsClass"
        :placeholder-override="inlinePlaceholder"
        :teleport-options="teleportOptions"
        @update:model-value="emitValue"
        @opened="$emit('opened')"
      />
      <button
        v-if="showInlineClearButton"
        type="button"
        :class="inlineClearButtonClass"
        :aria-label="clearAriaLabel"
        @mousedown.prevent
        @click.stop="onClear"
      >
        <XMarkIcon class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- Select-like filters (user, select, boolean, entity, …) -->
    <Listbox
      v-else
      :model-value="selectValue"
      :multiple="filter.filterType === 'multi-select'"
      v-slot="{ open }"
      @update:model-value="emitValue"
    >
      <span v-show="false" aria-hidden="true">{{ syncListboxOpenState(open) }}</span>
      <div class="relative min-w-0">
        <ListboxButton
          ref="listboxButtonRef"
          :class="[selectButtonClass, showInlineClearButton ? 'pr-8' : '']"
          @click="onListboxButtonClick"
        >
          <span
            class="block min-w-0 truncate text-left"
            :class="isActive ? inlineValueClass : inlinePlaceholderMutedClass"
          >
            {{ selectLabel }}
          </span>
        </ListboxButton>
        <button
          v-if="showInlineClearButton"
          type="button"
          :class="inlineClearButtonClass"
          :aria-label="clearAriaLabel"
          @mousedown.prevent
          @click.stop="onClear"
        >
          <XMarkIcon class="h-3.5 w-3.5" />
        </button>
        <Transition
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <Teleport to="body" :disabled="!teleportOptions">
            <ListboxOptions
              v-if="!teleportOptions || open"
              :style="teleportOptions ? teleportMenuStyle : undefined"
              :class="teleportOptions
                ? 'fixed z-[10050] max-h-60 overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-left text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800'
                : 'absolute left-0 z-[80] mt-1 max-h-60 w-full min-w-[10rem] overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-left text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800'"
              @vue:before-mount="syncTeleportPosition"
            >
            <ListboxOption
              :value="filter.filterType === 'multi-select' ? [] : ''"
              v-slot="{ active, selected }"
            >
              <li
                :class="[
                  'relative cursor-pointer select-none py-2 pl-3 pr-8 text-left',
                  active ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100' : 'text-gray-900 dark:text-gray-100'
                ]"
              >
                <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate text-left']">
                  {{ allLabel }}
                </span>
                <CheckIcon
                  v-if="selected"
                  class="absolute inset-y-0 right-2 my-auto h-4 w-4 text-gray-600 dark:text-gray-300"
                />
              </li>
            </ListboxOption>
            <ListboxOption
              v-for="option in filter.options || []"
              :key="String(option.value)"
              :value="option.value"
              v-slot="{ active, selected }"
            >
              <li
                :class="[
                  'relative cursor-pointer select-none py-2 pl-3 pr-8 text-left',
                  active ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100' : 'text-gray-900 dark:text-gray-100'
                ]"
              >
                <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate text-left']">
                  {{ option.label || option.value }}
                </span>
                <CheckIcon
                  v-if="selected"
                  class="absolute inset-y-0 right-2 my-auto h-4 w-4 text-gray-600 dark:text-gray-300"
                />
              </li>
            </ListboxOption>
            <li
              v-if="!filter.options?.length"
              class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
            >
              {{ t('common.listLoadingOptions') }}
            </li>
            </ListboxOptions>
          </Teleport>
        </Transition>
      </div>
    </Listbox>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import { CheckIcon, XMarkIcon } from '@heroicons/vue/20/solid';
import { Transition, Teleport } from 'vue';
import DateFilterDropdown from '@/components/common/DateFilterDropdown.vue';
import Avatar from '@/components/common/Avatar.vue';
import type { FilterConfig } from '@/platform/filters/filterResolver';
import { getColumnFilterPlaceholderKind } from '@/platform/filters/columnFilterPlaceholders';
import { resolveFilterAllLabel } from '@/platform/filters/filterAllLabelResolver';
import { isFilterValueActive, resolveFilterDisplayLabel } from '@/platform/filters/filterValueUtils';

const props = withDefaults(
  defineProps<{
    filter: FilterConfig;
    modelValue?: unknown;
    compact?: boolean;
    dense?: boolean;
    inline?: boolean;
    teleportOptions?: boolean;
  }>(),
  {
    modelValue: '',
    compact: false,
    dense: false,
    inline: false,
    teleportOptions: false,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void;
  (e: 'opened'): void;
  (e: 'commit'): void;
}>();

const { t } = useI18n();

const listboxButtonRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null);
const teleportMenuStyle = ref<Record<string, string>>({});
const listboxOpen = ref(false);
let viewportListenersBound = false;

function getListboxButtonElement(): HTMLElement | null {
  const raw = listboxButtonRef.value;
  if (!raw) return null;
  return ('$el' in raw && raw.$el ? raw.$el : raw) as HTMLElement;
}

function syncTeleportPosition() {
  if (!props.teleportOptions) return;
  const el = getListboxButtonElement();
  if (!el?.getBoundingClientRect) return;
  const rect = el.getBoundingClientRect();
  teleportMenuStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 160)}px`,
  };
}

function syncListboxOpenState(open: boolean) {
  listboxOpen.value = open;
  return '';
}

function onListboxButtonClick() {
  syncTeleportPosition();
  emit('opened');
}

function onViewportChange() {
  if (props.teleportOptions && listboxOpen.value) syncTeleportPosition();
}

function bindViewportListeners() {
  if (viewportListenersBound) return;
  viewportListenersBound = true;
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
}

function unbindViewportListeners() {
  if (!viewportListenersBound) return;
  viewportListenersBound = false;
  window.removeEventListener('scroll', onViewportChange, true);
  window.removeEventListener('resize', onViewportChange);
}

watch([listboxOpen, () => props.teleportOptions], ([open, teleport]) => {
  if (open && teleport) {
    bindViewportListeners();
    syncTeleportPosition();
  } else {
    unbindViewportListeners();
  }
});

onBeforeUnmount(() => {
  unbindViewportListeners();
});

const isActive = computed(() => isFilterValueActive(props.modelValue));

const isInline = computed(() => props.inline || props.compact);

const inlineFieldShellClass =
  'inline-flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-left text-sm font-normal shadow-none dark:border-gray-600 dark:bg-gray-900';

const inlineFieldClass =
  'block h-8 w-full min-w-0 rounded-md border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 shadow-none outline-none placeholder:font-normal placeholder:text-gray-400 focus:border-gray-300 focus:ring-1 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:font-normal dark:placeholder:text-gray-500 dark:focus:border-gray-500 dark:focus:ring-gray-700';

const inlinePlaceholderMutedClass = 'font-normal text-gray-400 dark:text-gray-500';

const inlineValueClass = 'font-normal text-gray-900 dark:text-gray-100';

const inlineClearChipButtonClass =
  'flex-shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300';

const inlineClearButtonClass =
  'absolute inset-y-0 right-2 z-10 flex flex-shrink-0 items-center rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300';

const showInlineClearButton = computed(
  () => props.inline && isActive.value && props.filter.filterType !== 'user'
);

const clearAriaLabel = computed(() =>
  t('common.listColumnFilterClearFor', { label: props.filter.label || props.filter.key })
);

const ariaLabel = computed(() =>
  t('common.listColumnFilterAria', { label: props.filter.label || props.filter.key })
);

const allLabel = computed(() => resolveFilterAllLabel(props.filter, t));

const placeholderKind = computed(() => getColumnFilterPlaceholderKind(props.filter.filterType));

const inlinePlaceholder = computed(() => {
  if (placeholderKind.value === 'search') {
    return t('common.listColumnFilterSearch');
  }
  return t('common.listColumnFilterGeneric');
});

const inputPlaceholder = computed(() => inlinePlaceholder.value);

const denseFieldClass =
  'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

const inputClass = computed(() => {
  if (isInline.value) {
    return inlineFieldClass;
  }
  if (props.dense) {
    const active = isActive.value
      ? 'border-indigo-400 ring-1 ring-indigo-400/30 dark:border-indigo-500'
      : '';
    return `block w-full min-w-0 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${denseFieldClass} ${active}`;
  }
  const base =
    'block w-full min-w-0 bg-white text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500';
  const size = props.compact ? 'h-8 px-2 text-xs' : 'h-10 px-3 text-sm';
  const border = isActive.value
    ? 'rounded-md border border-indigo-400 ring-1 ring-indigo-400/30 dark:border-indigo-500'
    : 'rounded-md border border-gray-200 dark:border-gray-600';
  return `${base} ${size} ${border} focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500`;
});

const textValue = computed(() => (props.modelValue == null ? '' : String(props.modelValue)));

const selectValue = computed(() => {
  if (props.filter.filterType === 'multi-select') {
    return Array.isArray(props.modelValue) ? props.modelValue : [];
  }
  return props.modelValue || '';
});

const selectedUserLabel = computed(() => {
  if (!isActive.value) return '';
  return resolveFilterDisplayLabel(props.filter, props.modelValue);
});

const selectedUserRecord = computed(() => {
  const value = props.modelValue;
  if (!value || value === 'me' || value === 'unassigned') return null;
  const match = props.filter.options?.find((opt) => opt.value === value);
  if (!match) return { firstName: selectedUserLabel.value };
  const parts = String(match.label || '').trim().split(/\s+/);
  return {
    firstName: parts[0] || match.label,
    lastName: parts.slice(1).join(' ') || '',
  };
});

const selectLabel = computed(() => {
  if (!isActive.value) {
    return inlinePlaceholder.value;
  }
  return resolveFilterDisplayLabel(props.filter, props.modelValue) || inlinePlaceholder.value;
});

const selectButtonClass = computed(() => {
  if (isInline.value) {
    return `${inlineFieldClass} relative inline-flex cursor-pointer items-center text-left font-normal`;
  }
  if (props.dense) {
    const active = isActive.value
      ? 'border-indigo-400 ring-1 ring-indigo-400/30 dark:border-indigo-500'
      : '';
    return `relative inline-flex w-full min-w-0 cursor-pointer items-center text-left font-normal ${denseFieldClass} ${active}`;
  }
  const base =
    'relative inline-flex w-full items-center rounded-md border bg-white text-left text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white dark:focus:border-indigo-400';
  const size = props.compact ? 'h-8 px-2 text-xs' : 'h-10 px-3 text-sm';
  const active = isActive.value
    ? 'border-indigo-400 ring-1 ring-indigo-400/30 dark:border-indigo-500'
    : 'border-gray-200 dark:border-gray-600';
  return `${base} ${size} ${active}`;
});

const dateButtonClass = computed(() => {
  const base = selectButtonClass.value;
  if (showInlineClearButton.value) {
    return `${base} pr-8`;
  }
  return base;
});
const dateOptionsClass = computed(() =>
  props.teleportOptions
    ? 'fixed z-[10050] max-h-60 w-64 overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-left text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800'
    : 'absolute left-0 z-[80] mt-1 max-h-60 w-64 overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-left text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800'
);

function emitValue(value: unknown) {
  emit('update:modelValue', value);
}

function onTextInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emitValue(target.value);
}

function onClear() {
  if (props.filter.filterType === 'multi-select') {
    emitValue([]);
    return;
  }
  emitValue('');
}
</script>
