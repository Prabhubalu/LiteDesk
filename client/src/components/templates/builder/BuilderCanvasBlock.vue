<template>
  <component :is="wrapperTag" :class="wrapperClass" :style="blockSpacingStyle">
    <template v-if="inlineEditConfig">
      <div :class="inlineEditWrapperClass">
        <BuilderInlineText
          :node-id="node.id"
          :text="inlineEditText"
          :is-selected="isSelected"
          :placeholder="inlineEditPlaceholder"
          :text-class="inlineEditTextClass"
          :text-align="String(node.style?.typography?.textAlign || 'left')"
          :font-size="Number(node.style?.typography?.fontSize) || null"
          :font-weight="Number(node.style?.typography?.fontWeight) || null"
          :binding-field="inlineEditConfig.bindingField"
          :enter-behavior="inlineEditConfig.enterBehavior"
          :multiline="Boolean(inlineEditConfig.multiline)"
          :plain-text="Boolean(inlineEditConfig.plainText)"
          @select="emit('select', $event)"
          @patch="emit('patch', $event)"
          @format-state="emit('format-state', $event)"
          @remove="emit('remove', $event)"
          @continue-after="emit('continue-after', $event)"
          @library-add="emit('library-add', $event)"
        />
      </div>
    </template>

    <template v-else-if="node.type === 'MergeTag'">
      <span
        class="inline-flex cursor-pointer items-center rounded-md px-2 py-1"
        :class="[ui.mergePill, hiddenClass, isSelected ? ui.selectedRing : '']"
        @click.stop="emit('select', node.id)"
      >
        {{ node.bindings?.path || 'path' }}
      </span>
    </template>

    <template v-else-if="node.type === 'Table'">
      <BuilderCanvasTable
        :node-id="node.id"
        :node="node"
        :is-selected="isSelected"
        :hidden-class="hiddenClass"
        @select="emit('select', $event)"
        @patch="emit('patch', $event)"
      />
    </template>

    <template v-else-if="node.type === 'LineItem'">
      <BuilderCanvasLineItem
        :node-id="node.id"
        :node="node"
        :is-selected="isSelected"
        :hidden-class="hiddenClass"
        @select="emit('select', $event)"
        @patch="emit('patch', $event)"
      />
    </template>

    <template v-else-if="node.type === 'Image' || node.type === 'Logo'">
      <BuilderCanvasImage
        :node-id="node.id"
        :node="node"
        :is-selected="isSelected"
        @select="emit('select', $event)"
        @patch="emit('patch', $event)"
      />
    </template>

    <template v-else-if="node.type === 'Divider'">
      <hr
        class="my-4 border-neutral-200 dark:border-neutral-700"
        :class="[hiddenClass, isSelected ? 'ring-1 ring-primary-400/30' : '']"
        @click.stop="emit('select', node.id)"
      />
    </template>

    <template v-else-if="node.type === 'PageBreak'">
      <div
        class="my-8 flex items-center gap-3 py-2"
        :class="[hiddenClass, isSelected ? ui.selectedRing : '']"
        @click.stop="emit('select', node.id)"
      >
        <div class="h-px flex-1 border-t-2 border-dashed border-neutral-300 dark:border-neutral-600" />
        <span class="text-meta uppercase tracking-wide text-neutral-400">{{ t('templates.builderPageBreakLabel') }}</span>
        <div class="h-px flex-1 border-t-2 border-dashed border-neutral-300 dark:border-neutral-600" />
      </div>
    </template>

    <template v-else-if="node.type === 'Spacer'">
      <div
        class="rounded transition-colors"
        :class="[
          hiddenClass,
          isSelected
            ? 'border border-dashed border-neutral-300 bg-neutral-50/50 dark:border-neutral-600 dark:bg-neutral-800/40'
            : 'border border-transparent group-hover:border-dashed group-hover:border-neutral-200 dark:group-hover:border-neutral-700'
        ]"
        :style="{ height: `${Number(node.bindings?.height || 16)}px` }"
        @click.stop="emit('select', node.id)"
      />
    </template>

    <template v-else-if="!isContainer">
      <BuilderCanvasStub
        :node-id="node.id"
        :node="node"
        :is-selected="isSelected"
        :hidden-class="hiddenClass"
        @select="emit('select', $event)"
      />
    </template>

    <template v-else-if="isContainer">
      <div
        :class="[containerLayoutClass, containerDropHighlight]"
        @click.stop="onContainerClick"
        @dragenter.prevent="onContainerDragEnter"
        @dragover.prevent="onContainerDragOver"
        @dragleave="onContainerDragLeave"
        @drop.prevent="onContainerDrop"
      >
        <BuilderCanvasNodeList
          :parent-id="node.id"
          :parent-type="String(node.type || '')"
          :parent-bindings="node.bindings || {}"
          :nodes="node.children || []"
          :selected-id="selectedId"
          :selected-ids="selectedIds"
          @select="emit('select', $event)"
          @remove="emit('remove', $event)"
          @duplicate="emit('duplicate', $event)"
          @reorder="emit('reorder', $event)"
          @patch="emit('patch', $event)"
          @continue-after="emit('continue-after', $event)"
          @library-add="emit('library-add', $event)"
        >
          <template #empty>
            <div
              class="min-h-[5rem] rounded-md px-2 py-6 text-center text-xs text-neutral-400"
              @click.stop="emit('select', node.id)"
            >
              {{ containerEmptyLabel }}
            </div>
          </template>
        </BuilderCanvasNodeList>
      </div>
    </template>
  </component>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BuilderInlineText from '@/components/templates/builder/BuilderInlineText.vue';
import BuilderCanvasTable from '@/components/templates/builder/BuilderCanvasTable.vue';
import BuilderCanvasLineItem from '@/components/templates/builder/BuilderCanvasLineItem.vue';
import BuilderCanvasImage from '@/components/templates/builder/BuilderCanvasImage.vue';
import BuilderCanvasStub from '@/components/templates/builder/BuilderCanvasStub.vue';
import BuilderCanvasNodeList from '@/components/templates/builder/BuilderCanvasNodeList.vue';
import { isBuilderContainerComponentType, CONTENT_COMPONENT_TYPES } from '@/constants/contentComponentRegistry';
import { getBuilderInlineEditConfig, resolveCanvasInlineText } from '@/constants/builderInlineEdit';
import { resolveColumnStackClass } from '@/utils/builderRowColumnLayout';
import { isNodeHidden } from '@/utils/templateBuilderTree';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useBuilderDropHighlightClass, useBuilderDropTarget } from '@/composables/useBuilderDragDrop';
import { isBuilderComponentDragEvent } from '@/constants/builderDragTypes';

const props = defineProps({
  node: { type: Object, required: true },
  selectedId: { type: String, default: null },
  selectedIds: { type: Array, default: () => [] }
});

const emit = defineEmits(['select', 'remove', 'duplicate', 'reorder', 'patch', 'format-state', 'continue-after', 'library-add']);

const { t } = useI18n();
const ui = useBuilderUi();

const {
  isDragOver: isContainerDragOver,
  onDragOver: onContainerDropOver,
  onDragLeave: onContainerDropLeave,
  onDrop: onContainerDropBase
} = useBuilderDropTarget(props.node.id);
const containerDropHighlight = useBuilderDropHighlightClass(isContainerDragOver);
const containerDragDepth = ref(0);

function onContainerDragEnter(event) {
  if (!isBuilderComponentDragEvent(event)) return;
  event.stopPropagation();
  containerDragDepth.value += 1;
  if (containerDragDepth.value === 1) {
    onContainerDropOver(event);
  }
}

function onContainerDragOver(event) {
  if (!isBuilderComponentDragEvent(event)) return;
  event.stopPropagation();
  onContainerDropOver(event);
}

function onContainerDragLeave(event) {
  if (!isBuilderComponentDragEvent(event)) return;
  event.stopPropagation();
  containerDragDepth.value = Math.max(0, containerDragDepth.value - 1);
  if (containerDragDepth.value === 0) {
    onContainerDropLeave();
  }
}

function onContainerDrop(event) {
  if (!isBuilderComponentDragEvent(event)) return;
  event.stopPropagation();
  containerDragDepth.value = 0;
  onContainerDropBase(event);
}

const isSelected = computed(() => props.selectedIds?.includes(props.node.id) || props.node.id === props.selectedId);
const isContainer = computed(() => isBuilderContainerComponentType(String(props.node?.type || '')));
const hiddenClass = computed(() => (isNodeHidden(props.node) ? 'opacity-40' : ''));

const inlineEditConfig = computed(() => getBuilderInlineEditConfig(String(props.node?.type || '')));
const inlineEditText = computed(() => {
  const config = inlineEditConfig.value;
  if (!config) return '';
  return resolveCanvasInlineText(props.node, config);
});
const inlineEditPlaceholder = computed(() => {
  const key = inlineEditConfig.value?.placeholderKey;
  return key ? t(key) : t('templates.builderParagraphPlaceholder');
});

const wrapperTag = computed(() => 'div');
const wrapperClass = computed(() => {
  if (props.node.type === CONTENT_COMPONENT_TYPES.SECTION) return 'space-y-3';
  if (props.node.type === CONTENT_COMPONENT_TYPES.ROW) return 'w-full';
  if (props.node.type === CONTENT_COMPONENT_TYPES.COLUMN) return 'min-w-0';
  return '';
});

const containerLayoutClass = computed(() => {
  const type = String(props.node?.type || '');
  if (type === CONTENT_COMPONENT_TYPES.ROW) {
    return 'w-full rounded-md border border-dashed border-neutral-200/80 p-2 dark:border-neutral-700/80';
  }
  if (type === CONTENT_COMPONENT_TYPES.COLUMN) {
    return [
      resolveColumnStackClass(),
      'rounded-md border border-dashed border-neutral-200/60 p-2 dark:border-neutral-700/60'
    ].join(' ');
  }
  return 'space-y-4';
});

const containerEmptyLabel = computed(() => {
  const type = String(props.node?.type || '');
  if (type === CONTENT_COMPONENT_TYPES.ROW) return t('templates.builderRowEmpty');
  if (type === CONTENT_COMPONENT_TYPES.COLUMN) return t('templates.builderColumnEmpty');
  return t('templates.builderSectionEmpty');
});

function onContainerClick() {
  emit('select', props.node.id);
}

const headingClass = computed(() => {
  const level = Math.min(4, Math.max(1, Number(props.node.bindings?.level || 1)));
  const sizes = {
    1: 'text-3xl font-bold text-neutral-900',
    2: 'text-2xl font-semibold text-neutral-900',
    3: 'text-xl font-semibold text-neutral-900',
    4: 'text-lg font-semibold text-neutral-900'
  };
  return sizes[level] || sizes[1];
});

const inlineEditTextClass = computed(() => {
  if (props.node.type === 'Heading') return headingClass.value;
  if (props.node.type === 'Variable' || props.node.type === 'Formula') {
    return [ui.mergePill, inlineEditConfig.value?.textClass || ''].filter(Boolean).join(' ');
  }
  return inlineEditConfig.value?.textClass || 'text-sm leading-relaxed text-neutral-700';
});

const inlineEditWrapperClass = computed(() => {
  const base = [hiddenClass.value, isSelected.value ? ui.selectedRing : ''].filter(Boolean);
  switch (props.node.type) {
    case 'Button':
      return [...base, 'inline-flex rounded-md bg-primary-600 px-3 py-1.5'].join(' ');
    case 'Link':
      return [...base, 'inline-block'].join(' ');
    case 'Watermark':
      return [...base, 'w-full py-2'].join(' ');
    case 'List':
      return [...base, 'w-full rounded-md border border-transparent px-1'].join(' ');
    default:
      return base.join(' ');
  }
});

const blockSpacingStyle = computed(() => {
  const spacing = props.node?.style?.spacing || {};
  return {
    marginTop: spacing.marginTop ? `${spacing.marginTop}px` : undefined,
    marginBottom: spacing.marginBottom ? `${spacing.marginBottom}px` : undefined,
    paddingTop: spacing.paddingTop ? `${spacing.paddingTop}px` : undefined,
    paddingBottom: spacing.paddingBottom ? `${spacing.paddingBottom}px` : undefined
  };
});
</script>
