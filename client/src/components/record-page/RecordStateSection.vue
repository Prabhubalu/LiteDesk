<template>
  <section ref="sectionRef" class="record-state-section mb-8 mt-4" aria-labelledby="record-state-heading">
    <h2 id="record-state-heading" class="sr-only">{{ resolvedHeading }}</h2>
    <div
      v-if="hasConfiguredFields"
      :class="[
        'record-state-section__grid',
        singleColumn || isContainerNarrow ? 'record-state-section__grid--single' : '',
        singleColumn ? 'record-state-section--compact' : ''
      ]"
    >
      <div
        v-for="(columnFields, colIndex) in columnGroups"
        :key="colIndex"
        :class="singleColumn ? 'space-y-2' : 'space-y-1'"
      >
        <template v-for="field in columnFields" :key="field.key">
          <EditableLabeledValue
            v-if="shouldRenderEditableField(field)"
            :label="displayFieldLabel(field)"
            :value="getFieldRawValue(field)"
            :type="field.type || 'text'"
            :prefix-icon="field.icon || null"
            row-padding-class="record-state-section__row"
            :can-edit="field.canEdit === true"
            :options="Array.isArray(field.options) ? field.options : []"
            :min="field.min"
            :step="field.step"
            :format-value="field.formatValue || (shouldUseFormatValue(field) ? () => getFieldValue(field) : null)"
            :get-tag-chip-class="field.getTagChipClass"
            :get-tag-chip-style="field.getTagChipStyle"
            :people-first-name-with-salutation="field.peopleFirstNameWithSalutation === true"
            :salutation-value="field.salutationValue"
            :salutation-options="field.salutationOptions"
            :record-country="recordCountry"
            :field-key="field.key"
            :module-key="moduleKey"
            layout="row"
            :commit-save="(v) => commitFieldSave(field, v)"
          />
          <div
            v-else-if="shouldRenderActionField(field)"
            class="record-state-section__row record-field-row-grid"
          >
            <span class="flex h-4 w-4 shrink-0 items-center justify-center text-gray-400 dark:text-gray-500" aria-hidden="true">
              <component
                v-if="field.icon"
                :is="field.icon"
                class="h-4 w-4"
              />
            </span>
            <span class="min-w-0 truncate text-sm text-gray-700 dark:text-gray-300">{{ displayFieldLabel(field) }}</span>
            <div class="min-w-0 min-h-8 flex">
              <button
                type="button"
                class="flex-1 min-w-0 w-full min-h-8 text-left text-sm text-gray-900 dark:text-white rounded px-2 py-1 -mx-2 -my-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer flex items-center"
                @click="handleFieldEdit(field, $event)"
              >
                <template v-if="field.type === 'tags' && Array.isArray(getFieldRawValue(field)) && getFieldRawValue(field).length > 0">
                  <div class="flex flex-wrap gap-1.5 text-left">
                    <span
                      v-for="(tag, index) in getFieldRawValue(field)"
                      :key="`${tag}-${index}`"
                      :style="field.getTagChipStyle ? field.getTagChipStyle(tag) : undefined"
                      :class="['inline-block text-xs px-2 py-0.5 rounded', (field.getTagChipClass ? field.getTagChipClass(tag) : null) || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200']"
                    >
                      {{
                        typeof tag === 'object'
                          ? (tag?.name
                            || tag?.label
                            || [tag?.firstName, tag?.lastName].filter(Boolean).join(' ').trim()
                            || tag?.email
                            || tag?._id
                            || '—')
                          : tag
                      }}
                    </span>
                  </div>
                </template>
                <template v-else-if="field.type === 'tags'">
                  <span class="text-record-empty">—</span>
                </template>
                <template v-else>
                  <a
                    v-if="shouldRenderLinkValue(field)"
                    :href="getFieldHref(field)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="truncate text-indigo-600 dark:text-indigo-400 hover:underline"
                    @click.stop
                  >
                    {{ getFieldValue(field) }}
                  </a>
                  <span v-else-if="getFieldValue(field)" class="truncate">{{ getFieldValue(field) }}</span>
                  <span v-else class="text-record-empty">—</span>
                </template>
              </button>
            </div>
          </div>
          <div
            v-else
            class="record-state-section__row record-field-row-grid"
          >
            <span class="flex h-4 w-4 shrink-0 items-center justify-center text-gray-400 dark:text-gray-500" aria-hidden="true">
              <component
                v-if="field.icon"
                :is="field.icon"
                class="h-4 w-4"
              />
            </span>
            <span class="min-w-0 truncate text-sm text-gray-700 dark:text-gray-300">{{ displayFieldLabel(field) }}</span>
            <div class="min-w-0 min-h-8 flex items-center rounded px-2 -mx-2 -my-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
              <slot :name="field.slotKey || field.key">
                <div
                  v-if="(field.type === 'tags' || field.type === 'multi-select') && Array.isArray(getFieldRawValue(field)) && getFieldRawValue(field).length > 0"
                  class="flex flex-wrap gap-1.5 min-w-0"
                >
                  <span
                    v-for="(tag, index) in getFieldRawValue(field)"
                    :key="`${tag}-${index}`"
                    :style="field.getTagChipStyle ? field.getTagChipStyle(tag) : undefined"
                    :class="['inline-block text-xs px-2 py-0.5 rounded', (field.getTagChipClass ? field.getTagChipClass(tag) : null) || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200']"
                  >
                    {{
                      typeof tag === 'object'
                        ? (tag?.name
                          || tag?.label
                          || [tag?.firstName, tag?.lastName].filter(Boolean).join(' ').trim()
                          || tag?.email
                          || tag?._id
                          || '—')
                        : tag
                    }}
                  </span>
                </div>
                <a
                  v-else-if="shouldRenderLinkValue(field)"
                  :href="getFieldHref(field)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block w-full min-w-0 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                  @click.stop
                >
                  {{ getFieldValue(field) }}
                </a>
                <span
                  v-else-if="getFieldValue(field) != null && getFieldValue(field) !== ''"
                  class="block w-full min-w-0 text-sm text-gray-900 dark:text-white"
                >
                  {{ getFieldValue(field) }}
                </span>
                <span v-else class="block w-full min-w-0 text-sm text-record-empty">—</span>
              </slot>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Optional: signals and hint below the grid (e.g. Task: Overdue, Due today, next action) -->
    <div v-if="signals && signals.length > 0" class="record-state-section__signals flex flex-wrap gap-1.5 mt-4">
      <span
        v-for="(signal, i) in signals"
        :key="i"
        class="inline-block text-xs text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700"
      >
        {{ signal }}
      </span>
    </div>
    <div v-if="nextActionHint != null && nextActionHint !== ''" class="record-state-section__hint text-sm text-gray-600 dark:text-gray-300 italic mt-2">
      {{ nextActionHint }}
    </div>
  </section>
</template>

<script setup>
import { computed, useSlots, inject, ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import EditableLabeledValue from '@/components/record-page/EditableLabeledValue.vue';
import { extractRecordCountry } from '@/utils/phoneInput';
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';
import { formatUserDate, formatUserDateTime } from '@/utils/localeFormat';

const { t, te } = useI18n();

/**
 * RecordStateSection – Key fields in two-column layout by default; collapses to one field per row
 * when the left column narrows (e.g. wider right pane). Field rows stack label/value at very narrow widths.
 *
 * Standardized: single data-driven path. Props `fields` + `fieldValues` define all rows;
 * one template renders both columns via v-for over columnGroups (single list when singleColumn).
 * Field contract: key, label, icon, type, canEdit, onSave, options; adapters supply this.
 * Optional: slots by field key for custom cell content; signals + nextActionHint below grid.
 */
const props = defineProps({
  heading: { type: String, default: '' },
  moduleKey: { type: String, default: '' },
  fields: { type: Array, default: () => [] },
  fieldValues: { type: Object, default: () => ({}) },
  signals: { type: Array, default: () => [] },
  nextActionHint: { type: String, default: null }
});

const resolvedHeading = computed(() => props.heading || t('records.stateHeadingSr'));

const recordCountry = computed(() => extractRecordCountry(props.fieldValues) || '');

function displayFieldLabel(field) {
  return resolveFieldLabel(props.moduleKey, field, t, te);
}

const recordLayoutIsMobile = inject('recordLayoutIsMobile', null);
const singleColumn = computed(() => Boolean(recordLayoutIsMobile?.value));

const sectionRef = ref(null);
const isContainerNarrow = ref(false);
const NARROW_CONTAINER_PX = 704;
let sectionResizeObserver = null;

const hasConfiguredFields = computed(() => Array.isArray(props.fields) && props.fields.length > 0);
const slots = useSlots();

const leftFields = computed(() => {
  if (!hasConfiguredFields.value) return [];
  const explicitlyLeft = props.fields.filter(field => field?.column === 'left');
  if (explicitlyLeft.length > 0) return explicitlyLeft;
  return props.fields.filter((_, index) => index % 2 === 0);
});

const rightFields = computed(() => {
  if (!hasConfiguredFields.value) return [];
  const explicitlyRight = props.fields.filter(field => field?.column === 'right');
  if (explicitlyRight.length > 0) return explicitlyRight;
  return props.fields.filter((_, index) => index % 2 === 1);
});

/** Flat list on mobile/embed or when left column narrows; otherwise left + right columns. */
const columnGroups = computed(() => {
  if (!hasConfiguredFields.value) return [];
  if (singleColumn.value || isContainerNarrow.value) return [props.fields];
  return [leftFields.value, rightFields.value];
});

onMounted(() => {
  const el = sectionRef.value;
  if (!el || typeof ResizeObserver === 'undefined') return;

  sectionResizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect?.width ?? 0;
    isContainerNarrow.value = width > 0 && width <= NARROW_CONTAINER_PX;
  });
  sectionResizeObserver.observe(el);
});

onBeforeUnmount(() => {
  sectionResizeObserver?.disconnect();
  sectionResizeObserver = null;
});

const getFieldValue = (field) => {
  if (!field) return null;
  const valueKey = field.valueKey || field.key;
  const raw = props.fieldValues?.[valueKey] ?? null;
  if (raw == null || raw === '') return raw;

  if (field.type === 'user' || field.type === 'entity') {
    if (typeof raw === 'object') {
      const name = raw.name ?? raw.title ?? raw.label
        ?? [raw.firstName ?? raw.first_name, raw.lastName ?? raw.last_name].filter(Boolean).join(' ').trim()
        ?? raw.email;
      if (name) return name;
    }
    const id = typeof raw === 'object' ? (raw._id ?? raw.id) : raw;
    const matched = (field.options || []).find((opt) => {
      const optId = opt?.value ?? opt?._id ?? opt?.id;
      return optId != null && String(optId) === String(id);
    });
    if (matched) return matched.label ?? matched.name ?? matched.value;
  }

  if (field.type === 'tags' && Array.isArray(raw)) {
    return raw.map((item) => (item != null && typeof item === 'object' ? (item.name || item.label || item.title) : String(item))).filter(Boolean).join(', ');
  }

  if (field.type === 'multi-select' && Array.isArray(raw)) {
    return raw.map((item) => {
      if (item != null && typeof item === 'object') {
        const name = [item.firstName ?? item.first_name, item.lastName ?? item.last_name]
          .filter(Boolean)
          .join(' ')
          .trim();
        return name || item.label || item.name || item.email || item.value || item._id || '';
      }
      const id = String(item);
      const matched = (field.options || []).find((opt) => {
        const optId = opt?.value ?? opt?._id ?? opt?.id;
        return optId != null && String(optId) === id;
      });
      return matched?.label ?? matched?.name ?? id;
    }).filter(Boolean).join(', ');
  }

  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(raw.trim())) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const isDateTime = raw.includes('T');
      return isDateTime
        ? formatUserDateTime(d)
        : formatUserDate(d);
    }
  }
  return raw;
};

const shouldUseFormatValue = (field) => {
  const type = String(field?.type || 'text').toLowerCase();
  return !['user', 'entity', 'select', 'tags', 'multi-select', 'phone'].includes(type);
};

const getFieldRawValue = (field) => {
  if (!field) return null;
  if (Object.prototype.hasOwnProperty.call(field, 'value')) return field.value;
  const valueKey = field.valueKey || field.key;
  return props.fieldValues?.[valueKey] ?? null;
};

const hasFieldSlot = (field) => {
  const slotKey = field?.slotKey || field?.key;
  return Boolean(slotKey && slots[slotKey]);
};

const shouldRenderEditableField = (field) => {
  if (!field || hasFieldSlot(field)) return false;
  return field.canEdit === true && typeof field.onSave === 'function';
};

const shouldRenderActionField = (field) => {
  if (!field || hasFieldSlot(field)) return false;
  return field.canOpenEditor === true && typeof field.onEdit === 'function';
};

async function commitFieldSave(field, value) {
  if (typeof field?.onSave !== 'function') return;
  await field.onSave(value);
}

const handleFieldEdit = (field, event) => {
  if (typeof field?.onEdit === 'function') {
    field.onEdit(event);
  }
};

const normalizeExternalUrl = (value) => {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
};

const shouldRenderLinkValue = (field) => {
  if (!field) return false;
  const fieldType = String(field.type || '').toLowerCase();
  const key = String(field.key || field.valueKey || '').toLowerCase();
  const isUrlField = fieldType === 'url' || key.includes('website') || key.includes('url') || key.includes('link');
  if (!isUrlField) return false;
  return Boolean(getFieldHref(field));
};

const getFieldHref = (field) => normalizeExternalUrl(getFieldValue(field));
</script>

<style scoped>
.record-state-section {
  container-type: inline-size;
  container-name: record-state;
}

.record-state-section__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 2rem;
  row-gap: 0.25rem;
}

.record-state-section__grid--single,
.record-state-section--compact {
  grid-template-columns: 1fr;
}

@container record-state (max-width: 44rem) {
  .record-state-section__grid:not(.record-state-section__grid--single) {
    grid-template-columns: 1fr;
  }
}

/* Match DetailsSection and EditableLabeledValue default row: same padding and min-height for consistent label–value spacing across People, Task, etc. */
.record-state-section__row {
  min-height: 2.5rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

/* Single-column / mobile: keep readable vertical rhythm between key fields */
.record-state-section--compact .record-state-section__row {
  min-height: 2.5rem;
  padding-top: 0.375rem;
  padding-bottom: 0.375rem;
}
</style>
