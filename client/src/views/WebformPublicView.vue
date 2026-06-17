<template>
  <div
    ref="rootEl"
    :class="[
      isEmbed ? 'webform-embed-surface min-h-0 py-4' : 'min-h-screen py-8',
      pageUsesDefaultBackground ? 'bg-gray-50 dark:bg-gray-900' : ''
    ]"
    :style="pageSurfaceStyle"
  >
    <div class="mx-auto max-w-2xl px-4 sm:px-6">
      <div v-if="loading" class="flex justify-center py-16">
        <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
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
import { mergeWebformBranding, webformSurfaceStyle } from '@/utils/webformBranding';
import {
  getWebformRecaptchaResponse,
  renderWebformRecaptcha,
  resetWebformRecaptcha
} from '@/utils/webformRecaptcha';
import {
  captureWebformPublicViewed,
  captureWebformSubmitted
} from '@/config/posthogWebforms';

const SUBMIT_TIMEOUT_MS = 30000;
const FETCH_OPTIONS = { cache: 'no-store' };

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
  return webformSurfaceStyle(pageBranding.value, { embed: isEmbed.value });
});

let loadGeneration = 0;
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
  const lang = i18n.global.locale.value;
  const messages = await ensureWebformsNamespaceLoaded(lang);
  i18n.global.mergeLocaleMessage(lang, messages);
  localeReady = true;
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
  window.parent.postMessage({ type: 'litedesk-webform-resize', height }, '*');
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

async function fetchJson(url, options = {}, timeoutMs = 30000) {
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timer = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(url, {
      ...FETCH_OPTIONS,
      ...options,
      ...(controller ? { signal: controller.signal } : {})
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
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

async function loadViaPublicApi(slug) {
  const { response, payload } = await fetchJson(publicApiPath(slug));
  if (!response.ok || !payload?.success || !payload?.data) {
    return { ok: false, message: payload?.message || null };
  }
  return { ok: true, data: payload.data };
}

async function loadViaAuthWebformId(webformId) {
  const token = getAuthToken();
  if (!token || !webformId) return { ok: false, message: null };

  const { response, payload } = await fetchJson(authApiPath(`/webforms/${encodeURIComponent(String(webformId))}`), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok || !payload?.success || !payload?.data) {
    return { ok: false, message: payload?.message || null };
  }
  return { ok: true, data: payload.data };
}

async function loadViaAuthPreview(slug) {
  const token = getAuthToken();
  if (!token) return { ok: false, message: null };

  const { response, payload } = await fetchJson(
    authApiPath(`/webforms/preview-by-slug/${encodeURIComponent(String(slug))}`),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  if (!response.ok || !payload?.success || !payload?.data) {
    return { ok: false, message: payload?.message || null };
  }
  return { ok: true, data: payload.data };
}

async function resolveWebformResult(slug, webformId) {
  const attempts = [() => loadViaPublicApi(slug)];
  if (webformId) {
    attempts.push(() => loadViaAuthWebformId(webformId));
  }
  if (getAuthToken()) {
    attempts.push(() => loadViaAuthPreview(slug));
  }

  let failureMessage = null;
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (result?.ok && result.data) {
        return result;
      }
      if (result?.message) failureMessage = result.message;
    } catch (err) {
      if (err?.message) failureMessage = err.message;
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

async function loadWebform() {
  const generation = ++loadGeneration;
  loading.value = true;
  error.value = '';
  resetSubmitState();
  webform.value = null;

  const slug = route.params.slug;
  if (!slug) {
    await ensureWebformsLocaleLoaded();
    error.value = translate('webforms.publicLoadError', 'This webform is unavailable.');
    loading.value = false;
    return;
  }

  const webformId = typeof route.query.webformId === 'string' ? route.query.webformId.trim() : '';

  try {
    const [, result] = await Promise.all([
      ensureWebformsLocaleLoaded(),
      resolveWebformResult(slug, webformId)
    ]);

    if (generation !== loadGeneration) return;

    if (!result.ok || !result.data) {
      error.value = result.message || translate('webforms.publicLoadError', 'This webform is unavailable.');
      return;
    }

    if (!applyWebformData(result.data)) {
      error.value = translate('webforms.publicLoadError', 'This webform is unavailable.');
      return;
    }

    error.value = '';
    captureWebformPublicViewed(String(slug), { webform_id: result.data?.webformId });
  } catch (err) {
    if (generation === loadGeneration) {
      error.value = err?.message || translate('webforms.publicLoadError', 'This webform is unavailable.');
    }
  } finally {
    if (generation === loadGeneration) {
      loading.value = false;
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
