<template>
  <div :class="variant === 'inline' ? 'space-y-2' : 'space-y-4'">
    <div
      v-if="variant !== 'inline'"
      class="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-1 pb-3 -mt-1 space-y-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/80"
    >
      <p v-if="intro" class="text-sm text-gray-600 dark:text-gray-400">{{ intro }}</p>
      <div v-if="catalogModules.length" class="relative">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="t('settings.fieldPermsSearchPh')"
          class="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>

    <div
      v-if="!catalogModules.length"
      :class="[
        'text-sm text-gray-500 dark:text-gray-400 text-center',
        variant === 'inline' ? 'py-2' : 'rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-8'
      ]"
    >
      {{ emptyLabel }}
    </div>
    <div
      v-else-if="variant !== 'inline' && !filteredModules.length"
      class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-8 text-sm text-gray-500 dark:text-gray-400 text-center"
    >
      {{ t('settings.fieldPermsNoMatches') }}
    </div>
    <template v-for="mod in displayModules" :key="mod.moduleKey">
      <section
        v-if="variant !== 'inline'"
        class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <button
          type="button"
          class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700 text-left hover:bg-gray-100/80 dark:hover:bg-gray-900/60 transition-colors"
          :aria-expanded="isModuleExpanded(mod.moduleKey)"
          @click="toggleModule(mod.moduleKey)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ mod.label || mod.moduleKey }}</h4>
              <p v-if="showAppScope && scopeLabel(mod)" class="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5 font-medium">
                {{ scopeLabel(mod) }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ moduleHint }}</p>
            </div>
            <ChevronRightIcon
              :class="[
                'h-4 w-4 shrink-0 text-gray-400 mt-0.5 transition-transform',
                isModuleExpanded(mod.moduleKey) && 'rotate-90'
              ]"
              aria-hidden="true"
            />
          </div>
        </button>
        <div
          v-show="isModuleExpanded(mod.moduleKey)"
          class="divide-y divide-gray-100 dark:divide-gray-700/80 max-h-80 overflow-y-auto"
        >
          <FieldPermissionRow
            v-for="field in fieldsForModule(mod)"
            :key="field.key"
            :field="field"
            :mod="mod"
            :level="levelFor(mod, field.key)"
            :baseline-label="baselineLabelFor(mod, field.key)"
            :disabled="disabled"
            :inherit-label="inheritLabel"
            :write-label="writeLabel"
            :read-label="readLabel"
            :hidden-label="hiddenLabel"
            @change="onLevelChange(mod, field.key, $event)"
          />
        </div>
      </section>
      <div v-else class="divide-y divide-gray-100 dark:divide-gray-700/80 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <FieldPermissionRow
          v-for="field in mod.fieldCatalog"
          :key="field.key"
          :field="field"
          :mod="mod"
          :level="levelFor(mod, field.key)"
          :baseline-label="baselineLabelFor(mod, field.key)"
          :disabled="disabled"
          :inherit-label="inheritLabel"
          :write-label="writeLabel"
          :read-label="readLabel"
          :hidden-label="hiddenLabel"
          compact
          @change="onLevelChange(mod, field.key, $event)"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import {
  resolveFieldOverrideLevel,
  resolveFieldRbacLevel,
  setFieldRbacLevel,
  modulesWithFieldCatalog
} from '@/utils/fieldRbacPermission';

const props = defineProps({
  modules: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({}) },
  baselinePermissions: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
  intro: { type: String, default: '' },
  emptyLabel: { type: String, default: '' },
  showAppScope: { type: Boolean, default: false },
  inheritFromProfile: { type: Boolean, default: false },
  variant: {
    type: String,
    default: 'full',
    validator: (v) => ['full', 'inline'].includes(v)
  }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();

const searchQuery = ref('');
/** @type {import('vue').Ref<Set<string>>} */
const collapsedModules = ref(new Set());

const catalogModules = computed(() => modulesWithFieldCatalog(props.modules));

const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

const filteredModules = computed(() => {
  const q = normalizedSearch.value;
  if (!q) return catalogModules.value;

  return catalogModules.value
    .map((mod) => {
      const moduleHit =
        String(mod.label || '')
          .toLowerCase()
          .includes(q) || String(mod.moduleKey || '').toLowerCase().includes(q);
      const matchingFields = (mod.fieldCatalog || []).filter((field) => {
        const label = String(field.label || '').toLowerCase();
        const key = String(field.key || '').toLowerCase();
        return label.includes(q) || key.includes(q);
      });
      if (!moduleHit && !matchingFields.length) return null;
      return {
        ...mod,
        fieldCatalog: moduleHit ? mod.fieldCatalog : matchingFields
      };
    })
    .filter(Boolean);
});

const displayModules = computed(() =>
  props.variant === 'inline' ? catalogModules.value : filteredModules.value
);

watch(normalizedSearch, (q) => {
  if (!q) return;
  // Searching: expand all visible modules so matches are visible
  const next = new Set(collapsedModules.value);
  for (const mod of filteredModules.value) {
    next.delete(mod.moduleKey);
  }
  collapsedModules.value = next;
});

const moduleHint = computed(() => t('settings.fieldPermsModuleHint'));
const inheritLabel = computed(() =>
  props.inheritFromProfile ? t('settings.fieldPermsInheritFromProfile') : t('settings.fieldPermsInherit')
);
const writeLabel = computed(() => t('settings.fieldPermsWrite'));
const readLabel = computed(() => t('settings.fieldPermsRead'));
const hiddenLabel = computed(() => t('settings.fieldPermsHidden'));

const FieldPermissionRow = defineComponent({
  name: 'FieldPermissionRow',
  props: {
    field: { type: Object, required: true },
    mod: { type: Object, required: true },
    level: { type: String, required: true },
    baselineLabel: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    inheritLabel: { type: String, required: true },
    writeLabel: { type: String, required: true },
    readLabel: { type: String, required: true },
    hiddenLabel: { type: String, required: true },
    compact: { type: Boolean, default: false }
  },
  emits: ['change'],
  setup(rowProps, { emit: rowEmit }) {
    return () =>
      h(
        'div',
        {
          class: [
            'flex items-center justify-between gap-4',
            rowProps.compact ? 'px-3 py-2 bg-gray-50/60 dark:bg-gray-900/20' : 'px-4 py-2.5'
          ]
        },
        [
          h('div', { class: 'min-w-0' }, [
            h(
              'p',
              {
                class: [
                  'text-gray-900 dark:text-white truncate',
                  rowProps.compact ? 'text-xs font-medium' : 'text-sm'
                ]
              },
              rowProps.field.label || rowProps.field.key
            ),
            rowProps.baselineLabel
              ? h(
                  'p',
                  { class: 'text-[11px] text-gray-500 dark:text-gray-400 mt-0.5' },
                  rowProps.baselineLabel
                )
              : !rowProps.compact
                ? h(
                    'p',
                    { class: 'text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate' },
                    rowProps.field.key
                  )
                : null
          ]),
          h(
            'select',
            {
              value: rowProps.level,
              disabled: rowProps.disabled,
              class:
                'rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 shrink-0',
              onChange: (event) => rowEmit('change', event.target.value)
            },
            [
              h('option', { value: 'inherit' }, rowProps.inheritLabel),
              h('option', { value: 'write' }, rowProps.writeLabel),
              h('option', { value: 'read' }, rowProps.readLabel),
              h('option', { value: 'hidden' }, rowProps.hiddenLabel)
            ]
          )
        ]
      );
  }
});

function fieldsForModule(mod) {
  return mod.fieldCatalog || [];
}

function isModuleExpanded(moduleKey) {
  return !collapsedModules.value.has(moduleKey);
}

function toggleModule(moduleKey) {
  const next = new Set(collapsedModules.value);
  if (next.has(moduleKey)) next.delete(moduleKey);
  else next.add(moduleKey);
  collapsedModules.value = next;
}

function appKeyFor(mod) {
  return mod.fieldPermissionAppKey || mod.appKey || null;
}

function scopeLabel(mod) {
  const appKey = appKeyFor(mod);
  if (appKey) {
    return t('settings.fieldPermsAppScope', { app: appKey });
  }
  if (mod.scope === 'core') {
    return t('settings.fieldPermsSharedScope');
  }
  return '';
}

function levelFor(mod, fieldKey) {
  const appKey = appKeyFor(mod);
  const level = resolveFieldOverrideLevel(props.modelValue, appKey, mod.moduleKey, fieldKey);
  return level || 'inherit';
}

function baselineLabelFor(mod, fieldKey) {
  if (!props.inheritFromProfile) return '';
  const appKey = appKeyFor(mod);
  const override = resolveFieldOverrideLevel(props.modelValue, appKey, mod.moduleKey, fieldKey);
  if (override) return '';
  const baseline = resolveFieldRbacLevel(
    props.baselinePermissions,
    appKey,
    mod.moduleKey,
    fieldKey
  );
  if (!baseline) return '';
  const labelMap = {
    write: writeLabel.value,
    read: readLabel.value,
    hidden: hiddenLabel.value
  };
  return t('settings.fieldPermsProfileDefault', { level: labelMap[baseline] || baseline });
}

function onLevelChange(mod, fieldKey, value) {
  const next = setFieldRbacLevel(
    props.modelValue || {},
    appKeyFor(mod),
    mod.moduleKey,
    fieldKey,
    value
  );
  emit('update:modelValue', next);
}
</script>
