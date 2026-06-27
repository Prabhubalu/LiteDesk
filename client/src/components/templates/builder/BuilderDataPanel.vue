<template>
  <aside
    class="flex h-full w-64 shrink-0 flex-col border-l"
    :class="[ui.panel, ui.border]"
  >
    <div class="border-b px-4 py-3" :class="ui.border">
      <h2 :class="ui.meta">{{ t('templates.builderTabData') }}</h2>
      <p class="mt-1 text-meta" :class="ui.textMuted">{{ t('templates.builderDataDragHint') }}</p>
    </div>

    <div v-if="loading" class="flex-1 p-4 text-sm" :class="ui.textMuted">
      {{ t('states.loading') }}
    </div>

    <div v-else-if="!moduleScope" class="flex-1 p-4 text-sm" :class="ui.textMuted">
      {{ t('templates.builderDataSelectModule') }}
    </div>

    <div v-else class="flex-1 overflow-y-auto p-2">
      <ul class="space-y-0.5">
        <BuilderDataTreeNode
          v-for="group in treeGroups"
          :key="group.id"
          :node="group"
          @insert="emit('insert', $event)"
        />
      </ul>
    </div>
  </aside>
</template>

<script setup>
import { toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import BuilderDataTreeNode from '@/components/templates/builder/BuilderDataTreeNode.vue';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useTemplateMergeTagSchema } from '@/composables/useTemplateMergeTagSchema';

const props = defineProps({
  moduleScope: { type: String, default: '' }
});

const emit = defineEmits(['insert']);

const { t } = useI18n();
const ui = useBuilderUi();

const { loading, treeGroups } = useTemplateMergeTagSchema(toRef(props, 'moduleScope'));
</script>
