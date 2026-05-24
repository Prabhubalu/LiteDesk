<template>
  <section class="record-state-section mb-8 mt-4" aria-labelledby="record-state-heading">
    <h2 id="record-state-heading" class="sr-only">{{ resolvedHeading }}</h2>
    <div
      v-if="hasConfiguredFields"
      :class="[
        'grid gap-x-8',
        singleColumn ? 'grid-cols-1 gap-y-1 record-state-section--compact' : 'grid-cols-1 xl:grid-cols-2 gap-y-2'
      ]"
    >
      <div
        v-for="(columnFields, colIndex) in columnGroups"
        :key="colIndex"
        :class="singleColumn ? 'space-y-0' : 'space-y-1'"
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
            :format-value="() => getFieldValue(field)"
            layout="row"
            :commit-save="(v) => commitFieldSave(field, v)"
          />
          <div
            v-else-if="shouldRenderActionField(field)"
            class="record-state-section__row flex items-center gap-3"
          >
            <div class="record-state-section__label flex items-center gap-3 flex-shrink-0">
              <component
                v-if="field.icon"
                :is="field.icon"
                class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ displayFieldLabel(field) }}</span>
            </div>
            <div class="flex-1 min-w-0 min-h-8 flex">
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
                      :class="['inline-block text-xs px-2 py-0.5 rounded', (field.getTagChipClass ? field.getTagChipClass(tag) : null) || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200']"
                    >
                      {{ typeof tag === 'object' ? (tag?.name || tag?.label || tag) : tag }}
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
            class="record-state-section__row flex items-center gap-3"
          >
            <div class="record-state-section__label flex items-center gap-3 flex-shrink-0">
              <component
                v-if="field.icon"
                :is="field.icon"
                class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ displayFieldLabel(field) }}</span>
            </div>
            <div class="flex-1 min-w-0 min-h-8 flex items-center rounded px-2 -mx-2 -my-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
              <slot :name="field.slotKey || field.key">
                <a
                  v-if="shouldRenderLinkValue(field)"
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
import { computed, useSlots, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import EditableLabeledValue from '@/components/record-page/EditableLabeledValue.vue';
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';

const { t, te } = useI18n();

/**
 * RecordStateSection – Key fields in two-column layout (or single-column when embed/quick preview).
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

function displayFieldLabel(field) {
  return resolveFieldLabel(props.moduleKey, field, t, te);
}

const recordLayoutIsMobile = inject('recordLayoutIsMobile', null);
const singleColumn = computed(() => Boolean(recordLayoutIsMobile?.value));

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

/** When singleColumn (e.g. quick preview), one group with all fields in order; otherwise left + right. */
const columnGroups = computed(() => {
  if (!hasConfiguredFields.value) return [];
  if (singleColumn.value) return [props.fields];
  return [leftFields.value, rightFields.value];
});

const getFieldValue = (field) => {
  if (!field) return null;
  const valueKey = field.valueKey || field.key;
  const raw = props.fieldValues?.[valueKey] ?? null;
  if (raw == null || raw === '') return raw;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(raw.trim())) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const isDateTime = raw.includes('T');
      return isDateTime
        ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return raw;
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
/* Match DetailsSection and EditableLabeledValue default row: same padding and min-height for consistent label–value spacing across People, Task, etc. */
.record-state-section__row {
  min-height: 2.5rem;
  padding: 0.5rem 1rem; /* py-2 px-4 */
}

/* Tighter spacing in quick preview / single-column (embed) layout */
.record-state-section--compact .record-state-section__row {
  min-height: 2.5rem;
  padding: 0.25rem 1rem;
}

/* Match EditableLabeledValue row layout: same label width so key fields align across People, Tasks, etc. */
.record-state-section__label {
  min-width: 12rem;
}
</style>
