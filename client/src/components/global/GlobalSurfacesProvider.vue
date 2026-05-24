<template>
  <!--
    ============================================================================
    Global Surfaces Provider
    ============================================================================
    
    ARCHITECTURE NOTE: This component centralizes all global UI surfaces.
    
    This component must be mounted once at the application root level.
    It owns the visibility state and keyboard shortcuts for all global surfaces
    that are available across the entire application.
    
    Responsibilities:
    - Owns global UI surfaces (GlobalSearch, CommandPalette)
    - Owns their visibility state
    - Owns global keyboard shortcuts (Cmd/Ctrl+K, Cmd/Ctrl+/)
    - Owns global custom-event listeners
    
    This ensures consistent behavior across all layouts (PlatformShell, AuditLayout, etc.)
    and prevents duplicate keyboard listeners and state management.
    
    See: docs/architecture/command-palette-invariants.md (if exists)
    ============================================================================
  -->
  
  <!-- Global Search -->
  <GlobalSearch
    :is-open="showGlobalSearch"
    @close="closeGlobalSearch"
    @open="openGlobalSearch"
  />
  
  <!-- Command Palette -->
  <!-- NOTE: Currently using GlobalSearch for command palette functionality -->
  <!-- GlobalSearch switches to command mode when user types '/' -->
  <!-- A separate CommandPalette component can be added here if needed in the future -->

  <ConnectMailboxModal
    v-model="connectModalOpen"
    :reason="connectModalReason"
    :mailbox-kind="connectModalMailboxKind"
    :target-mailbox="connectModalTargetMailbox"
    @connected="onMailboxConnected"
  />
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
/**
 * GlobalSurfacesProvider
 *
 * Owns all global, cross-app UI surfaces:
 * - GlobalSearch
 * - CommandPalette
 *
 * Rules:
 * - Must be mounted exactly once
 * - App layouts must NEVER own global surfaces
 * - App layouts trigger via custom events only
 *
 * Any deviation requires architecture review.
 */

import { ref, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue';
import { useConnectMailboxPrompt } from '@/composables/useConnectMailboxPrompt';
import { useMailboxConnection } from '@/composables/useMailboxConnection';
import ConnectMailboxModal from '@/components/inbox/ConnectMailboxModal.vue';

// Async so GlobalSearch (+ drawers, field engines, command registry, API client) is NOT in the
// same synchronous ESM pass as app.use(router) / root shell. A static import caused production
// ReferenceError: Cannot access 'G' before initialization inside defineComponent (TDZ / cycle).
const GlobalSearch = defineAsyncComponent(() => import('@/components/GlobalSearch.vue'));

const {
  connectModalOpen,
  connectModalReason,
  connectModalMailboxKind,
  connectModalTargetMailbox
} = useConnectMailboxPrompt();
const { refreshMailboxes } = useMailboxConnection();

function onMailboxConnected() {
  void refreshMailboxes();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('litedesk:mailbox-connected'));
  }
}

// Visibility state for global surfaces
const showGlobalSearch = ref(false);
const showCommandPalette = ref(false);

// Open/close handlers for GlobalSearch
const openGlobalSearch = () => {
  showGlobalSearch.value = true;
};

const closeGlobalSearch = () => {
  showGlobalSearch.value = false;
};

// Open/close handlers for CommandPalette
const openCommandPalette = () => {
  // ARCHITECTURE NOTE: For now, CommandPalette functionality is handled by GlobalSearch
  // When user types '/' in GlobalSearch, it switches to command mode
  // If a separate CommandPalette component is created, open it here
  showCommandPalette.value = true;
  // For now, also open GlobalSearch (which handles commands)
  openGlobalSearch();
};

const closeCommandPalette = () => {
  showCommandPalette.value = false;
};

/**
 * When focus is inside a rich text editor (TipTap / ProseMirror) and the user has text selected,
 * Cmd/Ctrl+K should run the editor’s “insert link” behavior — not global search.
 * ProseMirror usually calls preventDefault(); we also check DOM selection + target as a fallback.
 */
function shouldDeferModKToRichText(event) {
  if (event.defaultPrevented) return true;
  const rawTarget = event.target;
  if (!(rawTarget instanceof Element)) return false;
  const target = rawTarget.nodeType === Node.TEXT_NODE ? rawTarget.parentElement : rawTarget;
  if (!target?.closest) return false;
  const inRichText =
    target.closest('[contenteditable="true"]') ||
    target.closest('.ProseMirror') ||
    target.closest('.tiptap');
  if (!inRichText) return false;
  try {
    const sel = document.getSelection?.();
    if (!sel || sel.rangeCount === 0) return false;
    return !sel.isCollapsed;
  } catch {
    return false;
  }
}

// Keyboard shortcut handlers
const handleGlobalSearchKeydown = (event) => {
  const isModK =
    (event.metaKey || event.ctrlKey) && String(event.key || '').toLowerCase() === 'k';
  if (!isModK) return;
  if (shouldDeferModKToRichText(event)) return;
  event.preventDefault();
  openGlobalSearch();
};

const handleCommandPaletteKeydown = (event) => {
  // Cmd/Ctrl + / to open command palette
  if ((event.metaKey || event.ctrlKey) && event.key === '/') {
    event.preventDefault();
    openCommandPalette();
  }
};

// Combined keyboard handler
const handleKeydown = (event) => {
  handleGlobalSearchKeydown(event);
  handleCommandPaletteKeydown(event);
};

// Custom event handlers
const handleOpenGlobalSearchEvent = () => {
  openGlobalSearch();
};

const handleOpenCommandPaletteEvent = () => {
  openCommandPalette();
};

// Setup event listeners on mount
onMounted(() => {
  // Keyboard shortcuts
  window.addEventListener('keydown', handleKeydown);
  
  // Custom events
  window.addEventListener('arivu:open-global-search', handleOpenGlobalSearchEvent);
  window.addEventListener('arivu:open-command-palette', handleOpenCommandPaletteEvent);
});

// Cleanup event listeners on unmount
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('arivu:open-global-search', handleOpenGlobalSearchEvent);
  window.removeEventListener('arivu:open-command-palette', handleOpenCommandPaletteEvent);
});
</script>
