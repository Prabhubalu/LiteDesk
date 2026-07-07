import { ref, computed, onBeforeUnmount } from 'vue';
import type { ContentStudioMode, ContentStudioSaveStatus, ContentStudioDocumentRecord, ProseMirrorJson, ContentStudioPresentation } from '../types/contentStudio';
import { CONTENT_STUDIO_DEFAULT_PRESENTATION, normalizeContentStudioPresentation } from '../editor/articlePresentation';
import {
  getContentDocument,
  createContentDocument,
  updateContentDocument,
  publishContentDocument,
  unpublishContentDocument,
  archiveContentDocument,
  deleteContentDocument,
} from '../services/contentStudioApi';
import { createEmptyContentDocument } from '../editor/emptyDocument';

interface UseContentStudioDocumentOptions {
  mode: ContentStudioMode;
  documentId: () => string | null;
  isNew: () => boolean;
  getBlocks: () => ProseMirrorJson;
  onLoaded?: (record: ContentStudioDocumentRecord) => void;
}

export function useContentStudioDocument(options: UseContentStudioDocumentOptions) {
  const loading = ref(true);
  const saveStatus = ref<ContentStudioSaveStatus>('saved');
  const publishBusy = ref(false);
  const record = ref<ContentStudioDocumentRecord | null>(null);

  const title = ref('');
  const subtitle = ref('');
  const summary = ref('');
  const slug = ref('');
  const visibility = ref('portal');
  const featured = ref(false);
  const collectionId = ref<string | null>(null);
  const seoMetaTitle = ref('');
  const seoMetaDescription = ref('');
  const coverAssetId = ref<string | null>(null);
  const coverImageUrl = ref('');
  const presentation = ref<ContentStudioPresentation>({ ...CONTENT_STUDIO_DEFAULT_PRESENTATION });

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let suppressAutosave = false;

  const statusLabel = computed(() => {
    const status = String(record.value?.status || 'draft').toLowerCase();
    return status;
  });

  async function load() {
    loading.value = true;
    try {
      if (options.isNew()) {
        title.value = '';
        subtitle.value = '';
        summary.value = '';
        slug.value = '';
        collectionId.value = null;
        visibility.value = options.mode === 'articles' ? 'portal' : 'internal';
        featured.value = false;
        seoMetaTitle.value = '';
        seoMetaDescription.value = '';
        coverAssetId.value = null;
        coverImageUrl.value = '';
        presentation.value = { ...CONTENT_STUDIO_DEFAULT_PRESENTATION };
        record.value = null;
        return;
      }
      const id = options.documentId();
      if (!id) return;
      const data = await getContentDocument(options.mode, id);
      record.value = data;
      title.value = data.title || '';
      subtitle.value = data.subtitle || '';
      summary.value = data.summary || '';
      slug.value = data.slug || '';
      visibility.value = data.visibility || (options.mode === 'articles' ? 'portal' : 'internal');
      featured.value = Boolean(data.featured);
      collectionId.value = data.collectionId ? String(data.collectionId) : null;
      seoMetaTitle.value = data.seo?.metaTitle || '';
      seoMetaDescription.value = data.seo?.metaDescription || '';
      coverAssetId.value = data.coverAssetId ? String(data.coverAssetId) : null;
      coverImageUrl.value = data.coverImageUrl || '';
      presentation.value = normalizeContentStudioPresentation(data.presentation);
      options.onLoaded?.(data);
    } finally {
      loading.value = false;
      saveStatus.value = 'saved';
    }
  }

  function markDirty() {
    if (saveStatus.value !== 'saving') {
      saveStatus.value = 'dirty';
    }
    scheduleAutosave();
  }

  function scheduleAutosave() {
    if (suppressAutosave) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      void saveDraft();
    }, 2500);
  }

  async function saveDraft(force = false) {
    if (!force && saveStatus.value === 'saved') return record.value;
    const safeTitle = String(title.value || '').trim();
    if (!safeTitle) return record.value;

    saveStatus.value = 'saving';
    try {
      const payload = {
        title: safeTitle,
        subtitle: subtitle.value,
        summary: summary.value,
        slug: slug.value || undefined,
        visibility: visibility.value,
        featured: featured.value,
        collectionId: collectionId.value,
        coverAssetId: coverAssetId.value,
        presentation: presentation.value,
        blocks: options.getBlocks(),
        seo: {
          metaTitle: seoMetaTitle.value,
          metaDescription: seoMetaDescription.value,
        },
      };

      if (options.isNew() && !record.value?._id) {
        const created = await createContentDocument(options.mode, payload);
        record.value = created;
        suppressAutosave = true;
        return created;
      }

      const id = record.value?._id || options.documentId();
      if (!id) return record.value;

      const updated = await updateContentDocument(options.mode, id, payload);
      record.value = updated;
      saveStatus.value = 'saved';
      return updated;
    } catch {
      saveStatus.value = 'error';
      throw new Error('save_failed');
    }
  }

  async function publish() {
    publishBusy.value = true;
    try {
      await saveDraft(true);
      const id = record.value?._id || options.documentId();
      if (!id) throw new Error('missing_id');
      const published = await publishContentDocument(options.mode, id);
      record.value = published;
      saveStatus.value = 'saved';
      return published;
    } finally {
      publishBusy.value = false;
    }
  }

  async function unpublish() {
    publishBusy.value = true;
    try {
      const id = record.value?._id || options.documentId();
      if (!id) throw new Error('missing_id');
      const updated = await unpublishContentDocument(options.mode, id);
      record.value = updated;
      saveStatus.value = 'saved';
      return updated;
    } finally {
      publishBusy.value = false;
    }
  }

  async function archive() {
    publishBusy.value = true;
    try {
      const id = record.value?._id || options.documentId();
      if (!id) throw new Error('missing_id');
      const updated = await archiveContentDocument(options.mode, id);
      record.value = updated;
      saveStatus.value = 'saved';
      return updated;
    } finally {
      publishBusy.value = false;
    }
  }

  async function remove() {
    const id = record.value?._id || options.documentId();
    if (!id) throw new Error('missing_id');
    return deleteContentDocument(options.mode, id);
  }

  function initialBlocksFromRecord(data: ContentStudioDocumentRecord | null | undefined): ProseMirrorJson {
    const blocks = data?.currentVersion?.blocks;
    if (blocks && typeof blocks === 'object' && 'type' in blocks && blocks.type === 'doc') {
      return blocks as unknown as ProseMirrorJson;
    }
    return createEmptyContentDocument();
  }

  function updatePresentation(patch: Partial<ContentStudioPresentation>) {
    presentation.value = normalizeContentStudioPresentation({
      ...presentation.value,
      ...patch,
    });
    markDirty();
  }

  onBeforeUnmount(() => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
  });

  return {
    loading,
    saveStatus,
    publishBusy,
    record,
    title,
    subtitle,
    summary,
    slug,
    visibility,
    featured,
    collectionId,
    seoMetaTitle,
    seoMetaDescription,
    coverAssetId,
    coverImageUrl,
    presentation,
    statusLabel,
    load,
    markDirty,
    saveDraft,
    publish,
    unpublish,
    archive,
    remove,
    updatePresentation,
    initialBlocksFromRecord,
    setSuppressAutosave: (value: boolean) => {
      suppressAutosave = value;
    },
  };
}
