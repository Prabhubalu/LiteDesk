import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView } from '@tiptap/pm/view';
import {
  normalizeImagePosition,
  normalizeImageTextWrap,
  normalizeImageWidth,
} from './imageExtension';

interface ImageNodeViewOptions {
  captionPlaceholder: string;
}

function applyFigureAttrs(figure: HTMLElement, attrs: Record<string, unknown>, inGallery = false) {
  figure.className = inGallery ? 'content-image-figure content-gallery__figure' : 'content-image-figure';

  const customClass = attrs.cssClass ? String(attrs.cssClass).trim() : '';
  if (customClass) {
    customClass.split(/\s+/).forEach((value) => {
      if (value) figure.classList.add(value);
    });
  }

  if (inGallery) {
    figure.removeAttribute('data-width');
    figure.removeAttribute('data-text-wrap');
    figure.removeAttribute('data-image-position');
  } else {
    figure.dataset.width = normalizeImageWidth(String(attrs.width || ''));
    figure.dataset.textWrap = normalizeImageTextWrap(String(attrs.textWrap || ''));
    figure.dataset.imagePosition = normalizeImagePosition(String(attrs.imagePosition || ''));
  }

  const anchorId = attrs.anchorId ? String(attrs.anchorId) : '';
  if (anchorId) figure.id = anchorId;
  else figure.removeAttribute('id');

  const blockWidth = attrs.blockWidth ? String(attrs.blockWidth) : '';
  figure.classList.remove('content-block-width-wide', 'content-block-width-full');
  if (blockWidth && blockWidth !== 'content') {
    figure.dataset.blockWidth = blockWidth;
    figure.classList.add(`content-block-width-${blockWidth}`);
  } else {
    figure.removeAttribute('data-block-width');
  }

  const textAlign = attrs.textAlign ? String(attrs.textAlign) : '';
  if (textAlign) figure.style.textAlign = textAlign;
  else figure.style.removeProperty('text-align');
}

function stopProseMirrorEvent(event: Event) {
  event.stopPropagation();
}

function isCaptionEnabled(attrs: Record<string, unknown>) {
  if (attrs.captionEnabled) return true;
  return Boolean(String(attrs.caption || '').trim());
}

export function createContentStudioImageNodeView(options: ImageNodeViewOptions) {
  return ({
    node,
    getPos,
    editor,
  }: {
    node: ProseMirrorNode;
    getPos: () => number | undefined;
    editor: Editor;
  }): NodeView => {
    const figure = document.createElement('figure');
    const img = document.createElement('img');
    const captionInput = document.createElement('input');

    figure.setAttribute('contenteditable', 'false');
    figure.className = 'content-image-figure';

    captionInput.type = 'text';
    captionInput.className = 'content-image-caption-input';
    captionInput.placeholder = options.captionPlaceholder;
    captionInput.setAttribute('aria-label', options.captionPlaceholder);

    let captionSyncTimer: ReturnType<typeof setTimeout> | null = null;
    let captionFocused = false;
    let shouldFocusCaption = false;

    function syncCaptionToDocument() {
      const value = captionInput.value.trim();
      const nextCaption = value || null;
      const currentCaption = node.attrs.caption ? String(node.attrs.caption) : null;
      if (nextCaption === currentCaption) return;
      const pos = getPos();
      if (pos === undefined) return;
      editor.chain().setNodeSelection(pos).updateAttributes('image', { caption: nextCaption }).run();
    }

    function scheduleCaptionSync() {
      if (captionSyncTimer) clearTimeout(captionSyncTimer);
      captionSyncTimer = setTimeout(() => {
        captionSyncTimer = null;
        syncCaptionToDocument();
      }, 200);
    }

    captionInput.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      captionInput.focus();
    });
    captionInput.addEventListener('click', stopProseMirrorEvent);
    captionInput.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        captionInput.blur();
      }
    });
    captionInput.addEventListener('keyup', stopProseMirrorEvent);
    captionInput.addEventListener('keypress', stopProseMirrorEvent);
    captionInput.addEventListener('beforeinput', stopProseMirrorEvent);
    captionInput.addEventListener('input', (event) => {
      event.stopPropagation();
      scheduleCaptionSync();
    });
    captionInput.addEventListener('focus', () => {
      captionFocused = true;
    });
    captionInput.addEventListener('blur', () => {
      captionFocused = false;
      if (captionSyncTimer) {
        clearTimeout(captionSyncTimer);
        captionSyncTimer = null;
      }
      syncCaptionToDocument();
    });

    img.addEventListener('click', (event) => {
      event.stopPropagation();
      const pos = getPos();
      if (pos === undefined) return;
      editor.chain().setNodeSelection(pos).run();
    });

    figure.appendChild(img);

    function setCaptionVisible(enabled: boolean) {
      figure.dataset.captionEnabled = enabled ? 'true' : 'false';
      if (enabled) {
        if (!captionInput.isConnected) {
          figure.appendChild(captionInput);
        }
        if (shouldFocusCaption) {
          shouldFocusCaption = false;
          requestAnimationFrame(() => captionInput.focus());
        }
        return;
      }
      if (captionInput.isConnected) {
        captionInput.blur();
        figure.removeChild(captionInput);
      }
    }

    function renderFromNode(current: ProseMirrorNode) {
      const attrs = current.attrs as Record<string, unknown>;
      const inGallery = Boolean(figure.closest('[data-content-gallery]'));
      applyFigureAttrs(figure, attrs, inGallery);

      img.className = 'content-image';
      img.src = String(attrs.src || '');
      img.alt = String(attrs.alt || '');
      img.draggable = true;
      img.loading = 'lazy';

      const title = attrs.title ? String(attrs.title) : '';
      if (title) img.title = title;
      else img.removeAttribute('title');

      const enabled = isCaptionEnabled(attrs);
      setCaptionVisible(enabled);

      if (!captionFocused) {
        const caption = String(attrs.caption || '');
        if (captionInput.value !== caption) {
          captionInput.value = caption;
        }
      }
    }

    renderFromNode(node);

    return {
      dom: figure,
      update(updatedNode) {
        if (updatedNode.type.name !== 'image') return false;
        const prevEnabled = isCaptionEnabled(node.attrs as Record<string, unknown>);
        node = updatedNode;
        const nextEnabled = isCaptionEnabled(updatedNode.attrs as Record<string, unknown>);
        if (!prevEnabled && nextEnabled) {
          shouldFocusCaption = true;
        }
        renderFromNode(updatedNode);
        return true;
      },
      selectNode() {
        figure.classList.add('ProseMirror-selectednode');
      },
      deselectNode() {
        figure.classList.remove('ProseMirror-selectednode');
      },
      ignoreMutation(mutation) {
        return figure.contains(mutation.target);
      },
      destroy() {
        if (captionSyncTimer) clearTimeout(captionSyncTimer);
      },
    };
  };
}
