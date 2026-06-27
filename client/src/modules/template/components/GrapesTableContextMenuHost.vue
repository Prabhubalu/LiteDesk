<template>
  <BuilderTableContextMenu
    :open="menuOpen"
    :x="menuX"
    :y="menuY"
    :can-delete-row="menuState.canDeleteRow"
    :can-delete-col="menuState.canDeleteCol"
    :can-merge="menuState.canMerge"
    :can-unmerge="menuState.canUnmerge"
    :has-clipboard="hasClipboard"
    :is-data-row="menuState.isDataRow"
    @action="onMenuAction"
    @close="closeMenu"
  />
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import BuilderTableContextMenu from '@/components/templates/builder/BuilderTableContextMenu.vue';
import {
  copyCell,
  getTableActionState,
  runTableAction,
  setContextMenuOpen
} from '../editor/tableActions';
import {
  isTableCellComponent,
  resolveTableCellFromElement,
  resolveTableCellTarget,
  snapshotTableCellTarget
} from '../editor/tableModel';

const props = defineProps({
  editor: { type: Object, default: null }
});

const menuOpen = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const activeTarget = ref(null);
const clipboard = ref(null);
const hasClipboard = ref(false);

const defaultMenuState = () => ({
  canMerge: false,
  canUnmerge: false,
  canDeleteRow: true,
  canDeleteCol: true,
  isDataRow: false
});

const menuState = ref(defaultMenuState());

let frameLoadHandler = null;

function closeMenu() {
  menuOpen.value = false;
  setContextMenuOpen(false);
  activeTarget.value = null;
}

function detachListener() {
  const doc = props.editor?.Canvas?.getFrameEl?.()?.contentDocument;
  if (doc && doc.__arivuTableContextHandler) {
    doc.removeEventListener('contextmenu', doc.__arivuTableContextHandler, true);
    delete doc.__arivuTableContextHandler;
  }
}

function viewportPointFromFrameEvent(event) {
  const frame = props.editor?.Canvas?.getFrameEl?.();
  const rect = frame?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
  return {
    x: rect.left + event.clientX,
    y: rect.top + event.clientY
  };
}

function attachListener() {
  detachListener();
  const doc = props.editor?.Canvas?.getFrameEl?.()?.contentDocument;
  if (!doc) return;

  const handler = (event) => {
    const component = resolveTableCellFromElement(event.target, props.editor);
    if (!component || !isTableCellComponent(component)) return;

    const target = snapshotTableCellTarget(component);
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();

    activeTarget.value = target;
    menuState.value = getTableActionState(component) ?? defaultMenuState();

    const point = viewportPointFromFrameEvent(event);
    menuX.value = point.x;
    menuY.value = point.y;
    menuOpen.value = true;
    setContextMenuOpen(true);
  };

  doc.__arivuTableContextHandler = handler;
  doc.addEventListener('contextmenu', handler, true);
}

watch(
  () => props.editor,
  (instance, previous) => {
    if (previous && frameLoadHandler) {
      previous.off('canvas:frame:load', frameLoadHandler);
      frameLoadHandler = null;
    }

    detachListener();
    closeMenu();

    if (!instance) return;

    frameLoadHandler = attachListener;
    instance.on('canvas:frame:load', frameLoadHandler);
    attachListener();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (props.editor && frameLoadHandler) {
    props.editor.off('canvas:frame:load', frameLoadHandler);
  }
  detachListener();
  closeMenu();
});

function onMenuAction(action) {
  const target = activeTarget.value;
  const editor = props.editor;

  closeMenu();

  if (!target || !editor) return;

  if (action === 'copy-cell') {
    const resolved = resolveTableCellTarget(editor, target);
    if (!resolved) return;
    clipboard.value = copyCell(resolved.cell);
    hasClipboard.value = Boolean(clipboard.value);
    return;
  }

  const alignMap = {
    'align-left': 'align-left',
    'align-center': 'align-center',
    'align-right': 'align-right'
  };

  const mapped = alignMap[action] || action;

  window.setTimeout(() => {
    runTableAction(editor, target, mapped, clipboard.value);
  }, 0);
}
</script>
