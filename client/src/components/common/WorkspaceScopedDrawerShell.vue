<template>
  <!--
    Shared chrome for module create/edit side drawers.
    Mounts under #platform-workspace-drawer-host (below TabBar) when available.
    Non-modal so workspace tabs remain clickable; parks when owning tab is inactive.
    Slide transition matches ListView customize drawer (no dim backdrop).
  -->
  <Teleport v-if="teleportReady || isLeaving" :to="teleportTarget">
    <div
      v-show="effectivelyOpen || isLeaving"
      :class="[overlayPositionClass, drawerStackClass, 'pointer-events-none overflow-hidden']"
      role="dialog"
      aria-modal="false"
      :aria-labelledby="titleId || undefined"
    >
      <Transition
        enter-active-class="transition-transform ease-out duration-300"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform ease-in duration-300"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
        @before-leave="isLeaving = true"
        @after-leave="onAfterLeave"
      >
        <div
          v-if="panelVisible"
          :class="[
            'pointer-events-auto absolute inset-y-0 right-0 flex max-w-full h-full',
            panelOffsetClass,
          ]"
        >
          <slot />
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, ref, toRef, watch } from 'vue';
import { useWorkspaceScopedDrawer } from '@/composables/useWorkspaceScopedDrawer';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  /** Extra left padding before the panel (e.g. pl-10 sm:pl-16). */
  panelOffsetClass: {
    type: String,
    default: 'pl-0 sm:pl-16',
  },
  titleId: {
    type: String,
    default: '',
  },
  draftModuleKey: {
    type: String,
    default: '',
  },
  draftRecordId: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['backdrop', 'escape', 'park', 'unpark']);

const isOpenRef = toRef(props, 'isOpen');
const draftModuleKeyRef = toRef(props, 'draftModuleKey');
const draftRecordIdRef = toRef(props, 'draftRecordId');
const isLeaving = ref(false);
/** Delayed one frame after open so Teleport/host exist before enter classes apply. */
const panelVisible = ref(false);

const {
  effectivelyOpen,
  teleportReady,
  teleportTarget,
  overlayPositionClass,
  drawerStackClass,
  persistDraft,
  loadDraft,
  clearDraft,
  ownerTabId,
  claimOwnerTab,
  releaseOwnerTab,
  takeWasParked,
} = useWorkspaceScopedDrawer(isOpenRef, {
  draftModuleKey: draftModuleKeyRef,
  draftRecordId: draftRecordIdRef,
  onEscape: () => emit('escape'),
  onPark: (tabId) => emit('park', tabId),
});

watch(
  effectivelyOpen,
  (open, wasOpen) => {
    if (open) {
      isLeaving.value = false;
      const unparking = takeWasParked();
      if (unparking) {
        // Park kept the panel mounted — restore state without remounting form/lines.
        emit('unpark', ownerTabId.value);
        panelVisible.value = true;
        return;
      }
      panelVisible.value = false;
      nextTick(() => {
        requestAnimationFrame(() => {
          panelVisible.value = true;
        });
      });
      return;
    }
    // Park (isOpen still true): hide via v-show, keep panel DOM so commercial create
    // does not re-seed or POST another Draft on tab return.
    if (props.isOpen) {
      return;
    }
    if (wasOpen) isLeaving.value = true;
    panelVisible.value = false;
  },
  { flush: 'sync', immediate: true },
);

function onAfterLeave() {
  isLeaving.value = false;
}

defineExpose({
  effectivelyOpen,
  persistDraft,
  loadDraft,
  clearDraft,
  ownerTabId,
  claimOwnerTab,
  releaseOwnerTab,
});
</script>
