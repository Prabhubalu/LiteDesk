<template>
  <aside class="flex w-72 shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
    <div v-if="activePanel !== 'blocks'" class="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ panelTitle }}</h2>
      <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{{ panelHint }}</p>
    </div>

    <ContentStudioOutlinePanel
      v-if="activePanel === 'outline'"
      :editor="editor"
      :blocks="blocks"
    />

    <div v-else-if="activePanel === 'blocks'" class="flex min-h-0 flex-1 flex-col">
      <ContentStudioBlocksPanel :mode="mode" @add-block="emit('add-block', $event)" />
    </div>

    <div v-else-if="activePanel === 'media'" class="flex min-h-0 flex-1 flex-col">
      <ContentStudioMediaPanel :mode="mode" @insert-image="emit('insert-image', $event)" />
    </div>

    <ContentStudioSeoPanel
      v-else-if="activePanel === 'seo'"
      :mode="mode"
      :title="title"
      :summary="summary"
      :slug="slug"
      :cover-image-url="coverImageUrl"
      :seo-meta-title="seoMetaTitle"
      :seo-meta-description="seoMetaDescription"
      @update:summary="emit('update:summary', $event)"
      @update:slug="emit('update:slug', $event)"
      @update:seo-meta-title="emit('update:seoMetaTitle', $event)"
      @update:seo-meta-description="emit('update:seoMetaDescription', $event)"
    />

    <ContentStudioComponentsPanel
      v-else-if="activePanel === 'components'"
      :mode="mode"
      @insert-component="emit('insert-component', $event)"
    />

    <ContentStudioTemplatesPanel
      v-else-if="activePanel === 'templates'"
      :mode="mode"
      @apply-template="emit('apply-template', $event)"
    />

    <ContentStudioSettingsPanel
      v-else-if="activePanel === 'settings'"
      :mode="mode"
      :status="status"
      :visibility="visibility"
      :slug="slug"
      :article-id="articleId"
      :collection-id="collectionId"
      :busy="lifecycleBusy"
      @update:collection-id="emit('update:collectionId', $event)"
      @unpublish="emit('unpublish')"
      @archive="emit('archive')"
      @delete="emit('delete')"
    />

    <div v-else-if="activePanel === 'ai'" class="flex flex-1 items-center justify-center p-6 text-center">
      <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ t('contentStudio.panelComingSoon') }}</p>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import ContentStudioBlocksPanel from './ContentStudioBlocksPanel.vue';
import ContentStudioMediaPanel from './ContentStudioMediaPanel.vue';
import ContentStudioSeoPanel from './ContentStudioSeoPanel.vue';
import ContentStudioSettingsPanel from './ContentStudioSettingsPanel.vue';
import ContentStudioComponentsPanel from './ContentStudioComponentsPanel.vue';
import ContentStudioTemplatesPanel from './ContentStudioTemplatesPanel.vue';
import ContentStudioOutlinePanel from './ContentStudioOutlinePanel.vue';

const props = defineProps({
  mode: { type: String, required: true },
  activePanel: { type: String, default: 'blocks' },
  editor: { type: Object, default: null },
  blocks: { type: Object, default: null },
  title: { type: String, default: '' },
  summary: { type: String, default: '' },
  slug: { type: String, default: '' },
  coverImageUrl: { type: String, default: '' },
  status: { type: String, default: 'draft' },
  visibility: { type: String, default: 'portal' },
  articleId: { type: String, default: '' },
  collectionId: { type: String, default: null },
  lifecycleBusy: { type: Boolean, default: false },
  seoMetaTitle: { type: String, default: '' },
  seoMetaDescription: { type: String, default: '' },
});

const emit = defineEmits([
  'add-block',
  'insert-component',
  'apply-template',
  'insert-image',
  'update:summary',
  'update:slug',
  'update:seoMetaTitle',
  'update:seoMetaDescription',
  'update:collectionId',
  'unpublish',
  'archive',
  'delete',
]);

const { t } = useI18n();
const ui = useBuilderUi();

const panelTitle = computed(() => {
  const map = {
    blocks: 'contentStudio.panelBlocks',
    outline: 'contentStudio.panelOutline',
    components: 'contentStudio.panelComponents',
    media: 'contentStudio.panelMedia',
    ai: 'contentStudio.panelAi',
    templates: 'contentStudio.panelTemplates',
    seo: 'contentStudio.panelSeo',
    settings: 'contentStudio.panelSettings',
  };
  return t(map[props.activePanel] || 'contentStudio.panelBlocks');
});

const panelHint = computed(() => {
  if (props.activePanel === 'blocks') return t('contentStudio.addBlocksHint');
  if (props.activePanel === 'outline') {
    return props.mode === 'blog'
      ? t('contentStudio.outlineHintBlog')
      : t('contentStudio.outlineHint');
  }
  if (props.activePanel === 'components') {
    return props.mode === 'blog'
      ? t('contentStudio.componentsHintBlog')
      : t('contentStudio.componentsHint');
  }
  if (props.activePanel === 'templates') {
    return props.mode === 'blog'
      ? t('contentStudio.templatesHintBlog')
      : t('contentStudio.templatesHint');
  }
  if (props.activePanel === 'media') return t('contentStudio.mediaHint');
  if (props.activePanel === 'seo') return t('contentStudio.seoHint');
  if (props.activePanel === 'settings') return t('contentStudio.settingsHint');
  if (props.activePanel === 'ai') return t('contentStudio.panelComingSoon');
  return '';
});

</script>
