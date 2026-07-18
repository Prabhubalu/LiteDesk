<template>
  <div :class="ui.shell">
    <div v-if="loading" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="h-11 shrink-0 animate-pulse border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <div class="hidden w-10 shrink-0 animate-pulse border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 md:flex" />
        <div class="hidden w-72 shrink-0 animate-pulse border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 md:flex" />
        <div class="flex-1 animate-pulse bg-neutral-200/60 dark:bg-neutral-950" />
        <div class="hidden w-80 shrink-0 animate-pulse border-l border-neutral-200 bg-white dark:border-neutral-800 lg:block" />
      </div>
    </div>

    <template v-else>
      <ContentStudioHeader
        :mode="mode"
        :save-status="saveStatus"
        :preview-device="previewDevice"
        :publish-busy="publishBusy"
        :save-busy="saveStatus === 'saving'"
        @preview="handlePreview"
        @save="handleSave"
        @publish="handlePublish"
        @update:preview-device="previewDevice = $event"
      />

      <div
        v-if="mode === 'articles' && staleContent?.isStale"
        class="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
      >
        {{ t('contentStudio.staleContentAlert', {
          days: staleContent.daysSinceUpdate,
          threshold: staleContent.staleContentAlertDays,
        }) }}
      </div>

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div class="flex min-h-0 flex-1 overflow-hidden">
        <ContentStudioIconRail v-model:active-panel="leftPanel" />
        <ContentStudioLeftPanel
          :mode="mode"
          :active-panel="leftPanel"
          :editor="editor"
          :blocks="blocksSnapshot || getDocumentContent()"
          :title="title"
          :summary="summary"
          :slug="slug"
          :cover-image-url="coverImageUrl"
          :status="record?.status || 'draft'"
          :visibility="visibility"
          :article-id="record?._id || ''"
          :collection-id="collectionId"
          :lifecycle-busy="publishBusy"
          :seo-meta-title="seoMetaTitle"
          :seo-meta-description="seoMetaDescription"
          @add-block="handleAddBlock"
          @insert-component="handleInsertComponent"
          @apply-template="handleApplyTemplate"
          @insert-image="handleInsertImage"
          @update:summary="handleSummaryChange"
          @update:slug="handleSlugChange"
          @update:seo-meta-title="handleSeoTitleChange"
          @update:seo-meta-description="handleSeoDescriptionChange"
          @update:collection-id="handleCollectionChange"
          @unpublish="handleUnpublish"
          @archive="handleArchive"
          @delete="handleDelete"
        />
        <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <ContentStudioCanvas
            v-show="!previewOpen"
            :editor="editor"
            :title="title"
            :subtitle="subtitle"
            :preview-device="previewDevice"
            :mode="mode"
            :cover-image-url="coverImageUrl"
            :presentation="presentation"
            :word-count="documentWordCount"
            :read-minutes="documentReadMinutes"
            :author-name="authorName"
            @update:title="handleTitleChange"
            @update:subtitle="handleSubtitleChange"
            @register-image-trigger="imageUploadTrigger = $event"
            @register-image-file-handler="imageFileHandler = $event"
            @cover-uploaded="handleCoverUploaded"
            @remove-cover="handleRemoveCover"
          />
          <ContentStudioPreviewPanel
            v-if="previewOpen"
            :title="title"
            :subtitle="subtitle"
            :blocks="blocksSnapshot || getDocumentContent()"
            :preview-device="previewDevice"
            :mode="mode"
            :cover-image-url="coverImageUrl"
            :presentation="presentation"
            :read-minutes="documentReadMinutes"
            :author-name="authorName"
            @close="previewOpen = false"
          />
        </div>
        <ContentStudioInspector
          :editor="editor"
          :mode="mode"
          :active-block-type="activeBlockType"
          :selection-revision="selectionRevision"
          :summary="summary"
          :slug="slug"
          :visibility="visibility"
          :featured="featured"
          :sticky="sticky"
          :tags="tags"
          :author-id="authorId"
          :author-name="authorName"
          :seo-meta-title="seoMetaTitle"
          :seo-meta-description="seoMetaDescription"
          :cover-position="presentation.coverPosition"
          :title-overlap-cover="presentation.titleOverlapCover"
          :subtitle-size="presentation.subtitleSize"
          :heading-color="presentation.headingColor"
          :subheading-color="presentation.subheadingColor"
          :block-anchor-id="blockAnchorId"
          :block-css-class="blockCssClass"
          @update:summary="handleSummaryChange"
          @update:slug="handleSlugChange"
          @update:visibility="handleVisibilityChange"
          @update:featured="handleFeaturedChange"
          @update:sticky="handleStickyChange"
          @update:tags="handleTagsChange"
          @update:author-id="handleAuthorIdChange"
          @update:author-name="handleAuthorNameChange"
          @update:seo-meta-title="handleSeoTitleChange"
          @update:seo-meta-description="handleSeoDescriptionChange"
          @update:cover-position="handleCoverPositionChange"
          @update:title-overlap-cover="handleTitleOverlapCoverChange"
          @update:subtitle-size="handleSubtitleSizeChange"
          @update:heading-color="handleHeadingColorChange"
          @update:subheading-color="handleSubheadingColorChange"
          @update:block-attributes="handleBlockAttributesChange"
          @structure-change="markDirty"
          @request-image-upload="handleRequestImageUpload"
        />
        </div>
        <ContentStudioStatusBar
          :save-status="saveStatus"
          :word-count="documentWordCount"
          :read-minutes="documentReadMinutes"
        />
      </div>

      <ContentStudioMediaInsertDialog
        :open="mediaInsertOpen"
        :block-type="mediaInsertBlockType"
        @submit="submitMediaInsert"
        @cancel="cancelMediaInsert"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useNotifications } from '@/composables/useNotifications';
import ContentStudioHeader from '../components/ContentStudioHeader.vue';
import ContentStudioIconRail from '../components/ContentStudioIconRail.vue';
import ContentStudioLeftPanel from '../components/ContentStudioLeftPanel.vue';
import ContentStudioCanvas from '../components/ContentStudioCanvas.vue';
import ContentStudioInspector from '../components/ContentStudioInspector.vue';
import ContentStudioPreviewPanel from '../components/ContentStudioPreviewPanel.vue';
import ContentStudioStatusBar from '../components/ContentStudioStatusBar.vue';
import ContentStudioMediaInsertDialog from '../components/ContentStudioMediaInsertDialog.vue';
import { useContentStudioEditor } from '../composables/useContentStudioEditor';
import { useContentStudioMediaInsertDialog } from '../composables/useContentStudioMediaInsertDialog';
import { useContentStudioKeyboardShortcuts } from '../composables/useContentStudioKeyboardShortcuts';
import { countWords, estimateReadMinutes, extractPlainTextFromBlocks } from '../utils/documentStats';
import { captureArticlePublished, captureArticlePreviewed, captureArticleSaved, captureArticleCreated } from '@/config/posthogArticles';
import { captureBlogPostCreated, captureBlogPostPublished, captureBlogPostSaved } from '@/config/posthogBlog';
import { useTabs } from '@/composables/useTabs';
import { useContentStudioDocument } from '../composables/useContentStudioDocument';
import { addGalleryImage, isEditorInGallery } from '../editor/blockCommands';
import { setPendingGalleryIntent } from '../editor/slashCommands';
import '../editor/contentStudioTabs.css';
import '../editor/contentStudioGallery.css';
import '../editor/contentStudioChecklist.css';
import '../editor/contentStudioFaq.css';
import '../editor/contentStudioSteps.css';
import '../editor/contentStudioRelatedArticles.css';

const props = defineProps({
  mode: {
    type: String,
    required: true,
    validator: (value) => value === 'articles' || value === 'blog',
  },
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const ui = useBuilderUi();
const notifications = useNotifications();
const { activeTabId, updateTabTitle } = useTabs();

const previewDevice = ref('desktop');
const leftPanel = ref('blocks');
const previewOpen = ref(false);
const imageUploadTrigger = ref(null);
const imageFileHandler = ref(null);
const {
  open: mediaInsertOpen,
  blockType: mediaInsertBlockType,
  request: requestMediaInsertDialog,
  submit: submitMediaInsert,
  cancel: cancelMediaInsert,
} = useContentStudioMediaInsertDialog();
const mediaInsertHandler = ref(requestMediaInsertDialog);

const documentId = computed(() => {
  const raw = route.params.id;
  return raw && raw !== 'new' ? String(raw) : null;
});
const isNew = computed(() => !documentId.value || route.name?.toString().includes('new'));

const blocksSnapshot = ref(null);

const {
  editor,
  activeBlockType,
  selectionRevision,
  setDocumentContent,
  getDocumentContent,
  addBlock,
  insertComponent,
  applyTemplate,
  hasDocumentBodyContent,
  getActiveBlockAttributes,
  updateActiveBlockAttributes,
} = useContentStudioEditor({
  placeholder: computed(() => t('contentStudio.editorPlaceholder')),
  imageCaptionPlaceholder: computed(() => t('contentStudio.imageCaptionPlaceholder')),
  imageUploadTrigger,
  imageFileHandler,
  mediaInsertHandler,
  onUpdate: (json) => {
    blocksSnapshot.value = json;
    markDirty();
  },
});

const {
  loading,
  saveStatus,
  publishBusy,
  record,
  title,
  subtitle,
  summary,
  slug,
  seoMetaTitle,
  seoMetaDescription,
  visibility,
  featured,
  sticky,
  tags,
  authorId,
  authorName,
  collectionId,
  coverAssetId,
  coverImageUrl,
  presentation,
  load,
  markDirty,
  applyTitle,
  applySlug,
  saveDraft,
  publish,
  unpublish,
  archive,
  remove,
  updatePresentation,
  initialBlocksFromRecord,
  setSuppressAutosave,
} = useContentStudioDocument({
  mode: props.mode,
  documentId: () => documentId.value,
  isNew: () => isNew.value,
  getBlocks: () => blocksSnapshot.value || getDocumentContent(),
  onLoaded: (data) => {
    setSuppressAutosave(true);
    setDocumentContent(initialBlocksFromRecord(data));
    blocksSnapshot.value = initialBlocksFromRecord(data);
    setSuppressAutosave(false);
  },
});

const documentWordCount = computed(() => {
  const text = extractPlainTextFromBlocks(blocksSnapshot.value || getDocumentContent(), `${title.value} ${subtitle.value}`);
  return countWords(text);
});

const documentReadMinutes = computed(() => estimateReadMinutes(documentWordCount.value));

const staleContent = computed(() => record.value?.staleContent || null);

const blockAnchorId = computed(() => {
  void selectionRevision.value;
  return String(getActiveBlockAttributes().anchorId || '');
});
const blockCssClass = computed(() => {
  void selectionRevision.value;
  return String(getActiveBlockAttributes().cssClass || '');
});

useContentStudioKeyboardShortcuts({
  editor,
  onSave: () => {
    void handleSave();
  },
  linkPrompt: (current) => {
    const href = window.prompt(t('contentStudio.linkPrompt'), current || 'https://');
    if (href === null) return null;
    if (!href.trim()) return '__remove__';
    return href;
  },
});

function handleBlockAttributesChange(attrs) {
  updateActiveBlockAttributes(attrs);
  markDirty();
}

function handleCoverUploaded(payload) {
  const asset = payload?.asset;
  coverAssetId.value = asset?._id || asset?.assetId
    ? String(asset._id || asset.assetId)
    : (payload?.assetId ? String(payload.assetId) : null);
  coverImageUrl.value = payload?.url || asset?.downloadUrl || asset?.url || asset?.publicUrl || '';
  markDirty();
}

function handleRemoveCover() {
  coverAssetId.value = null;
  coverImageUrl.value = '';
  markDirty();
}

function handleTitleChange(value) {
  applyTitle(value);
}

function handleSubtitleChange(value) {
  subtitle.value = value;
  markDirty();
}

function handleCoverPositionChange(value) {
  updatePresentation({ coverPosition: value });
}

function handleTitleOverlapCoverChange(value) {
  updatePresentation({ titleOverlapCover: Boolean(value) });
}

function handleSubtitleSizeChange(value) {
  updatePresentation({ subtitleSize: value });
}

function handleHeadingColorChange(value) {
  updatePresentation({ headingColor: value });
}

function handleSubheadingColorChange(value) {
  updatePresentation({ subheadingColor: value });
}

function handleSummaryChange(value) {
  summary.value = value;
  markDirty();
}

function handleSlugChange(value) {
  applySlug(value);
}

function handleSeoTitleChange(value) {
  seoMetaTitle.value = value;
  markDirty();
}

function handleSeoDescriptionChange(value) {
  seoMetaDescription.value = value;
  markDirty();
}

function handleAddBlock(type) {
  addBlock(type);
  markDirty();
}

function handleInsertComponent(component) {
  insertComponent(component);
  markDirty();
}

function handleApplyTemplate(template) {
  const hasContent = hasDocumentBodyContent() || String(title.value || '').trim().length > 0;
  if (hasContent && !window.confirm(t('contentStudio.applyTemplateConfirm'))) return;

  const meta = applyTemplate(template);
  if (meta) {
    title.value = t(meta.titleKey);
    subtitle.value = t(meta.subtitleKey);
    summary.value = t(meta.summaryKey);
  }
  blocksSnapshot.value = getDocumentContent();
  markDirty();
}

function handleInsertImage(asset) {
  const url = asset?.downloadUrl || asset?.url || asset?.publicUrl;
  if (!url || !editor.value) return;
  const alt = asset?.name || asset?.filename || '';
  if (isEditorInGallery(editor.value) || editor.value.isActive('gallery')) {
    addGalleryImage(editor.value, url, alt);
  } else {
    editor.value.chain().focus().setImage({ src: url, alt }).run();
  }
  markDirty();
}

function handleRequestImageUpload(intent = 'add') {
  if (editor.value) {
    setPendingGalleryIntent(editor.value, intent);
  }
  imageUploadTrigger.value?.();
}

function handleVisibilityChange(value) {
  visibility.value = value;
  markDirty();
}

function handleFeaturedChange(value) {
  featured.value = Boolean(value);
  markDirty();
}

function handleStickyChange(value) {
  sticky.value = Boolean(value);
  markDirty();
}

function handleTagsChange(value) {
  tags.value = Array.isArray(value) ? value.map(String) : [];
  markDirty();
}

function handleAuthorIdChange(value) {
  authorId.value = String(value || '');
  markDirty();
}

function handleAuthorNameChange(value) {
  authorName.value = String(value || '');
  markDirty();
}

function handleCollectionChange(value) {
  collectionId.value = value || null;
  markDirty();
}

async function handleSave() {
  try {
    const wasNew = isNew.value && !record.value?._id;
    const saved = await saveDraft(true);
    if (isNew.value && saved?._id) {
      const editorRoute = props.mode === 'articles' ? 'helpdesk-article-edit' : 'marketing-blog-edit';
      await router.replace({ name: editorRoute, params: { id: saved._id } });
    }
    if (wasNew && saved?._id) {
      if (props.mode === 'blog') {
        captureBlogPostCreated({ mode: props.mode, post_id: saved._id });
      } else {
        captureArticleCreated({ mode: props.mode, article_id: saved._id });
      }
    }
    if (props.mode === 'blog') {
      captureBlogPostSaved({ mode: props.mode, post_id: saved?._id });
    } else {
      captureArticleSaved({ mode: props.mode, article_id: saved?._id });
    }
    notifications.success(t('contentStudio.saveSuccess'));
  } catch {
    notifications.error(t('contentStudio.saveFailed'));
  }
}

async function handlePublish() {
  if ((props.mode === 'articles' || props.mode === 'blog') && visibility.value !== 'public') {
    const proceed = window.confirm(
      blogOrArticleCopy('contentStudio.publishNonPublicHeadlessConfirm', 'contentStudio.publishNonPublicHeadlessConfirmPost'),
    );
    if (!proceed) return;
  }

  try {
    const published = await publish();
    if (isNew.value && published?._id) {
      const editorRoute = props.mode === 'articles' ? 'helpdesk-article-edit' : 'marketing-blog-edit';
      await router.replace({ name: editorRoute, params: { id: published._id } });
    }
    if (props.mode === 'blog') {
      captureBlogPostPublished({ mode: props.mode, post_id: published?._id, visibility: published?.visibility });
    } else {
      captureArticlePublished({ mode: props.mode, article_id: published?._id, visibility: published?.visibility });
    }
    notifications.success(t('contentStudio.publishSuccess'));
  } catch {
    notifications.error(t('contentStudio.publishFailed'));
  }
}

function blogOrArticleCopy(articleKey, blogKey) {
  return props.mode === 'blog' ? t(blogKey) : t(articleKey);
}

async function handleUnpublish() {
  try {
    await unpublish();
    notifications.success(blogOrArticleCopy('contentStudio.unpublishSuccess', 'contentStudio.unpublishSuccessPost'));
  } catch {
    notifications.error(blogOrArticleCopy('contentStudio.unpublishFailed', 'contentStudio.unpublishFailedPost'));
  }
}

async function handleArchive() {
  try {
    await archive();
    notifications.success(blogOrArticleCopy('contentStudio.archiveSuccess', 'contentStudio.archiveSuccessPost'));
  } catch {
    notifications.error(blogOrArticleCopy('contentStudio.archiveFailed', 'contentStudio.archiveFailedPost'));
  }
}

async function handleDelete() {
  if (!window.confirm(blogOrArticleCopy('contentStudio.deleteConfirm', 'contentStudio.deleteConfirmPost'))) return;
  try {
    await remove();
    notifications.success(blogOrArticleCopy('contentStudio.deleteSuccess', 'contentStudio.deleteSuccessPost'));
    goBack();
  } catch {
    notifications.error(blogOrArticleCopy('contentStudio.deleteFailed', 'contentStudio.deleteFailedPost'));
  }
}

function handlePreview() {
  blocksSnapshot.value = getDocumentContent();
  captureArticlePreviewed({ mode: props.mode, article_id: record.value?._id });
  previewOpen.value = true;
}

function goBack() {
  const listRoute = props.mode === 'articles' ? 'helpdesk-articles' : 'marketing-blog';
  router.push({ name: listRoute });
}

onMounted(async () => {
  await load();
  if (isNew.value && !record.value) {
    setDocumentContent(initialBlocksFromRecord(null));
    blocksSnapshot.value = getDocumentContent();
  }
});

watch(
  () => route.params.id,
  async () => {
    await load();
  },
);

watch(
  () => record.value?._id,
  async (id) => {
    if (!id || !isNew.value) return;
    const editorRoute = props.mode === 'articles' ? 'helpdesk-article-edit' : 'marketing-blog-edit';
    if (String(route.params.id || '') === String(id)) return;
    await router.replace({ name: editorRoute, params: { id } });
  },
);

watch(title, (nextTitle) => {
  const trimmed = String(nextTitle || '').trim();
  if (!activeTabId.value || !trimmed) return;
  updateTabTitle(activeTabId.value, trimmed);
});
</script>

<style scoped>
:deep(.content-studio-shell) {
  height: 100%;
}
</style>
