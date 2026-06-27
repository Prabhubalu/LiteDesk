<template>
  <div>
    <p class="mb-3 text-xs" :class="ui.textMuted">{{ t('templates.builderMergeTagsHint') }}</p>

    <div v-if="loading" class="text-sm" :class="ui.textMuted">{{ t('states.loading') }}</div>

    <div v-else-if="!moduleScope" class="text-sm" :class="ui.textMuted">
      {{ t('templates.builderDataSelectModule') }}
    </div>

    <template v-else>
      <div class="mb-3 space-y-2">
        <input
          v-model="searchQuery"
          type="search"
          :class="ui.input"
          :placeholder="t('templates.builderMergeTagsSearchPlaceholder')"
        />
        <select v-model="selectedGroupId" :class="ui.input">
          <option value="">{{ t('templates.builderMergeTagsFilterAll') }}</option>
          <option v-for="group in allGroups" :key="group.id" :value="group.id">
            {{ group.label }} ({{ group.fields.length }})
          </option>
        </select>
      </div>

      <div v-if="!filteredGroups.length" class="text-sm" :class="ui.textMuted">
        {{ t('templates.builderMergeTagsNoResults') }}
      </div>

      <div v-else class="space-y-4 pb-1">
        <section v-for="group in filteredGroups" :key="group.id">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide" :class="ui.textMuted">
            {{ group.label }}
            <span class="font-normal normal-case">({{ group.fields.length }})</span>
          </h3>
          <ul class="space-y-0.5">
            <li v-for="field in group.fields" :key="field.path">
              <button
                type="button"
                data-arivu-merge-insert="true"
                class="w-full rounded-lg border px-2.5 py-2 text-left transition-colors hover:border-primary-400 dark:hover:border-primary-600"
                :class="[ui.border, ui.hoverRow]"
                @mousedown.prevent="emit('insert', field.path)"
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
        </section>
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

const props = defineProps({
  moduleScope: { type: String, default: '' }
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

const allGroups = computed(() => flattenMergeTagTreeGroups(treeGroups.value, t));

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
