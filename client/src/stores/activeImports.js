import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import { pushToast } from '@/composables/useNotifications';
import { buildToastPresentation } from '@/utils/toastPresentation';
import { i18n } from '@/i18n';

const STORAGE_KEY = 'litedesk:activeImports';
const POLL_INTERVAL_MS = 1500;

const t = i18n.global.t.bind(i18n.global);

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota errors */
  }
}

export const useActiveImportsStore = defineStore('activeImports', () => {
  const imports = ref([]);
  let pollTimer = null;
  const waiters = new Map();

  const processingImports = computed(() =>
    imports.value.filter((item) => item.status === 'processing')
  );

  const hasProcessing = computed(() => processingImports.value.length > 0);

  function getImport(importId) {
    return imports.value.find((item) => item.importId === importId) || null;
  }

  function resolveWaiters(importId, record) {
    const handlers = waiters.get(importId);
    if (!handlers) return;
    waiters.delete(importId);
    handlers.forEach((handler) => handler(record));
  }

  function rejectWaiters(importId, error) {
    const handlers = waiters.get(importId);
    if (!handlers) return;
    waiters.delete(importId);
    handlers.forEach((handler) => handler(null, error));
  }

  function persistProcessingImports() {
    writeStorage(imports.value.filter((item) => item.status === 'processing'));
  }

  function trackImport({ importId, fileName, module, total }) {
    const id = String(importId);
    const existing = imports.value.find((item) => item.importId === id);
    if (existing) {
      Object.assign(existing, {
        fileName: fileName || existing.fileName,
        module: module || existing.module,
        total: total ?? existing.total,
        status: 'processing',
      });
    } else {
      imports.value.push({
        importId: id,
        fileName: fileName || 'import.csv',
        module: module || '',
        total: total ?? 0,
        processed: 0,
        status: 'processing',
      });
    }
    persistProcessingImports();
    ensurePolling();
  }

  function updateImportFromRecord(record) {
    const id = String(record._id);
    const item = imports.value.find((entry) => entry.importId === id);
    if (!item) return null;

    item.fileName = record.fileName || item.fileName;
    item.module = record.module || item.module;
    item.processed = record.stats?.processed ?? item.processed;
    item.total = record.stats?.total ?? item.total;
    item.status = record.status || item.status;
    persistProcessingImports();
    return item;
  }

  function notifyImportComplete(record) {
    const variant = record.status === 'failed' ? 'error' : 'success';
    const titleKey = record.status === 'failed'
      ? 'import.importBackgroundFailedTitle'
      : 'import.importBackgroundCompleteTitle';
    const messageKey = record.status === 'failed'
      ? 'import.importBackgroundFailedMessage'
      : 'import.importBackgroundCompleteMessage';

    pushToast(buildToastPresentation({
      variant,
      primary: t(titleKey),
      secondary: t(messageKey, { fileName: record.fileName || 'import.csv' }),
      duration: 8000,
    }));
  }

  async function pollOnce() {
    const processing = imports.value.filter((item) => item.status === 'processing');
    if (!processing.length) {
      stopPolling();
      return;
    }

    await Promise.all(processing.map(async (item) => {
      try {
        const response = await apiClient.get(`/imports/${item.importId}`);
        if (!response.success) return;

        const record = response.data;
        updateImportFromRecord(record);

        if (record.status !== 'processing') {
          const hasWaiter = waiters.has(item.importId);
          imports.value = imports.value.filter((entry) => entry.importId !== item.importId);
          persistProcessingImports();
          resolveWaiters(item.importId, record);
          if (!hasWaiter) notifyImportComplete(record);
        }
      } catch (error) {
        console.error('[activeImports] poll error:', error);
        rejectWaiters(item.importId, error);
      }
    }));
  }

  function ensurePolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      void pollOnce();
    }, POLL_INTERVAL_MS);
    void pollOnce();
  }

  function stopPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function init() {
    imports.value = readStorage().map((item) => ({
      importId: String(item.importId),
      fileName: item.fileName || 'import.csv',
      module: item.module || '',
      total: item.total ?? 0,
      processed: item.processed ?? 0,
      status: 'processing',
    }));
    if (hasProcessing.value) ensurePolling();
  }

  function reset() {
    stopPolling();
    imports.value = [];
    writeStorage([]);
    waiters.clear();
  }

  function waitForImport(importId) {
    const id = String(importId);
    ensurePolling();

    return new Promise((resolve, reject) => {
      const handlers = waiters.get(id) || [];
      handlers.push((record, error) => {
        if (error) reject(error);
        else resolve(record);
      });
      waiters.set(id, handlers);

      void apiClient.get(`/imports/${id}`).then((response) => {
        if (!response.success) return;
        const record = response.data;
        updateImportFromRecord(record);
        if (record.status !== 'processing') {
          const hasWaiter = waiters.has(id);
          imports.value = imports.value.filter((entry) => entry.importId !== id);
          persistProcessingImports();
          resolveWaiters(id, record);
          if (!hasWaiter) notifyImportComplete(record);
        }
      }).catch(reject);
    });
  }

  return {
    imports,
    processingImports,
    hasProcessing,
    trackImport,
    getImport,
    init,
    reset,
    stopPolling,
    waitForImport,
    ensurePolling,
  };
});
