import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';

const DocumentSlashCommandPluginKey = new PluginKey('documentSlashCommand');

function matchesSlashQuery(cmd, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  if (cmd.title.toLowerCase().includes(q)) return true;
  return (cmd.keywords || []).some((keyword) => keyword.includes(q) || q.includes(keyword));
}

export function createDocumentSlashCommands(triggerUpload) {
  const commands = [
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
          triggerUpload?.();
        }, 0);
      }
    },
    { title: 'Bullet list', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
    {
      title: 'Checklist',
      keywords: ['todo', 'task', 'checkbox'],
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
    { title: 'Numbered list', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { title: 'Blockquote', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
    {
      title: 'Code block',
      keywords: ['code', 'snippet'],
      command: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    }
  ];

  return Extension.create({
    name: 'documentSlashCommands',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          pluginKey: DocumentSlashCommandPluginKey,
          char: '/',
          startOfLine: false,
          allowedPrefixes: null,
          items: ({ query }) => commands.filter((cmd) => matchesSlashQuery(cmd, query)),
          command: ({ editor, range, props }) => {
            props.command(editor, range);
          },
          render: () => {
            let list = null;
            let selectedIndex = 0;
            let currentProps = null;
            let viewportListenerBound = false;

            const createList = () => {
              const el = document.createElement('div');
              el.className = 'slash-command-list rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1 overflow-hidden max-h-[280px] overflow-y-auto';
              el.style.width = 'max-content';
              el.style.maxWidth = '220px';
              el.style.minWidth = '180px';
              return el;
            };

            const updateSelection = () => {
              if (!list) return;
              const buttons = list.querySelectorAll('[data-slash-index]');
              buttons.forEach((btn, index) => {
                const selected = index === selectedIndex;
                btn.className = `slash-command-item block w-full whitespace-nowrap px-3 py-1.5 text-left text-sm ${
                  selected
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50'
                }`;
              });
            };

            const renderItems = () => {
              if (!list || !currentProps) return;
              list.innerHTML = '';
              const items = currentProps.items || [];
              items.forEach((item, index) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.dataset.slashIndex = String(index);
                btn.className = 'slash-command-item block w-full whitespace-nowrap px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50';
                btn.textContent = item.title;
                btn.addEventListener('mousedown', (event) => {
                  event.preventDefault();
                  currentProps.command(item);
                });
                list.appendChild(btn);
              });
              updateSelection();
            };
            const positionList = (props) => {
              if (!list || !props.clientRect) return;
              const rect = props.clientRect();
              if (!rect) return;
              list.style.position = 'fixed';
              list.style.left = `${rect.left}px`;
              list.style.top = `${rect.bottom + 4}px`;
              list.style.zIndex = '11000';
            };

            const handleViewportChange = () => {
              if (!currentProps) return;
              positionList(currentProps);
            };

            const bindViewportListeners = () => {
              if (viewportListenerBound) return;
              window.addEventListener('scroll', handleViewportChange, true);
              window.addEventListener('resize', handleViewportChange);
              viewportListenerBound = true;
            };

            const unbindViewportListeners = () => {
              if (!viewportListenerBound) return;
              window.removeEventListener('scroll', handleViewportChange, true);
              window.removeEventListener('resize', handleViewportChange);
              viewportListenerBound = false;
            };

            return {
              onStart: (props) => {
                currentProps = props;
                list = createList();
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
              }
            };
          }
        })
      ];
    }
  });
}
