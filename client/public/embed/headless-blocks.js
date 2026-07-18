;(function (global) {
  'use strict';

  function initGalleries(root) {
    var scope = root || document;
    scope.querySelectorAll('.content-gallery--carousel[data-content-gallery], .content-gallery[data-gallery-layout="carousel"]').forEach(function (gallery) {
      if (gallery.dataset.galleryInit === 'true') return;
      gallery.dataset.galleryInit = 'true';

      var inputs = Array.prototype.slice.call(gallery.querySelectorAll('.content-gallery__input'));
      var figures = Array.prototype.slice.call(
        gallery.querySelectorAll('.content-gallery__viewport > .content-image-figure, .content-gallery__viewport > .content-gallery__figure'),
      );
      if (!figures.length) return;

      function syncFromIndex(index) {
        var normalized = ((index % figures.length) + figures.length) % figures.length;
        if (inputs[normalized]) inputs[normalized].checked = true;
        figures.forEach(function (figure, figureIndex) {
          figure.style.setProperty('display', figureIndex === normalized ? 'block' : 'none', 'important');
        });
        gallery.querySelectorAll('.content-gallery__dot').forEach(function (dot, dotIndex) {
          dot.classList.toggle('content-gallery__dot--active', dotIndex === normalized);
        });
      }

      function currentIndex() {
        for (var i = 0; i < inputs.length; i += 1) {
          if (inputs[i].checked) return i;
        }
        return 0;
      }

      gallery.querySelectorAll('.content-gallery__dot').forEach(function (button, index) {
        button.addEventListener('click', function (event) {
          event.preventDefault();
          syncFromIndex(index);
        });
      });

      var prev = gallery.querySelector('.content-gallery__arrow--prev');
      var next = gallery.querySelector('.content-gallery__arrow--next');
      if (prev) {
        prev.addEventListener('click', function (event) {
          event.preventDefault();
          syncFromIndex(currentIndex() - 1);
        });
      }
      if (next) {
        next.addEventListener('click', function (event) {
          event.preventDefault();
          syncFromIndex(currentIndex() + 1);
        });
      }

      syncFromIndex(currentIndex());
    });
  }

  var activeLightbox = null;
  var activeLightboxKeyHandler = null;

  function closeImageLightbox() {
    if (activeLightboxKeyHandler) {
      document.removeEventListener('keydown', activeLightboxKeyHandler);
      activeLightboxKeyHandler = null;
    }
    if (activeLightbox) {
      activeLightbox.remove();
      activeLightbox = null;
    }
    document.documentElement.classList.remove('cs-image-lightbox--open');
  }

  function openImageLightbox(src, alt) {
    closeImageLightbox();

    var overlay = document.createElement('div');
    overlay.className = 'cs-image-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', alt || 'Expanded image');

    var backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'cs-image-lightbox__backdrop';
    backdrop.setAttribute('aria-label', 'Close');
    backdrop.addEventListener('click', closeImageLightbox);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cs-image-lightbox__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', closeImageLightbox);

    var img = document.createElement('img');
    img.className = 'cs-image-lightbox__image';
    img.src = src;
    img.alt = alt || '';

    overlay.appendChild(backdrop);
    overlay.appendChild(closeBtn);
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    activeLightbox = overlay;
    document.documentElement.classList.add('cs-image-lightbox--open');

    activeLightboxKeyHandler = function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeImageLightbox();
      }
    };
    document.addEventListener('keydown', activeLightboxKeyHandler);
    closeBtn.focus();
  }

  function isLightboxImage(img) {
    if (!img || !img.src) return false;
    if (img.closest('.cs-image-lightbox')) return false;
    if (img.closest('a[href]')) return false;
    return Boolean(
      (img.classList && img.classList.contains('content-image'))
      || img.closest('.content-image-figure')
      || img.closest('.content-gallery')
    );
  }

  function initImageLightbox(root) {
    var scope = root || document;
    if (!(scope instanceof Element)) {
      scope = document.body;
    }
    if (!scope || scope.getAttribute('data-cs-image-lightbox-init') === 'true') return;
    scope.setAttribute('data-cs-image-lightbox-init', 'true');

    scope.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var img = target.closest('img');
      if (!isLightboxImage(img)) return;
      event.preventDefault();
      event.stopPropagation();
      openImageLightbox(img.currentSrc || img.src, img.alt || '');
    });
  }

  function init(root) {
    initGalleries(root);
    initImageLightbox(root);
  }

  function boot() {
    init(document);
  }

  var api = {
    init: init,
    initGalleries: initGalleries,
    initImageLightbox: initImageLightbox,
    closeImageLightbox: closeImageLightbox,
  };

  global.LiteDeskHeadlessBlocks = api;
  global.ArivuHeadlessBlocks = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
