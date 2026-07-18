import { ref, shallowRef, onBeforeUnmount, watch, type Ref } from 'vue';
import { useEditor } from '@tiptap/vue-3';
import 'prosemirror-tables/style/tables.css';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { applyBlockLayoutAttributes } from '../editor/blockLayout';
import { isEditorInGallery } from '../editor/blockCommands';
import { isEditorInTable } from '../editor/tableAttributes';
import { ContentStudioCallout } from '../editor/calloutExtension';
import { ContentStudioBlockAttributes } from '../editor/blockAttributesExtension';
import { ContentStudioAudio } from '../editor/audioExtension';
import { ContentStudioEmbed } from '../editor/embedExtension';
import { ContentStudioImage } from '../editor/imageExtension';
import {
  extractImageFileFromClipboard,
  extractImageFileFromDataTransfer,
} from '../editor/imageFileTransfer';
import {
  ContentStudioFaq,
  ContentStudioFaqItem,
  ContentStudioRelatedArticles,
  ContentStudioStep,
  ContentStudioSteps,
} from '../editor/kbBlocksExtension';
import {
  ContentStudioTable,
  ContentStudioTableCell,
  ContentStudioTableHeader,
  ContentStudioTableRow,
} from '../editor/contentStudioTableExtension';
import {
  ContentStudioButton,
  ContentStudioFile,
  ContentStudioGallery,
  ContentStudioSpacer,
  ContentStudioTimeline,
  ContentStudioTimelineItem,
} from '../editor/layoutBlocksExtension';
import {
  ContentStudioColumn,
  ContentStudioColumns,
  ContentStudioForm,
  ContentStudioHero,
  ContentStudioNewsletterSignup,
  ContentStudioProgress,
  ContentStudioRating,
  ContentStudioSection,
  ContentStudioSocial,
  ContentStudioTabItem,
  ContentStudioTabs,
  ContentStudioToc,
} from '../editor/structureBlocksExtension';
import {
  ContentStudioSlashCommands,
  registerContentStudioImageUploadTrigger,
  unregisterContentStudioImageUploadTrigger,
  insertBlockType,
} from '../editor/slashCommands';
import { normalizeContentStudioTables } from '../editor/normalizeContentStudioTables';
import { createEmptyContentDocument } from '../editor/emptyDocument';
import {
  registerContentStudioMediaInsertHandler,
  unregisterContentStudioMediaInsertHandler,
  type MediaInsertRequestHandler,
} from '../editor/mediaInsertDialog';
import type { ArticleComponentDefinition } from '../editor/articleComponents';
import type { ArticleTemplateDefinition } from '../editor/articleTemplates';
import type { ProseMirrorJson } from '../types/contentStudio';

export type ContentStudioImageFileHandler = (file: File) => void | Promise<void>;

interface UseContentStudioEditorOptions {
  placeholder: Ref<string> | string;
  imageCaptionPlaceholder?: Ref<string> | string;
  onUpdate?: (json: ProseMirrorJson) => void;
  onSelectionChange?: (editor: Editor) => void;
  imageUploadTrigger?: Ref<(() => void) | null>;
  imageFileHandler?: Ref<ContentStudioImageFileHandler | null>;
  mediaInsertHandler?: Ref<MediaInsertRequestHandler | null>;
}

export function useContentStudioEditor(options: UseContentStudioEditorOptions) {
  const activeBlockType = ref<string | null>(null);
  const selectionRevision = ref(0);
  const editorRef = shallowRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: {},
        horizontalRule: {},
        codeBlock: {
          HTMLAttributes: {
            class: 'content-code-block',
          },
        },
      }),
      Heading.configure({ levels: [1, 2, 3, 4] }),
      Link.configure({ openOnClick: false }),
      ContentStudioImage.configure({
        inline: false,
        allowBase64: false,
        captionPlaceholder:
          typeof options.imageCaptionPlaceholder === 'string'
            ? options.imageCaptionPlaceholder
            : options.imageCaptionPlaceholder?.value || 'Enter image caption',
      }),
      Placeholder.configure({
        placeholder: () => (typeof options.placeholder === 'string' ? options.placeholder : options.placeholder.value),
      }),
      TaskList.configure({ HTMLAttributes: { class: 'content-task-list' } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: 'content-task-item' } }),
      ContentStudioBlockAttributes,
      ContentStudioCallout,
      ContentStudioEmbed,
      ContentStudioSteps,
      ContentStudioStep,
      ContentStudioFaq,
      ContentStudioFaqItem,
      ContentStudioRelatedArticles,
      ContentStudioTable,
      ContentStudioTableRow,
      ContentStudioTableCell,
      ContentStudioTableHeader,
      ContentStudioSpacer,
      ContentStudioAudio.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: 'content-audio',
        },
      }),
      ContentStudioButton,
      ContentStudioFile,
      ContentStudioTimeline,
      ContentStudioTimelineItem,
      ContentStudioGallery,
      ContentStudioTabs,
      ContentStudioTabItem,
      ContentStudioColumns,
      ContentStudioColumn,
      ContentStudioSection,
      ContentStudioToc,
      ContentStudioForm,
      ContentStudioSocial,
      ContentStudioRating,
      ContentStudioProgress,
      ContentStudioHero,
      ContentStudioNewsletterSignup,
      ContentStudioSlashCommands,
    ],
    content: createEmptyContentDocument(),
    editorProps: {
      attributes: {
        class: 'content-studio-tiptap outline-none min-h-[320px]',
      },
      handlePaste: (_view, event) => {
        const handler = options.imageFileHandler?.value;
        if (!handler) return false;
        const file = extractImageFileFromClipboard(event.clipboardData);
        if (!file) return false;
        event.preventDefault();
        void handler(file);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const handler = options.imageFileHandler?.value;
        if (!handler) return false;
        const file = extractImageFileFromDataTransfer(event.dataTransfer);
        if (!file) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (coords) {
          const $pos = view.state.doc.resolve(coords.pos);
          view.dispatch(view.state.tr.setSelection(TextSelection.near($pos)));
        }
        void handler(file);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      options.onUpdate?.(ed.getJSON() as ProseMirrorJson);
      updateActiveBlock(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      updateActiveBlock(ed);
      selectionRevision.value += 1;
      options.onSelectionChange?.(ed);
    },
    onCreate: ({ editor: ed }) => {
      editorRef.value = ed;
      if (options.imageUploadTrigger?.value) {
        registerContentStudioImageUploadTrigger(ed, options.imageUploadTrigger.value);
      }
      if (options.mediaInsertHandler?.value) {
        registerContentStudioMediaInsertHandler(ed, options.mediaInsertHandler.value);
      }
    },
    onDestroy: () => {
      if (editorRef.value) {
        unregisterContentStudioImageUploadTrigger(editorRef.value);
        unregisterContentStudioMediaInsertHandler(editorRef.value);
      }
      editorRef.value = null;
    },
  });

  function updateActiveBlock(ed: Editor) {
    if (ed.isActive('faqItem')) activeBlockType.value = 'faqItem';
    else if (ed.isActive('step')) activeBlockType.value = 'step';
    else if (ed.isActive('timelineItem')) activeBlockType.value = 'timelineItem';
    else if (isEditorInTable(ed)) activeBlockType.value = 'table';
    else if (ed.isActive('heading')) activeBlockType.value = 'heading';
    else if (isEditorInGallery(ed) || ed.isActive('gallery')) activeBlockType.value = 'gallery';
    else if (ed.isActive('image')) activeBlockType.value = 'image';
    else if (ed.isActive('embed')) activeBlockType.value = 'embed';
    else if (ed.isActive('blockquote')) activeBlockType.value = 'blockquote';
    else if (ed.isActive('taskList')) activeBlockType.value = 'taskList';
    else if (ed.isActive('orderedList')) activeBlockType.value = 'orderedList';
    else if (ed.isActive('bulletList')) activeBlockType.value = 'bulletList';
    else if (ed.isActive('codeBlock')) activeBlockType.value = 'codeBlock';
    else if (ed.isActive('callout')) activeBlockType.value = 'callout';
    else if (ed.isActive('steps')) activeBlockType.value = 'steps';
    else if (ed.isActive('faq')) activeBlockType.value = 'faq';
    else if (ed.isActive('timeline')) activeBlockType.value = 'timeline';
    else if (ed.isActive('spacer')) activeBlockType.value = 'spacer';
    else if (ed.isActive('button')) activeBlockType.value = 'button';
    else if (ed.isActive('audio')) activeBlockType.value = 'audio';
    else if (ed.isActive('file')) activeBlockType.value = 'file';
    else if (ed.isActive('tabItem')) activeBlockType.value = 'tabItem';
    else if (ed.isActive('tabs')) activeBlockType.value = 'tabs';
    else if (ed.isActive('columns')) activeBlockType.value = 'columns';
    else if (ed.isActive('column')) activeBlockType.value = 'column';
    else if (ed.isActive('section')) activeBlockType.value = 'section';
    else if (ed.isActive('toc')) activeBlockType.value = 'toc';
    else if (ed.isActive('form')) activeBlockType.value = 'form';
    else if (ed.isActive('social')) activeBlockType.value = 'social';
    else if (ed.isActive('rating')) activeBlockType.value = 'rating';
    else if (ed.isActive('progress')) activeBlockType.value = 'progress';
    else if (ed.isActive('hero')) activeBlockType.value = 'hero';
    else if (ed.isActive('newsletterSignup')) activeBlockType.value = 'newsletterSignup';
    else if (ed.isActive('link')) activeBlockType.value = 'link';
    else if (ed.isActive('horizontalRule')) activeBlockType.value = 'horizontalRule';
    else activeBlockType.value = 'paragraph';
  }

  function getActiveBlockAttributes(): Record<string, unknown> {
    const ed = editor.value;
    if (!ed) return {};
    const type = activeBlockType.value || 'paragraph';
    if (type === 'paragraph' && ed.isActive('heading')) {
      return ed.getAttributes('heading');
    }
    return ed.getAttributes(type);
  }

  function updateActiveBlockAttributes(attrs: Record<string, unknown>) {
    const ed = editor.value;
    if (!ed) return;
    const type = activeBlockType.value || 'paragraph';
    const resolvedType = type === 'paragraph' && ed.isActive('heading') ? 'heading' : type;
    applyBlockLayoutAttributes(ed, resolvedType, attrs);
  }

  function setDocumentContent(blocks: ProseMirrorJson | null | undefined) {
    const ed = editor.value;
    if (!ed) return;
    const next = blocks && blocks.type === 'doc' ? normalizeContentStudioTables(blocks) : createEmptyContentDocument();
    ed.commands.setContent(next, false);
    ed.commands.fixTables();
    updateActiveBlock(ed);
  }

  function getDocumentContent(): ProseMirrorJson {
    return (editor.value?.getJSON() as ProseMirrorJson) || createEmptyContentDocument();
  }

  function addBlock(type: string) {
    const ed = editor.value;
    if (!ed) return;
    insertBlockType(ed, type);
  }

  function insertComponent(component: ArticleComponentDefinition) {
    const ed = editor.value;
    if (!ed || !component.content.length) return;
    ed.chain().focus().insertContent(component.content).run();
  }

  function applyTemplate(template: ArticleTemplateDefinition) {
    const ed = editor.value;
    if (!ed) return;
    ed.commands.setContent(template.blocks, false);
    updateActiveBlock(ed);
    return {
      titleKey: template.titleKey,
      subtitleKey: template.subtitleKey,
      summaryKey: template.summaryKey,
    };
  }

  function hasDocumentBodyContent(): boolean {
    const ed = editor.value;
    if (!ed) return false;
    const json = ed.getJSON() as ProseMirrorJson;
    const nodes = json.content || [];
    if (nodes.length === 0) return false;
    if (nodes.length === 1 && nodes[0]?.type === 'paragraph') {
      const text = nodes[0].content?.map((node) => node.text || '').join('') || '';
      return text.trim().length > 0;
    }
    return true;
  }

  watch(
    () => options.imageUploadTrigger?.value,
    (trigger) => {
      const ed = editor.value;
      if (!ed || !trigger) return;
      registerContentStudioImageUploadTrigger(ed, trigger);
    },
  );

  watch(
    () => options.mediaInsertHandler?.value,
    (handler) => {
      const ed = editor.value;
      if (!ed || !handler) return;
      registerContentStudioMediaInsertHandler(ed, handler);
    },
  );

  onBeforeUnmount(() => {
    editor.value?.destroy();
  });

  return {
    editor,
    editorRef,
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
  };
}
