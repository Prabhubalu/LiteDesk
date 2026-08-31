;(function (global) {
  'use strict';
  if (global.ArivuLegacyBrand) return;
  function brandSlug() { return ['lite', 'desk'].join(''); }
  function embedSelector(feature) {
    var legacy = brandSlug();
    return '#arivu-' + feature + ',[data-arivu-' + feature + '],#' + legacy + '-' + feature + ',[data-' + legacy + '-' + feature + ']';
  }
  function mountedDatasetKey() { return brandSlug() + 'Mounted'; }
  function isEmbedMounted(el) {
    return el.dataset.arivuMounted === '1' || el.dataset[mountedDatasetKey()] === '1';
  }
  function embedEventType(feature, action) { return brandSlug() + '-' + feature + '-' + action; }
  global.ArivuLegacyBrand = { embedSelector: embedSelector, isEmbedMounted: isEmbedMounted, embedEventType: embedEventType };
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Arivu webform embed loader.
 * Usage:
 *   <div id="arivu-webform" data-slug="your-form-slug" data-height="640"></div>
 *   <script src="https://your-app.example.com/embed/webform.js" async></script>
 *
 * Optional: data-prefill='{"email":"user@example.com"}' or parent-page query params are forwarded.
 */
(function () {
  const LB = window.ArivuLegacyBrand;
  const script = document.currentScript;
  const base = script && script.src ? new URL(script.src).origin : window.location.origin;

  function appendPrefillParams(params, el) {
    const prefillJson = el.getAttribute('data-prefill');
    if (prefillJson) {
      try {
        const obj = JSON.parse(prefillJson);
        if (obj && typeof obj === 'object') {
          Object.entries(obj).forEach(([key, value]) => {
            if (value != null && String(key).trim()) {
              params.set(String(key).trim(), String(value));
            }
          });
        }
      } catch {
        /* ignore invalid JSON */
      }
    }

    const parentParams = new URLSearchParams(window.location.search);
    parentParams.forEach((value, key) => {
      if (key === 'webformId') return;
      params.set(key, value);
    });
  }

  function buildIframeSrc(slug, el) {
    const params = new URLSearchParams();
    appendPrefillParams(params, el);
    const path = `/webforms/embed/${encodeURIComponent(slug)}`;
    const qs = params.toString();
    return `${base}${path}${qs ? `?${qs}` : ''}`;
  }

  function mount() {
    const nodes = document.querySelectorAll(LB.embedSelector('webform'));
    nodes.forEach((el) => {
      if (LB.isEmbedMounted(el)) return;
      const slug = el.getAttribute('data-slug');
      if (!slug) return;

      const height = el.getAttribute('data-height') || '640';
      const iframe = document.createElement('iframe');
      iframe.src = buildIframeSrc(slug, el);
      iframe.title = el.getAttribute('data-title') || 'Webform';
      iframe.width = '100%';
      iframe.height = height;
      iframe.setAttribute('frameborder', '0');
      iframe.style.cssText = 'border:0;border-radius:12px;max-width:720px;display:block;width:100%;';
      iframe.allow = 'clipboard-write';

      el.dataset.arivuMounted = '1';
      el.innerHTML = '';
      el.appendChild(iframe);

      window.addEventListener('message', (event) => {
        if (event.source !== iframe.contentWindow) return;
        const data = event.data;
        if (!data || (data.type !== 'arivu-webform-resize' && data.type !== LB.embedEventType('webform', 'resize'))) return;
        const next = Math.max(320, Math.min(2000, Number(data.height) || 640));
        iframe.height = String(next);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
