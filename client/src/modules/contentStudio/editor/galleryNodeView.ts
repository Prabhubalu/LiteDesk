import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView } from '@tiptap/pm/view';
import { normalizeGalleryLayout, type GalleryLayout } from './layoutBlocksExtension';

function galleryStructureSignature(current: ProseMirrorNode): string {
  let signature = `${normalizeGalleryLayout(current.attrs.layout)}:${current.childCount}:`;
  current.forEach((child, _offset, index) => {
    if (child.type.name !== 'image') return;
    signature += `${index}:${String(child.attrs.src || '')}|`;
  });
  return signature;
}

export function createContentStudioGalleryNodeView() {
  return ({
    node,
  }: {
    node: ProseMirrorNode;
    getPos: () => number | undefined;
  }): NodeView => {
    const dom = document.createElement('div');
    dom.setAttribute('data-content-gallery', '');

    const viewport = document.createElement('div');
    viewport.className = 'content-gallery__viewport';

    const controls = document.createElement('div');
    controls.className = 'content-gallery__controls';
    controls.setAttribute('contenteditable', 'false');

    let activeIndex = 0;
    let currentNode = node;
    let currentLayout = normalizeGalleryLayout(node.attrs.layout);
    let structureSignature = galleryStructureSignature(node);

    function applyLayoutClasses(layout: GalleryLayout) {
      dom.className = ['content-gallery', `content-gallery--${layout}`].join(' ');
      dom.dataset.galleryLayout = layout;
      controls.hidden = layout !== 'carousel' || currentNode.childCount <= 1;
      viewport.style.cssText = '';

      if (layout === 'grid') {
        viewport.style.display = 'grid';
        viewport.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
        viewport.style.gap = '0.75rem';
        viewport.style.width = '100%';
        return;
      }

      if (layout === 'scroll') {
        viewport.style.display = 'flex';
        viewport.style.flexDirection = 'row';
        viewport.style.flexWrap = 'nowrap';
        viewport.style.gap = '0.75rem';
        viewport.style.overflowX = 'auto';
        viewport.style.paddingBottom = '0.5rem';
        viewport.style.width = '100%';
        return;
      }

      viewport.style.width = '100%';
      viewport.style.overflow = 'hidden';
    }

    function imageElements(): HTMLElement[] {
      return Array.from(viewport.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.classList.contains('content-image-figure'),
      );
    }

    function updateSlideVisibility() {
      const layout = normalizeGalleryLayout(currentNode.attrs.layout);
      const figures = imageElements();
      if (layout !== 'carousel') {
        figures.forEach((figure) => figure.style.removeProperty('display'));
        return;
      }
      if (activeIndex >= figures.length) {
        activeIndex = Math.max(0, figures.length - 1);
      }
      figures.forEach((figure, index) => {
        figure.style.setProperty('display', index === activeIndex ? 'block' : 'none', 'important');
      });
      controls.querySelectorAll<HTMLButtonElement>('.content-gallery__dot').forEach((dot, index) => {
        dot.classList.toggle('content-gallery__dot--active', index === activeIndex);
      });
    }

    function goToSlide(index: number) {
      const figures = imageElements();
      if (!figures.length) return;
      activeIndex = ((index % figures.length) + figures.length) % figures.length;
      updateSlideVisibility();
    }

    function renderControls(current: ProseMirrorNode) {
      controls.replaceChildren();
      const layout = normalizeGalleryLayout(current.attrs.layout);
      if (layout !== 'carousel' || current.childCount <= 1) return;

      const prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'content-gallery__arrow content-gallery__arrow--prev';
      prev.setAttribute('aria-label', 'Previous slide');
      prev.textContent = '‹';
      prev.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        goToSlide(activeIndex - 1);
      });

      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'content-gallery__arrow content-gallery__arrow--next';
      next.setAttribute('aria-label', 'Next slide');
      next.textContent = '›';
      next.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        goToSlide(activeIndex + 1);
      });

      const dots = document.createElement('div');
      dots.className = 'content-gallery__dots';

      let imageIndex = 0;
      current.forEach((child) => {
        if (child.type.name !== 'image') return;
        const index = imageIndex;
        imageIndex += 1;
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'content-gallery__dot';
        dot.setAttribute('aria-label', `Slide ${index + 1}`);
        dot.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          goToSlide(index);
        });
        dots.appendChild(dot);
      });

      controls.append(prev, dots, next);
    }

    viewport.addEventListener('mousedown', (event) => {
      const target = event.target as HTMLElement | null;
      const figure = target?.closest('.content-image-figure');
      if (!figure || !viewport.contains(figure)) return;
      const index = imageElements().indexOf(figure as HTMLElement);
      if (index >= 0) {
        activeIndex = index;
        updateSlideVisibility();
      }
    });

    dom.appendChild(viewport);
    dom.appendChild(controls);
    applyLayoutClasses(currentLayout);
    renderControls(node);
    updateSlideVisibility();

    return {
      dom,
      contentDOM: viewport,
      update(updatedNode) {
        if (updatedNode.type.name !== 'gallery') return false;
        const nextSignature = galleryStructureSignature(updatedNode);
        const structureChanged = nextSignature !== structureSignature;
        structureSignature = nextSignature;
        currentNode = updatedNode;

        const nextLayout = normalizeGalleryLayout(updatedNode.attrs.layout);
        if (nextLayout !== currentLayout) {
          currentLayout = nextLayout;
          applyLayoutClasses(nextLayout);
        }
        if (activeIndex >= updatedNode.childCount) {
          activeIndex = Math.max(0, updatedNode.childCount - 1);
        }
        if (structureChanged || nextLayout === 'carousel') {
          renderControls(updatedNode);
        }
        window.requestAnimationFrame(() => updateSlideVisibility());
        return true;
      },
      stopEvent(event) {
        return controls.contains(event.target as Node);
      },
      ignoreMutation(mutation) {
        if (controls.contains(mutation.target)) return true;
        if (mutation.type === 'attributes' && viewport.contains(mutation.target as Node)) {
          return mutation.attributeName === 'style';
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
