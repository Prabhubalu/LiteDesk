'use strict';

function getEnvRecaptchaSecretKey() {
  return String(process.env.RECAPTCHA_SECRET_KEY || '').trim();
}

function getEnvRecaptchaSiteKey() {
  return String(process.env.RECAPTCHA_SITE_KEY || '').trim();
}

function isEnvRecaptchaConfigured() {
  return Boolean(getEnvRecaptchaSecretKey() && getEnvRecaptchaSiteKey());
}

/**
 * @param {import('mongoose').Document|object|null|undefined} webform
 */
function resolveCaptchaKeys(webform) {
  const formSiteKey = String(webform?.captcha?.siteKey || '').trim();
  const formSecretKey = String(webform?.captcha?.secretKey || '').trim();
  return {
    siteKey: formSiteKey || getEnvRecaptchaSiteKey(),
    secretKey: formSecretKey || getEnvRecaptchaSecretKey(),
    source: {
      siteKey: formSiteKey ? 'webform' : (getEnvRecaptchaSiteKey() ? 'env' : 'none'),
      secretKey: formSecretKey ? 'webform' : (getEnvRecaptchaSecretKey() ? 'env' : 'none')
    }
  };
}

function isCaptchaEnabledForWebform(webform) {
  return webform?.captcha?.enabled === true;
}

function isCaptchaRequiredForWebform(webform) {
  if (!webform || webform.status !== 'Active') return false;
  if (!isCaptchaEnabledForWebform(webform)) return false;
  const { siteKey, secretKey } = resolveCaptchaKeys(webform);
  return Boolean(siteKey && secretKey);
}

function resolvePublicCaptchaConfig(webform) {
  const enabled = isCaptchaEnabledForWebform(webform);
  const { siteKey, secretKey } = resolveCaptchaKeys(webform);
  const configured = Boolean(siteKey && secretKey);
  const required = isCaptchaRequiredForWebform(webform);
  const showWidget = enabled && configured;
  return {
    enabled,
    required,
    configured,
    siteKey: showWidget ? siteKey : ''
  };
}

function formatCaptchaForClient(webform) {
  const captcha = webform?.captcha || {};
  const publicConfig = resolvePublicCaptchaConfig(webform);
  const resolved = resolveCaptchaKeys(webform);
  const formSiteKey = String(captcha.siteKey || '').trim();
  const formSecretKey = String(captcha.secretKey || '').trim();
  return {
    enabled: captcha.enabled === true,
    required: publicConfig.required,
    configured: publicConfig.configured,
    siteKey: publicConfig.siteKey || resolved.siteKey,
    secretConfigured: Boolean(formSecretKey || getEnvRecaptchaSecretKey()),
    usesEnvFallback: !formSiteKey || !formSecretKey
  };
}

/**
 * @param {string} token
 * @param {string} [remoteIp]
 * @param {import('mongoose').Document|object} [webform]
 */
async function verifyRecaptchaToken(token, remoteIp, webform) {
  const { secretKey } = resolveCaptchaKeys(webform);
  if (!secretKey) {
    return { ok: true, skipped: true };
  }

  const responseToken = String(token || '').trim();
  if (!responseToken) {
    return { ok: false, error: 'CAPTCHA verification is required.' };
  }

  const body = new URLSearchParams({
    secret: secretKey,
    response: responseToken
  });
  if (remoteIp) {
    body.set('remoteip', String(remoteIp));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal
    });
    const payload = await response.json();
    if (payload?.success === true) {
      return { ok: true };
    }
    return { ok: false, error: 'CAPTCHA verification failed. Please try again.' };
  } catch (err) {
    console.warn('[webformCaptchaService] verify failed:', err?.message || err);
    return { ok: false, error: 'CAPTCHA verification is temporarily unavailable.' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  getEnvRecaptchaSiteKey,
  isEnvRecaptchaConfigured,
  isCaptchaEnabledForWebform,
  isCaptchaRequiredForWebform,
  resolveCaptchaKeys,
  resolvePublicCaptchaConfig,
  formatCaptchaForClient,
  verifyRecaptchaToken
};
