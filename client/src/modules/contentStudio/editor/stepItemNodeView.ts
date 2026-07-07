import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { NodeView } from '@tiptap/pm/view';

function readTitle(node: ProseMirrorNode): string {
  return String(node.attrs.title || '').trim();
}

export function createContentStudioStepItemNodeView() {
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
    dom.className = 'content-step content-step--editable';
    dom.setAttribute('data-step', '');

    const header = document.createElement('div');
    header.className = 'content-step__header';

    const numberEl = document.createElement('span');
    numberEl.className = 'content-step__number';
    numberEl.setAttribute('aria-hidden', 'true');

    const titleEl = document.createElement('div');
    titleEl.className = 'content-step__title';
    titleEl.contentEditable = 'true';
    titleEl.setAttribute('data-placeholder', 'Step title');
    titleEl.setAttribute('role', 'textbox');
    titleEl.setAttribute('aria-multiline', 'false');

    const body = document.createElement('div');
    body.className = 'content-step__body';

    let currentNode = node;

    function titleFromElement(): string {
      return titleEl.textContent?.trim() || 'Step title';
    }

    function syncTitleDataset() {
      dom.dataset.title = titleFromElement();
    }

    function commitTitle() {
      const pos = getPos();
      if (pos === undefined) return;

      const nextTitle = titleFromElement();
      if (nextTitle === String(currentNode.attrs.title || '')) return;

      const { tr } = editor.state;
      tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, title: nextTitle });
      editor.view.dispatch(tr);
    }

    function focusBody() {
      const pos = getPos();
      if (pos === undefined) return;

      const bodyPos = pos + 1;
      if (bodyPos >= editor.state.doc.content.size) return;

      const tr = editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(bodyPos)));
      editor.view.dispatch(tr);
      editor.view.focus();
    }

    function renderTitle(current: ProseMirrorNode) {
      const title = readTitle(current);
      dom.dataset.title = title || 'Step title';
      if (document.activeElement === titleEl) return;
      titleEl.textContent = title;
    }

    titleEl.addEventListener('input', syncTitleDataset);
    titleEl.addEventListener('blur', commitTitle);
    titleEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commitTitle();
      focusBody();
    });
    titleEl.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') ?? '';
      document.execCommand('insertText', false, text.replace(/\r?\n/g, ' '));
    });

    header.append(numberEl, titleEl);
    renderTitle(node);
    dom.append(header, body);

    return {
      dom,
      contentDOM: body,
      update(updatedNode) {
        if (updatedNode.type.name !== 'step') return false;
        currentNode = updatedNode;
        renderTitle(updatedNode);
        return true;
      },
      stopEvent(event) {
        return header.contains(event.target as Node);
      },
      ignoreMutation(mutation) {
        return header.contains(mutation.target);
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
