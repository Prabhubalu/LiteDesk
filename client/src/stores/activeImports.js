import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import { pushToast } from '@/composables/useNotifications';
import { buildToastPresentation } from '@/utils/toastPresentation';
import { dispatchImportListRefresh } from '@/utils/importListModuleMatch';
import { i18n } from '@/i18n';

const STORAGE_KEY = 'litedesk:activeImports';
const POLL_INTERVAL_MS = 800;

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
  /** Import IDs currently shown in CSVImportModal (hidden from floating banner). */
  const modalPinnedImportIds = ref(new Set());
  let pollTimer = null;
  const waiters = new Map();

  const processingImports = computed(() =>
    imports.value.filter((item) => item.status === 'processing')
  );

  const processingImportsForBanner = computed(() =>
    processingImports.value.filter((item) => !modalPinnedImportIds.value.has(item.importId))
  );

  const hasProcessing = computed(() => processingImports.value.length > 0);

  const hasBannerImports = computed(() => processingImportsForBanner.value.length > 0);

  function pinImportToModal(importId) {
    const id = String(importId);
    const next = new Set(modalPinnedImportIds.value);
    next.add(id);
    modalPinnedImportIds.value = next;
  }

  function releaseImportToBanner(importId) {
    const id = String(importId);
    if (!modalPinnedImportIds.value.has(id)) return;
    const next = new Set(modalPinnedImportIds.value);
    next.delete(id);
    modalPinnedImportIds.value = next;
  }

  function isImportPinnedToModal(importId) {
    return modalPinnedImportIds.value.has(String(importId));
  }

  function shouldNotifyImportComplete(importId, hasWaiter) {
    if (!hasWaiter) return true;
    return !isImportPinnedToModal(importId);
  }

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
          releaseImportToBanner(item.importId);
          imports.value = imports.value.filter((entry) => entry.importId !== item.importId);
          persistProcessingImports();
          resolveWaiters(item.importId, record);
          dispatchImportListRefresh(record);
          if (shouldNotifyImportComplete(item.importId, hasWaiter)) {
            notifyImportComplete(record);
          }
        }
      } catch (error) {
        console.error('[activeImports] poll error:', error);
        const status = error?.response?.status;
        if (status === 404 || status === 403) {
          imports.value = imports.value.filter((entry) => entry.importId !== item.importId);
          persistProcessingImports();
          resolveWaiters(item.importId, { status: 'failed', fileName: item.fileName });
          return;
        }
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

  async function init() {
    imports.value = readStorage().map((item) => ({
      importId: String(item.importId),
      fileName: item.fileName || 'import.csv',
      module: item.module || '',
      total: item.total ?? 0,
      processed: item.processed ?? 0,
      status: 'processing',
    }));
    if (hasProcessing.value) {
      await pollOnce();
      if (hasProcessing.value) ensurePolling();
    }
  }

  function reset() {
    stopPolling();
    imports.value = [];
    modalPinnedImportIds.value = new Set();
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
          releaseImportToBanner(id);
          imports.value = imports.value.filter((entry) => entry.importId !== id);
          persistProcessingImports();
          resolveWaiters(id, record);
          dispatchImportListRefresh(record);
          if (shouldNotifyImportComplete(id, hasWaiter)) {
            notifyImportComplete(record);
          }
        }
      }).catch(reject);
    });
  }

  return {
    imports,
    processingImports,
    processingImportsForBanner,
    hasProcessing,
    hasBannerImports,
    trackImport,
    getImport,
    pinImportToModal,
    releaseImportToBanner,
    isImportPinnedToModal,
    init,
    reset,
    stopPolling,
    waitForImport,
    ensurePolling,
  };
});
