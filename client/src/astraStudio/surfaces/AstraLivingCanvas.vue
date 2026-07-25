<script setup lang="ts">
/**
 * Astra Living Canvas — polished board embedded in main /astra (not a separate app).
 * Visual language aligned to Generative Canvas reference: hero + KPIs + soft cards + floating ask.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ArrowLeftIcon,
  ShareIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/vue/24/outline';
import WidgetFrame from '@/astraStudio/engine/WidgetFrame.vue';
import WidgetHost from '@/astraStudio/widgets/WidgetHost.vue';
import AstraLogo from '@/astra/components/AstraLogo.vue';
import type { CanvasMeta, CanvasWidget, WidgetFrame as WidgetFrameBox } from '@/astraStudio/types';
import {
  applyOps,
  createCanvas,
  getCanvas,
  hydrateCanvas,
  updateCanvas,
} from '@/astraStudio/api/studioApi';
import { useStudioCollab } from '@/astraStudio/composables/useStudioCollab';
import { useStudioAsk } from '@/astraStudio/composables/useStudioAsk';
import {
  LIVING_BOARD_GAP,
  LIVING_BOARD_WIDTH,
  applyLivingGravity,
  framesOverlap,
  livingBoardHeight,
  packLivingWidgets,
  shouldAutoPackLiving,
  resolveLivingFrame,
  resolveLivingLayoutPush,
  snapLivingColumns,
} from '@/astraStudio/engine/packLivingLayout';
import {
  sortWidgetsForFlow,
  widgetHasRenderableContent,
} from '@/astraStudio/widgets/widgetContent';

const props = defineProps<{
  /** Optional seed prompt when opening from Astra chat */
  seedPrompt?: string;
  /** Optional CRM focus for the generated canvas */
  seedFocus?: { moduleKey?: string; recordId?: string; recordName?: string };
  /** Explicit canvas to resume (from ?id=). Without this, always create a new board. */
  resumeId?: string;
  /** Show sidebar expand control in the canvas hero when Astra rail is collapsed */
  showSidebarExpand?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  'expand-sidebar': [];
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const canvasId = ref<string | undefined>(undefined);
const meta = ref<CanvasMeta | null>(null);
const selectedId = ref<string | null>(null);
const camera = ref({ x: 24, y: 24, zoom: 1 });
const chatInput = ref('');
const askInputRef = ref<HTMLInputElement | null>(null);
const creating = ref(false);
const pendingPrompt = ref(false);
const loadError = ref('');
const showAddMenu = ref(false);
const addError = ref('');
let cameraSaveTimer: ReturnType<typeof setTimeout> | null = null;

const collab = useStudioCollab(canvasId);
const { askStudio, asking, error: askError } = useStudioAsk(canvasId);

const canEditCanvas = computed(() => Boolean(collab.canEdit.value || collab.connected.value));
const widgetList = computed(() => Object.values(collab.widgets.value));

const visibleWidgets = computed(() => {
  // While editing, keep empty panels visible (user-added shells must appear).
  // In read-only view, hide unfilled template shells.
  const source = canEditCanvas.value
    ? widgetList.value
    : widgetList.value.filter((w) => widgetHasRenderableContent(w));
  return sortWidgetsForFlow(source);
});

/** Live layout while dragging — obstacles shift before drop. */
const liveFrames = ref<Record<string, WidgetFrameBox>>({});
const previewDragId = ref<string | null>(null);
let previewRaf = 0;
let pendingPreview: { widgetId: string; frame: CanvasWidget['frame'] } | null = null;

const boardWidgets = computed(() => {
  const live = liveFrames.value;
  if (!Object.keys(live).length) return visibleWidgets.value;
  return visibleWidgets.value.map((w) => {
    const frame = live[w.id];
    return frame ? { ...w, frame } : w;
  });
});

const boardHeight = computed(() => livingBoardHeight(boardWidgets.value));

const selectedWidget = computed(() =>
  selectedId.value ? collab.widgets.value[selectedId.value] || null : null,
);

const selectedWidgetTitle = computed(() => {
  const w = selectedWidget.value;
  if (!w) return '';
  return String(w.config?.title || w.type?.split('.').pop() || t('astraStudio.widgetFallbackTitle'));
});

const askPlaceholder = computed(() => {
  if (selectedWidgetTitle.value) {
    return t('astraStudio.livingAskWidgetPlaceholder', { title: selectedWidgetTitle.value });
  }
  return t('astraStudio.livingAskPlaceholder');
});

function onSelectWidget(widgetId: string): void {
  selectedId.value = widgetId;
  requestAnimationFrame(() => {
    askInputRef.value?.focus();
  });
}

function clearAskWidgetContext(): void {
  selectedId.value = null;
}

function onBoardBackgroundClick(): void {
  selectedId.value = null;
}

function applyLivePreview(widgetId: string, frame: CanvasWidget['frame']): void {
  previewDragId.value = widgetId;
  // Column-snapped physics so neighbors slide up as soon as you leave a column.
  // Dragged card still renders at the free pointer position.
  const physicsFrame = snapLivingColumns(frame);
  const withActive = widgetList.value.map((w) => ({
    id: w.id,
    frame: w.id === widgetId ? physicsFrame : w.frame,
  }));
  const updates = resolveLivingLayoutPush(widgetId, physicsFrame, withActive, {
    freeActive: true,
  });
  const next: Record<string, WidgetFrameBox> = {};
  for (const row of updates) {
    next[row.id] = row.id === widgetId ? { ...frame } : row.frame;
  }
  liveFrames.value = next;
}

function clearLivePreview(): void {
  if (previewRaf) {
    cancelAnimationFrame(previewRaf);
    previewRaf = 0;
  }
  pendingPreview = null;
  liveFrames.value = {};
  previewDragId.value = null;
}

let autoPackRan = false;
let markingArranged = false;

async function markUserArranged(): Promise<void> {
  if (!canvasId.value || markingArranged) return;
  if (meta.value?.layoutMeta?.userArranged) return;
  markingArranged = true;
  try {
    const next = {
      ...(meta.value?.layoutMeta || {}),
      userArranged: true,
      packed: true,
    };
    await updateCanvas(canvasId.value, { layoutMeta: next });
    if (meta.value) meta.value = { ...meta.value, layoutMeta: next };
  } catch {
    // local drag still works
  } finally {
    markingArranged = false;
  }
}

async function autoPackIfNeeded(): Promise<void> {
  if (autoPackRan || !canvasId.value || !canEditCanvas.value) return;
  const widgets = widgetList.value;
  if (widgets.length < 2) return;
  const layout = meta.value?.layoutMeta || {};
  const crowded = widgets.some((a, i) =>
    widgets.some((b, j) => j > i && framesOverlap(a.frame, b.frame, LIVING_BOARD_GAP)),
  );
  const rowTemplate = shouldAutoPackLiving(widgets);

  // User layout wins unless cards are actually overlapping/crowded
  if (layout.userArranged && !crowded) {
    autoPackRan = true;
    return;
  }

  const gravity = applyLivingGravity(widgets.map((w) => ({ id: w.id, frame: w.frame })));
  const needsGravity = gravity.some((g) => {
    const cur = widgets.find((w) => w.id === g.id);
    return Boolean(cur && g.frame.y < (cur.frame?.y || 0) - 8);
  });

  // Close vertical gaps even on already-packed boards (never rewrite user sizes)
  if (!rowTemplate && !crowded && needsGravity) {
    autoPackRan = true;
    for (const row of gravity) {
      collab.applyLocalWidgetUpdate(row.id, { frame: row.frame });
    }
    try {
      await applyOps(
        canvasId.value,
        gravity.map((row) => ({ op: 'updateWidget', widgetId: row.id, frame: row.frame })),
      );
    } catch {
      // local gravity already applied
    }
    return;
  }
  if (layout.packed && !rowTemplate && !crowded) {
    autoPackRan = true;
    return;
  }
  if (!rowTemplate && !crowded) {
    autoPackRan = true;
    return;
  }

  autoPackRan = true;
  const packed = packLivingWidgets(widgets);
  for (const row of packed) {
    collab.applyLocalWidgetUpdate(row.id, { frame: row.frame });
  }
  try {
    await applyOps(
      canvasId.value,
      packed.map((row) => ({ op: 'updateWidget', widgetId: row.id, frame: row.frame })),
    );
    const next = { ...layout, packed: true, userArranged: false };
    await updateCanvas(canvasId.value, { layoutMeta: next });
    if (meta.value) meta.value = { ...meta.value, layoutMeta: next };
  } catch {
    // local pack already applied
  }
}

watch(
  () => [canvasId.value, widgetList.value.length, collab.connected.value, meta.value?.layoutMeta?.packed],
  () => {
    if (!collab.connected.value || !widgetList.value.length) return;
    void autoPackIfNeeded();
  },
);

watch(canvasId, () => {
  autoPackRan = false;
});

const showBoardShimmer = computed(
  () =>
    creating.value
    || asking.value
    || pendingPrompt.value
    || (Boolean(props.seedPrompt) && !canvasId.value)
    || (
      Boolean(props.seedPrompt || props.seedFocus?.recordId)
      && Boolean(canvasId.value)
      && !visibleWidgets.value.length
      && !loadError.value
    ),
);

const focusSummary = computed(() => {
  const focus = meta.value?.focus || [];
  if (!focus.length) return null;
  const primary = focus[0];
  return {
    moduleKey: primary?.moduleKey || '',
    recordId: primary?.recordId || '',
    label: focus.map((f) => f.moduleKey).filter(Boolean).join(' · '),
  };
});

const kpiItems = computed(() => {
  const widgets = visibleWidgets.value;
  const focus = meta.value?.focus || [];
  const deal = focus.find((f) => /deal/i.test(String(f.moduleKey || '')));
  const person = focus.find((f) => /people|person|contact/i.test(String(f.moduleKey || '')));
  const org = focus.find((f) => /org|account/i.test(String(f.moduleKey || '')));
  const riskBody = widgets.find((w) => w.type === 'ai.risk');
  const riskLines = String(riskBody?.config?.body || riskBody?.ai?.text || '')
    .split('\n')
    .filter((l) => l.trim().startsWith('•') || l.trim().startsWith('-'));

  return [
    {
      label: t('astraStudio.kpiFocus'),
      value: deal || org || person
        ? String((deal || org || person)?.moduleKey || '—').replace(/s$/, '')
        : /executive_report|quarterly_business_review/i.test(String(meta.value?.canvasType || ''))
          ? t('astraStudio.kpiFocusOrg')
          : t('astraStudio.kpiFocusNone'),
    },
    {
      label: t('astraStudio.kpiPanels'),
      value: String(widgets.length),
    },
    {
      label: t('astraStudio.kpiRisks'),
      value: riskLines.length ? String(riskLines.length) : (riskBody ? '1' : '0'),
    },
    {
      label: t('astraStudio.kpiStatus'),
      value: collab.connected.value ? t('astraStudio.kpiLive') : t('astraStudio.kpiOffline'),
    },
  ];
});

const subtitle = computed(() => {
  const label = focusSummary.value?.label;
  if (label) {
    return t('astraStudio.livingSubtitleFocused', { focus: label });
  }
  return t('astraStudio.livingSubtitle');
});

const quickAddTypes = [
  'ai.summary',
  'ai.insights',
  'ai.risk',
  'ai.recommendations',
  'crm.deal',
  'crm.contact',
  'comms.meeting_notes',
  'analytics.kpi',
  'content.checklist',
] as const;

const presentWidgetTypes = computed(() => {
  const set = new Set<string>();
  for (const w of widgetList.value) {
    if (w?.type) set.add(String(w.type));
  }
  return set;
});

const availableAddTypes = computed(() =>
  quickAddTypes.filter((wt) => !presentWidgetTypes.value.has(wt)),
);

function inferCanvasType(prompt: string, moduleKey?: string): string {
  const mk = String(moduleKey || '').toLowerCase();
  const q = String(prompt || '').toLowerCase();
  // Prompt signals beat moduleKey — meeting-with-person must not become customer_360.
  if (/war\s*room|opportun|deal\s+health|win\s+strateg|advance\b.*\b(deal|proposal|stage)|to\s+proposal/.test(q)) {
    return 'opportunity_war_room';
  }
  if (mk === 'deals' || mk === 'deal') return 'opportunity_war_room';
  if (/support|investigation|root\s+cause/.test(q) || mk === 'cases' || mk === 'case') {
    return 'support_investigation';
  }
  if (/\bqbr\b|quarterly\s+business/.test(q)) return 'quarterly_business_review';
  if (/executive\s+report|board\s+report/.test(q)) return 'executive_report';
  if (/account\s+plan/.test(q)) return 'account_planning';
  if (/renewal/.test(q)) return 'renewal_workspace';
  if (/success\s+plan|onboarding\s+plan/.test(q)) return 'customer_success_plan';
  if (/project\s+workspace|implementation\s+roadmap/.test(q)) return 'project_workspace';
  if (/workflow|process\s+diagram/.test(q)) return 'workflow_design';
  if (/brainstorm|swot|mind\s*map|sticky/.test(q)) return 'brainstorming';
  if (/strateg/.test(q)) return 'strategy_workspace';
  if (
    /\bmeet(?:ing|ng)?\b|\bprep(?:are)?\b|\bwith\s+['"“]|for\s+['"“]/.test(q)
    || mk === 'tasks'
    || mk === 'quotes'
  ) {
    return 'meeting_preparation';
  }
  if (
    /customer\s*360|account\s+360|analyze\s+(this\s+)?customer/.test(q)
    || mk === 'organizations'
    || mk === 'organization'
    || mk === 'people'
  ) {
    return 'customer_360';
  }
  return 'blank';
}

async function syncCanvasIdInUrl(id: string): Promise<void> {
  if (String(route.query.id || '') === id) return;
  await router.replace({
    query: {
      ...route.query,
      view: 'canvas',
      id,
    },
  });
}

/** Always create a fresh board — never reopen the latest canvas. Resume only via resumeId/?id=. */
async function ensureCanvas(prompt?: string): Promise<void> {
  const seed = String(prompt || props.seedPrompt || '').trim();
  const hasFocus = Boolean(props.seedFocus?.moduleKey && props.seedFocus?.recordId);
  if (!seed && !hasFocus) {
    // Wait for the user to describe the workspace — do not create Untitled blanks.
    pendingPrompt.value = true;
    creating.value = false;
    return;
  }

  creating.value = true;
  pendingPrompt.value = false;
  loadError.value = '';
  try {
    const title = seed.slice(0, 120) || t('astraStudio.untitledCanvas');
    const focus =
      props.seedFocus?.moduleKey && props.seedFocus?.recordId
        ? [{ moduleKey: props.seedFocus.moduleKey, recordId: props.seedFocus.recordId }]
        : undefined;
    const { canvas } = await createCanvas({
      title,
      canvasType: inferCanvasType(seed, props.seedFocus?.moduleKey),
      focus,
      generate: true,
      prompt: seed || undefined,
    });
    canvasId.value = canvas._id;
    await syncCanvasIdInUrl(canvas._id);
    await loadMeta();
  } catch (err: unknown) {
    const e = err as { message?: string };
    loadError.value = e?.message || t('astraStudio.loadFailed');
  } finally {
    creating.value = false;
  }
}

async function loadMeta(): Promise<void> {
  if (!canvasId.value) return;
  try {
    const detail = await getCanvas(canvasId.value);
    meta.value = detail.canvas;
    if (detail.canvas.layoutMeta) {
      camera.value = {
        x: detail.canvas.layoutMeta.cameraX ?? 24,
        y: detail.canvas.layoutMeta.cameraY ?? 24,
        zoom: detail.canvas.layoutMeta.zoom ?? 1,
      };
    }
    await maybeRepairSoftFocus(detail.canvas);
    await maybeRepairEmptyBoard(detail.canvas, detail.summary?.widgetCount);
  } catch (err: unknown) {
    const e = err as { message?: string };
    loadError.value = e?.message || t('astraStudio.loadFailed');
  }
}

const PARTY_FOCUS_RE = /people|person|contact|org|account|deal/i;
let softFocusRepairAttempted = false;
let emptyBoardRepairAttempted = false;

function isSoftFocusOnly(focus: CanvasMeta['focus']): boolean {
  const rows = Array.isArray(focus) ? focus : [];
  if (!rows.length) return false;
  return !rows.some((f) => PARTY_FOCUS_RE.test(String(f?.moduleKey || '')));
}

/** Re-hydrate canvases stuck on events/tasks focus so CRM widgets can bind. */
async function maybeRepairSoftFocus(canvas: CanvasMeta): Promise<void> {
  if (!canvasId.value || softFocusRepairAttempted) return;
  if (!isSoftFocusOnly(canvas.focus)) return;
  softFocusRepairAttempted = true;
  try {
    const repaired = await hydrateCanvas(canvasId.value, {
      prompt: String(canvas.title || props.seedPrompt || ''),
    });
    if (repaired?.canvas) {
      meta.value = repaired.canvas;
      // Pull fresh Yjs widget payloads after server rewrite
      collab.disconnect();
      collab.connect();
    }
  } catch {
    // keep soft-focus canvas as-is
  }
}

/** Seed meeting-prep (etc.) widgets when the board was created as blank / empty. */
async function maybeRepairEmptyBoard(
  canvas: CanvasMeta,
  widgetCount?: number,
): Promise<void> {
  if (!canvasId.value || emptyBoardRepairAttempted) return;
  const count = typeof widgetCount === 'number' ? widgetCount : -1;
  const typedBlank = String(canvas.canvasType || '') === 'blank';
  if (count > 0) return;
  if (count < 0 && !typedBlank) return;
  emptyBoardRepairAttempted = true;
  creating.value = true;
  try {
    const repaired = await hydrateCanvas(canvasId.value, {
      prompt: String(canvas.title || props.seedPrompt || ''),
      force: true,
    });
    if (repaired?.canvas) {
      meta.value = repaired.canvas;
      collab.disconnect();
      collab.connect();
    }
  } catch {
    // leave empty board
  } finally {
    creating.value = false;
  }
}

function onFrameUpdate(
  widgetId: string,
  frame: CanvasWidget['frame'],
  meta: { phase?: 'preview' | 'commit' } = {},
): void {
  const phase = meta.phase || 'commit';

  if (phase === 'preview') {
    pendingPreview = { widgetId, frame };
    if (previewRaf) return;
    previewRaf = requestAnimationFrame(() => {
      previewRaf = 0;
      const pending = pendingPreview;
      pendingPreview = null;
      if (pending) applyLivePreview(pending.widgetId, pending.frame);
    });
    return;
  }

  // Commit: resolve, write Yjs + persist via ops so refresh keeps sizes
  const withActive = widgetList.value.map((w) => ({
    id: w.id,
    frame: w.id === widgetId ? frame : w.frame,
  }));
  const updates = resolveLivingLayoutPush(widgetId, frame, withActive);
  const settled: Record<string, WidgetFrameBox> = {};
  const ops: Array<{ op: 'updateWidget'; widgetId: string; frame: WidgetFrameBox }> = [];
  for (const row of updates) {
    settled[row.id] = row.frame;
    const prev = widgetList.value.find((w) => w.id === row.id)?.frame;
    if (
      prev
      && prev.x === row.frame.x
      && prev.y === row.frame.y
      && prev.w === row.frame.w
      && prev.h === row.frame.h
    ) {
      continue;
    }
    collab.applyLocalWidgetUpdate(row.id, { frame: row.frame });
    ops.push({ op: 'updateWidget', widgetId: row.id, frame: row.frame });
  }
  // Hold settled frames so widgets don't flash to pre-drag positions
  liveFrames.value = settled;
  previewDragId.value = null;
  if (previewRaf) {
    cancelAnimationFrame(previewRaf);
    previewRaf = 0;
  }
  pendingPreview = null;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      liveFrames.value = {};
    });
  });
  if (ops.length && canvasId.value) {
    void applyOps(canvasId.value, ops).catch(() => {
      // Yjs already updated locally
    });
  }
  void markUserArranged();
}

async function onDeleteWidget(widgetId: string): Promise<void> {
  collab.removeWidget(widgetId);
  try {
    if (canvasId.value) await applyOps(canvasId.value, [{ op: 'removeWidget', widgetId }]);
  } catch {
    // local remove already applied
  }
  if (selectedId.value === widgetId) selectedId.value = null;
}

function seedConfigForType(type: string): Record<string, unknown> {
  const label = (type.split('.').pop() || type).replace(/_/g, ' ');
  const title = label.charAt(0).toUpperCase() + label.slice(1);
  if (type === 'content.checklist') {
    return {
      title: 'Action items',
      items: [
        { id: '1', label: 'Confirm next step', done: false },
        { id: '2', label: 'Assign owner', done: false },
      ],
    };
  }
  if (type === 'analytics.kpi' || type.startsWith('analytics.')) {
    return { title, metrics: [] };
  }
  if (type.startsWith('viz.timeline')) {
    return {
      title,
      items: [{ id: '1', label: 'Add timeline events', at: new Date().toISOString() }],
    };
  }
  if (type.startsWith('ai.') || type.startsWith('comms.') || type.startsWith('content.')) {
    return {
      title,
      body: '• Ask Astra to fill this panel\n• Or double-click to edit',
    };
  }
  if (type.startsWith('crm.')) {
    return { title };
  }
  return { title };
}

async function onAddWidget(type: string): Promise<void> {
  if (!canvasId.value || !canEditCanvas.value) return;
  showAddMenu.value = false;
  if (presentWidgetTypes.value.has(type)) {
    addError.value = t('astraStudio.widgetAlreadyOnCanvas');
    return;
  }
  addError.value = '';
  const id = `w_${Math.random().toString(16).slice(2, 10)}`;
  const others = widgetList.value.map((w) => w.frame);
  const frame = resolveLivingFrame(
    {
      x: 16,
      y: Math.max(16, livingBoardHeight(widgetList.value) - 16),
      w: 340,
      h: 260,
      z: 1,
    },
    others,
  );
  const widget: CanvasWidget = {
    id,
    type,
    frame,
    config: seedConfigForType(type),
    collapsed: false,
  };
  // Optimistic local insert so the panel appears even if WS/Redis blips
  collab.upsertLocalWidget(widget);
  void markUserArranged();
  try {
    await applyOps(canvasId.value, [{ op: 'addWidget', widget }]);
  } catch (err: unknown) {
    const e = err as { message?: string };
    addError.value = e?.message || t('astraStudio.addWidgetFailed');
  }
}

const lastAskNote = ref('');
const shareNote = ref('');
let shareNoteTimer: ReturnType<typeof setTimeout> | null = null;

function canvasShareUrl(): string {
  const id = canvasId.value;
  if (!id) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/astra?view=canvas&id=${encodeURIComponent(id)}`;
}

async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy copy
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function flashShareNote(message: string): void {
  shareNote.value = message;
  if (shareNoteTimer) clearTimeout(shareNoteTimer);
  shareNoteTimer = setTimeout(() => {
    shareNote.value = '';
    shareNoteTimer = null;
  }, 2500);
}

async function onShare(): Promise<void> {
  if (!canvasId.value) {
    flashShareNote(t('astraStudio.shareNeedCanvas'));
    return;
  }
  const url = canvasShareUrl();
  const ok = await copyText(url);
  if (ok) {
    flashShareNote(t('astraStudio.shareCopied'));
    return;
  }
  // Last resort: prompt so the user can still copy
  try {
    window.prompt(t('astraStudio.shareCopyManual'), url);
  } catch {
    flashShareNote(t('astraStudio.shareFailed'));
  }
}

async function onAsk(): Promise<void> {
  const text = chatInput.value.trim();
  if (!text || asking.value) return;
  chatInput.value = '';
  lastAskNote.value = '';
  addError.value = '';
  if (!canvasId.value) {
    await ensureCanvas(text);
    if (!canvasId.value) return;
    collab.connect();
  }
  const target = selectedWidget.value;
  const result = await askStudio(text, {
    targetWidgetId: target?.id,
    targetWidgetTitle: selectedWidgetTitle.value || undefined,
  });
  const claim = Array.isArray(result?.raw?.claims)
    ? (result?.raw as { claims?: Array<{ text?: string }> }).claims?.[0]?.text
    : '';
  lastAskNote.value = claim || result?.answer || '';
}

watch(
  camera,
  (cam) => {
    if (!canvasId.value || !meta.value) return;
    if (cameraSaveTimer) clearTimeout(cameraSaveTimer);
    cameraSaveTimer = setTimeout(() => {
      void updateCanvas(canvasId.value!, {
        layoutMeta: { cameraX: cam.x, cameraY: cam.y, zoom: cam.zoom },
      });
    }, 800);
  },
  { deep: true },
);

watch(canvasId, (id, prev) => {
  if (prev) collab.disconnect();
  softFocusRepairAttempted = false;
  emptyBoardRepairAttempted = false;
  if (id) {
    collab.connect();
    void loadMeta();
  }
});

onMounted(async () => {
  const idParam = String(props.resumeId || route.query.id || '').trim();
  if (idParam) {
    canvasId.value = idParam;
    await syncCanvasIdInUrl(idParam);
    collab.connect();
    await loadMeta();
  } else {
    await ensureCanvas(props.seedPrompt);
    if (canvasId.value) collab.connect();
  }
});

onUnmounted(() => {
  collab.disconnect();
  if (cameraSaveTimer) clearTimeout(cameraSaveTimer);
});

defineExpose({ ensureCanvas, canvasId });
</script>

<template>
  <div class="living-canvas relative flex h-full min-h-0 flex-col overflow-hidden dark:bg-neutral-950">
    <!-- Building: logo only -->
    <div
      v-if="showBoardShimmer"
      class="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6"
    >
      <div class="astra-hero-logo flex items-center justify-center">
        <AstraLogo size="hero" />
      </div>
      <p class="text-base font-medium tracking-[-0.01em] text-neutral-600 dark:text-neutral-300">
        {{ t('astraStudio.buildingCanvas') }}
      </p>
      <p v-if="loadError" class="mt-2 max-w-md text-center text-sm text-red-600">{{ loadError }}</p>
    </div>

    <template v-else>
    <!-- Hero -->
    <header class="relative z-20 shrink-0 px-5 pb-3 pt-4 sm:px-8 sm:pt-6">
      <div class="mx-auto flex max-w-7xl flex-wrap items-start gap-4">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <button
            v-if="showSidebarExpand"
            type="button"
            class="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-neutral-500 ring-1 ring-black/[0.05] backdrop-blur transition hover:bg-white hover:text-neutral-800 dark:bg-neutral-900/70 dark:ring-white/10 md:inline-flex"
            :aria-label="t('astra.sidebarExpand')"
            :title="t('astra.sidebarExpand')"
            @click="emit('expand-sidebar')"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="2.25" stroke="currentColor" stroke-width="1.5" />
              <path d="M9.25 5v14" stroke="currentColor" stroke-width="1.5" />
              <path d="M5.75 9h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <path d="M5.75 12h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <path d="M5.75 15h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
          <button
            type="button"
            class="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/70 text-neutral-500 ring-1 ring-black/[0.05] backdrop-blur transition hover:bg-white hover:text-neutral-800 dark:bg-neutral-900/70 dark:ring-white/10"
            :aria-label="t('astraStudio.backToChat')"
            @click="emit('back')"
          >
            <ArrowLeftIcon class="h-4 w-4" />
          </button>

          <div class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/80 ring-1 ring-black/[0.05] dark:bg-neutral-900 dark:ring-white/10">
            <AstraLogo size="md" />
          </div>
          <div class="min-w-0 pt-0.5">
            <h1 class="truncate text-[1.35rem] font-semibold tracking-[-0.03em] text-neutral-900 dark:text-white sm:text-[1.65rem]">
              {{ meta?.title || t('astraStudio.untitledCanvas') }}
            </h1>
            <p class="mt-1 max-w-2xl text-[13px] leading-snug text-neutral-500 dark:text-neutral-400">
              {{ subtitle }}
            </p>
            <p class="mt-2 text-[11px] tracking-wide text-neutral-400">
              {{ collab.connected ? t('astraStudio.connected') : t('astraStudio.disconnected') }}
              <span class="mx-1.5 text-neutral-300">·</span>
              {{ canEditCanvas ? t('astraStudio.canEdit') : t('astraStudio.viewOnly') }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-stretch overflow-hidden rounded-2xl bg-white/75 ring-1 ring-black/[0.05] backdrop-blur dark:bg-neutral-900/75 dark:ring-white/10">
            <div
              v-for="(kpi, idx) in kpiItems"
              :key="kpi.label"
              class="min-w-[4.25rem] px-3.5 py-2.5"
              :class="idx > 0 ? 'border-l border-black/[0.05] dark:border-white/10' : ''"
            >
              <p class="text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{{ kpi.label }}</p>
              <p class="mt-0.5 text-sm font-semibold tracking-tight text-neutral-900 dark:text-white">{{ kpi.value }}</p>
            </div>
          </div>
          <button
            type="button"
            class="relative inline-flex h-9 items-center gap-1.5 rounded-2xl bg-white/75 px-3.5 text-xs font-medium text-neutral-600 ring-1 ring-black/[0.05] backdrop-blur transition hover:bg-white hover:text-neutral-900 dark:bg-neutral-900/75 dark:text-neutral-200 dark:ring-white/10"
            :class="shareNote ? 'text-primary-700 ring-primary-200 dark:text-primary-300' : ''"
            @click="onShare"
          >
            <CheckIcon v-if="shareNote" class="h-3.5 w-3.5" />
            <ShareIcon v-else class="h-3.5 w-3.5" />
            {{ shareNote || t('astraStudio.share') }}
          </button>
          <div class="relative">
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/75 text-neutral-600 ring-1 ring-black/[0.05] backdrop-blur transition hover:bg-white dark:bg-neutral-900/75 dark:ring-white/10"
              :aria-label="t('astraStudio.addWidget')"
              @click="showAddMenu = !showAddMenu"
            >
              <PlusIcon class="h-4 w-4" />
            </button>
            <div
              v-if="showAddMenu"
              class="absolute right-0 z-30 mt-2 w-52 rounded-2xl bg-white/95 p-1 shadow-xl ring-1 ring-black/5 backdrop-blur dark:bg-neutral-900 dark:ring-white/10"
            >
              <button
                v-for="wt in availableAddTypes"
                :key="wt"
                type="button"
                class="block w-full rounded-xl px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-white/5"
                @click="onAddWidget(wt)"
              >
                {{ wt }}
              </button>
              <p
                v-if="!availableAddTypes.length"
                class="px-3 py-2 text-[11px] text-neutral-400"
              >
                {{ t('astraStudio.allWidgetsOnCanvas') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>

    <p v-if="loadError" class="px-6 py-2 text-sm text-red-600">{{ loadError }}</p>
    <p v-if="askError || addError" class="px-6 py-1 text-sm text-red-600">{{ askError || addError }}</p>
    <p v-if="lastAskNote && !askError" class="px-6 py-1 text-center text-xs text-primary-700 dark:text-primary-300">
      {{ lastAskNote }}
    </p>

    <!-- Freeform board — auto-packed by default; drag anywhere after -->
    <main class="relative min-h-0 flex-1 overflow-auto" @click="onBoardBackgroundClick">
      <div
        v-if="canvasId"
        class="living-board relative mx-auto"
        :style="{
          width: `${LIVING_BOARD_WIDTH}px`,
          maxWidth: '100%',
          height: `${boardHeight}px`,
          minHeight: '70vh',
        }"
      >
        <WidgetFrame
          v-for="w in boardWidgets"
          :key="w.id"
          :widget="w"
          :selected="selectedId === w.id"
          :can-edit="canEditCanvas"
          :smooth-reflow="previewDragId !== null && previewDragId !== w.id"
          variant="living"
          layout="absolute"
          @select="onSelectWidget(w.id)"
          @delete="onDeleteWidget(w.id)"
          @collapse="(c) => collab.applyLocalWidgetUpdate(w.id, { collapsed: c })"
          @update:frame="(f, meta) => onFrameUpdate(w.id, f, meta)"
        >
          <WidgetHost
            :widget="w"
            :can-edit="canEditCanvas"
            @update:config="(cfg) => collab.applyLocalWidgetUpdate(w.id, { config: { ...w.config, ...cfg } })"
          />
        </WidgetFrame>
        <p
          v-if="!boardWidgets.length"
          class="absolute inset-x-0 top-24 text-center text-sm text-neutral-500"
        >
          {{ collab.connected.value ? t('astraStudio.boardEmpty') : t('astraStudio.loading') }}
        </p>
      </div>
      <div
        v-else
        class="flex h-full items-center justify-center text-sm text-neutral-500"
      >
        {{ t('astraStudio.loading') }}
      </div>
    </main>

    <!-- Floating Ask bar -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-6 pt-20">
      <div class="pointer-events-auto w-full max-w-2xl">
        <div
          v-if="selectedWidget"
          class="mb-2 flex justify-center"
        >
          <div
            class="inline-flex max-w-full items-center gap-2 rounded-full border border-primary-200/80 bg-white/90 py-1 pl-3 pr-1.5 text-xs shadow-sm backdrop-blur dark:border-primary-500/30 dark:bg-neutral-900/90"
          >
            <span class="truncate font-medium text-primary-700 dark:text-primary-300">
              {{ t('astraStudio.livingAskContextChip', { title: selectedWidgetTitle }) }}
            </span>
            <button
              type="button"
              class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-white/10 dark:hover:text-neutral-200"
              :aria-label="t('astraStudio.livingAskContextClear')"
              @click="clearAskWidgetContext"
            >
              <XMarkIcon class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <form
          class="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 p-1.5 shadow-[0_8px_40px_rgba(15,23,42,0.10)] ring-1 ring-black/[0.04] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/85 dark:ring-white/10"
          :class="selectedWidget ? 'ring-2 ring-primary-400/40' : ''"
          @submit.prevent="onAsk"
        >
          <span class="ml-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-white">
            <SparklesIcon class="h-4 w-4" />
          </span>
          <input
            ref="askInputRef"
            v-model="chatInput"
            type="text"
            class="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-white"
            :placeholder="askPlaceholder"
            :disabled="asking || creating"
          >
          <button
            type="submit"
            class="mr-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-500 text-white transition hover:bg-primary-600 disabled:opacity-40 dark:bg-primary-500 dark:hover:bg-primary-600"
            :disabled="asking || creating || !chatInput.trim()"
            :aria-label="t('astraStudio.send')"
          >
            <PaperAirplaneIcon class="h-4 w-4 -rotate-45" />
          </button>
        </form>
        <p class="mt-2.5 text-center text-[10px] tracking-wide text-neutral-400">
          {{ t('astraStudio.livingAiDisclaimer') }}
        </p>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.living-canvas {
  background:
    radial-gradient(1100px 560px at 8% -12%, rgb(245 243 255 / 0.95), transparent 55%),
    radial-gradient(900px 480px at 92% 0%, rgb(237 233 254 / 0.55), transparent 50%),
    linear-gradient(180deg, #f7f6fc 0%, #f3f4f6 52%, #f5f3ff 100%);
}
:global(html.dark) .living-canvas {
  background:
    radial-gradient(1000px 500px at 10% -10%, rgb(96 73 231 / 0.18), transparent 55%),
    linear-gradient(180deg, #0a0a0b 0%, #111214 100%);
}
.astra-hero-logo {
  position: relative;
  display: inline-flex;
  isolation: isolate;
}
.astra-hero-logo::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgb(255 255 255 / 0.12) 40%,
    rgb(255 255 255 / 0.85) 50%,
    rgb(255 255 255 / 0.12) 60%,
    transparent 100%
  );
  background-size: 220% 100%;
  animation: astra-hero-logo-shimmer 2.8s linear infinite;
  pointer-events: none;
  -webkit-mask-image: url('/assets/logo/Ai%20Logo.svg');
  mask-image: url('/assets/logo/Ai%20Logo.svg');
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  will-change: background-position;
}
:global(html.dark) .astra-hero-logo::after {
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgb(255 255 255 / 0.1) 40%,
    rgb(255 255 255 / 0.7) 50%,
    rgb(255 255 255 / 0.1) 60%,
    transparent 100%
  );
  background-size: 220% 100%;
}
@keyframes astra-hero-logo-shimmer {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}
.living-board {
  /* Ask bar clearance is baked into boardHeight; keep a little extra scroll room */
  box-sizing: content-box;
  padding-left: 1rem;
  padding-right: 1rem;
  padding-bottom: 1rem;
}
</style>
