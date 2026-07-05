<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden" data-arivu-merge-picker="true">
    <p class="mb-3 shrink-0 text-xs" :class="ui.textMuted">{{ t('templates.builderMergeTagsHint') }}</p>

    <div v-if="loading" class="text-sm" :class="ui.textMuted">{{ t('states.loading') }}</div>

    <div v-else-if="!moduleScope" class="text-sm" :class="ui.textMuted">
      {{ t('templates.builderDataSelectModule') }}
    </div>

    <template v-else>
      <div class="mb-3 shrink-0 space-y-2" data-arivu-merge-search="true">
        <input
          v-model="searchQuery"
          type="search"
          :class="ui.input"
          :placeholder="t('templates.builderMergeTagsSearchPlaceholder')"
        />
        <div data-arivu-merge-filter="true">
          <BuilderSelect
            v-model="selectedGroupId"
            :options="groupFilterOptions"
            :allow-empty="true"
            :empty-label="t('templates.builderMergeTagsFilterAll')"
            :options-attrs="{ 'data-arivu-merge-filter-options': 'true' }"
          />
        </div>
      </div>

      <div v-if="!filteredGroups.length" class="text-sm" :class="ui.textMuted">
        {{ t('templates.builderMergeTagsNoResults') }}
      </div>

      <div v-else class="min-h-0 flex-1 space-y-1 overflow-y-auto pb-1">
        <BuilderDisclosureSection
          v-for="group in filteredGroups"
          :key="group.id"
          :title="`${group.label} (${group.fields.length})`"
          :default-open="filteredGroups.length <= 3"
        >
          <ul class="space-y-0.5">
            <li v-for="field in group.fields" :key="field.path">
              <button
                type="button"
                data-arivu-merge-insert="true"
                class="w-full rounded-md border px-2.5 py-2 text-left transition-colors hover:border-primary-400 dark:hover:border-primary-600"
                :class="[ui.border, ui.hoverRow]"
                @click.prevent="emit('insert', field.path)"
              >
                <span class="block truncate text-sm text-neutral-800 dark:text-neutral-100">
                  {{ field.label }}
                </span>
                <span class="mt-0.5 block truncate font-mono text-xs" :class="ui.textMuted">
                  {{ field.path }}
                </span>
              </button>
            </li>
          </ul>
        </BuilderDisclosureSection>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useTemplateMergeTagSchema } from '@/composables/useTemplateMergeTagSchema';
import { flattenMergeTagTreeGroups } from '@/utils/templateMergeTagSchema';
import BuilderDisclosureSection from './BuilderDisclosureSection.vue';
import BuilderSelect from './BuilderSelect.vue';

const props = defineProps({
  moduleScope: { type: String, default: '' },
  pickerActive: { type: Boolean, default: false },
  editor: { type: Object, default: null }
});

const emit = defineEmits(['insert']);

const { t } = useI18n();
const ui = useBuilderUi();
const { loading, treeGroups } = useTemplateMergeTagSchema(toRef(props, 'moduleScope'));

const searchQuery = ref('');
const selectedGroupId = ref('');

watch(
  () => props.moduleScope,
  () => {
    searchQuery.value = '';
    selectedGroupId.value = '';
  }
);

watch(
  () => props.pickerActive,
  (active) => {
    if (!active) {
      searchQuery.value = '';
    }
  }
);

const allGroups = computed(() => flattenMergeTagTreeGroups(treeGroups.value, t));

const groupFilterOptions = computed(() =>
  allGroups.value.map((group) => ({
    value: group.id,
    label: `${group.label} (${group.fields.length})`
  }))
);

const filteredGroups = computed(() => {
  let groups = allGroups.value;

  if (selectedGroupId.value) {
    groups = groups.filter((group) => group.id === selectedGroupId.value);
  }

  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return groups;

  return groups
    .map((group) => ({
      ...group,
      fields: group.fields.filter((field) => field.searchText.includes(query))
    }))
    .filter((group) => group.fields.length > 0);
});
</script>
