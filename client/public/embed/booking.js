/**
 * Arivu booking embed loader.
 * Usage:
 *   <div id="arivu-booking" data-slug="your-page-slug" data-height="720"></div>
 *   <script src="https://your-app.example.com/embed/booking.js" async></script>
 */
(function () {
  const script = document.currentScript;
  const base = script && script.src ? new URL(script.src).origin : window.location.origin;

  function mount() {
    const nodes = document.querySelectorAll('#arivu-booking,[data-arivu-booking],#litedesk-booking,[data-litedesk-booking]');
    nodes.forEach((el) => {
      if (el.dataset.arivuMounted === '1' || el.dataset.litedeskMounted === '1') return;
      const slug = el.getAttribute('data-slug');
      if (!slug) return;

      const height = el.getAttribute('data-height') || '720';
      const iframe = document.createElement('iframe');
      iframe.src = `${base}/book/${encodeURIComponent(slug)}/embed`;
      iframe.title = 'Book an appointment';
      iframe.width = '100%';
      iframe.height = height;
      iframe.setAttribute('frameborder', '0');
      iframe.style.cssText = 'border:0;border-radius:12px;max-width:480px;display:block;width:100%;';
      iframe.allow = 'clipboard-write';

      el.dataset.arivuMounted = '1';
      el.innerHTML = '';
      el.appendChild(iframe);

      window.addEventListener('message', (event) => {
        if (event.source !== iframe.contentWindow) return;
        const data = event.data;
        if (!data || data.type !== 'litedesk-booking-resize') return;
        const next = Math.max(420, Math.min(1400, Number(data.height) || 720));
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
