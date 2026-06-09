import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';

const SlashCommandPluginKey = new PluginKey('slashCommand');

/** Per-editor image upload trigger (supports multiple editors on one page). */
const imageUploadTriggers = new WeakMap();

export function registerDescriptionImageUploadTrigger(editor, trigger) {
  if (editor && typeof trigger === 'function') {
    imageUploadTriggers.set(editor, trigger);
  }
}

export function unregisterDescriptionImageUploadTrigger(editor) {
  if (editor) imageUploadTriggers.delete(editor);
}

function matchesSlashQuery(cmd, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  if (cmd.title.toLowerCase().includes(q)) return true;
  return (cmd.keywords || []).some((keyword) => keyword.includes(q) || q.includes(keyword));
}

const SLASH_COMMANDS = [
  { title: 'Heading 1', command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
  { title: 'Heading 2', command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
  { title: 'Heading 3', command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
  { title: 'Paragraph', command: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run() },
  {
    title: 'Image',
    keywords: ['img', 'photo', 'picture', 'upload'],
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      window.setTimeout(() => {
        imageUploadTriggers.get(editor)?.();
      }, 0);
    }
  },
  { title: 'Bullet list', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { title: 'Numbered list', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { title: 'Blockquote', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
];

function createSlashCommandList() {
  const list = document.createElement('div');
  list.className = 'slash-command-list rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1 overflow-hidden min-w-[180px] max-h-[280px] overflow-y-auto';
  return list;
}

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: SlashCommandPluginKey,
        char: '/',
        // Allow slash menu from any cursor position, not only line start.
        startOfLine: false,
        allowedPrefixes: null,
        items: ({ query }) => SLASH_COMMANDS.filter((cmd) => matchesSlashQuery(cmd, query)),
        command: ({ editor, range, props }) => {
          props.command(editor, range);
        },
        render: () => {
          let list = null;
          let selectedIndex = 0;
          let currentProps = null;
          let viewportListenerBound = false;
          let outsidePointerListenerBound = false;

          return {
            onStart: (props) => {
              currentProps = props;
              list = createSlashCommandList();
              document.body.appendChild(list);
              selectedIndex = 0;
              updateList(props);
              positionList(props);
              bindGlobalListeners();
            },
            onUpdate: (props) => {
              currentProps = props;
              selectedIndex = 0;
              updateList(props);
              positionList(props);
            },
            onKeyDown: ({ event }) => {
              if (!currentProps || !list) return false;
              if (event.key === 'ArrowUp') {
                selectedIndex = (selectedIndex - 1 + list.children.length) % Math.max(1, list.children.length);
                updateSelection();
                return true;
              }
              if (event.key === 'ArrowDown') {
                selectedIndex = (selectedIndex + 1) % Math.max(1, list.children.length);
                updateSelection();
                return true;
              }
              if (event.key === 'Enter') {
                const item = list.children[selectedIndex];
                if (item?.dataset?.index !== undefined) {
                  const idx = parseInt(item.dataset.index, 10);
                  const cmd = currentProps.items[idx];
                  if (cmd) currentProps.command(cmd);
                }
                return true;
              }
              return false;
            },
            onExit: () => {
              unbindGlobalListeners();
              list?.remove();
              list = null;
              currentProps = null;
            },
          };

          function updateList(props) {
            if (!list) return;
            list.innerHTML = '';
            props.items.forEach((item, idx) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = `slash-command-item w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 ${idx === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''}`;
              btn.dataset.index = String(idx);
              btn.textContent = item.title;
              btn.addEventListener('click', () => props.command(item));
              list.appendChild(btn);
            });
          }

          function updateSelection() {
            if (!list) return;
            const items = list.querySelectorAll('.slash-command-item');
            items.forEach((el, i) => {
              el.classList.toggle('bg-gray-100', i === selectedIndex);
              el.classList.toggle('dark:bg-gray-700', i === selectedIndex);
            });
          }

          function positionList(props) {
            if (!list || !props.clientRect) return;
            const rect = props.clientRect();
            if (!rect) return;
            list.style.position = 'fixed';
            list.style.left = `${rect.left}px`;
            list.style.top = `${rect.bottom + 4}px`;
            // Drawer dialogs render at z-10000; keep slash menu above them.
            list.style.zIndex = '11000';
          }

          function handleViewportChange() {
            if (!currentProps) return;
            positionList(currentProps);
          }

          function handleOutsidePointerDown(event) {
            if (!list || !currentProps?.editor?.view?.dom) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            const clickedInsideMenu = list.contains(target);
            const clickedInsideEditor = currentProps.editor.view.dom.contains(target);
            if (!clickedInsideMenu && !clickedInsideEditor) {
              currentProps.editor.commands.blur();
            }
          }

          function bindGlobalListeners() {
            if (!viewportListenerBound) {
              window.addEventListener('scroll', handleViewportChange, true);
              window.addEventListener('resize', handleViewportChange);
              viewportListenerBound = true;
            }
            if (!outsidePointerListenerBound) {
              document.addEventListener('pointerdown', handleOutsidePointerDown, true);
              outsidePointerListenerBound = true;
            }
          }

          function unbindGlobalListeners() {
            if (viewportListenerBound) {
              window.removeEventListener('scroll', handleViewportChange, true);
              window.removeEventListener('resize', handleViewportChange);
              viewportListenerBound = false;
            }
            if (outsidePointerListenerBound) {
              document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
              outsidePointerListenerBound = false;
            }
          }
        },
      }),
    ];
  },
});
