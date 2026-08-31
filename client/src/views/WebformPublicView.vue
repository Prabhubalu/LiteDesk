<template>
  <div
    ref="rootEl"
    :class="[
      isEmbed ? 'webform-embed-surface min-h-0 py-4' : 'min-h-screen py-8',
      pageUsesDefaultBackground ? 'bg-gray-50 dark:bg-gray-900' : webformBrandingSurfaceClasses(pageBranding)
    ]"
    :style="pageSurfaceStyle"
  >
    <div class="mx-auto max-w-2xl px-4 sm:px-6">
      <div v-if="loading" class="flex justify-center py-16">
        <div :class="WEBFORM_SPINNER_CLASS" />
      </div>

      <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/30">
        <p class="text-sm font-medium text-red-800 dark:text-red-200">{{ error }}</p>
      </div>

      <div v-else-if="submitted" class="rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-900/40 dark:bg-gray-800">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ translate('webforms.publicSuccessTitle', 'Thank you') }}</h1>
        <p class="mt-3 text-gray-600 dark:text-gray-400">{{ thankYouMessage || translate('webforms.publicSuccessDefault', 'Your submission was received.') }}</p>
      </div>

      <WebformFillForm
        v-else-if="webform"
        :webform="webform"
        v-model="formData"
        :submitting="submitting"
        :submit-error="submitError"
        :public-slug="String(route.params.slug || '')"
        @submit="submitForm"
      >
        <template v-if="showCaptcha" #before-actions>
          <div class="mt-2 flex justify-center sm:col-span-2">
            <div ref="captchaContainer" />
          </div>
        </template>
      </WebformFillForm>

      <div v-else class="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ unavailableMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteUpdate, useRoute } from 'vue-router';
import { ensureWebformsNamespaceLoaded, i18n } from '@/i18n';
import WebformFillForm from '@/components/webforms/WebformFillForm.vue';
import { normalizePublicWebformPayload } from '@/utils/webformFormActions';
import { applyWebformPrefillFromQuery } from '@/utils/webformPrefill';
import { getApiUrlForFetch } from '@/config/apiBase';
import { mergeWebformBranding, webformBrandingCssVars, webformBrandingSurfaceClasses } from '@/utils/webformBranding';
import { WEBFORM_SPINNER_CLASS } from '@/utils/webformUiClasses';
import {
  getWebformRecaptchaResponse,
  renderWebformRecaptcha,
  resetWebformRecaptcha
} from '@/utils/webformRecaptcha';
import {
  captureWebformPublicViewed,
  captureWebformSubmitted
} from '@/config/posthogWebforms';

const LOAD_TIMEOUT_MS = 10000;
const SUBMIT_TIMEOUT_MS = 30000;
const FETCH_OPTIONS = { cache: 'no-store' };
const PUBLIC_CACHE_PREFIX = 'arivu:webform-public:v3:';
const PUBLIC_CACHE_TTL_MS = 15 * 60 * 1000;

const props = defineProps({
  embed: { type: Boolean, default: false }
});

const route = useRoute();

const rootEl = ref(null);
let resizeObserver = null;

const isEmbed = computed(() => props.embed || route.meta?.embed === true);
const loading = ref(true);
const submitting = ref(false);
const submitted = ref(false);
const error = ref('');
const submitError = ref('');
const webform = ref(null);
const formData = ref({});
const thankYouMessage = ref('');
const submitIdempotencyKey = ref(createSubmitIdempotencyKey());
const captchaContainer = ref(null);
const captchaWidgetId = ref(null);

const captchaRequired = computed(() => webform.value?.captcha?.required === true);
const showCaptcha = computed(() => {
  const captcha = webform.value?.captcha;
  if (!captcha?.enabled) return false;
  return Boolean(String(captcha.siteKey || '').trim()) && captcha.configured === true;
});
const captchaSiteKey = computed(() => String(webform.value?.captcha?.siteKey || '').trim());

const pageBranding = computed(() => mergeWebformBranding(webform.value?.branding));
const pageUsesDefaultBackground = computed(() => !pageBranding.value.backgroundColor);
const pageSurfaceStyle = computed(() => {
  if (!pageBranding.value.backgroundColor) return {};
  return webformBrandingCssVars(pageBranding.value);
});

let loadGeneration = 0;
let activeLoadAbort = null;
let localeReady = false;

function createSubmitIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const unavailableMessage = computed(
  () => error.value || translate('webforms.publicLoadError', 'This webform is unavailable.')
);

function translate(key, fallback) {
  const value = i18n.global.t(key);
  if (!value || String(value).startsWith('[missing:')) return fallback;
  return value;
}

function publicApiPath(slug, suffix = '') {
  return `/api/public/webforms/${encodeURIComponent(String(slug))}${suffix}`;
}

function authApiPath(path) {
  return `/api${path.startsWith('/') ? path : `/${path}`}`;
}

async function ensureWebformsLocaleLoaded() {
  if (localeReady) return;
  try {
    const lang = i18n.global.locale.value;
    const messages = await ensureWebformsNamespaceLoaded(lang);
    i18n.global.mergeLocaleMessage(lang, messages);
    localeReady = true;
  } catch (err) {
    console.warn('[WebformPublicView] Failed to load webforms locale', err);
  }
}

function getAuthToken() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.token || null;
  } catch {
    return null;
  }
}

function publicCacheKey(slug) {
  return `${PUBLIC_CACHE_PREFIX}${String(slug || '').trim().toLowerCase()}`;
}

function readCachedPublic(slug) {
  try {
    const raw = sessionStorage.getItem(publicCacheKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    if (parsed.savedAt && Date.now() - parsed.savedAt > PUBLIC_CACHE_TTL_MS) return null;
    const targetModuleKey = String(parsed.data?.targetModuleKey || '').trim();
    if (targetModuleKey && !Array.isArray(parsed.data?.moduleFields)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedPublic(slug, data) {
  try {
    sessionStorage.setItem(publicCacheKey(slug), JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // sessionStorage may be unavailable
  }
}

function initFormData(fields, query = route.query) {
  const next = {};
  for (const field of fields) {
    next[field.fieldId] = field.type === 'Checkbox' ? false : '';
  }
  formData.value = applyWebformPrefillFromQuery(fields, next, query);
}

function notifyEmbedHeight() {
  if (!isEmbed.value || typeof window === 'undefined' || window.parent === window) return;
  const height = Math.ceil(document.documentElement.scrollHeight);
  window.parent.postMessage({ type: 'arivu-webform-resize', height }, '*');
}

function setupEmbedResize() {
  if (!isEmbed.value) return;
  notifyEmbedHeight();
  if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => notifyEmbedHeight());
    resizeObserver.observe(rootEl.value);
  }
}

function teardownEmbedResize() {
  resizeObserver?.disconnect();
  resizeObserver = null;
}

function resetSubmitState() {
  submitted.value = false;
  submitError.value = '';
  thankYouMessage.value = '';
  submitIdempotencyKey.value = createSubmitIdempotencyKey();
}

async function fetchJson(url, options = {}, timeoutMs = LOAD_TIMEOUT_MS) {
  const externalSignal = options.signal;
  const controller = new AbortController();
  const timer = timeoutMs > 0
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abortFromExternal, { once: true });
    }
  }

  try {
    const response = await fetch(getApiUrlForFetch(url), {
      ...FETCH_OPTIONS,
      ...options,
      signal: controller.signal
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { response, payload };
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Is the API server running?');
    }
    throw err;
  } finally {
    if (timer) window.clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortFromExternal);
    }
  }
}

async function loadViaPublicApi(slug, signal) {
  const { response, payload } = await fetchJson(publicApiPath(slug), { signal });
  if (!response.ok || !payload?.success || !payload?.data) {
    return { ok: false, message: payload?.message || null };
  }
  return { ok: true, data: payload.data };
}

async function loadViaAuthWebformId(webformId, signal) {
  const token = getAuthToken();
  if (!token || !webformId) return { ok: false, message: null };

  const { response, payload } = await fetchJson(
    authApiPath(`/webforms/${encodeURIComponent(String(webformId))}`),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal
    }
  );
  if (!response.ok || !payload?.success || !payload?.data) {
    return { ok: false, message: payload?.message || null };
  }
  return { ok: true, data: payload.data };
}

async function loadViaAuthPreview(slug, signal) {
  const token = getAuthToken();
  if (!token) return { ok: false, message: null };

  const { response, payload } = await fetchJson(
    authApiPath(`/webforms/preview-by-slug/${encodeURIComponent(String(slug))}`),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal
    }
  );
  if (!response.ok || !payload?.success || !payload?.data) {
    return { ok: false, message: payload?.message || null };
  }
  return { ok: true, data: payload.data };
}

async function tryResolveAttempt(attempt) {
  try {
    const result = await attempt();
    if (result?.ok && result.data) {
      return { ok: true, data: result.data, message: null };
    }
    return { ok: false, data: null, message: result?.message || null };
  } catch (err) {
    return { ok: false, data: null, message: err?.message || null };
  }
}

async function resolveWebformResult(slug, webformId, signal) {
  let failureMessage = null;

  // Hosted/public URLs must use the public payload — it includes live moduleFields for dependencies.
  const publicResult = await tryResolveAttempt(() => loadViaPublicApi(slug, signal));
  if (publicResult.ok) return publicResult;
  if (publicResult.message) failureMessage = publicResult.message;

  const token = getAuthToken();
  if (token) {
    const preview = await tryResolveAttempt(() => loadViaAuthPreview(slug, signal));
    if (preview.ok) return preview;
    if (preview.message) failureMessage = preview.message;

    if (webformId) {
      const byId = await tryResolveAttempt(() => loadViaAuthWebformId(webformId, signal));
      if (byId.ok) return byId;
      if (byId.message) failureMessage = byId.message;
    }
  }

  return { ok: false, message: failureMessage };
}

function applyWebformData(raw) {
  const payload = normalizePublicWebformPayload(raw);
  if (!payload) return false;
  webform.value = payload;
  initFormData(payload.fields || []);
  return true;
}

async function refreshPublicWebform(slug, webformId, generation, controller) {
  try {
    const result = await resolveWebformResult(slug, webformId, controller.signal);
    if (controller.signal.aborted || generation !== loadGeneration) return;
    if (!result.ok || !result.data) return;
    if (!applyWebformData(result.data)) return;
    writeCachedPublic(slug, result.data);
    error.value = '';
  } catch {
    // Keep cached version when background refresh fails.
  }
}

async function loadWebform() {
  activeLoadAbort?.abort();
  const controller = new AbortController();
  activeLoadAbort = controller;
  const generation = ++loadGeneration;

  const slug = route.params.slug;
  if (!slug) {
    loading.value = false;
    await ensureWebformsLocaleLoaded();
    error.value = translate('webforms.publicLoadError', 'This webform is unavailable.');
    return;
  }

  const webformId = typeof route.query.webformId === 'string' ? route.query.webformId.trim() : '';
  const cached = readCachedPublic(slug);

  if (cached && applyWebformData(cached)) {
    loading.value = false;
    error.value = '';
    void ensureWebformsLocaleLoaded();
    setupEmbedResize();
    notifyEmbedHeight();
    void refreshPublicWebform(slug, webformId, generation, controller);
    return;
  }

  loading.value = true;
  error.value = '';
  resetSubmitState();
  webform.value = null;

  const watchdog = window.setTimeout(() => {
    if (generation !== loadGeneration || !loading.value) return;
    loading.value = false;
    if (!webform.value) {
      error.value = error.value || translate('webforms.publicLoadError', 'This webform is unavailable.');
    }
  }, LOAD_TIMEOUT_MS + 2500);

  try {
    void ensureWebformsLocaleLoaded();
    const result = await resolveWebformResult(slug, webformId, controller.signal);

    if (controller.signal.aborted || generation !== loadGeneration) return;

    if (!result.ok || !result.data) {
      error.value = result.message || translate('webforms.publicLoadError', 'This webform is unavailable.');
      return;
    }

    if (!applyWebformData(result.data)) {
      error.value = translate('webforms.publicLoadError', 'This webform is unavailable.');
      return;
    }

    writeCachedPublic(slug, result.data);
    error.value = '';
    captureWebformPublicViewed(String(slug), { webform_id: result.data?.webformId });
  } catch (err) {
    if (!controller.signal.aborted && generation === loadGeneration) {
      error.value = err?.message || translate('webforms.publicLoadError', 'This webform is unavailable.');
    }
  } finally {
    window.clearTimeout(watchdog);
    if (generation === loadGeneration) {
      loading.value = false;
      if (activeLoadAbort === controller) {
        activeLoadAbort = null;
      }
      setupEmbedResize();
      notifyEmbedHeight();
    }
  }
}

let captchaSetupGeneration = 0;

async function setupCaptchaWidget() {
  const generation = ++captchaSetupGeneration;
  captchaWidgetId.value = null;
  if (!showCaptcha.value || !captchaSiteKey.value) return;
  await nextTick();
  if (!captchaContainer.value) await nextTick();
  if (generation !== captchaSetupGeneration || !captchaContainer.value) return;
  captchaContainer.value.innerHTML = '';
  try {
    const widgetId = await renderWebformRecaptcha(captchaContainer.value, captchaSiteKey.value);
    if (generation !== captchaSetupGeneration) return;
    captchaWidgetId.value = widgetId;
  } catch {
    if (generation !== captchaSetupGeneration) return;
    submitError.value = translate('webforms.publicCaptchaError', 'CAPTCHA failed to load. Refresh and try again.');
  }
}

async function submitForm() {
  submitting.value = true;
  submitError.value = '';
  try {
    const slug = route.params.slug;
    const body = { fieldValues: formData.value };
    if (captchaRequired.value) {
      const captchaToken = getWebformRecaptchaResponse(captchaWidgetId.value);
      if (!captchaToken) {
        submitError.value = translate('webforms.publicCaptchaRequired', 'Please complete the CAPTCHA.');
        return;
      }
      body.captchaToken = captchaToken;
    }

    const { response, payload } = await fetchJson(
      publicApiPath(slug, '/submit'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': submitIdempotencyKey.value
        },
        body: JSON.stringify(body)
      },
      SUBMIT_TIMEOUT_MS
    );
    if (!response.ok || !payload?.success) {
      submitError.value = payload?.message || translate('webforms.publicSubmitError', 'Could not submit the form.');
      if (captchaRequired.value) resetWebformRecaptcha(captchaWidgetId.value);
      return;
    }
    thankYouMessage.value = payload.data?.thankYouMessage || payload.message || '';
    submitted.value = true;
    captureWebformSubmitted({
      slug: String(slug),
      webformId: webform.value?.webformId,
      submissionId: payload.data?.submissionId,
      crmAction: payload.data?.crmOutcome?.action || null,
      dedupMatched: payload.data?.dedupOutcome?.matched === true
    });
    const redirect = payload.data?.redirectUrl;
    if (redirect) {
      window.setTimeout(() => {
        window.location.href = redirect;
      }, 1500);
    }
  } catch (err) {
    submitError.value = err?.message || translate('webforms.publicSubmitError', 'Could not submit the form.');
    if (captchaRequired.value) resetWebformRecaptcha(captchaWidgetId.value);
  } finally {
    submitting.value = false;
  }
}

function handlePageShow(event) {
  if (event?.persisted) {
    void loadWebform();
  }
}

watch(
  () => [loading.value, showCaptcha.value, captchaSiteKey.value],
  ([isLoading]) => {
    if (isLoading) return;
    void setupCaptchaWidget();
    notifyEmbedHeight();
  },
  { flush: 'post' }
);

watch(
  () => route.query,
  (query) => {
    if (!webform.value?.fields?.length) return;
    formData.value = applyWebformPrefillFromQuery(webform.value.fields, formData.value, query);
    notifyEmbedHeight();
  },
  { deep: true }
);

watch(submitted, () => {
  notifyEmbedHeight();
});

onMounted(() => {
  void loadWebform();
  window.addEventListener('pageshow', handlePageShow);
});

onBeforeUnmount(() => {
  loadGeneration += 1;
  activeLoadAbort?.abort();
  activeLoadAbort = null;
  loading.value = false;
  window.removeEventListener('pageshow', handlePageShow);
  teardownEmbedResize();
});

onBeforeRouteUpdate((to, from) => {
  if (to.params.slug !== from.params.slug || to.query.webformId !== from.query.webformId) {
    void loadWebform();
    return;
  }
  if (webform.value?.fields?.length) {
    formData.value = applyWebformPrefillFromQuery(webform.value.fields, formData.value, to.query);
    notifyEmbedHeight();
  }
});
</script>
