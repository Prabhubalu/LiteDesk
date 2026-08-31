import { markModuleListDirty } from '@/utils/moduleListFreshness';

/** Map CSV import API module keys to list module keys. */
const IMPORT_MODULE_ALIASES = {
  contacts: 'people',
  people: 'people',
  organizations: 'organizations',
  deals: 'deals',
  tasks: 'tasks',
};

const pendingListRefreshModules = new Set();

export function resolveImportListModuleKey(importModule) {
  const normalized = String(importModule || '').toLowerCase();
  return IMPORT_MODULE_ALIASES[normalized] || normalized;
}

export function importModuleMatchesListModule(importModule, listModuleKey) {
  const listKey = String(listModuleKey || '').toLowerCase();
  if (!listKey) return false;
  return resolveImportListModuleKey(importModule) === listKey;
}

export function markImportListRefreshPending(listModuleKey) {
  const key = resolveImportListModuleKey(listModuleKey);
  if (key) {
    pendingListRefreshModules.add(key);
    markModuleListDirty(key);
  }
}

export function consumeImportListRefreshPending(listModuleKey) {
  const key = resolveImportListModuleKey(listModuleKey);
  if (!key || !pendingListRefreshModules.has(key)) return false;
  pendingListRefreshModules.delete(key);
  return true;
}

/** Notify module lists to reload after import (background job or inline). */
export function dispatchImportListRefresh(record = {}) {
  const listKey = resolveImportListModuleKey(record.module);
  if (listKey) {
    pendingListRefreshModules.add(listKey);
    markModuleListDirty(listKey);
  }

  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('arivu:import-complete', {
    detail: {
      module: record.module || '',
      status: record.status || '',
      importId: record._id || record.importId || '',
    },
  }));
}
