<template>
  <section
    v-if="fields.length"
    class="details-section"
  >
    <h3 v-if="!hideHeader" class="text-sm font-normal text-gray-900 dark:text-white">{{ t('records.detailsTitle') }}</h3>
    <div
      :class="[
        isCompact
          ? 'details-section__compact-list'
          : 'border-y border-x-0 border-gray-200/70 dark:border-gray-700/70 divide-y divide-gray-200/70 dark:divide-gray-700/70'
      ]"
    >
      <template
        v-for="(field, fieldIdx) in visibleFields"
        :key="field.key"
      >
        <h4
          v-if="isCompact && groupFields && isNewGroupHeader(fieldIdx, field)"
          :class="[
            'details-section__group-header',
            fieldIdx > 0 ? 'border-t border-gray-200/80 pt-5 dark:border-gray-700/80' : ''
          ]"
        >
          <div
            :class="[
              'flex min-w-0 w-full items-center gap-2',
              groupHeaderClass(field)
            ]"
          >
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80"
              aria-hidden="true"
            />
            <span class="min-w-0 truncate">{{ field.groupLabel || 'Fields' }}</span>
          </div>
        </h4>
        <!-- Related record link + optional inline listbox: hover → primary; click value → open record. Inline edit via dropdown, never edit drawer. -->
        <div
          v-if="field.recordPath && typeof context.openTab === 'function'"
          :class="isCompact ? 'details-section__field' : 'flex min-h-[2rem] items-center gap-3 px-4 py-2'"
        >
          <template v-if="!isCompact">
            <span class="flex-shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true">
              <component :is="getFieldIcon(field)" class="h-4 w-4" />
            </span>
            <span class="min-w-[12rem] flex-shrink-0 text-sm text-gray-700 dark:text-gray-300">{{ displayFieldLabel(field) }}</span>
          </template>
          <span v-else :class="DRAWER_FIELD_LABEL_CLASS">{{ displayFieldLabel(field) }}</span>

          <HeadlessSelect
            v-if="isCompact && field.options?.length && field.canEdit && typeof field.onSave === 'function'"
            :model-value="getRecordPathFieldSelectedId(field)"
            :options="displayFieldOptions(field)"
            allow-empty
            :empty-label="t('records.detailsSelectOption')"
            :empty-value="null"
            teleport
            wrapper-class="mt-1 relative min-w-0 w-full"
            :button-class="DRAWER_FIELD_LISTBOX_CLASS"
            @update:model-value="(v) => field.onSave(v)"
          />

          <Listbox
            v-else-if="field.options?.length && field.canEdit && typeof field.onSave === 'function'"
            v-slot="{ open }"
            as="div"
            :model-value="getRecordPathFieldSelectedId(field)"
            @update:model-value="(v) => field.onSave(v)"
            :class="isCompact ? 'mt-1 relative min-w-0 w-full' : 'min-w-0 flex-1'"
          >
            <div class="relative w-full">
              <ListboxButton
                :class="[
                  isCompact
                    ? DRAWER_FIELD_LISTBOX_CLASS
                    : 'flex min-h-8 w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-0 dark:hover:bg-gray-800'
                ]"
              >
                <span
                  v-if="field.displayValue"
                  class="min-w-0 flex-1 truncate text-gray-900 dark:text-white transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                  :class="isCompact ? 'text-base sm:text-sm/6' : 'text-sm'"
                >
                  <span
                    role="button"
                    tabindex="0"
                    class="inline cursor-pointer"
                    @click.stop="(e) => { if (field.recordPath && context.openTab) { e.stopPropagation(); context.openTab(field.recordPath, { background: false, insertAdjacent: true }); } }"
                  >
                    {{ field.displayValue }}
                  </span>
                </span>
                <span
                  v-else
                  class="min-w-0 flex-1 truncate text-record-empty"
                  :class="isCompact ? 'text-base sm:text-sm/6' : 'text-sm'"
                >
                  {{ t('records.detailsSelectOption') }}
                </span>
                <span
                  v-if="isCompact"
                  class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
                >
                  <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                </span>
              </ListboxButton>
              <Transition
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
              >
                <ListboxOptions
                  v-if="open"
                  class="absolute z-10 mt-1 max-h-60 w-full min-w-[160px] overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
                >
                  <ListboxOption :value="null" v-slot="{ active }">
                    <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                      <span :class="['block truncate', active ? '' : 'text-record-empty']">{{ t('records.detailsSelectOption') }}</span>
                    </li>
                  </ListboxOption>
                  <ListboxOption
                    v-for="opt in displayFieldOptions(field)"
                    :key="opt.value"
                    :value="opt.value"
                    v-slot="{ active, selected }"
                  >
                    <li :class="['relative cursor-default select-none py-2 pl-4 pr-10', active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100']">
                      <span :class="['block truncate', selected ? 'font-medium' : 'font-normal']">{{ opt.label }}</span>
                      <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400">
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </li>
                  </ListboxOption>
                </ListboxOptions>
              </Transition>
            </div>
          </Listbox>

          <!-- recordPath + onEdit (e.g. task Related to): click value → open record; click elsewhere → inline editor (popover) -->
          <button
            v-else-if="field.canOpenEditor && typeof field.onEdit === 'function'"
            type="button"
            :class="[
              'cursor-pointer text-left text-gray-900 transition-colors dark:text-white',
              isCompact
                ? joinDrawerFieldClasses(DRAWER_FIELD_CONTROL_CLASS, 'hover:opacity-95')
                : '-mx-2 -my-1 flex-1 min-w-0 rounded px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800'
            ]"
            @click="handleFieldEdit(field, $event)"
          >
            <span
              v-if="field.displayValue"
              class="block min-w-0 truncate transition-colors hover:text-primary-600 dark:hover:text-primary-400"
            >
              <span
                role="button"
                tabindex="0"
                class="inline cursor-pointer"
                @click.stop="(e) => { if (field.recordPath && context.openTab) { e.stopPropagation(); context.openTab(field.recordPath, { background: false, insertAdjacent: true }); } }"
              >
                {{ field.displayValue }}
              </span>
            </span>
            <span v-else class="text-record-empty">{{ t('records.detailsLinkRecord') }}</span>
          </button>

          <div
            v-else
            :class="[
              'min-w-0 text-left text-gray-900 dark:text-white',
              isCompact
                ? DRAWER_FIELD_READ_ONLY_DISPLAY_CLASS
                : '-mx-2 -my-1 flex-1 rounded px-2 py-1 text-sm'
            ]"
          >
            <span
              v-if="field.displayValue"
              class="block min-w-0 truncate transition-colors hover:text-primary-600 dark:hover:text-primary-400"
            >
              <span
                role="button"
                tabindex="0"
                class="inline cursor-pointer"
                @click="(e) => { if (field.recordPath && context.openTab) { e.stopPropagation(); context.openTab(field.recordPath, { background: false, insertAdjacent: true }); } }"
              >
                {{ field.displayValue }}
              </span>
            </span>
            <span v-else class="text-record-empty">—</span>
          </div>
        </div>

        <div
          v-else-if="field.canOpenEditor && typeof field.onEdit === 'function'"
          :class="isCompact ? 'details-section__field' : 'flex min-h-[2rem] items-center gap-3 px-4 py-2'"
        >
          <template v-if="!isCompact">
            <span class="flex-shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true">
              <component :is="getFieldIcon(field)" class="h-4 w-4" />
            </span>
            <span class="min-w-[12rem] flex-shrink-0 text-sm text-gray-700 dark:text-gray-300">{{ displayFieldLabel(field) }}</span>
          </template>
          <span v-else :class="DRAWER_FIELD_LABEL_CLASS">{{ displayFieldLabel(field) }}</span>
          <button
            type="button"
            :class="[
              'cursor-pointer text-left text-gray-900 transition-colors dark:text-white',
              isCompact
                ? joinDrawerFieldClasses(DRAWER_FIELD_CONTROL_CLASS, 'hover:opacity-95')
                : '-mx-2 -my-1 flex-1 min-w-0 rounded px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800'
            ]"
            @click="handleFieldEdit(field, $event)"
          >
            <template v-if="field.key === 'tags' && Array.isArray(field.value) && field.value.length > 0">
              <div class="flex flex-wrap gap-1.5 text-left">
                <span
                  v-for="(tag, index) in field.value"
                  :key="`${tag}-${index}`"
                  :class="['inline-block text-xs px-2 py-0.5 rounded', (field.getTagChipClass ? field.getTagChipClass(tag) : null) || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200']"
                >
                  {{ typeof tag === 'object' ? (tag.name || tag.label || tag) : tag }}
                </span>
              </div>
            </template>
            <template v-else-if="field.key === 'tags'">
              <span class="text-record-empty">—</span>
            </template>
            <template v-else>
              <span v-if="field.displayValue" class="truncate">{{ field.displayValue }}</span>
              <span v-else class="text-record-empty">—</span>
            </template>
          </button>
        </div>

        <div v-else :class="isCompact ? 'details-section__field' : ''">
          <EditableLabeledValue
            :label="displayFieldLabel(field)"
            :value="field.value"
            :type="field.type || 'text'"
            :prefix-icon="isCompact ? null : (field.prefixIcon || null)"
            :can-edit="field.canEdit === true"
            :options="displayFieldOptions(field)"
            :min="field.min"
            :step="field.step"
            :multiline="field.multiline === true"
            :rows="field.rows"
            :format-value="shouldFormatDetailValue(field) ? () => field.displayValue : null"
            :get-tag-chip-class="field.getTagChipClass"
            :get-tag-chip-style="field.getTagChipStyle"
            :layout="isCompact ? 'stack' : 'row'"
            :compact="isCompact"
            :people-first-name-with-salutation="field.peopleFirstNameWithSalutation === true"
            :salutation-value="field.salutationValue"
            :salutation-options="field.salutationOptions"
            :record-country="recordCountry"
            :field-key="field.key"
            :module-key="String(context?.module || '')"
            row-padding-class="py-2 px-4 min-h-[2rem]"
            :commit-save="(v) => commitFieldSave(field, v)"
          />
        </div>
      </template>
    </div>
    <div v-if="showExpandCollapse" class="pt-1">
      <button
        type="button"
        class="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        @click="expanded ? collapse() : expand()"
      >
        {{ expanded ? t('records.sectionViewLess') : t('records.sectionViewAll', { count: fields.length }) }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';

const { t, te } = useI18n();
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';
import { localizeSelectOptions } from '@/utils/configurableLabelResolver';
import {
  CurrencyDollarIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  TagIcon,
  UserIcon,
  LinkIcon,
  CheckIcon,
  ChevronUpDownIcon
} from '@heroicons/vue/24/outline';
import EditableLabeledValue from '@/components/record-page/EditableLabeledValue.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { shouldHideDetailField, shouldHideRecordPaneDetailField } from '@/components/record-page/fieldVisibilityGuards';
import { extractRecordCountry } from '@/utils/phoneInput';

/** Match DynamicFormField / quick create drawer — keep in sync with EditableLabeledValue. */
const DRAWER_FIELD_LABEL_CLASS = 'block text-sm/6 font-medium text-gray-900 dark:text-white';

const DRAWER_FIELD_CONTROL_CLASS =
  'block w-full mt-1 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500';

const DRAWER_FIELD_READ_ONLY_DISPLAY_CLASS =
  'block w-full mt-1 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 sm:text-sm/6 dark:outline-white/10';

const DRAWER_FIELD_LISTBOX_CLASS =
  'block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 relative cursor-default text-left';

function joinDrawerFieldClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}

function getRecordPathFieldSelectedId(field) {
  const v = field?.value;
  if (v == null || v === '') return null;
  if (Array.isArray(v)) {
    const first = v[0];
    if (first == null || first === '') return null;
    if (typeof first === 'object') return first._id ?? first.id ?? first.value ?? null;
    return first;
  }
  if (typeof v === 'object') return v._id ?? v.id ?? null;
  return v;
}

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: {
    type: Object,
    default: () => ({ module: '' })
  },
  /** When set, use these rows instead of adapter.getDetailFields (e.g. right-pane Details tab with search). */
  fieldRowsOverride: {
    type: Array,
    default: null
  },
  /** Show every field row (skip "View all" truncation). */
  showAllFields: {
    type: Boolean,
    default: false
  },
  /**
   * default: horizontal icon + label + value (main column).
   * compact: stacked label + value, card list — best for narrow right pane.
   */
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'compact'].includes(v)
  },
  /** Compact pane: show section headers from field groupId / groupLabel (from adapter). */
  groupFields: {
    type: Boolean,
    default: true
  }
});

const recordCountry = computed(() => extractRecordCountry(props.record) || '');

function displayFieldLabel(field) {
  const mk = String(props.context?.module || '').toLowerCase();
  return resolveFieldLabel(mk, field, t, te);
}

function displayFieldOptions(field) {
  return localizeSelectOptions(field?.options, t, te);
}

function shouldFormatDetailValue(field) {
  const type = String(field?.type || 'text').toLowerCase();
  return !['user', 'entity', 'select', 'tags', 'multi-select', 'phone'].includes(type);
}

const isCompact = computed(() => props.variant === 'compact');

function isNewGroupHeader(fieldIdx, field) {
  if (!isCompact.value || !props.groupFields) return false;
  const list = visibleFields.value;
  if (fieldIdx === 0) return true;
  const prev = list[fieldIdx - 1];
  return (field.groupId || '') !== (prev.groupId || '');
}

/** Visual accent per adapter group (Core, app scopes, System, etc.). */
function groupHeaderClass(field) {
  const id = String(field?.groupId || '').toLowerCase();
  if (id === 'core') {
    return 'text-indigo-700 dark:text-indigo-300';
  }
  if (id === 'system') {
    return 'text-slate-600 dark:text-slate-300';
  }
  if (id.startsWith('app-')) {
    return 'text-emerald-700 dark:text-emerald-300';
  }
  if (id === 'meta') {
    return 'text-amber-700 dark:text-amber-300';
  }
  if (id.startsWith('explicit-')) {
    return 'text-violet-700 dark:text-violet-300';
  }
  return 'text-gray-600 dark:text-gray-300';
}

const fields = computed(() => {
  let list;
  if (props.fieldRowsOverride != null) {
    list = Array.isArray(props.fieldRowsOverride) ? props.fieldRowsOverride : [];
  } else {
    const value = props.adapter?.getDetailFields?.(props.record, props.context);
    list = Array.isArray(value) ? value : [];
  }
  const moduleKey = (props.context?.moduleKey || props.context?.module || '').toString().toLowerCase().trim();
  // Right-pane Details tab (override): show audit/system fields read-only; main column still uses stricter hides.
  if (props.fieldRowsOverride != null) {
    return list.filter((field) => !shouldHideRecordPaneDetailField(field, moduleKey));
  }
  return list.filter((field) => !shouldHideDetailField(field, moduleKey, { enforceRegistryKnown: false }));
});

const hideHeader = computed(() => props.context?.hideHeader === true);

const DEFAULT_VISIBLE_FIELDS = 5;
const isSectionExpanded = computed(() => (props.context?.expandedLeftSection || '').toString().trim() === 'details');
const expanded = ref(isSectionExpanded.value);

// When the detail section is expanded (e.g. user clicked "Expand"), show all fields
watch(isSectionExpanded, (expandedMode) => {
  if (expandedMode) expanded.value = true;
}, { immediate: false });

const visibleFields = computed(() => {
  const list = fields.value;
  if (props.showAllFields || expanded.value || list.length <= DEFAULT_VISIBLE_FIELDS) return list;
  return list.slice(0, DEFAULT_VISIBLE_FIELDS);
});

const showExpandCollapse = computed(() => !props.showAllFields && fields.value.length > DEFAULT_VISIBLE_FIELDS);

function expand() {
  expanded.value = true;
  props.adapter?.viewAllDetails?.(props.record, props.context);
}

function collapse() {
  expanded.value = false;
}

const getFieldIcon = (field) => {
  if (field?.prefixIcon) return field.prefixIcon;

  const key = String(field?.key || '').toLowerCase();
  if (key === 'relatedto') return LinkIcon;
  if (key === 'tags') return TagIcon;

  const map = {
    number: CurrencyDollarIcon,
    date: CalendarDaysIcon,
    text: DocumentTextIcon,
    select: TagIcon,
    user: UserIcon,
    entity: UserIcon
  };
  const type = String(field?.type || 'text').toLowerCase();
  return map[type] || DocumentTextIcon;
};

/** Await adapter save so API validation errors surface inline (EditableLabeledValue commitSave). */
async function commitFieldSave(field, value) {
  if (typeof field?.onSave !== 'function') return;
  await field.onSave(value);
}

const handleFieldEdit = (field, event) => {
  if (typeof field?.onEdit === 'function') {
    field.onEdit(event);
  }
};

</script>

<style scoped>
/* Match DynamicForm / quick create drawer: space-y-6 between field blocks */
.details-section__compact-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Pull first field in a group closer to its header (24px gap → ~8px visual) */
.details-section__group-header {
  margin-bottom: -1rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.details-section :deep(.text-record-empty) {
  color: var(--color-neutral-300) !important;
}

:global(.dark) .details-section :deep(.text-record-empty) {
  color: var(--color-neutral-600) !important;
}
</style>
