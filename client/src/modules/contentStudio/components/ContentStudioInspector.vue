<template>
  <aside class="flex w-80 shrink-0 flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
    <div :class="ui.inspectorTabList" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'document'"
        :class="[ui.inspectorTab, activeTab === 'document' ? ui.inspectorTabActive : ui.inspectorTabIdle]"
        @click="activeTab = 'document'"
      >
        {{ t('contentStudio.tabDocument') }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'block'"
        :class="[ui.inspectorTab, activeTab === 'block' ? ui.inspectorTabActive : ui.inspectorTabIdle]"
        @click="activeTab = 'block'"
      >
        {{ t('contentStudio.tabBlock') }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div v-if="activeTab === 'document'" class="space-y-4 p-4">
        <div>
          <label :class="ui.label">{{ t('contentStudio.fieldCoverPosition') }}</label>
          <select
            :value="coverPosition"
            :class="[ui.input, 'mt-1']"
            @change="emit('update:coverPosition', $event.target.value)"
          >
            <option value="below-title">{{ t('contentStudio.coverPositionBelowTitle') }}</option>
            <option value="above-title">{{ t('contentStudio.coverPositionAboveTitle') }}</option>
          </select>
        </div>
        <div v-if="coverPosition === 'above-title'">
          <label class="mt-3 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              :checked="titleOverlapCover"
              class="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 dark:border-neutral-600"
              @change="emit('update:titleOverlapCover', $event.target.checked)"
            />
            <span>{{ t('contentStudio.fieldTitleOverlapCover') }}</span>
          </label>
        </div>
        <div>
          <label :class="ui.label">{{ t('contentStudio.fieldSubtitleSize') }}</label>
          <select
            :value="subtitleSize"
            :class="[ui.input, 'mt-1']"
            @change="emit('update:subtitleSize', $event.target.value)"
          >
            <option value="sm">{{ t('contentStudio.subtitleSizeSmall') }}</option>
            <option value="md">{{ t('contentStudio.subtitleSizeMedium') }}</option>
            <option value="lg">{{ t('contentStudio.subtitleSizeLarge') }}</option>
            <option value="xl">{{ t('contentStudio.subtitleSizeExtraLarge') }}</option>
          </select>
        </div>
        <div>
          <label :class="ui.label">{{ t('contentStudio.fieldHeadingColor') }}</label>
          <div class="mt-1 flex items-center gap-2">
            <input
              :value="headingColor || '#111827'"
              type="color"
              class="h-10 w-12 cursor-pointer rounded border border-neutral-300 dark:border-neutral-600"
              @input="emit('update:headingColor', $event.target.value)"
            />
            <input
              :value="headingColor"
              type="text"
              :class="[ui.input, 'flex-1']"
              placeholder="#111827"
              @input="emit('update:headingColor', $event.target.value)"
            />
          </div>
        </div>
        <div>
          <label :class="ui.label">{{ t('contentStudio.fieldSubheadingColor') }}</label>
          <div class="mt-1 flex items-center gap-2">
            <input
              :value="subheadingColor || '#4b5563'"
              type="color"
              class="h-10 w-12 cursor-pointer rounded border border-neutral-300 dark:border-neutral-600"
              @input="emit('update:subheadingColor', $event.target.value)"
            />
            <input
              :value="subheadingColor"
              type="text"
              :class="[ui.input, 'flex-1']"
              placeholder="#4b5563"
              @input="emit('update:subheadingColor', $event.target.value)"
            />
          </div>
        </div>
        <div>
          <label :class="ui.label">{{ t('contentStudio.fieldVisibility') }}</label>
          <select
            :value="visibility"
            :class="[ui.input, 'mt-1']"
            @change="emit('update:visibility', $event.target.value)"
          >
            <option v-for="option in visibilityOptions" :key="option.value" :value="option.value">
              {{ t(option.labelKey) }}
            </option>
          </select>
          <p
            v-if="showHeadlessVisibilityHint"
            class="mt-2 text-xs text-amber-700 dark:text-amber-300"
          >
            {{ t('contentStudio.visibilityPublicHeadlessHint') }}
          </p>
        </div>
        <div v-if="mode === 'articles'">
          <label class="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              :checked="featured"
              class="mt-0.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 dark:border-neutral-600"
              @change="emit('update:featured', $event.target.checked)"
            />
            <span>
              <span class="block font-medium">{{ t('contentStudio.fieldFeatured') }}</span>
              <span class="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                {{ t('contentStudio.fieldFeaturedHint') }}
              </span>
            </span>
          </label>
        </div>
        <div>
          <label :class="ui.label">{{ t('contentStudio.fieldSummary') }}</label>
          <textarea
            :value="summary"
            rows="3"
            :class="[ui.input, 'mt-1']"
            @input="emit('update:summary', $event.target.value)"
          />
        </div>
        <div>
          <label :class="ui.label">{{ t('contentStudio.fieldSlug') }}</label>
          <input
            :value="slug"
            type="text"
            :class="[ui.input, 'mt-1']"
            @input="emit('update:slug', $event.target.value)"
          />
        </div>
        <div>
          <label :class="ui.label">{{ t('contentStudio.fieldMetaTitle') }}</label>
          <input
            :value="seoMetaTitle"
            type="text"
            :class="[ui.input, 'mt-1']"
            @input="emit('update:seoMetaTitle', $event.target.value)"
          />
        </div>
        <div>
          <label :class="ui.label">{{ t('contentStudio.fieldMetaDescription') }}</label>
          <textarea
            :value="seoMetaDescription"
            rows="4"
            :class="[ui.input, 'mt-1']"
            @input="emit('update:seoMetaDescription', $event.target.value)"
          />
        </div>
      </div>

      <div v-else>
        <ContentStudioBlockInspector
          :editor="editor"
          :active-block-type="activeBlockType"
          :selection-revision="selectionRevision"
          :block-anchor-id="blockAnchorId"
          :block-css-class="blockCssClass"
          @update:block-attributes="emit('update:blockAttributes', $event)"
          @structure-change="emit('structure-change')"
          @request-image-upload="emit('request-image-upload', $event)"
        />
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import ContentStudioBlockInspector from './ContentStudioBlockInspector.vue';

const props = defineProps({
  editor: { type: Object, default: null },
  mode: { type: String, default: 'articles' },
  activeBlockType: { type: String, default: 'paragraph' },
  selectionRevision: { type: Number, default: 0 },
  summary: { type: String, default: '' },
  slug: { type: String, default: '' },
  visibility: { type: String, default: 'portal' },
  featured: { type: Boolean, default: false },
  seoMetaTitle: { type: String, default: '' },
  seoMetaDescription: { type: String, default: '' },
  coverPosition: { type: String, default: 'below-title' },
  titleOverlapCover: { type: Boolean, default: false },
  subtitleSize: { type: String, default: 'md' },
  headingColor: { type: String, default: '' },
  subheadingColor: { type: String, default: '' },
  blockAnchorId: { type: String, default: '' },
  blockCssClass: { type: String, default: '' },
});

const emit = defineEmits([
  'update:summary',
  'update:slug',
  'update:visibility',
  'update:featured',
  'update:seoMetaTitle',
  'update:seoMetaDescription',
  'update:coverPosition',
  'update:titleOverlapCover',
  'update:subtitleSize',
  'update:headingColor',
  'update:subheadingColor',
  'update:blockAttributes',
  'structure-change',
  'request-image-upload',
]);

const { t } = useI18n();
const ui = useBuilderUi();
const activeTab = ref('document');

watch(
  () => props.activeBlockType,
  (type) => {
    if (type === 'table') activeTab.value = 'block';
  },
);

const visibilityOptions = computed(() => {
  if (props.mode === 'blog') {
    return [
      { value: 'internal', labelKey: 'contentStudio.visibilityInternal' },
      { value: 'public', labelKey: 'contentStudio.visibilityPublic' },
    ];
  }
  return [
    { value: 'internal', labelKey: 'contentStudio.visibilityInternal' },
    { value: 'portal', labelKey: 'contentStudio.visibilityPortal' },
    { value: 'public', labelKey: 'contentStudio.visibilityPublic' },
    { value: 'private', labelKey: 'contentStudio.visibilityPrivate' },
  ];
});

const showHeadlessVisibilityHint = computed(
  () => props.mode === 'articles' && props.visibility !== 'public',
);
</script>
