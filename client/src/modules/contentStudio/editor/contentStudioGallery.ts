export function initContentStudioGalleries(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.content-gallery--carousel[data-content-gallery]').forEach((gallery) => {
    if (gallery.dataset.galleryInit === 'true') return;
    gallery.dataset.galleryInit = 'true';

    const inputs = Array.from(gallery.querySelectorAll<HTMLInputElement>('.content-gallery__input'));
    const figures = Array.from(
      gallery.querySelectorAll<HTMLElement>('.content-gallery__viewport > .content-image-figure'),
    );
    if (!figures.length) return;

    const syncFromIndex = (index: number) => {
      const normalized = ((index % figures.length) + figures.length) % figures.length;
      if (inputs[normalized]) inputs[normalized].checked = true;
      figures.forEach((figure, figureIndex) => {
        figure.style.setProperty('display', figureIndex === normalized ? 'block' : 'none', 'important');
      });
      gallery.querySelectorAll<HTMLElement>('.content-gallery__dot').forEach((dot, dotIndex) => {
        dot.classList.toggle('content-gallery__dot--active', dotIndex === normalized);
      });
    };

    const currentIndex = () => {
      const checked = inputs.findIndex((input) => input.checked);
      return checked >= 0 ? checked : 0;
    };

    gallery.querySelectorAll<HTMLButtonElement>('.content-gallery__dot').forEach((button, index) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        syncFromIndex(index);
      });
    });

    gallery.querySelector<HTMLButtonElement>('.content-gallery__arrow--prev')?.addEventListener('click', (event) => {
      event.preventDefault();
      syncFromIndex(currentIndex() - 1);
    });

    gallery.querySelector<HTMLButtonElement>('.content-gallery__arrow--next')?.addEventListener('click', (event) => {
      event.preventDefault();
      syncFromIndex(currentIndex() + 1);
    });

    syncFromIndex(currentIndex());
  });
}
