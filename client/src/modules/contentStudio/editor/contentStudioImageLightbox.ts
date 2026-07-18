/**
 * Fullscreen image lightbox for published/preview article bodies.
 * Click any content image to expand; Esc / backdrop / close dismisses.
 */

const OVERLAY_CLASS = 'cs-image-lightbox';
const OPEN_CLASS = 'cs-image-lightbox--open';

let activeOverlay: HTMLElement | null = null;
let activeKeyHandler: ((event: KeyboardEvent) => void) | null = null;

function closeLightbox(): void {
  if (activeKeyHandler) {
    document.removeEventListener('keydown', activeKeyHandler);
    activeKeyHandler = null;
  }
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }
  document.documentElement.classList.remove(OPEN_CLASS);
}

function openLightbox(src: string, alt: string): void {
  closeLightbox();

  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', alt || 'Expanded image');

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = `${OVERLAY_CLASS}__backdrop`;
  backdrop.setAttribute('aria-label', 'Close');
  backdrop.addEventListener('click', closeLightbox);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = `${OVERLAY_CLASS}__close`;
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', closeLightbox);

  const img = document.createElement('img');
  img.className = `${OVERLAY_CLASS}__image`;
  img.src = src;
  img.alt = alt || '';

  overlay.appendChild(backdrop);
  overlay.appendChild(closeBtn);
  overlay.appendChild(img);
  document.body.appendChild(overlay);
  activeOverlay = overlay;
  document.documentElement.classList.add(OPEN_CLASS);

  activeKeyHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLightbox();
    }
  };
  document.addEventListener('keydown', activeKeyHandler);
  closeBtn.focus();
}

function isLightboxTarget(img: HTMLImageElement): boolean {
  if (!img.src) return false;
  if (img.closest(`.${OVERLAY_CLASS}`)) return false;
  if (img.closest('a[href]')) return false;
  return Boolean(
    img.classList.contains('content-image')
    || img.closest('.content-image-figure')
    || img.closest('.content-gallery')
  );
}

export function initContentStudioImageLightbox(root: ParentNode = document): void {
  const scope = root instanceof HTMLElement ? root : document.body;
  if (scope.dataset.csImageLightboxInit === 'true') return;
  scope.dataset.csImageLightboxInit = 'true';

  scope.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const img = target.closest('img');
    if (!(img instanceof HTMLImageElement) || !isLightboxTarget(img)) return;
    event.preventDefault();
    event.stopPropagation();
    openLightbox(img.currentSrc || img.src, img.alt || '');
  });
}

export function destroyContentStudioImageLightbox(): void {
  closeLightbox();
}
