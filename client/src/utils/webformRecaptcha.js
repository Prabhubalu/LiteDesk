let scriptPromise = null;

const RECAPTCHA_SCRIPT_SRC = 'https://www.google.com/recaptcha/api.js?render=explicit';

function waitForGrecaptchaRender() {
  return new Promise((resolve, reject) => {
    const grecaptcha = window.grecaptcha;
    if (!grecaptcha) {
      reject(new Error('CAPTCHA script failed to load.'));
      return;
    }

    const finish = () => {
      if (typeof window.grecaptcha?.render === 'function') {
        resolve(window.grecaptcha);
        return;
      }
      reject(new Error('CAPTCHA is unavailable.'));
    };

    if (typeof grecaptcha.render === 'function') {
      finish();
      return;
    }

    if (typeof grecaptcha.ready === 'function') {
      grecaptcha.ready(finish);
      return;
    }

    reject(new Error('CAPTCHA is unavailable.'));
  });
}

function loadRecaptchaScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('window unavailable'));
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-webform-recaptcha="1"]');
    if (existing) {
      if (existing.getAttribute('data-loaded') === '1') {
        waitForGrecaptchaRender().then(resolve).catch(reject);
        return;
      }
      existing.addEventListener('load', () => {
        existing.setAttribute('data-loaded', '1');
        waitForGrecaptchaRender().then(resolve).catch(reject);
      }, { once: true });
      existing.addEventListener('error', () => {
        scriptPromise = null;
        reject(new Error('CAPTCHA script failed to load.'));
      }, { once: true });
      if (window.grecaptcha) {
        existing.setAttribute('data-loaded', '1');
        waitForGrecaptchaRender().then(resolve).catch(reject);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = RECAPTCHA_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.webformRecaptcha = '1';
    script.onload = () => {
      script.setAttribute('data-loaded', '1');
      waitForGrecaptchaRender().then(resolve).catch(reject);
    };
    script.onerror = () => {
      script.remove();
      scriptPromise = null;
      reject(new Error('CAPTCHA script failed to load.'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * @param {HTMLElement} container
 * @param {string} siteKey
 */
export async function renderWebformRecaptcha(container, siteKey) {
  const key = String(siteKey || '').trim();
  if (!key) {
    throw new Error('CAPTCHA is unavailable.');
  }

  const grecaptcha = await loadRecaptchaScript();

  return new Promise((resolve, reject) => {
    const render = () => {
      try {
        resolve(grecaptcha.render(container, { sitekey: key }));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('CAPTCHA is unavailable.'));
      }
    };

    if (typeof grecaptcha.ready === 'function') {
      grecaptcha.ready(render);
    } else {
      render();
    }
  });
}

/**
 * @param {number} widgetId
 */
export function getWebformRecaptchaResponse(widgetId) {
  if (typeof window === 'undefined' || !window.grecaptcha || widgetId == null) return '';
  try {
    return window.grecaptcha.getResponse(widgetId) || '';
  } catch {
    return '';
  }
}

export function resetWebformRecaptcha(widgetId) {
  if (typeof window === 'undefined' || !window.grecaptcha || widgetId == null) return;
  try {
    window.grecaptcha.reset(widgetId);
  } catch {
    /* ignore */
  }
}
