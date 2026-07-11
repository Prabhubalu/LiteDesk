import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { NodeView } from '@tiptap/pm/view';

function readQuestion(node: ProseMirrorNode): string {
  return String(node.attrs.question || '').trim();
}

export function createContentStudioFaqItemNodeView() {
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
    dom.className = 'content-faq-item content-faq-item--editable';
    dom.setAttribute('data-faq-item', '');

    const header = document.createElement('div');
    header.className = 'content-faq-item__header';

    const chevron = document.createElement('span');
    chevron.className = 'content-faq-item__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '›';

    const questionEl = document.createElement('div');
    questionEl.className = 'content-faq-item__question';
    questionEl.contentEditable = 'true';
    questionEl.setAttribute('data-placeholder', 'Question');
    questionEl.setAttribute('role', 'textbox');
    questionEl.setAttribute('aria-multiline', 'false');

    const body = document.createElement('div');
    body.className = 'content-faq-item__body';

    let currentNode = node;

    function questionFromElement(): string {
      return questionEl.textContent?.trim() || 'Question';
    }

    function syncQuestionDataset() {
      dom.dataset.question = questionFromElement();
    }

    function commitQuestion() {
      const pos = getPos();
      if (pos === undefined) return;

      const nextQuestion = questionFromElement();
      if (nextQuestion === String(currentNode.attrs.question || '')) return;

      const { tr } = editor.state;
      tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, question: nextQuestion });
      editor.view.dispatch(tr);
    }

    function focusAnswer() {
      const pos = getPos();
      if (pos === undefined) return;

      const answerPos = pos + 1;
      if (answerPos >= editor.state.doc.content.size) return;

      const tr = editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(answerPos)));
      editor.view.dispatch(tr);
      editor.view.focus();
    }

    function renderQuestion(current: ProseMirrorNode) {
      const question = readQuestion(current);
      dom.dataset.question = question || 'Question';
      if (document.activeElement === questionEl) return;
      questionEl.textContent = question;
    }

    questionEl.addEventListener('input', syncQuestionDataset);
    questionEl.addEventListener('blur', commitQuestion);
    questionEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commitQuestion();
      focusAnswer();
    });
    questionEl.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') ?? '';
      document.execCommand('insertText', false, text.replace(/\r?\n/g, ' '));
    });

    header.append(chevron, questionEl);
    renderQuestion(node);
    dom.append(header, body);

    return {
      dom,
      contentDOM: body,
      update(updatedNode) {
        if (updatedNode.type.name !== 'faqItem') return false;
        currentNode = updatedNode;
        renderQuestion(updatedNode);
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
