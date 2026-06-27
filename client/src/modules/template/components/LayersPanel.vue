<template>
  <div v-if="!root" class="text-sm" :class="ui.textMuted">
    {{ t('templates.builderLayersEmpty') }}
  </div>

  <ul v-else class="space-y-1">
    <LayersTreeNode
      :node="root"
      :selected-id="selectedId"
      @select="emit('select', $event)"
    />
  </ul>
</template>

<script setup>
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useI18n } from 'vue-i18n';
import LayersTreeNode from './LayersTreeNode.vue';

defineProps({
  root: { type: Object, default: null },
  selectedId: { type: String, default: '' }
});

const emit = defineEmits(['select']);

const { t } = useI18n();
const ui = useBuilderUi();
</script>
