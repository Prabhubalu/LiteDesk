import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from 'vue';
import { PLATFORM_WORKSPACE_DRAWER_HOST_ID } from '@/utils/sidebarLayout';

export function useWorkspaceCustomizeDrawer(
  isOpen: Ref<boolean>,
  buttonRef: Ref<HTMLElement | null>,
) {
  const workspaceDrawerHost = `#${PLATFORM_WORKSPACE_DRAWER_HOST_ID}`;
  const workspaceDrawerHostReady = ref(false);
  const drawerTopPx = ref(0);

  let listenersBound = false;

  function refreshWorkspaceDrawerHostReady() {
    if (typeof document === 'undefined') return;
    workspaceDrawerHostReady.value = Boolean(
      document.getElementById(PLATFORM_WORKSPACE_DRAWER_HOST_ID),
    );
  }

  function syncDrawerPosition() {
    if (typeof document === 'undefined') return;

    const host = document.getElementById(PLATFORM_WORKSPACE_DRAWER_HOST_ID);
    const button = buttonRef.value;
    if (!(host instanceof HTMLElement) || !(button instanceof HTMLElement)) {
      drawerTopPx.value = 0;
      return;
    }

    const hostRect = host.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    drawerTopPx.value = Math.max(0, Math.round(buttonRect.top - hostRect.top));
  }

  const drawerInsetStyle = computed(() => ({
    top: `${drawerTopPx.value}px`,
  }));

  function bindListeners() {
    if (listenersBound) return;
    listenersBound = true;
    window.addEventListener('resize', syncDrawerPosition, { passive: true });
    document
      .querySelector('[data-platform-scroll-root]')
      ?.addEventListener('scroll', syncDrawerPosition, { passive: true });
  }

  function unbindListeners() {
    if (!listenersBound) return;
    listenersBound = false;
    window.removeEventListener('resize', syncDrawerPosition);
    document
      .querySelector('[data-platform-scroll-root]')
      ?.removeEventListener('scroll', syncDrawerPosition);
  }

  watch(isOpen, (open) => {
    if (open) {
      syncDrawerPosition();
      nextTick(() => requestAnimationFrame(syncDrawerPosition));
      bindListeners();
      return;
    }
    unbindListeners();
  });

  onMounted(() => {
    refreshWorkspaceDrawerHostReady();
    if (!workspaceDrawerHostReady.value) {
      nextTick(refreshWorkspaceDrawerHostReady);
    }
  });

  onBeforeUnmount(() => {
    unbindListeners();
  });

  return {
    workspaceDrawerHost,
    workspaceDrawerHostReady,
    refreshWorkspaceDrawerHostReady,
    syncDrawerPosition,
    drawerInsetStyle,
  };
}
