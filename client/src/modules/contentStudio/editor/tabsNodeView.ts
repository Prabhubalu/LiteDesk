import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView } from '@tiptap/pm/view';

function tabLabel(node: ProseMirrorNode, index: number): string {
  const label = String(node.attrs.label || '').trim();
  return label || `Tab ${index + 1}`;
}

function tabsStructureSignature(current: ProseMirrorNode): string {
  let signature = `${current.childCount}:`;
  current.forEach((child, _offset, index) => {
    if (child.type.name !== 'tabItem') return;
    signature += `${index}:${String(child.attrs.label || '')}|`;
  });
  return signature;
}

export function createContentStudioTabsNodeView() {
  return ({
    node,
    editor,
    getPos,
  }: {
    node: ProseMirrorNode;
    editor: Editor;
    getPos: () => number | undefined;
  }): NodeView => {
    const dom = document.createElement('div');
    dom.className = 'content-tabs content-tabs--editable';
    dom.setAttribute('data-content-tabs', '');

    const tabBar = document.createElement('div');
    tabBar.className = 'content-tabs__bar';
    tabBar.setAttribute('contenteditable', 'false');
    tabBar.setAttribute('role', 'tablist');

    const panels = document.createElement('div');
    panels.className = 'content-tabs__panels';

    let activeIndex = 0;
    let currentNode = node;
    let structureSignature = tabsStructureSignature(node);

    function resolveTabsPos(): number | undefined {
      const direct = getPos();
      if (typeof direct === 'number') return direct;

      const { $from } = editor.state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name === 'tabs') {
          return $from.before(depth);
        }
      }
      return undefined;
    }

    function tabPanelElements(): HTMLElement[] {
      return Array.from(panels.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.hasAttribute('data-tab-item'),
      );
    }

    function updateVisibility() {
      panels.dataset.activeIndex = String(activeIndex);
      tabPanelElements().forEach((panel, index) => {
        panel.style.setProperty('display', index === activeIndex ? 'block' : 'none', 'important');
      });
      tabBar.querySelectorAll<HTMLButtonElement>('.content-tabs__tab').forEach((button, index) => {
        const isActive = index === activeIndex;
        button.classList.toggle('content-tabs__tab--active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    function focusTabContent(index: number) {
      const pos = resolveTabsPos();
      if (pos === undefined) return;

      let tabIndex = 0;
      let targetPos: number | null = null;
      currentNode.forEach((child, offset) => {
        if (child.type.name !== 'tabItem') return;
        if (tabIndex === index) {
          targetPos = pos + 1 + offset + 1;
        }
        tabIndex += 1;
      });
      if (targetPos == null) return;
      editor.chain().focus().setTextSelection(targetPos).run();
    }

    function activateTab(index: number, focusContent: boolean) {
      if (index < 0 || index >= currentNode.childCount) return;
      activeIndex = index;
      updateVisibility();
      if (focusContent) {
        window.setTimeout(() => focusTabContent(index), 0);
      }
    }

    function renderTabBar(current: ProseMirrorNode) {
      tabBar.replaceChildren();
      let tabIndex = 0;
      current.forEach((child) => {
        if (child.type.name !== 'tabItem') return;
        const index = tabIndex;
        tabIndex += 1;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'content-tabs__tab';
        button.setAttribute('role', 'tab');
        button.textContent = tabLabel(child, index);

        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          activateTab(index, true);
        });

        tabBar.appendChild(button);
      });
    }

    panels.addEventListener('mousedown', (event) => {
      const target = event.target as HTMLElement | null;
      const panel = target?.closest('[data-tab-item]');
      if (!panel || !panels.contains(panel)) return;
      const index = tabPanelElements().indexOf(panel as HTMLElement);
      if (index >= 0) {
        activeIndex = index;
        updateVisibility();
      }
    });

    dom.appendChild(tabBar);
    dom.appendChild(panels);

    renderTabBar(node);
    updateVisibility();

    return {
      dom,
      contentDOM: panels,
      update(updatedNode) {
        if (updatedNode.type.name !== 'tabs') return false;
        const nextSignature = tabsStructureSignature(updatedNode);
        const structureChanged = nextSignature !== structureSignature;
        structureSignature = nextSignature;
        currentNode = updatedNode;
        if (activeIndex >= updatedNode.childCount) {
          activeIndex = Math.max(0, updatedNode.childCount - 1);
        }
        if (structureChanged) {
          renderTabBar(updatedNode);
        }
        window.requestAnimationFrame(() => updateVisibility());
        return true;
      },
      stopEvent(event) {
        return tabBar.contains(event.target as Node);
      },
      ignoreMutation(mutation) {
        if (tabBar.contains(mutation.target)) return true;
        if (mutation.type === 'attributes' && panels.contains(mutation.target as Node)) {
          return mutation.attributeName === 'style' || mutation.attributeName === 'data-active-index';
        }
        return false;
      },
      selectNode() {
        dom.classList.add('ProseMirror-selectednode');
      },
      deselectNode() {
        dom.classList.remove('ProseMirror-selectednode');
      },
    };
  };
}
