<template>
  <div>
    <p class="mb-3 text-xs" :class="ui.textMuted">{{ t('templates.builderMergeTagsHint') }}</p>

    <div v-if="loading" class="text-sm" :class="ui.textMuted">{{ t('states.loading') }}</div>

    <div v-else-if="!moduleScope" class="text-sm" :class="ui.textMuted">
      {{ t('templates.builderDataSelectModule') }}
    </div>

    <div v-else class="space-y-4">
      <section v-for="group in flatGroups" :key="group.id">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide" :class="ui.textMuted">
          {{ group.label }}
        </h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="field in group.fields"
            :key="field.path"
            type="button"
            class="rounded-full border px-2.5 py-1 text-xs font-mono hover:border-primary-400 dark:hover:border-primary-600"
            :class="ui.border"
            @click="emit('insert', field.path)"
          >
            {{ field.label }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useTemplateMergeTagSchema } from '@/composables/useTemplateMergeTagSchema';

const props = defineProps({
  moduleScope: { type: String, default: '' }
});

const emit = defineEmits(['insert']);

const { t } = useI18n();
const ui = useBuilderUi();
const { loading, treeGroups } = useTemplateMergeTagSchema(toRef(props, 'moduleScope'));

function flattenGroup(node) {
  if (node.labelKey) return t(node.labelKey);
  return node.label || '';
}

function flattenTree(nodes, output = []) {
  for (const node of nodes) {
    if (Array.isArray(node.children) && node.children.length) {
      const leafFields = node.children.filter((child) => child.path && !child.children?.length);
      const nestedGroups = node.children.filter((child) => child.children?.length);
      if (leafFields.length) {
        output.push({
          id: node.id,
          label: flattenGroup(node),
          fields: leafFields
        });
      }
      flattenTree(nestedGroups, output);
    } else if (node.path) {
      const last = output[output.length - 1];
      if (last) last.fields.push(node);
      else {
        output.push({ id: node.id, label: node.label || node.path, fields: [node] });
      }
    }
  }
  return output;
}

const flatGroups = computed(() => flattenTree(treeGroups.value));
</script>
