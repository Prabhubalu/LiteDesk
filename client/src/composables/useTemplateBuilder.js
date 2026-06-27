import { computed, ref, shallowRef, watch } from 'vue';
import {
  addChild,
  cloneDefinition,
  countComponents,
  createNodeId,
  duplicateNode,
  findNode,
  insertChildAt,
  isContainerComponentType,
  isNodeLocked,
  removeNode,
  reorderPageChildren,
  reorderChildren,
  toggleNodeLocked,
  toggleNodeVisibility,
  updateNode
} from '@/utils/templateBuilderTree';
import { BUILDER_CATALOG, createCatalogComponentNode } from '@/constants/templateBuilderCatalog';
import {
  DEFAULT_CUSTOM_PAGE_HEIGHT_MM,
  DEFAULT_CUSTOM_PAGE_WIDTH_MM,
  resolveContentAreaPx,
  resolvePageDimensionsPx,
  resolvePageMarginsPx
} from '@/constants/contentPageSettings';
import {
  BUILDER_LAYOUT_MODES,
  applyZIndexFromOrder,
  clampLayoutToContentArea,
  ensureNodeLayout,
  migrateFlowChildrenToAbsolute,
  resolveLayoutMode
} from '@/utils/builderLayout';
import { useTemplates } from '@/composables/useTemplates';
import {
  loadBuilderHistory,
  saveBuilderHistory
} from '@/utils/builderHistoryStorage';
import { buildTableBindingsPatch } from '@/utils/builderTableBindings';
import {
  applySyncedTableLayouts,
  normalizeTableGridBindings,
  resolveSyncedTableLayout,
  tableWidthPercentFromLayoutWidth,
  updateCell,
  setRepeatRowIndex
} from '@/utils/builderTableGridModel';

const MAX_HISTORY = 50;
const AUTOSAVE_MS = 2000;

function blankPageDefinition() {
  return {
    id: 'root',
    type: 'Page',
    name: 'Page 1',
    layout: { x: 0, y: 0, width: '100%', height: 'auto' },
    style: {},
    bindings: { layoutMode: BUILDER_LAYOUT_MODES.ABSOLUTE },
    visibility: {},
    children: []
  };
}

export function useTemplateBuilder(templateId) {
  const { fetchTemplate, updateTemplate, previewRenderedTemplate, renderHtmlPreview } = useTemplates();

  const templateMeta = shallowRef(null);
  const definition = ref(blankPageDefinition());
  const selectedId = ref(null);
  const selectedIds = ref([]);
  const loading = ref(true);
  const saveStatus = ref('saved');
  const previewBusy = ref(false);
  const htmlPreview = ref('');
  const htmlPreviewLoading = ref(false);
  const htmlPreviewError = ref('');
  const previewRecordId = ref('');
  const previewRecordLabel = ref('');

  const past = ref([]);
  const future = ref([]);

  let autosaveTimer = null;
  let suppressAutosave = false;

  const selectedNode = computed(() => {
    if (!selectedId.value) return null;
    return findNode(definition.value, selectedId.value);
  });

  const insertParentId = computed(() => {
    const selected = selectedNode.value;
    if (selected && isContainerComponentType(String(selected.type))) {
      return selected.id;
    }
    return definition.value.id;
  });

  const insertParentLabel = computed(() => {
    const selected = selectedNode.value;
    if (selected && isContainerComponentType(String(selected.type))) {
      return selected.name || selected.type;
    }
    return 'Page';
  });

  const componentCount = computed(() => countComponents(definition.value));

  const layoutMode = computed(() => resolveLayoutMode(definition.value));

  const pageDimensionsPx = computed(() => resolvePageDimensionsPx({
    paperSize: String(templateMeta.value?.paperSize || 'A4'),
    orientation: templateMeta.value?.orientation === 'landscape' ? 'landscape' : 'portrait',
    customPageWidth: templateMeta.value?.customPageWidth,
    customPageHeight: templateMeta.value?.customPageHeight
  }));

  const pageWidthPx = computed(() => pageDimensionsPx.value.width);
  const pageHeightPx = computed(() => pageDimensionsPx.value.height);

  const pageContentArea = computed(() =>
    resolveContentAreaPx(pageWidthPx.value, pageHeightPx.value, resolvePageMarginsPx())
  );

  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);

  function buildPageSettingsPayload() {
    const meta = templateMeta.value || {};
    const paperSize = meta.paperSize || 'A4';
    const orientation = meta.orientation === 'landscape' ? 'landscape' : 'portrait';
    const payload = { paperSize, orientation };

    if (paperSize === 'Custom') {
      payload.customPageWidth = Number(meta.customPageWidth) || DEFAULT_CUSTOM_PAGE_WIDTH_MM;
      payload.customPageHeight = Number(meta.customPageHeight) || DEFAULT_CUSTOM_PAGE_HEIGHT_MM;
    }

    return payload;
  }

  function syncAllTableLayoutsInPlace() {
    definition.value = applySyncedTableLayouts(
      definition.value,
      pageWidthPx.value,
      pageHeightPx.value
    );
  }

  function finalizeAbsoluteBlockPatch(node, patch) {
    if (!node) return patch;

    if (node.type === 'Table') {
      const mergedBindings = patch.bindings
        ? { ...(node.bindings || {}), ...patch.bindings }
        : (node.bindings || {});
      const mergedLayout = patch.layout
        ? { ...(node.layout || {}), ...(patch.layout || {}) }
        : (node.layout || {});

      let bindings = mergedBindings;
      if (patch.layout?.width != null && !patch.bindings) {
        const gridBindings = normalizeTableGridBindings(mergedBindings);
        if (gridBindings.widthUnit === 'percent') {
          bindings = buildTableBindingsPatch(node.bindings, {
            ...gridBindings,
            tableWidthPercent: tableWidthPercentFromLayoutWidth(
              Number(patch.layout.width),
              pageContentArea.value.width
            ),
            widthUnit: 'percent'
          });
        }
      }

      const mergedNode = { ...node, bindings, layout: mergedLayout };
      const layout = resolveSyncedTableLayout(
        mergedNode,
        pageWidthPx.value,
        pageHeightPx.value
      );

      const nextPatch = { ...patch, layout };
      if (patch.bindings || (patch.layout?.width != null && bindings !== mergedBindings)) {
        nextPatch.bindings = bindings;
      }
      return nextPatch;
    }

    if (layoutMode.value !== BUILDER_LAYOUT_MODES.ABSOLUTE || !patch.layout) {
      return patch;
    }

    const mergedLayout = patch.layout
      ? { ...(node.layout || {}), ...(patch.layout || {}) }
      : (node.layout || {});
    const layout = clampLayoutToContentArea(
      {
        x: Number(mergedLayout.x) || pageContentArea.value.x,
        y: Number(mergedLayout.y) || pageContentArea.value.y,
        width: Math.max(32, Number(mergedLayout.width) || 240),
        height: Math.max(32, Number(mergedLayout.height) || 80),
        zIndex: mergedLayout.zIndex
      },
      pageContentArea.value
    );
    return { ...patch, layout };
  }

  function updatePageSettings(patch) {
    if (!templateMeta.value) return;
    templateMeta.value = {
      ...templateMeta.value,
      ...patch
    };
    saveStatus.value = 'dirty';
    scheduleAutosave();
    syncAllTableLayoutsInPlace();
  }

  function persistHistoryState() {
    const id = templateId();
    if (!id) return;
    saveBuilderHistory(id, {
      past: past.value,
      future: future.value,
      selectedId: selectedId.value
    });
  }

  function pushHistory() {
    past.value = [...past.value.slice(-(MAX_HISTORY - 1)), cloneDefinition(definition.value)];
    future.value = [];
    persistHistoryState();
  }

  function applyDefinition(next, { recordHistory = true } = {}) {
    if (recordHistory) pushHistory();
    definition.value = next;
    saveStatus.value = 'dirty';
    scheduleAutosave();
    persistHistoryState();
  }

  function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      void saveDraft();
    }, AUTOSAVE_MS);
  }

  async function refreshHtmlPreview() {
    if (loading.value || !templateId()) return;
    syncAllTableLayoutsInPlace();
    htmlPreviewLoading.value = true;
    htmlPreviewError.value = '';
    try {
      const meta = templateMeta.value || {};
      htmlPreview.value = await renderHtmlPreview(templateId(), {
        jsonDefinition: cloneDefinition(definition.value),
        pageSettings: buildPageSettingsPayload(),
        recordModuleKey: meta.moduleScope,
        recordId: previewRecordId.value || undefined
      });
    } catch (error) {
      htmlPreviewError.value = error?.message || 'Preview failed';
      htmlPreview.value = '';
    } finally {
      htmlPreviewLoading.value = false;
    }
  }

  async function load() {
    loading.value = true;
    suppressAutosave = true;
    try {
      const data = await fetchTemplate(templateId());
      templateMeta.value = data;
      definition.value = applySyncedTableLayouts(
        cloneDefinition(data.draftDefinition || blankPageDefinition()),
        pageWidthPx.value,
        pageHeightPx.value
      );
      selectedId.value = null;
      selectedIds.value = [];
      past.value = [];
      future.value = [];

      const restored = loadBuilderHistory(templateId());
      if (restored?.past?.length) {
        past.value = restored.past.map((entry) => cloneDefinition(entry));
        future.value = Array.isArray(restored.future)
          ? restored.future.map((entry) => cloneDefinition(entry))
          : [];
        if (restored.selectedId && findNode(definition.value, restored.selectedId)) {
          selectedId.value = restored.selectedId;
          selectedIds.value = [restored.selectedId];
        }
      }

      saveStatus.value = 'saved';
    } finally {
      suppressAutosave = false;
      loading.value = false;
    }
  }

  async function saveDraft() {
    if (suppressAutosave || loading.value) return;
    saveStatus.value = 'saving';
    try {
      await updateTemplate(templateId(), {
        jsonDefinition: cloneDefinition(definition.value),
        ...buildPageSettingsPayload()
      });
      saveStatus.value = 'saved';
    } catch {
      saveStatus.value = 'error';
    }
  }

  function undo() {
    if (!canUndo.value) return;
    const previous = past.value[past.value.length - 1];
    if (!previous) return;
    past.value = past.value.slice(0, -1);
    future.value = [cloneDefinition(definition.value), ...future.value];
    definition.value = previous;
    saveStatus.value = 'dirty';
    scheduleAutosave();
    persistHistoryState();
  }

  function redo() {
    if (!canRedo.value) return;
    const [next, ...rest] = future.value;
    if (!next) return;
    past.value = [...past.value, cloneDefinition(definition.value)];
    future.value = rest;
    definition.value = next;
    saveStatus.value = 'dirty';
    scheduleAutosave();
    persistHistoryState();
  }

  function selectNode(nodeId, { additive = false } = {}) {
    if (!nodeId) {
      selectedId.value = null;
      selectedIds.value = [];
      persistHistoryState();
      return;
    }

    if (additive) {
      const next = new Set(selectedIds.value);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      selectedIds.value = [...next];
      selectedId.value = selectedIds.value.includes(nodeId)
        ? nodeId
        : (selectedIds.value[selectedIds.value.length - 1] || null);
    } else {
      selectedIds.value = [nodeId];
      selectedId.value = nodeId;
    }
    persistHistoryState();
  }

  function alignSelectedText(align) {
    const ids = selectedIds.value.length ? selectedIds.value : (selectedId.value ? [selectedId.value] : []);
    if (!ids.length) return;

    let next = definition.value;
    for (const id of ids) {
      const node = findNode(next, id);
      if (node?.type !== 'Heading' && node?.type !== 'Paragraph') continue;
      next = updateNode(next, id, {
        style: {
          typography: {
            ...(node.style?.typography || {}),
            textAlign: align || 'left'
          }
        }
      });
    }
    if (next !== definition.value) applyDefinition(next);
  }

  function normalizeChildForLayout(child, { parentId, layout } = {}) {
    const targetParentId = parentId || insertParentId.value;
    if (layoutMode.value !== BUILDER_LAYOUT_MODES.ABSOLUTE || targetParentId !== definition.value.id) {
      return child;
    }

    const parent = targetParentId === definition.value.id
      ? definition.value
      : findNode(definition.value, targetParentId);
    const siblings = parent?.children || [];
    let normalizedChild = ensureNodeLayout(child, siblings, pageWidthPx.value, pageHeightPx.value);
    if (layout) {
      normalizedChild = {
        ...normalizedChild,
        layout: {
          ...(normalizedChild.layout || {}),
          ...layout
        }
      };
    }
    if (normalizedChild.type === 'Table') {
      normalizedChild = {
        ...normalizedChild,
        layout: resolveSyncedTableLayout(
          normalizedChild,
          pageWidthPx.value,
          pageHeightPx.value
        )
      };
    }
    return normalizedChild;
  }

  function addComponent(child, { parentId, index, layout } = {}) {
    const targetParentId = parentId || insertParentId.value;
    const normalizedChild = normalizeChildForLayout(child, { parentId: targetParentId, layout });
    const next = typeof index === 'number'
      ? insertChildAt(definition.value, targetParentId, index, normalizedChild)
      : addChild(definition.value, targetParentId, normalizedChild);
    applyDefinition(next);
    selectedId.value = normalizedChild.id;
    selectedIds.value = [normalizedChild.id];
  }

  function addComponentByType(componentType, { parentId, index, layout } = {}) {
    const moduleScope = String(templateMeta.value?.moduleScope || '');
    const node = createCatalogComponentNode(componentType, { moduleScope });
    if (!node) return;
    addComponent(node, { parentId, index, layout });
  }

  function removeById(nodeId) {
    const id = String(nodeId || '').trim();
    if (!id || id === definition.value.id) return;
    const node = findNode(definition.value, id);
    if (!node || isNodeLocked(node)) return;
    const next = removeNode(definition.value, id);
    if (next === definition.value) return;
    applyDefinition(next);
    if (selectedId.value === id) selectedId.value = null;
    selectedIds.value = selectedIds.value.filter((entry) => entry !== id);
    persistHistoryState();
  }

  function duplicateById(nodeId) {
    if (!nodeId || nodeId === definition.value.id) return;
    const node = findNode(definition.value, nodeId);
    if (isNodeLocked(node)) return;
    let { root: next, newNodeId } = duplicateNode(definition.value, nodeId);
    if (newNodeId && layoutMode.value === BUILDER_LAYOUT_MODES.ABSOLUTE && node?.layout) {
      const copy = findNode(next, newNodeId);
      if (copy) {
        next = updateNode(next, newNodeId, {
          layout: {
            ...(copy.layout || {}),
            x: Number(copy.layout?.x || 0) + 16,
            y: Number(copy.layout?.y || 0) + 16,
            zIndex: Number(copy.layout?.zIndex || 0) + 1
          }
        });
      }
    }
    applyDefinition(next);
    if (newNodeId) {
      selectedId.value = newNodeId;
      selectedIds.value = [newNodeId];
    }
  }

  function removeSelected() {
    const ids = selectedIds.value.length
      ? [...selectedIds.value]
      : (selectedId.value ? [selectedId.value] : []);
    if (!ids.length) return;

    let next = definition.value;
    for (const id of ids) {
      const node = findNode(next, id);
      if (!node || isNodeLocked(node) || id === next.id) continue;
      next = removeNode(next, id);
    }
    if (next === definition.value) return;
    applyDefinition(next);
    selectedId.value = null;
    selectedIds.value = [];
    persistHistoryState();
  }

  function patchSelected(patch) {
    if (!selectedId.value) return;
    const node = findNode(definition.value, selectedId.value);
    if (isNodeLocked(node)) return;
    const finalPatch = finalizeAbsoluteBlockPatch(node, patch);
    applyDefinition(updateNode(definition.value, selectedId.value, finalPatch));
  }

  function patchNodeById(nodeId, patch) {
    if (!nodeId || nodeId === definition.value.id) return;
    const node = findNode(definition.value, nodeId);
    if (isNodeLocked(node)) return;
    const finalPatch = finalizeAbsoluteBlockPatch(node, patch);
    applyDefinition(updateNode(definition.value, nodeId, finalPatch));
  }

  function patchNodeLayout(nodeId, layoutPatch, { live = false } = {}) {
    if (!nodeId || nodeId === definition.value.id) return;
    const node = findNode(definition.value, nodeId);
    if (isNodeLocked(node)) return;
    const nextLayout = clampLayoutToContentArea(
      {
        ...(node.layout || {}),
        ...layoutPatch
      },
      pageContentArea.value
    );
    const finalPatch = finalizeAbsoluteBlockPatch(node, { layout: nextLayout });
    applyDefinition(updateNode(definition.value, nodeId, finalPatch), { recordHistory: !live });
  }

  function setLayoutMode(mode) {
    if (mode !== BUILDER_LAYOUT_MODES.FLOW && mode !== BUILDER_LAYOUT_MODES.ABSOLUTE) return;
    if (mode === layoutMode.value) return;

    let next = cloneDefinition(definition.value);
    if (mode === BUILDER_LAYOUT_MODES.ABSOLUTE) {
      next = migrateFlowChildrenToAbsolute(next, pageWidthPx.value, pageHeightPx.value);
    } else {
      next.bindings = {
        ...(next.bindings || {}),
        layoutMode: BUILDER_LAYOUT_MODES.FLOW
      };
    }
    applyDefinition(next);
  }

  function addParagraphBlock(text = '') {
    const child = {
      id: createNodeId('paragraph'),
      type: 'Paragraph',
      name: 'Paragraph',
      bindings: { text },
      style: {},
      children: []
    };
    addComponent(child);
    return child.id;
  }

  function insertParagraphAfter(nodeId, text = '') {
    const root = definition.value;
    const children = root.children || [];
    const index = children.findIndex((child) => child.id === nodeId);
    const child = {
      id: createNodeId('paragraph'),
      type: 'Paragraph',
      name: 'Paragraph',
      bindings: { text },
      style: {},
      children: []
    };
    addComponent(child, {
      parentId: root.id,
      index: index >= 0 ? index + 1 : undefined
    });
    return child.id;
  }

  function toggleHidden(nodeId) {
    if (!nodeId || nodeId === definition.value.id) return;
    applyDefinition(toggleNodeVisibility(definition.value, nodeId));
  }

  function toggleLocked(nodeId) {
    if (!nodeId || nodeId === definition.value.id) return;
    applyDefinition(toggleNodeLocked(definition.value, nodeId));
  }

  function setPreviewRecord(recordId, label = '') {
    previewRecordId.value = recordId || '';
    previewRecordLabel.value = label || '';
  }

  function insertMergeTag(path, { nodeId } = {}) {
    const target = nodeId ? findNode(definition.value, nodeId) : selectedNode.value;
    if (target?.type === 'Paragraph' || target?.type === 'Heading') {
      const currentText = String(target.bindings?.text || '');
      const token = `{{${path}}}`;
      applyDefinition(updateNode(definition.value, target.id, {
        bindings: {
          ...target.bindings,
          text: currentText ? `${currentText} ${token}` : token
        }
      }));
      selectedId.value = target.id;
      return;
    }

    addComponent({
      id: createNodeId('merge'),
      type: 'MergeTag',
      name: path,
      bindings: { path, format: 'text' },
      style: {},
      children: []
    });
  }

  function patchTableCell(nodeId, row, col, cellPatch, options = {}) {
    const node = findNode(definition.value, nodeId);
    if (node?.type !== 'Table') return;

    const gridBindings = normalizeTableGridBindings(node.bindings);
    if (!gridBindings.grid[row]?.[col] && !options.setDataRow) return;

    let nextBindings = options.setDataRow
      ? gridBindings
      : updateCell(gridBindings, row, col, cellPatch);

    if (options.setDataRow) {
      nextBindings = setRepeatRowIndex(
        { ...nextBindings, collection: nextBindings.collection || 'lines' },
        row
      );
    } else if (cellPatch.text != null && rowContainsLineMergeTags(nextBindings.grid[row])) {
      nextBindings = setRepeatRowIndex(
        { ...nextBindings, collection: nextBindings.collection || 'lines' },
        row
      );
    }

    patchNodeById(nodeId, {
      bindings: buildTableBindingsPatch(node.bindings, nextBindings)
    });
    selectedId.value = nodeId;
  }

  function rowContainsLineMergeTags(row) {
    return Array.isArray(row) && row.some((cell) => /\{\{\s*lines\./i.test(String(cell?.text || '')));
  }

  function insertMergeTagIntoTableCell(path, nodeId, row, col) {
    const node = findNode(definition.value, nodeId);
    if (node?.type !== 'Table') return;

    const gridBindings = normalizeTableGridBindings(node.bindings);
    const cell = gridBindings.grid[row]?.[col];
    if (!cell) return;

    const token = `{{${path}}}`;
    const currentText = String(cell.text || '');
    const text = currentText ? `${currentText} ${token}` : token;
    let nextBindings = updateCell(gridBindings, row, col, { text });

    if (/^lines\.[A-Za-z0-9_]+/.test(String(path || ''))) {
      nextBindings = setRepeatRowIndex(
        { ...nextBindings, collection: nextBindings.collection || 'lines' },
        row
      );
    }

    patchNodeById(nodeId, {
      bindings: buildTableBindingsPatch(node.bindings, nextBindings)
    });
    selectedId.value = nodeId;
  }

  function assignMergeTagToTableColumn(nodeId, columnIndex, mergePath) {
    const node = findNode(definition.value, nodeId);
    if (node?.type !== 'Table' || typeof columnIndex !== 'number') return;

    const collection = String(node.bindings?.collection || 'lines');
    const prefix = `${collection}.`;
    let path = String(mergePath || '');
    if (path.startsWith(prefix)) {
      path = path.slice(prefix.length);
    } else {
      const segments = path.split('.');
      if (segments[0] === collection && segments.length > 1) {
        path = segments.slice(1).join('.');
      } else {
        path = segments[segments.length - 1] || path;
      }
    }

    const columns = Array.isArray(node.bindings?.columns)
      ? node.bindings.columns.map((column, index) =>
          index === columnIndex ? { ...column, path } : column
        )
      : [];
    patchNodeById(nodeId, { bindings: { ...node.bindings, columns } });
    selectedId.value = nodeId;
  }

  function handleBuilderDrop(payload, { parentId, targetNodeId, index, columnIndex } = {}) {
    if (!payload) return;

    if (payload.kind === 'component' && payload.type) {
      addComponentByType(payload.type, { parentId, index });
      return;
    }

    if (payload.kind === 'merge-tag' && payload.path) {
      const target = targetNodeId ? findNode(definition.value, targetNodeId) : selectedNode.value;
      if (target?.type === 'Table' && typeof columnIndex === 'number') {
        assignMergeTagToTableColumn(targetNodeId, columnIndex, payload.path);
        return;
      }
      if (target?.type === 'Paragraph' || target?.type === 'Heading') {
        insertMergeTag(payload.path, { nodeId: target.id });
      } else {
        insertMergeTag(payload.path);
      }
    }
  }

  function reorderCanvas(orderedIds) {
    if (layoutMode.value === BUILDER_LAYOUT_MODES.ABSOLUTE) {
      const children = definition.value.children || [];
      const next = cloneDefinition(definition.value);
      next.children = applyZIndexFromOrder(orderedIds, children);
      applyDefinition(next);
      return;
    }
    applyDefinition(reorderPageChildren(definition.value, orderedIds));
  }

  function reorderChildrenAt(parentId, orderedIds) {
    applyDefinition(reorderChildren(definition.value, parentId, orderedIds));
  }

  async function previewPdf() {
    previewBusy.value = true;
    try {
      await saveDraft();
      const meta = templateMeta.value || {};
      await previewRenderedTemplate(templateId(), {
        preview: true,
        recordModuleKey: meta.moduleScope,
        recordId: previewRecordId.value || undefined,
        fileName: `${String(meta.name || 'template')}.pdf`
      });
    } finally {
      previewBusy.value = false;
    }
  }

  watch(templateId, () => {
    if (templateId()) void load();
  });

  return {
    templateMeta,
    definition,
    layoutMode,
    pageWidthPx,
    selectedId,
    selectedIds,
    selectedNode,
    insertParentLabel,
    componentCount,
    loading,
    saveStatus,
    previewBusy,
    htmlPreview,
    htmlPreviewLoading,
    htmlPreviewError,
    previewRecordId,
    previewRecordLabel,
    canUndo,
    canRedo,
    load,
    saveDraft,
    undo,
    redo,
    selectNode,
    alignSelectedText,
    addComponent,
    addComponentByType,
    removeById,
    duplicateById,
    removeSelected,
    patchSelected,
    patchNodeById,
    patchNodeLayout,
    setLayoutMode,
    addParagraphBlock,
    insertParagraphAfter,
    toggleHidden,
    toggleLocked,
    setPreviewRecord,
    handleBuilderDrop,
    reorderCanvas,
    reorderChildrenAt,
    insertMergeTag,
    insertMergeTagIntoTableCell,
    patchTableCell,
    previewPdf,
    refreshHtmlPreview,
    updatePageSettings,
    buildPageSettingsPayload
  };
}
