<template>
  <div class="min-h-screen bg-gray-50 py-8 dark:bg-gray-900">
    <div class="mx-auto max-w-2xl px-4 sm:px-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          @click="goBack"
        >
          ← {{ backLabel }}
        </button>
        <span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {{ badgeLabel }}
        </span>
      </div>

      <div v-if="loading" class="flex justify-center py-16">
        <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>

      <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/30">
        <p class="text-sm font-medium text-red-800 dark:text-red-200">{{ error }}</p>
      </div>

      <div v-else-if="submitted" class="rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-sm dark:border-emerald-900/40 dark:bg-gray-800">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ successTitle }}</h1>
        <p class="mt-3 text-gray-600 dark:text-gray-400">{{ thankYouMessage || successDefault }}</p>
      </div>

      <WebformFillForm
        v-else-if="webform"
        :webform="webform"
        v-model="formData"
        :submitting="submitting"
        :submit-error="submitError"
        :public-slug="String(route.params.slug || '')"
        @submit="submitForm"
      />

      <div v-else class="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ unavailableMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ensureWebformsNamespaceLoaded, i18n } from '@/i18n';
import { getApiUrlForFetch } from '@/config/apiBase';
import WebformFillForm from '@/components/webforms/WebformFillForm.vue';
import { normalizePublicWebformPayload } from '@/utils/webformFormActions';

const PREVIEW_CACHE_PREFIX = 'arivu:webform-staff-preview:v2:';
const PREVIEW_CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const submitting = ref(false);
const submitted = ref(false);
const error = ref('');
const submitError = ref('');
const webform = ref(null);
const formData = ref({});
const thankYouMessage = ref('');

let loadGeneration = 0;

const backLabel = computed(() => translate('webforms.staffPreviewBack', 'Back'));
const badgeLabel = computed(() => translate('webforms.staffPreviewBadge', 'Staff preview'));
const successTitle = computed(() => translate('webforms.publicSuccessTitle', 'Thank you'));
const successDefault = computed(() => translate('webforms.publicSuccessDefault', 'Your submission was received.'));

const unavailableMessage = computed(
  () => error.value || translate('webforms.publicLoadError', 'This webform is unavailable.')
);

function translate(key, fallback) {
  const value = i18n.global.t(key);
  if (!value || String(value).startsWith('[missing:')) return fallback;
  return value;
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

function previewCacheKey(slug) {
  return `${PREVIEW_CACHE_PREFIX}${String(slug || '').trim().toLowerCase()}`;
}

function readCachedPreview(slug) {
  try {
    const raw = localStorage.getItem(previewCacheKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    if (parsed.savedAt && Date.now() - parsed.savedAt > PREVIEW_CACHE_TTL_MS) return null;
    const targetModuleKey = String(parsed.data?.targetModuleKey || '').trim();
    if (targetModuleKey && !Array.isArray(parsed.data?.moduleFields)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function toPreviewPayload(source) {
  return normalizePublicWebformPayload(source);
}

async function ensureWebformsLocaleLoaded() {
  try {
    const lang = i18n.global.locale.value;
    const messages = await ensureWebformsNamespaceLoaded(lang);
    i18n.global.mergeLocaleMessage(lang, messages);
  } catch (err) {
    console.warn('[WebformStaffPreviewView] Failed to load webforms locale', err);
  }
}

function mergeWebformsLocale() {
  void ensureWebformsLocaleLoaded();
}

async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { response, payload };
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Is the server running on port 3000?');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

function initFormData(fields) {
  const next = {};
  for (const field of fields) {
    next[field.fieldId] = field.type === 'Checkbox' ? false : '';
  }
  formData.value = next;
}

function applyWebformData(data) {
  const payload = toPreviewPayload(data);
  if (!payload) return false;
  webform.value = payload;
  initFormData(payload.fields || []);
  return true;
}

async function loadViaWebformId(webformId, token) {
  const url = getApiUrlForFetch(`/webforms/${encodeURIComponent(String(webformId))}`);
  const { response, payload } = await fetchJsonWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok || !payload?.success || !payload?.data) {
    return { ok: false, message: payload?.message || null };
  }
  return { ok: true, data: toPreviewPayload(payload.data) };
}

async function loadViaPreviewSlug(slug, token) {
  const url = getApiUrlForFetch(`/webforms/preview-by-slug/${encodeURIComponent(String(slug))}`);
  const { response, payload } = await fetchJsonWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok || !payload?.success || !payload?.data) {
    return { ok: false, message: payload?.message || null };
  }
  return { ok: true, data: toPreviewPayload(payload.data) };
}

async function loadViaPublicApi(slug) {
  const url = getApiUrlForFetch(`/public/webforms/${encodeURIComponent(String(slug))}`);
  const { response, payload } = await fetchJsonWithTimeout(url, { cache: 'no-store' });
  if (!response.ok || !payload?.success || !payload?.data) {
    return { ok: false, message: payload?.message || null };
  }
  return { ok: true, data: toPreviewPayload(payload.data) };
}

async function refreshFromApi(slug, generation) {
  const publicResult = await loadViaPublicApi(slug);
  if (generation !== loadGeneration) return;

  if (publicResult.ok && publicResult.data) {
    applyWebformData(publicResult.data);
    error.value = '';
    return;
  }

  const token = getAuthToken();
  if (!token) {
    if (!webform.value) {
      error.value = publicResult.message || translate('webforms.publicLoadError', 'This webform is unavailable.');
    }
    return;
  }

  const webformId = route.query.webformId;
  let result = null;

  if (webformId) {
    result = await loadViaWebformId(webformId, token);
  }
  if (!result?.ok) {
    result = await loadViaPreviewSlug(slug, token);
  }

  if (generation !== loadGeneration) return;

  if (!result?.ok || !result.data) {
    if (!webform.value) {
      error.value = result?.message || publicResult.message || translate('webforms.publicLoadError', 'This webform is unavailable.');
    }
    return;
  }

  applyWebformData(result.data);
  error.value = '';
}

async function loadWebform() {
  const generation = ++loadGeneration;
  const slug = route.params.slug;

  if (!slug) {
    await ensureWebformsLocaleLoaded();
    loading.value = false;
    error.value = translate('webforms.publicLoadError', 'This webform is unavailable.');
    return;
  }

  const cached = readCachedPreview(slug);
  if (cached && applyWebformData(cached)) {
    await ensureWebformsLocaleLoaded();
    loading.value = false;
    error.value = '';
    void refreshFromApi(slug, generation);
    return;
  }

  loading.value = true;
  error.value = '';
  submitted.value = false;
  submitError.value = '';
  webform.value = null;

  try {
    await ensureWebformsLocaleLoaded();
    await refreshFromApi(slug, generation);
  } catch (err) {
    if (generation === loadGeneration && !webform.value) {
      error.value = err?.message || translate('webforms.publicLoadError', 'This webform is unavailable.');
    }
  } finally {
    if (generation === loadGeneration) {
      loading.value = false;
    }
  }
}

async function submitForm() {
  submitting.value = true;
  submitError.value = '';
  try {
    const slug = route.params.slug;
    const response = await fetch(getApiUrlForFetch(`/public/webforms/${encodeURIComponent(String(slug))}/submit`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldValues: formData.value })
    });
    const payload = await response.json();
    if (!response.ok || !payload?.success) {
      submitError.value = payload?.message || translate('webforms.publicSubmitError', 'Could not submit the form.');
      return;
    }
    thankYouMessage.value = payload.data?.thankYouMessage || payload.message || '';
    submitted.value = true;
  } catch {
    submitError.value = translate('webforms.publicSubmitError', 'Could not submit the form.');
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push({ path: '/settings', query: { tab: 'webforms' } });
}

onMounted(() => {
  void loadWebform();
});

watch(
  () => route.params.slug,
  (next, prev) => {
    if (next && next !== prev) {
      void loadWebform();
    }
  }
);
</script>
