<template>
  <div v-if="!component" class="text-sm" :class="ui.textMuted">
    {{ t('templates.builderPropertiesEmpty') }}
  </div>

  <div v-else class="space-y-4">
    <div
      class="sticky top-0 z-10 -mx-4 border-b px-4 pb-4 pt-1"
      :class="[ui.border, ui.panel]"
    >
      <div class="flex items-start gap-3">
        <div :class="ui.inspectorBlockIcon">
          <component :is="blockIcon" class="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ componentTypeLabel }}</p>
          <p class="mt-0.5 text-[11px] font-mono text-neutral-400">#{{ componentId.split(':')[0] }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-0.5">
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
      <GrapesComponentFields
        v-if="showComponentFields"
        :component="component"
        :revision="revision"
        :asset-library="assetLibrary"
        @change="onComponentFieldsChange"
        @pick-asset="onAssetPicked"
      />

      <template v-if="showGenericText">
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldText') }}</label>
          <textarea
            v-model="genericTextField.draft"
            rows="3"
            :class="ui.input"
            @focus="genericTextField.onFocus"
            @input="genericTextField.onInput"
            @blur="genericTextField.onBlur"
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

    <BuilderDisclosureSection :title="t('templates.builderFieldClasses')" :default-open="false">
      <input
        :value="classNames"
        type="text"
        :class="ui.input"
        placeholder="class-one class-two"
        @change="onClassesChange($event.target.value)"
      />
    </BuilderDisclosureSection>

    <BuilderDisclosureSection v-if="showLayoutSection" :title="t('templates.builderGroupLayout')">
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
          <BuilderSelect
            :model-value="rowFlexDirection"
            :options="rowDirectionOptions"
            @update:model-value="onRowDirectionChange"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.builderFieldRowCellAlign') }}</label>
          <BuilderSelect
            :model-value="rowCellAlign"
            :options="rowCellAlignOptions"
            @update:model-value="patchStyle({ 'align-items': $event })"
          />
        </div>
      </div>
      <div v-if="isLayoutGridCellSelected" class="grid grid-cols-1 gap-2">
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.builderFieldCellHorizontalAlign') }}</label>
          <BuilderSelect
            :model-value="cellHorizontalAlign"
            :options="horizontalFlexOptions"
            @update:model-value="onCellHorizontalAlignChange"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs" :class="ui.textMuted">{{ t('templates.builderFieldCellContentAlign') }}</label>
          <BuilderSelect
            :model-value="cellContentAlign"
            :options="verticalFlexOptions"
            @update:model-value="patchStyle({ 'justify-content': $event })"
          />
        </div>
      </div>
      <div>
        <p class="mb-2" :class="ui.label">{{ t('templates.builderGroupSpacing') }}</p>
        <div class="space-y-3">
          <BuilderRangeField
            :label="t('templates.builderFieldMarginTop')"
            :value="marginTop"
            :max="120"
            @change="patchStyle({ 'margin-top': $event })"
          />
          <BuilderRangeField
            :label="t('templates.builderFieldMarginBottom')"
            :value="marginBottom"
            :max="120"
            @change="patchStyle({ 'margin-bottom': $event })"
          />
          <BuilderRangeField
            :label="t('templates.builderFieldPadding')"
            :value="paddingTop"
            :max="80"
            @change="onUniformPaddingChange"
          />
        </div>
      </div>
      <details class="group">
        <summary class="cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
          {{ t('templates.builderSpacingAdvanced') }}
        </summary>
        <div class="mt-3 space-y-3">
          <div class="grid grid-cols-2 gap-2">
            <StyleField
              :label="t('templates.builderFieldMarginLeft')"
              :value="marginLeft"
              placeholder="0"
              @change="patchStyle({ 'margin-left': $event })"
            />
            <StyleField
              :label="t('templates.builderFieldMarginRight')"
              :value="marginRight"
              placeholder="0"
              @change="patchStyle({ 'margin-right': $event })"
            />
          </div>
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
      </details>
    </BuilderDisclosureSection>

    <BuilderDisclosureSection v-if="showTypographySection" :title="t('templates.builderGroupTypography')">
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
          <BuilderSelect
            :model-value="fontWeight"
            :options="fontWeightOptions"
            @update:model-value="patchStyle({ 'font-weight': $event })"
          />
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
          <label class="mb-1.5 block text-xs" :class="ui.textMuted">{{ t('templates.builderTableCellAlign') }}</label>
          <BuilderSegmentGroup
            :model-value="textAlign"
            :options="textAlignSegmentOptions"
            :aria-label="t('templates.builderTableCellAlign')"
            @update:model-value="patchStyle({ 'text-align': $event })"
          />
        </div>
      </div>
      <StyleField
        :label="t('templates.builderFieldLineHeight')"
        :value="lineHeight"
        placeholder="1.5"
        @change="patchStyle({ 'line-height': $event })"
      />
    </BuilderDisclosureSection>

    <BuilderDisclosureSection v-if="showAppearanceSection" :title="t('templates.builderGroupAppearance')" :default-open="false">
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
    </BuilderDisclosureSection>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowUpIcon,
  Bars3BottomLeftIcon,
  Bars3Icon,
  Bars4Icon,
  DocumentDuplicateIcon,
  TrashIcon
} from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { isEditorSerializing } from '../editor/editorSerializeGuard';
import { resolveBuilderIcon } from '@/constants/templateBuilderIcons';
import { useComponentTextDraft } from '../composables/useComponentTextDraft';
import StyleField from './GrapesStyleField.vue';
import GrapesComponentFields from './GrapesComponentFields.vue';
import {
  canSelectParent,
  deleteComponent,
  duplicateComponent,
  selectParentComponent
} from '../editor/componentActions';
import { resolveTableCellComponent } from '../editor/tableModel';
import { findLineItemRoot } from '../editor/lineItemModel';
import GrapesTablePanel from './GrapesTablePanel.vue';
import GrapesLineItemPanel from './GrapesLineItemPanel.vue';
import BuilderDisclosureSection from './BuilderDisclosureSection.vue';
import BuilderSelect from './BuilderSelect.vue';
import BuilderRangeField from './BuilderRangeField.vue';
import BuilderSegmentGroup from './BuilderSegmentGroup.vue';
import { isLayoutGridCell, isLayoutGridRow } from '../editor/printArea';
import {
  inspectorIconType,
  inspectorLabelKey,
  inspectorShowsAppearance,
  inspectorShowsLayout,
  inspectorShowsTypography,
  resolveInspectorContext
} from '../editor/componentInspector';
import {
  isTextComponent,
  patchComponentStyle,
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
  if (isEditorSerializing()) return;
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
const componentId = computed(() => `${String(component.value?.getId?.() || '')}:${revision.value}`);
const inspectorContext = computed(() => resolveInspectorContext(component.value));
const componentTypeLabel = computed(() => {
  const ctx = inspectorContext.value;
  if (ctx && ctx.kind !== 'generic') {
    return t(inspectorLabelKey(ctx.kind));
  }
  return String(component.value?.get?.('name') || component.value?.get?.('tagName') || component.value?.get?.('type') || '');
});
const canParent = computed(() => canSelectParent(component.value));

const blockIcon = computed(() => {
  const kind = inspectorContext.value?.kind || 'generic';
  return resolveBuilderIcon(inspectorIconType(kind));
});

const lineItemRoot = computed(() => findLineItemRoot(component.value));
const isTableCell = computed(() => Boolean(resolveTableCellComponent(component.value)));
const tableCell = computed(() => resolveTableCellComponent(component.value));
const isLayoutGridRowSelected = computed(() => isLayoutGridRow(component.value));
const isLayoutGridCellSelected = computed(() => isLayoutGridCell(component.value));

const showComponentFields = computed(() => {
  const kind = inspectorContext.value?.kind;
  return Boolean(kind && kind !== 'line-item' && kind !== 'table-cell' && kind !== 'generic');
});

const showGenericText = computed(() =>
  inspectorContext.value?.kind === 'generic'
  && isTextComponent(component.value)
  && !isTableCell.value
  && !lineItemRoot.value
);

const showLayoutSection = computed(() =>
  inspectorContext.value ? inspectorShowsLayout(inspectorContext.value.kind) : true
);

const showTypographySection = computed(() =>
  inspectorContext.value ? inspectorShowsTypography(inspectorContext.value.kind) : true
);

const showAppearanceSection = computed(() =>
  inspectorContext.value ? inspectorShowsAppearance(inspectorContext.value.kind) : true
);

const genericTextField = useComponentTextDraft(
  component,
  componentId,
  readTextContent,
  (model, value) => writeTextContent(model, value, { silent: true, force: true }),
  () => emit('change')
);

function styleValue(keys, fallback = '') {
  void revision.value;
  return readStyleValue(component.value, keys, fallback);
}

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

const rowDirectionOptions = computed(() => [
  { value: 'row', label: t('templates.builderRowDirectionRow') },
  { value: 'column', label: t('templates.builderRowDirectionColumn') }
]);

const rowCellAlignOptions = computed(() => [
  { value: 'flex-start', label: t('templates.builderFormatAlignTop') },
  { value: 'center', label: t('templates.builderFormatAlignMiddle') },
  { value: 'flex-end', label: t('templates.builderFormatAlignBottom') },
  { value: 'stretch', label: t('templates.builderFormatAlignStretch') }
]);

const horizontalFlexOptions = computed(() => [
  { value: 'flex-start', label: t('templates.builderFormatAlignLeft') },
  { value: 'center', label: t('templates.builderFormatAlignCenter') },
  { value: 'flex-end', label: t('templates.builderFormatAlignRight') }
]);

const verticalFlexOptions = computed(() => [
  { value: 'flex-start', label: t('templates.builderFormatAlignTop') },
  { value: 'center', label: t('templates.builderFormatAlignMiddle') },
  { value: 'flex-end', label: t('templates.builderFormatAlignBottom') }
]);

const fontWeightOptions = computed(() => [
  { value: '400', label: t('templates.builderFontWeightRegular') },
  { value: '600', label: t('templates.builderFontWeightSemibold') },
  { value: '700', label: t('templates.builderFontWeightBold') }
]);

const textAlignSegmentOptions = computed(() => [
  { value: 'left', label: t('templates.builderFormatAlignLeft'), icon: Bars3BottomLeftIcon },
  { value: 'center', label: t('templates.builderFormatAlignCenter'), icon: Bars3Icon },
  { value: 'right', label: t('templates.builderFormatAlignRight'), icon: Bars4Icon }
]);

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

function onUniformPaddingChange(value) {
  patchStyle({
    'padding-top': value,
    'padding-right': value,
    'padding-bottom': value,
    'padding-left': value
  });
}

function onLineItemChange() {
  revision.value += 1;
  emit('change');
}

function onComponentFieldsChange() {
  emit('change');
}

function patchStyle(patch) {
  if (!component.value) return;
  patchComponentStyle(component.value, patch);
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
}
</script>
