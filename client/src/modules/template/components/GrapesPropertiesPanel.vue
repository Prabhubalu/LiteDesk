<template>
  <div v-if="!component" class="text-sm" :class="ui.textMuted">
    {{ t('templates.builderPropertiesEmpty') }}
  </div>

  <div v-else class="space-y-4">
    <div
      class="sticky top-0 z-10 -mx-4 border-b px-4 pb-3"
      :class="[ui.border, ui.panel]"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p :class="[ui.meta, 'mb-1']">{{ tagLabel }}</p>
          <p class="text-meta font-mono text-neutral-400">#{{ componentId }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button
            type="button"
            :class="ui.btnIcon"
            :disabled="!canParent"
            :title="t('templates.builderActionSelectParent')"
            @click="selectParentComponent(editor)"
          >
            <ArrowUpIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            :class="ui.btnIcon"
            :title="t('templates.builderActionDuplicate')"
            @click="duplicateComponent(editor, component)"
          >
            <DocumentDuplicateIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            :class="ui.btnIcon"
            :title="t('templates.builderActionDelete')"
            @click="deleteComponent(editor, component)"
          >
            <TrashIcon class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <template v-if="showTextFields">
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldText') }}</label>
          <textarea
            :value="textContent"
            rows="3"
            :class="ui.input"
            @input="onTextChange($event.target.value)"
          />
        </div>
      </template>

      <template v-if="isMergeField">
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldMergePath') }}</label>
          <input
            :value="mergePath"
            type="text"
            :class="[ui.input, 'font-mono']"
            @input="onMergePathChange($event.target.value)"
          />
        </div>
      </template>

      <template v-if="isImage">
        <BuilderImageAssetPicker :library="assetLibrary" @select="onAssetPicked" />
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldImageSrc') }}</label>
          <input
            :value="imageSrc"
            type="text"
            :class="ui.input"
            @input="onImageSrcChange($event.target.value)"
          />
        </div>
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldImageAlt') }}</label>
          <input
            :value="imageAlt"
            type="text"
            :class="ui.input"
            @input="onImageAltChange($event.target.value)"
          />
        </div>
      </template>

      <template v-if="isLink">
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldHref') }}</label>
          <input
            :value="linkHref"
            type="text"
            :class="ui.input"
            @input="onHrefChange($event.target.value)"
          />
        </div>
      </template>

      <GrapesLineItemPanel
        v-if="lineItemRoot"
        :component="lineItemRoot"
        :module-scope="moduleScope"
        :revision="revision"
        @change="onLineItemChange"
      />

      <GrapesTablePanel
        v-if="isTableCell"
        :component="tableCell"
        :editor="editor"
        @change="emit('change')"
      />
    </div>

    <section class="space-y-3 border-t pt-4" :class="ui.border">
      <h3 :class="ui.label">{{ t('templates.builderFieldClasses') }}</h3>
      <input
        :value="classNames"
        type="text"
        :class="ui.input"
        placeholder="class-one class-two"
        @change="onClassesChange($event.target.value)"
      />
    </section>

    <section class="space-y-3 border-t pt-4" :class="ui.border">
      <h3 :class="ui.label">{{ t('templates.builderGroupLayout') }}</h3>
      <div class="grid grid-cols-2 gap-2">
        <StyleField
          :label="t('templates.builderFieldWidth')"
          :value="width"
          placeholder="auto"
          @change="patchStyle({ width: $event })"
        />
        <StyleField
          :label="t('templates.builderFieldHeight')"
          :value="height"
          placeholder="auto"
          @change="patchStyle({ height: $event })"
        />
        <StyleField
          :label="t('templates.builderFieldMaxWidth')"
          :value="maxWidth"
          placeholder="auto"
          @change="patchStyle({ 'max-width': $event })"
        />
        <StyleField
          :label="t('templates.builderFieldMinHeight')"
          :value="minHeight"
          placeholder="auto"
          @change="patchStyle({ 'min-height': $event })"
        />
      </div>
      <div v-if="isLayoutGridRowSelected" class="grid grid-cols-1 gap-2">
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.builderFieldRowDirection') }}</label>
          <select
            :value="rowFlexDirection"
            :class="ui.input"
            @change="onRowDirectionChange($event.target.value)"
          >
            <option value="row">{{ t('templates.builderRowDirectionRow') }}</option>
            <option value="column">{{ t('templates.builderRowDirectionColumn') }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.builderFieldRowCellAlign') }}</label>
          <select
            :value="rowCellAlign"
            :class="ui.input"
            @change="patchStyle({ 'align-items': $event.target.value })"
          >
            <option value="flex-start">{{ t('templates.builderFormatAlignTop') }}</option>
            <option value="center">{{ t('templates.builderFormatAlignMiddle') }}</option>
            <option value="flex-end">{{ t('templates.builderFormatAlignBottom') }}</option>
            <option value="stretch">{{ t('templates.builderFormatAlignStretch') }}</option>
          </select>
        </div>
      </div>
      <div v-if="isLayoutGridCellSelected" class="grid grid-cols-1 gap-2">
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.builderFieldCellHorizontalAlign') }}</label>
          <select
            :value="cellHorizontalAlign"
            :class="ui.input"
            @change="onCellHorizontalAlignChange($event.target.value)"
          >
            <option value="flex-start">{{ t('templates.builderFormatAlignLeft') }}</option>
            <option value="center">{{ t('templates.builderFormatAlignCenter') }}</option>
            <option value="flex-end">{{ t('templates.builderFormatAlignRight') }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.builderFieldCellContentAlign') }}</label>
          <select
            :value="cellContentAlign"
            :class="ui.input"
            @change="patchStyle({ 'justify-content': $event.target.value })"
          >
            <option value="flex-start">{{ t('templates.builderFormatAlignTop') }}</option>
            <option value="center">{{ t('templates.builderFormatAlignMiddle') }}</option>
            <option value="flex-end">{{ t('templates.builderFormatAlignBottom') }}</option>
          </select>
        </div>
      </div>
      <div>
        <p class="mb-2" :class="ui.label">{{ t('templates.builderFieldPadding') }}</p>
        <div class="grid grid-cols-2 gap-2">
          <StyleField
            :label="t('templates.builderFieldPaddingTop')"
            :value="paddingTop"
            placeholder="0"
            @change="patchStyle({ 'padding-top': $event })"
          />
          <StyleField
            :label="t('templates.builderFieldPaddingRight')"
            :value="paddingRight"
            placeholder="0"
            @change="patchStyle({ 'padding-right': $event })"
          />
          <StyleField
            :label="t('templates.builderFieldPaddingBottom')"
            :value="paddingBottom"
            placeholder="0"
            @change="patchStyle({ 'padding-bottom': $event })"
          />
          <StyleField
            :label="t('templates.builderFieldPaddingLeft')"
            :value="paddingLeft"
            placeholder="0"
            @change="patchStyle({ 'padding-left': $event })"
          />
        </div>
      </div>
      <div>
        <p class="mb-2" :class="ui.label">{{ t('templates.builderFieldMargin') }}</p>
        <div class="grid grid-cols-2 gap-2">
          <StyleField
            :label="t('templates.builderFieldMarginTop')"
            :value="marginTop"
            placeholder="0"
            @change="patchStyle({ 'margin-top': $event })"
          />
          <StyleField
            :label="t('templates.builderFieldMarginRight')"
            :value="marginRight"
            placeholder="0"
            @change="patchStyle({ 'margin-right': $event })"
          />
          <StyleField
            :label="t('templates.builderFieldMarginBottom')"
            :value="marginBottom"
            placeholder="0"
            @change="patchStyle({ 'margin-bottom': $event })"
          />
          <StyleField
            :label="t('templates.builderFieldMarginLeft')"
            :value="marginLeft"
            placeholder="0"
            @change="patchStyle({ 'margin-left': $event })"
          />
        </div>
      </div>
    </section>

    <section class="space-y-3 border-t pt-4" :class="ui.border">
      <h3 :class="ui.label">{{ t('templates.builderGroupTypography') }}</h3>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.builderFieldFontSize') }}</label>
          <input
            :value="fontSize"
            type="number"
            min="8"
            max="96"
            :class="ui.input"
            @change="patchStyle({ 'font-size': $event.target.value ? `${$event.target.value}px` : '' })"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.builderFieldFontWeight') }}</label>
          <select
            :value="fontWeight"
            :class="ui.input"
            @change="patchStyle({ 'font-weight': $event.target.value })"
          >
            <option value="400">{{ t('templates.builderFontWeightRegular') }}</option>
            <option value="600">{{ t('templates.builderFontWeightSemibold') }}</option>
            <option value="700">{{ t('templates.builderFontWeightBold') }}</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.themeColorText') }}</label>
          <input
            :value="textColor"
            type="color"
            class="h-9 w-full cursor-pointer rounded-lg border border-neutral-200 dark:border-neutral-700"
            @input="patchStyle({ color: $event.target.value })"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.builderTableCellAlign') }}</label>
          <select
            :value="textAlign"
            :class="ui.input"
            @change="patchStyle({ 'text-align': $event.target.value })"
          >
            <option value="left">{{ t('templates.builderFormatAlignLeft') }}</option>
            <option value="center">{{ t('templates.builderFormatAlignCenter') }}</option>
            <option value="right">{{ t('templates.builderFormatAlignRight') }}</option>
          </select>
        </div>
      </div>
      <StyleField
        :label="t('templates.builderFieldLineHeight')"
        :value="lineHeight"
        placeholder="1.5"
        @change="patchStyle({ 'line-height': $event })"
      />
    </section>

    <section class="space-y-3 border-t pt-4" :class="ui.border">
      <h3 :class="ui.label">{{ t('templates.builderGroupAppearance') }}</h3>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.themeColorBackground') }}</label>
          <input
            :value="backgroundColor"
            type="color"
            class="h-9 w-full cursor-pointer rounded-lg border border-neutral-200 dark:border-neutral-700"
            @input="patchStyle({ 'background-color': $event.target.value })"
          />
        </div>
        <StyleField
          :label="t('templates.builderFieldBorderRadius')"
          :value="borderRadius"
          placeholder="0"
          @change="patchStyle({ 'border-radius': $event })"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowUpIcon,
  DocumentDuplicateIcon,
  TrashIcon
} from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';
import BuilderImageAssetPicker from '@/components/templates/builder/BuilderImageAssetPicker.vue';
import StyleField from './GrapesStyleField.vue';
import {
  canSelectParent,
  deleteComponent,
  duplicateComponent,
  selectParentComponent
} from '../editor/componentActions';
import { resolveTableCellComponent } from '../editor/tableModel';
import { findLineItemRoot, isLineItemComponent } from '../editor/lineItemModel';
import GrapesTablePanel from './GrapesTablePanel.vue';
import GrapesLineItemPanel from './GrapesLineItemPanel.vue';
import { isLayoutGridCell, isLayoutGridRow } from '../editor/printArea';
import {
  formatMergeToken,
  isImageComponent,
  isMergeFieldComponent,
  isTextComponent,
  parseMergePathFromContent,
  patchComponentAttributes,
  patchComponentStyle,
  readComponentAttributes,
  readComponentClasses,
  readStyleValue,
  readTextContent,
  writeComponentClasses,
  writeTextContent
} from '../editor/selection';

const props = defineProps({
  component: { type: Object, default: null },
  editor: { type: Object, default: null },
  moduleScope: { type: String, default: '' },
  assetLibrary: {
    type: String,
    default: 'content',
    validator: (value) => ['content', 'marketing'].includes(value)
  }
});

const emit = defineEmits(['change', 'pick-asset']);

const { t } = useI18n();
const ui = useBuilderUi();
const revision = ref(0);

watch(
  () => props.component,
  () => {
    revision.value += 1;
  }
);

function onLineItemBindingsUpdate(updated) {
  const root = lineItemRoot.value;
  if (!root || !updated) return;
  if (String(updated.getId?.() || '') !== String(root.getId?.() || '')) return;
  revision.value += 1;
}

let detachLineItemUpdate = null;

watch(
  () => props.editor,
  (editor) => {
    detachLineItemUpdate?.();
    detachLineItemUpdate = null;
    if (!editor) return;
    const handler = (updated) => onLineItemBindingsUpdate(updated);
    editor.on('component:update', handler);
    detachLineItemUpdate = () => editor.off('component:update', handler);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  detachLineItemUpdate?.();
});

const component = computed(() => props.component);
const componentId = computed(() => String(component.value?.getId?.() || ''));
const tagLabel = computed(() => String(component.value?.get?.('tagName') || component.value?.get?.('type') || ''));
const canParent = computed(() => canSelectParent(component.value));

const isImage = computed(() => isImageComponent(component.value));
const isMergeField = computed(() => isMergeFieldComponent(component.value));
const isLink = computed(() => String(component.value?.get?.('tagName') || '').toLowerCase() === 'a');
const isLineItemRoot = computed(() => isLineItemComponent(component.value));
const lineItemRoot = computed(() => findLineItemRoot(component.value));
const isTableCell = computed(() => Boolean(resolveTableCellComponent(component.value)));
const tableCell = computed(() => resolveTableCellComponent(component.value));
const isLayoutGridRowSelected = computed(() => isLayoutGridRow(component.value));
const isLayoutGridCellSelected = computed(() => isLayoutGridCell(component.value));
const showTextFields = computed(() =>
  isTextComponent(component.value) && !isImage.value && !isTableCell.value && !isLineItemRoot.value
);

function attrValue(key, fallback = '') {
  void revision.value;
  if (!component.value) return fallback;
  return readComponentAttributes(component.value)[key] || fallback;
}

function styleValue(keys, fallback = '') {
  void revision.value;
  return readStyleValue(component.value, keys, fallback);
}

const textContent = computed(() => {
  void revision.value;
  return component.value ? readTextContent(component.value) : '';
});

const mergePath = computed(() => parseMergePathFromContent(textContent.value));
const imageSrc = computed(() => attrValue('src'));
const imageAlt = computed(() => attrValue('alt'));
const linkHref = computed(() => attrValue('href'));
const classNames = computed(() => {
  void revision.value;
  return readComponentClasses(component.value);
});

const width = computed(() => styleValue(['width']));
const height = computed(() => styleValue(['height']));
const maxWidth = computed(() => styleValue(['max-width', 'maxWidth']));
const minHeight = computed(() => styleValue(['min-height', 'minHeight']));
const paddingTop = computed(() => styleValue(['padding-top', 'paddingTop']));
const paddingRight = computed(() => styleValue(['padding-right', 'paddingRight']));
const paddingBottom = computed(() => styleValue(['padding-bottom', 'paddingBottom']));
const paddingLeft = computed(() => styleValue(['padding-left', 'paddingLeft']));
const marginTop = computed(() => styleValue(['margin-top', 'marginTop']));
const marginRight = computed(() => styleValue(['margin-right', 'marginRight']));
const marginBottom = computed(() => styleValue(['margin-bottom', 'marginBottom']));
const marginLeft = computed(() => styleValue(['margin-left', 'marginLeft']));
const fontSize = computed(() => styleValue(['font-size', 'fontSize']).replace(/px$/, '') || '');
const fontWeight = computed(() => styleValue(['font-weight', 'fontWeight'], '400'));
const textColor = computed(() => styleValue(['color'], '#111827'));
const textAlign = computed(() => styleValue(['text-align', 'textAlign'], 'left'));
const lineHeight = computed(() => styleValue(['line-height', 'lineHeight']));
const backgroundColor = computed(() => styleValue(['background-color', 'backgroundColor'], '#ffffff'));
const borderRadius = computed(() => styleValue(['border-radius', 'borderRadius']));

function normalizeFlexAlignValue(value, fallback) {
  if (!value) return fallback;
  if (value === 'start') return 'flex-start';
  if (value === 'end') return 'flex-end';
  return value;
}

const rowCellAlign = computed(() =>
  normalizeFlexAlignValue(styleValue(['align-items', 'alignItems']), 'stretch')
);

const rowFlexDirection = computed(() => {
  const value = styleValue(['flex-direction', 'flexDirection'], 'row');
  return value === 'column' ? 'column' : 'row';
});

const cellContentAlign = computed(() =>
  normalizeFlexAlignValue(styleValue(['justify-content', 'justifyContent']), 'flex-start')
);

const cellHorizontalAlign = computed(() => {
  const alignItems = normalizeFlexAlignValue(styleValue(['align-items', 'alignItems']), '');
  if (alignItems && alignItems !== 'stretch') return alignItems;

  const textAlign = styleValue(['text-align', 'textAlign'], 'left');
  if (textAlign === 'right') return 'flex-end';
  if (textAlign === 'center') return 'center';
  return 'flex-start';
});

function onRowDirectionChange(value) {
  if (!component.value) return;
  patchStyle({
    display: 'flex',
    'flex-direction': value,
    'flex-wrap': value === 'column' ? 'wrap' : 'nowrap'
  });
}

function onCellHorizontalAlignChange(value) {
  const textAlign = value === 'flex-end' ? 'right' : value === 'center' ? 'center' : 'left';
  patchStyle({
    'align-items': value,
    'text-align': textAlign
  });
}

function onLineItemChange() {
  revision.value += 1;
  emit('change');
}

function patchStyle(patch) {
  if (!component.value) return;
  patchComponentStyle(component.value, patch);
  revision.value += 1;
  emit('change');
}

function onTextChange(value) {
  if (!component.value) return;
  writeTextContent(component.value, value);
  revision.value += 1;
  emit('change');
}

function onMergePathChange(value) {
  onTextChange(formatMergeToken(value));
}

function onImageSrcChange(value) {
  if (!component.value) return;
  patchComponentAttributes(component.value, { src: value });
  revision.value += 1;
  emit('change');
}

function onImageAltChange(value) {
  if (!component.value) return;
  patchComponentAttributes(component.value, { alt: value });
  revision.value += 1;
  emit('change');
}

function onHrefChange(value) {
  if (!component.value) return;
  patchComponentAttributes(component.value, { href: value });
  revision.value += 1;
  emit('change');
}

function onClassesChange(value) {
  if (!component.value) return;
  writeComponentClasses(component.value, value);
  revision.value += 1;
  emit('change');
}

function onAssetPicked(payload) {
  emit('pick-asset', payload);
  if (!component.value) return;
  patchComponentAttributes(component.value, {
    src: payload.src,
    alt: payload.alt || ''
  });
  revision.value += 1;
  emit('change');
}
</script>
