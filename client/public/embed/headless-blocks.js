;(function (global) {
  'use strict';

  function initGalleries(root) {
    var scope = root || document;
    scope.querySelectorAll('.content-gallery--carousel[data-content-gallery], .content-gallery[data-gallery-layout="carousel"]').forEach(function (gallery) {
      if (gallery.dataset.galleryInit === 'true') return;
      gallery.dataset.galleryInit = 'true';

      var inputs = Array.prototype.slice.call(gallery.querySelectorAll('.content-gallery__input'));
      var figures = Array.prototype.slice.call(gallery.querySelectorAll('.content-gallery__viewport > .content-image-figure, .content-gallery__viewport > .content-gallery__figure'));
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

  function init(root) {
    initGalleries(root);
  }

  global.LiteDeskHeadlessBlocks = {
    init: init,
    initGalleries: initGalleries,
  };
})(typeof window !== 'undefined' ? window : globalThis);
