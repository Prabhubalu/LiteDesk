import { ref, reactive } from 'vue';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

function authHeaders() {
  const authStore = useAuthStore();
  const headers = {};
  if (authStore.user?.token) {
    headers.Authorization = `Bearer ${authStore.user.token}`;
  }
  return headers;
}

async function fetchRenderedOutputBlob(renderResult) {
  const path = renderResult?.previewUrl;
  if (!path) {
    throw new Error('Preview URL missing');
  }

  const response = await fetch(getApiUrlForFetch(path), { headers: authHeaders() });
  if (!response.ok) {
    throw new Error('Failed to load rendered output');
  }

  const blob = await response.blob();
  const contentType = response.headers.get('content-type') || blob.type || 'application/pdf';
  return { blob, contentType };
}

function pdfBlobFromRenderResult(renderResult) {
  const mimeType = renderResult?.mimeType || 'application/pdf';
  const buffer = renderResult?.buffer;
  if (buffer?.type === 'Buffer' && Array.isArray(buffer.data)) {
    return new Blob([new Uint8Array(buffer.data)], { type: mimeType });
  }
  return null;
}

function openBlobInNewTab(blob, contentType) {
  const blobUrl = URL.createObjectURL(new Blob([blob], { type: contentType }));
  const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');

  if (!opened) {
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
}

export function useTemplates() {
  const templates = ref([]);
  const loading = ref(false);
  const summary = ref(null);
  const summaryLoading = ref(false);
  const pagination = reactive({
    currentPage: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });

  async function fetchTemplateSummary() {
    summaryLoading.value = true;
    try {
      const response = await apiClient.get('/templates/summary', { cache: 'no-store' });
      if (response?.success) {
        summary.value = response.data || null;
      } else {
        summary.value = null;
      }
      return summary.value;
    } finally {
      summaryLoading.value = false;
    }
  }

  async function fetchTemplates(options = {}) {
    loading.value = true;
    try {
      const page = options.page ?? pagination.currentPage;
      const limit = options.limit ?? pagination.limit;
      const response = await apiClient.get('/templates', {
        params: {
          page,
          limit,
          status: options.status || undefined,
          moduleScope: options.moduleScope || undefined,
          outputFormat: options.outputFormat || undefined,
          category: options.category || undefined,
          purpose: options.purpose || undefined,
          search: options.search || undefined
        },
        cache: 'no-store'
      });

      if (response?.success) {
        templates.value = Array.isArray(response.data) ? response.data : [];
        const pag = response.pagination || {};
        pagination.currentPage = pag.page ?? page;
        pagination.limit = pag.limit ?? limit;
        pagination.total = pag.total ?? templates.value.length;
        pagination.totalPages = pag.totalPages ?? 1;
      } else {
        templates.value = [];
      }

      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTemplate(id) {
    const response = await apiClient.get(`/templates/${id}`, { cache: 'no-store' });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to load template');
    }
    return response.data;
  }

  async function createTemplate(payload) {
    const response = await apiClient.post('/templates', payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to create template');
    }
    return response.data;
  }

  async function updateTemplate(id, payload) {
    const response = await apiClient.put(`/templates/${id}`, payload);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to update template');
    }
    return response.data;
  }

  async function publishTemplate(id, releaseNotes = '') {
    const response = await apiClient.post(`/templates/${id}/publish`, { releaseNotes });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to publish template');
    }
    return response.data;
  }

  async function archiveTemplate(id) {
    const response = await apiClient.post(`/templates/${id}/archive`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to archive template');
    }
    return response.data;
  }

  async function deleteTemplate(id) {
    const response = await apiClient.delete(`/templates/${id}`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to delete template');
    }
    return response.data;
  }

  async function listVersions(id) {
    const response = await apiClient.get(`/templates/${id}/versions`, { cache: 'no-store' });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to load versions');
    }
    return response.data || [];
  }

  async function validateTemplate(id, jsonDefinition) {
    const response = await apiClient.post(`/templates/${id}/validate`, {
      jsonDefinition
    });
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to validate template');
    }
    return response.data;
  }

  async function restoreVersion(id, version) {
    const response = await apiClient.post(`/templates/${id}/versions/${version}/restore`);
    if (!response?.success) {
      throw new Error(response?.message || 'Failed to restore version');
    }
    return response.data;
  }

  async function renderTemplate(id, options = {}) {
    const runtimeContext = {};
    if (options.recordId) runtimeContext.recordId = options.recordId;
    if (options.recordModuleKey) runtimeContext.recordModuleKey = options.recordModuleKey;

    const response = await apiClient.post(`/templates/${id}/render`, {
      outputFormat: options.outputFormat || 'pdf',
      preview: options.preview === true,
      persistOutput: false,
      runtimeContext
    });

    if (!response?.success) {
      throw new Error(response?.message || 'Failed to render template');
    }
    return response.data;
  }

  async function previewRenderedTemplate(id, options = {}) {
    const renderResult = await renderTemplate(id, { ...options, preview: true });
    const inlineBlob = pdfBlobFromRenderResult(renderResult);
    const mimeType = renderResult?.mimeType || 'application/pdf';

    if (inlineBlob) {
      openBlobInNewTab(inlineBlob, mimeType);
      return renderResult;
    }

    const { blob, contentType } = await fetchRenderedOutputBlob(renderResult);
    openBlobInNewTab(blob, contentType);
    return renderResult;
  }

  async function renderHtmlPreview(id, options = {}) {
    const runtimeContext = {};
    if (options.recordId) runtimeContext.recordId = options.recordId;
    if (options.recordModuleKey) runtimeContext.recordModuleKey = options.recordModuleKey;

    const response = await apiClient.post(`/templates/${id}/render/preview`, {
      outputFormat: 'html',
      persistOutput: false,
      preview: true,
      jsonDefinition: options.jsonDefinition,
      pageSettings: options.pageSettings,
      runtimeContext
    });

    if (!response?.success) {
      throw new Error(response?.message || 'Failed to render HTML preview');
    }
    return response.data?.html || '';
  }

  return {
    templates,
    loading,
    summary,
    summaryLoading,
    pagination,
    fetchTemplates,
    fetchTemplateSummary,
    fetchTemplate,
    createTemplate,
    updateTemplate,
    publishTemplate,
    archiveTemplate,
    deleteTemplate,
    listVersions,
    validateTemplate,
    restoreVersion,
    renderTemplate,
    previewRenderedTemplate,
    renderHtmlPreview
  };
}
