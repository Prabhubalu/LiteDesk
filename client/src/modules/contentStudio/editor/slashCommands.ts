import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import type { Editor, Range } from '@tiptap/core';
import {
  createCalloutBlockContent,
  createFaqBlockContent,
  createRelatedArticlesBlockContent,
  createStepsBlockContent,
  insertTableBlock,
  createTimelineBlockContent,
  createGalleryBlockContent,
  addGalleryImage,
  replaceGalleryImage,
  createButtonBlockContent,
  createSpacerBlockContent,
  createTabsBlockContent,
  createColumnsBlockContent,
  createSectionBlockContent,
  createTocBlockContent,
  createFormBlockContent,
  createSocialBlockContent,
  createRatingBlockContent,
  createProgressBlockContent,
  createHeroBlockContent,
  createNewsletterSignupBlockContent,
  insertMediaBlock,
} from './blockCommands';
import { findBlockRegistryItem, resolveInsertBlockAttrs, resolveInsertBlockType } from './blockRegistry';
import { requestMediaInsert } from './mediaInsertDialog';

const SlashCommandPluginKey = new PluginKey('contentStudioSlashCommand');

const imageUploadTriggers = new WeakMap<Editor, () => void>();

export type GalleryImageIntent = 'insert' | 'add' | 'replace';

const pendingGalleryIntent = new WeakMap<Editor, GalleryImageIntent>();

export function registerContentStudioImageUploadTrigger(editor: Editor, trigger: () => void) {
  imageUploadTriggers.set(editor, trigger);
}

export function unregisterContentStudioImageUploadTrigger(editor: Editor) {
  imageUploadTriggers.delete(editor);
  pendingGalleryIntent.delete(editor);
}

export function setPendingGalleryIntent(editor: Editor, intent: GalleryImageIntent) {
  pendingGalleryIntent.set(editor, intent);
}

export function consumePendingGalleryIntent(editor: Editor): GalleryImageIntent | null {
  const intent = pendingGalleryIntent.get(editor) || null;
  pendingGalleryIntent.delete(editor);
  return intent;
}

export function markPendingGalleryInsert(editor: Editor) {
  setPendingGalleryIntent(editor, 'insert');
}

/** @deprecated Use consumePendingGalleryIntent */
export function consumePendingGalleryInsert(editor: Editor): boolean {
  const intent = consumePendingGalleryIntent(editor);
  return intent === 'insert';
}

interface SlashCommandItem {
  title: string;
  keywords?: string[];
  command: (editor: Editor, range: Range) => void;
}

function matchesQuery(cmd: SlashCommandItem, query: string) {
  const q = query.toLowerCase();
  if (!q) return true;
  if (cmd.title.toLowerCase().includes(q)) return true;
  return (cmd.keywords || []).some((keyword) => keyword.includes(q) || q.includes(keyword));
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  { title: 'Heading 1', command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
  { title: 'Heading 2', command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
  { title: 'Heading 3', command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
  { title: 'Paragraph', command: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run() },
  {
    title: 'Image',
    keywords: ['img', 'photo', 'picture', 'upload'],
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      window.setTimeout(() => imageUploadTriggers.get(editor)?.(), 0);
    },
  },
  { title: 'Bullet list', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { title: 'Checklist', keywords: ['todo', 'task'], command: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
  { title: 'Numbered list', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { title: 'Quote', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
  {
    title: 'Callout',
    keywords: ['note', 'tip', 'warning'],
    command: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: 'callout', attrs: { variant: 'info' }, content: [{ type: 'paragraph' }] })
        .run(),
  },
  { title: 'Divider', command: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
  { title: 'Code', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
  {
    title: 'Embed',
    keywords: ['iframe', 'video', 'youtube', 'vimeo'],
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      insertMediaBlockFromDialog(editor, 'embed');
    },
  },
  {
    title: 'Table',
    keywords: ['grid', 'rows', 'columns'],
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      insertTableBlock(editor);
    },
  },
  {
    title: 'Steps',
    keywords: ['how-to', 'guide'],
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertContent(createStepsBlockContent()).run(),
  },
  {
    title: 'FAQ',
    keywords: ['question', 'answer'],
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertContent(createFaqBlockContent()).run(),
  },
  {
    title: 'Related Articles',
    keywords: ['related', 'links', 'articles'],
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertContent(createRelatedArticlesBlockContent()).run(),
  },
];

function createSlashCommandList() {
  const list = document.createElement('div');
  list.className =
    'content-studio-slash-list rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 min-w-[200px] max-h-[280px] overflow-y-auto';
  return list;
}

export const ContentStudioSlashCommands = Extension.create({
  name: 'contentStudioSlashCommands',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        pluginKey: SlashCommandPluginKey,
        char: '/',
        startOfLine: false,
        allowedPrefixes: null,
        items: ({ query }) => SLASH_COMMANDS.filter((cmd) => matchesQuery(cmd, query)),
        command: ({ editor, range, props }) => {
          props.command(editor, range);
        },
        render: () => {
          let list: HTMLDivElement | null = null;
          let selectedIndex = 0;
          let currentProps: SuggestionProps<SlashCommandItem> | null = null;
          let viewportListenerBound = false;

          const selectedClass =
            'bg-primary-50 text-primary-800 dark:bg-primary-950/50 dark:text-primary-200';
          const idleClass =
            'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800';

          function updateSelection() {
            if (!list) return;
            const buttons = list.querySelectorAll('[data-slash-index]');
            buttons.forEach((button, index) => {
              button.className = [
                'slash-command-item block w-full px-3 py-2 text-left text-sm',
                index === selectedIndex ? selectedClass : idleClass,
              ].join(' ');
            });
          }

          function renderItems() {
            if (!list || !currentProps) return;
            list.innerHTML = '';
            const items = currentProps.items || [];
            items.forEach((item, index) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.dataset.slashIndex = String(index);
              btn.className = `slash-command-item block w-full px-3 py-2 text-left text-sm ${index === selectedIndex ? selectedClass : idleClass}`;
              btn.textContent = item.title;
              btn.addEventListener('mousedown', (event) => {
                event.preventDefault();
                currentProps?.command(item);
              });
              list?.appendChild(btn);
            });
          }

          function positionList(props: SuggestionProps<SlashCommandItem>) {
            if (!list || !props.clientRect) return;
            const rect = props.clientRect();
            if (!rect) return;
            list.style.position = 'fixed';
            list.style.left = `${rect.left}px`;
            list.style.top = `${rect.bottom + 4}px`;
            list.style.zIndex = '12000';
          }

          function handleViewportChange() {
            if (!currentProps) return;
            positionList(currentProps);
          }

          function bindViewportListeners() {
            if (viewportListenerBound) return;
            window.addEventListener('scroll', handleViewportChange, true);
            window.addEventListener('resize', handleViewportChange);
            viewportListenerBound = true;
          }

          function unbindViewportListeners() {
            if (!viewportListenerBound) return;
            window.removeEventListener('scroll', handleViewportChange, true);
            window.removeEventListener('resize', handleViewportChange);
            viewportListenerBound = false;
          }

          return {
            onStart: (props) => {
              currentProps = props;
              list = createSlashCommandList();
              document.body.appendChild(list);
              selectedIndex = 0;
              renderItems();
              positionList(props);
              bindViewportListeners();
            },
            onUpdate: (props) => {
              currentProps = props;
              selectedIndex = 0;
              renderItems();
              positionList(props);
            },
            onKeyDown: ({ event }) => {
              if (!currentProps || !list) return false;
              const count = currentProps.items?.length || 0;
              if (!count) return false;

              if (event.key === 'ArrowUp') {
                selectedIndex = (selectedIndex - 1 + count) % count;
                updateSelection();
                return true;
              }
              if (event.key === 'ArrowDown') {
                selectedIndex = (selectedIndex + 1) % count;
                updateSelection();
                return true;
              }
              if (event.key === 'Enter') {
                const item = currentProps.items[selectedIndex];
                if (item) currentProps.command(item);
                return true;
              }
              return false;
            },
            onExit: () => {
              unbindViewportListeners();
              list?.remove();
              list = null;
              currentProps = null;
            },
          };
        },
      }),
    ];
  },
});

function insertMediaBlockFromDialog(editor: Editor, type: 'audio' | 'file' | 'embed') {
  void requestMediaInsert(editor, type).then((values) => {
    if (!values?.url.trim()) return;
    insertMediaBlock(editor, type, values);
  });
}

export function insertBlockType(editor: Editor, type: string) {
  const registryItem = findBlockRegistryItem(type);
  if (registryItem?.enabled === false) return;

  const resolvedType = resolveInsertBlockType(type);
  const insertAttrs = resolveInsertBlockAttrs(type);

  switch (resolvedType) {
    case 'paragraph':
      editor.chain().focus().setParagraph().run();
      break;
    case 'heading':
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      break;
    case 'image':
      imageUploadTriggers.get(editor)?.();
      break;
    case 'gallery':
      markPendingGalleryInsert(editor);
      imageUploadTriggers.get(editor)?.();
      break;
    case 'bulletList':
      editor.chain().focus().toggleBulletList().run();
      break;
    case 'orderedList':
      editor.chain().focus().toggleOrderedList().run();
      break;
    case 'taskList':
      editor.chain().focus().toggleTaskList().run();
      break;
    case 'embed':
      insertMediaBlockFromDialog(editor, 'embed');
      break;
    case 'blockquote':
      editor.chain().focus().toggleBlockquote().run();
      break;
    case 'horizontalRule':
      editor.chain().focus().setHorizontalRule().run();
      break;
    case 'codeBlock':
      editor.chain().focus().toggleCodeBlock().run();
      break;
    case 'callout':
      editor.chain().focus().insertContent(createCalloutBlockContent(String(insertAttrs.variant || 'info'))).run();
      break;
    case 'steps':
      editor.chain().focus().insertContent(createStepsBlockContent()).run();
      break;
    case 'faq':
      editor.chain().focus().insertContent(createFaqBlockContent()).run();
      break;
    case 'relatedArticles':
      editor.chain().focus().insertContent(createRelatedArticlesBlockContent()).run();
      break;
    case 'table':
      insertTableBlock(editor);
      break;
    case 'timeline':
      editor.chain().focus().insertContent(createTimelineBlockContent()).run();
      break;
    case 'spacer':
      editor.chain().focus().insertContent(createSpacerBlockContent()).run();
      break;
    case 'button': {
      const label = window.prompt('Button label', 'Learn more');
      if (!label) break;
      const href = window.prompt('Button URL', 'https://');
      if (!href) break;
      editor.chain().focus().insertContent(createButtonBlockContent(label, href)).run();
      break;
    }
    case 'audio':
      insertMediaBlockFromDialog(editor, 'audio');
      break;
    case 'file':
      insertMediaBlockFromDialog(editor, 'file');
      break;
    case 'tabs':
      editor.chain().focus().insertContent(createTabsBlockContent()).run();
      break;
    case 'columns':
      editor.chain().focus().insertContent(createColumnsBlockContent()).run();
      break;
    case 'section':
      editor.chain().focus().insertContent(createSectionBlockContent()).run();
      break;
    case 'toc':
      editor.chain().focus().insertContent(createTocBlockContent()).run();
      break;
    case 'form':
      editor.chain().focus().insertContent(createFormBlockContent()).run();
      break;
    case 'social':
      editor.chain().focus().insertContent(createSocialBlockContent()).run();
      break;
    case 'rating':
      editor.chain().focus().insertContent(createRatingBlockContent()).run();
      break;
    case 'progress':
      editor.chain().focus().insertContent(createProgressBlockContent()).run();
      break;
    case 'hero':
      editor.chain().focus().insertContent(createHeroBlockContent()).run();
      break;
    case 'newsletterSignup':
      editor.chain().focus().insertContent(createNewsletterSignupBlockContent()).run();
      break;
    default:
      editor.chain().focus().setParagraph().run();
  }
}

export function insertGalleryFromImageUrl(editor: Editor, imageUrl: string, alt = '') {
  if (!imageUrl) return;
  editor.chain().focus().insertContent(createGalleryBlockContent(imageUrl, alt)).run();
}

export function applyGalleryImageFromUpload(
  editor: Editor,
  imageUrl: string,
  alt: string,
  intent: GalleryImageIntent,
) {
  if (!imageUrl) return false;
  switch (intent) {
    case 'insert':
      insertGalleryFromImageUrl(editor, imageUrl, alt);
      return true;
    case 'add':
      return addGalleryImage(editor, imageUrl, alt);
    case 'replace':
      return replaceGalleryImage(editor, imageUrl, alt);
    default:
      return false;
  }
}
