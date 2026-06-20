/**
 * Documents module record adapter — generic layout + file/versions section for uploaded files.
 */
import { createGenericRecordAdapter } from './genericRecordAdapter';
import DocumentFileRecordSection from '@/components/record-page/sections/DocumentFileRecordSection.vue';
import DocumentRichContentSection from '@/components/record-page/sections/DocumentRichContentSection.vue';
import DocumentVisibilitySection from '@/components/record-page/sections/DocumentVisibilitySection.vue';
import DocumentReservationSection from '@/components/record-page/sections/DocumentReservationSection.vue';
import DocumentExternalLinkSection from '@/components/record-page/sections/DocumentExternalLinkSection.vue';
import DocumentLifecycleSection from '@/components/record-page/sections/DocumentLifecycleSection.vue';
import DocumentInlineCommentsSection from '@/components/record-page/sections/DocumentInlineCommentsSection.vue';
import DocumentSignatureSection from '@/components/record-page/sections/DocumentSignatureSection.vue';
import DocumentCollaborationDraftSection from '@/components/record-page/sections/DocumentCollaborationDraftSection.vue';
import { getRichContentHtml, isFileDocument, isExternalLinkDocument } from '@/utils/documentRichContent';
import { getCoordinationSectionKey } from '@/utils/documentEditingCoordination';

const FILE_SECTION_STACK = ['file', 'lifecycle', 'visibility', 'details', 'related'];
const RICH_SECTION_STACK = ['content', 'comments', 'signatures', 'collaboration', 'lifecycle', 'visibility', 'details', 'related'];
const EXTERNAL_SECTION_STACK = ['external', 'lifecycle', 'visibility', 'details', 'related'];

function resolveExpandedSection(opts) {
  const expanded = opts.expandedLeftSection;
  if (expanded && typeof expanded === 'object' && 'value' in expanded) {
    return String(expanded.value || '').trim();
  }
  return String(expanded || '').trim();
}

function buildSectionStack(record) {
  const isExternal = isExternalLinkDocument(record);
  const isFile = isFileDocument(record);
  const baseStack = isExternal
    ? EXTERNAL_SECTION_STACK
    : isFile
      ? FILE_SECTION_STACK
      : RICH_SECTION_STACK;
  const coordinationKey = getCoordinationSectionKey(record);
  return coordinationKey ? [coordinationKey, ...baseStack] : baseStack;
}

export function createDocumentsRecordAdapter(opts = {}) {
  const base = createGenericRecordAdapter(opts);
  const fileTitle = opts.sectionLabels?.file || 'File';
  const contentTitle = opts.sectionLabels?.content || 'Content';
  const openEditorLabel = opts.sectionLabels?.openEditor || 'Open editor';
  const openDocumentEditor = opts.openDocumentEditor;

  const openRichContentHistory = opts.openRichContentHistory;

  return {
    ...base,
    module: 'documents',

    getRichContent(record) {
      return getRichContentHtml(record?.richContent);
    },

    getRichContentTitle() {
      return contentTitle;
    },

    canEditRichContent(record, context) {
      if (!isFileDocument(record)) {
        return context?.canEditRichContent === true;
      }
      return false;
    },

    saveRichContent(value, record, context) {
      if (typeof context?.onRichContentSave === 'function') {
        return context.onRichContentSave(value, record);
      }
      return undefined;
    },

    getSections(record) {
      const expanded = resolveExpandedSection(opts);
      const isExpanded = expanded.length > 0;
      const contentVersionFullPage = expanded === 'description-history' || expanded === 'rich-content-history';
      const stackKeys = buildSectionStack(record);

      const keys = isExpanded && !contentVersionFullPage
        ? stackKeys.filter((k) => k === expanded)
        : contentVersionFullPage
          ? []
          : stackKeys;

      const baseSections = base.getSections(record);
      const byKey = Object.fromEntries(
        baseSections.map((section) => [section.key, section])
      );

      const fileSection = {
        key: 'file',
        title: fileTitle,
        component: DocumentFileRecordSection,
        className: 'pt-2 pb-2',
        actions: []
      };

      const contentSection = {
        key: 'content',
        title: contentTitle,
        component: DocumentRichContentSection,
        className: 'pt-2 pb-2',
        actions: [
          !isExpanded && typeof openRichContentHistory === 'function' && !isFileDocument(record)
            ? {
                key: 'rich-content-history',
                type: 'history',
                label: opts.sectionLabels?.history || 'History',
                handler: () => { void openRichContentHistory(); }
              }
            : null,
          !isExpanded && typeof openDocumentEditor === 'function'
            ? {
                key: 'expand-editor',
                type: 'expand',
                label: openEditorLabel,
                alwaysVisible: true,
                handler: () => openDocumentEditor()
              }
            : null
        ].filter(Boolean)
      };

      const visibilitySection = {
        key: 'visibility',
        title: opts.sectionLabels?.visibility || 'Visibility',
        component: DocumentVisibilitySection,
        className: 'pt-2 pb-2',
        actions: []
      };

      const reservationSection = {
        key: 'reservation',
        title: opts.sectionLabels?.reservation || 'Editing status',
        component: DocumentReservationSection,
        className: 'pt-2 pb-2',
        actions: []
      };

      const externalSection = {
        key: 'external',
        title: opts.sectionLabels?.external || 'External Link',
        component: DocumentExternalLinkSection,
        className: 'pt-2 pb-2',
        actions: []
      };

      const lifecycleSection = {
        key: 'lifecycle',
        title: opts.sectionLabels?.lifecycle || 'Lifecycle',
        component: DocumentLifecycleSection,
        className: 'pt-2 pb-2',
        actions: []
      };

      const commentsSection = {
        key: 'comments',
        title: opts.sectionLabels?.comments || 'Comments',
        component: DocumentInlineCommentsSection,
        className: 'pt-2 pb-2',
        actions: []
      };

      const signaturesSection = {
        key: 'signatures',
        title: opts.sectionLabels?.signatures || 'Signatures',
        component: DocumentSignatureSection,
        className: 'pt-2 pb-2',
        actions: []
      };

      const collaborationSection = {
        key: 'collaboration',
        title: opts.sectionLabels?.collaboration || 'Collaboration',
        component: DocumentCollaborationDraftSection,
        className: 'pt-2 pb-2',
        actions: []
      };

      return keys
        .map((key) => {
          if (key === 'file') return fileSection;
          if (key === 'content') return contentSection;
          if (key === 'comments') return commentsSection;
          if (key === 'signatures') return signaturesSection;
          if (key === 'collaboration') return collaborationSection;
          if (key === 'visibility') return visibilitySection;
          if (key === 'reservation') return reservationSection;
          if (key === 'external') return externalSection;
          if (key === 'lifecycle') return lifecycleSection;
          return byKey[key];
        })
        .filter(Boolean);
    }
  };
}
