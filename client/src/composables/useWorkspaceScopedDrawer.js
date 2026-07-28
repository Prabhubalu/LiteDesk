/**
 * Workspace-scoped side drawers: mount under TabBar, stay non-modal so tabs work,
 * and park visibility when the owning workspace tab is inactive.
 */
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  unref,
} from 'vue';
import { PLATFORM_WORKSPACE_DRAWER_HOST_ID } from '@/utils/sidebarLayout';
import { useTabs } from '@/composables/useTabs';
import {
  tabDrawerDraftKey,
  saveTabDrawerDraft,
  getTabDrawerDraft,
  clearTabDrawerDraft,
} from '@/composables/useTabDrawerDrafts';

/**
 * @param {import('vue').Ref<boolean> | (() => boolean) | { value: boolean }} isOpenSource
 * @param {{
 *   draftModuleKey?: import('vue').Ref<string> | string | (() => string),
 *   draftRecordId?: import('vue').Ref<string|null> | string | (() => string|null),
 *   onEscape?: () => void,
 *   focusRef?: import('vue').Ref<HTMLElement|null>,
 * }} [options]
 */
export function useWorkspaceScopedDrawer(isOpenSource, options = {}) {
  const { activeTabId } = useTabs();

  const workspaceDrawerHost = `#${PLATFORM_WORKSPACE_DRAWER_HOST_ID}`;
  const workspaceDrawerHostReady = ref(false);
  const ownerTabId = ref(null);

  function readIsOpen() {
    return Boolean(unref(isOpenSource));
  }

  function readDraftModuleKey() {
    if (options.draftModuleKey == null) return '';
    return String(unref(options.draftModuleKey) || '').trim();
  }

  function readDraftRecordId() {
    if (options.draftRecordId == null) return null;
    const id = unref(options.draftRecordId);
    return id != null && String(id).trim() ? String(id).trim() : null;
  }

  function refreshWorkspaceDrawerHostReady() {
    if (typeof document === 'undefined') return;
    workspaceDrawerHostReady.value = Boolean(
      document.getElementById(PLATFORM_WORKSPACE_DRAWER_HOST_ID),
    );
  }

  const effectivelyOpen = computed(
    () =>
      readIsOpen() &&
      (!ownerTabId.value || ownerTabId.value === activeTabId.value),
  );

  // Keep host Teleport mounted so Vue leave transitions can finish (customise-drawer pattern).
  const teleportReady = computed(
    () =>
      workspaceDrawerHostReady.value ||
      readIsOpen() ||
      effectivelyOpen.value,
  );

  const teleportTarget = computed(() =>
    workspaceDrawerHostReady.value ? workspaceDrawerHost : 'body',
  );

  const overlayPositionClass = computed(() =>
    workspaceDrawerHostReady.value ? 'absolute inset-0' : 'fixed inset-0',
  );

  const drawerStackClass = computed(() =>
    workspaceDrawerHostReady.value ? 'z-[100]' : 'z-[10000]',
  );

  function currentDraftKey(tabId = ownerTabId.value || activeTabId.value) {
    const moduleKey = readDraftModuleKey();
    if (!moduleKey) return '';
    return tabDrawerDraftKey(tabId, moduleKey, readDraftRecordId());
  }

  function claimOwnerTab() {
    if (!ownerTabId.value) ownerTabId.value = activeTabId.value;
  }

  function releaseOwnerTab() {
    ownerTabId.value = null;
  }

  function persistDraft(payload) {
    claimOwnerTab();
    const key = currentDraftKey(ownerTabId.value);
    if (!key || !payload) return;
    saveTabDrawerDraft(key, payload);
  }

  function loadDraft() {
    claimOwnerTab();
    const key = currentDraftKey(ownerTabId.value);
    if (!key) return null;
    return getTabDrawerDraft(key);
  }

  function clearDraft() {
    const key = currentDraftKey(ownerTabId.value || activeTabId.value);
    if (key) clearTabDrawerDraft(key);
  }

  function handleEscapeKey(event) {
    if (event.key !== 'Escape' || !effectivelyOpen.value) return;
    options.onEscape?.();
  }

  watch(effectivelyOpen, (open) => {
    if (open) {
      claimOwnerTab();
      refreshWorkspaceDrawerHostReady();
      window.addEventListener('keydown', handleEscapeKey);
      nextTick(() => options.focusRef?.value?.focus?.());
      return;
    }
    window.removeEventListener('keydown', handleEscapeKey);
  });

  watch(activeTabId, (nextId, prevId) => {
    if (!readIsOpen()) return;
    if (!ownerTabId.value && prevId) ownerTabId.value = prevId;
    if (prevId && ownerTabId.value && prevId === ownerTabId.value && nextId !== prevId) {
      // Consumers should persist via onPark callback if needed
      options.onPark?.(ownerTabId.value);
    }
  });

  watch(
    () => readIsOpen(),
    (open, wasOpen) => {
      if (open) {
        refreshWorkspaceDrawerHostReady();
        ownerTabId.value = activeTabId.value;
        return;
      }
      if (wasOpen) {
        releaseOwnerTab();
        window.removeEventListener('keydown', handleEscapeKey);
      }
    },
  );

  onMounted(() => {
    refreshWorkspaceDrawerHostReady();
    if (!workspaceDrawerHostReady.value) {
      nextTick(refreshWorkspaceDrawerHostReady);
    }
    if (readIsOpen()) {
      claimOwnerTab();
      refreshWorkspaceDrawerHostReady();
    }
  });

  onUnmounted(() => {
    if (readIsOpen() && ownerTabId.value) {
      options.onPark?.(ownerTabId.value);
    }
    window.removeEventListener('keydown', handleEscapeKey);
  });

  return {
    workspaceDrawerHost,
    workspaceDrawerHostReady,
    refreshWorkspaceDrawerHostReady,
    ownerTabId,
    effectivelyOpen,
    teleportReady,
    teleportTarget,
    overlayPositionClass,
    drawerStackClass,
    claimOwnerTab,
    releaseOwnerTab,
    currentDraftKey,
    persistDraft,
    loadDraft,
    clearDraft,
  };
}
