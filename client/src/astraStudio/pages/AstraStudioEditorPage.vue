<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import CanvasViewport from '@/astraStudio/engine/CanvasViewport.vue';
import WidgetFrame from '@/astraStudio/engine/WidgetFrame.vue';
import WidgetHost from '@/astraStudio/widgets/WidgetHost.vue';
import { WIDGET_TYPES, type CanvasMeta, type CanvasWidget } from '@/astraStudio/types';
import {
  applyOps,
  createComment,
  createRevision,
  exportCanvas,
  getCanvas,
  listComments,
  listRevisions,
  listSuggestions,
  restoreRevision,
  resolveSuggestion,
  updateCanvas,
} from '@/astraStudio/api/studioApi';
import { useStudioCollab } from '@/astraStudio/composables/useStudioCollab';
import { useStudioAsk } from '@/astraStudio/composables/useStudioAsk';

const { t } = useI18n();
const route = useRoute();

const canvasId = computed(() => String(route.params.canvasId || ''));
const meta = ref<CanvasMeta | null>(null);
const selectedId = ref<string | null>(null);
const camera = ref({ x: 40, y: 40, zoom: 1 });
const chatInput = ref('');
const chatLog = ref<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
const suggestions = ref<Array<{ _id: string; title?: string; body?: string; message?: string }>>([]);
const comments = ref<Array<{ _id: string; body: string; authorName?: string }>>([]);
const revisions = ref<Array<{ _id: string; versionNumber: number }>>([]);
const commentDraft = ref('');
const loadError = ref('');
let cameraSaveTimer: ReturnType<typeof setTimeout> | null = null;

const collab = useStudioCollab(canvasId);
const { askStudio, asking, error: askError } = useStudioAsk(canvasId);

const widgetList = computed(() => Object.values(collab.widgets.value));

/** Cull off-screen widgets for 500+ widget performance (Wave 5). */
const visibleWidgets = computed(() => {
  const margin = 400;
  const z = camera.value.zoom || 1;
  const viewLeft = -camera.value.x / z - margin;
  const viewTop = -camera.value.y / z - margin;
  const viewRight = viewLeft + (typeof window !== 'undefined' ? window.innerWidth / z : 2000) + margin * 2;
  const viewBottom = viewTop + (typeof window !== 'undefined' ? window.innerHeight / z : 1200) + margin * 2;
  return widgetList.value.filter((w) => {
    const f = w.frame || { x: 0, y: 0, w: 100, h: 100 };
    const right = f.x + (f.w || 100);
    const bottom = f.y + (f.h || 100);
    return right >= viewLeft && f.x <= viewRight && bottom >= viewTop && f.y <= viewBottom;
  });
});

const selectedWidget = computed(() =>
  selectedId.value ? collab.widgets.value[selectedId.value] : null,
);

const remotePeers = computed(() =>
  collab.peers.value.filter((p) => p.user?.id),
);

/** Prefer WS canEdit; fall back to true while Live so chrome actions stay available. */
const canEditCanvas = computed(() => Boolean(collab.canEdit.value || collab.connected.value));

async function loadMeta(): Promise<void> {
  loadError.value = '';
  try {
    const detail = await getCanvas(canvasId.value);
    meta.value = detail.canvas;
    if (detail.canvas.layoutMeta) {
      camera.value = {
        x: detail.canvas.layoutMeta.cameraX ?? 40,
        y: detail.canvas.layoutMeta.cameraY ?? 40,
        zoom: detail.canvas.layoutMeta.zoom ?? 1,
      };
    }
    const [sug, com, rev] = await Promise.all([
      listSuggestions(canvasId.value),
      listComments(canvasId.value),
      listRevisions(canvasId.value),
    ]);
    suggestions.value = sug.items || [];
    comments.value = com.items || [];
    revisions.value = rev.items || [];
  } catch (err: unknown) {
    const e = err as { message?: string };
    loadError.value = e?.message || t('astraStudio.loadFailed');
  }
}

function onFrameUpdate(widgetId: string, frame: CanvasWidget['frame']): void {
  collab.applyLocalWidgetUpdate(widgetId, { frame });
}

function onConfigUpdate(widgetId: string, config: Record<string, unknown>): void {
  collab.applyLocalWidgetUpdate(widgetId, { config });
}

async function onDeleteWidget(widgetId: string): Promise<void> {
  // Primary: mutate local Yjs (syncs over WS + server persistence)
  const removed = collab.removeWidget(widgetId);
  // Backup: REST ops so delete persists even if WS is down
  try {
    await applyOps(canvasId.value, [{ op: 'removeWidget', widgetId }]);
  } catch (err) {
    console.warn('[astra-studio] removeWidget REST failed', err);
    if (!removed) {
      loadError.value = t('astraStudio.deleteFailed');
    }
  }
  if (selectedId.value === widgetId) selectedId.value = null;
}

async function onAddWidget(type: string): Promise<void> {
  if (widgetList.value.some((w) => String(w.type) === type)) return;
  const id = `w_${Math.random().toString(16).slice(2, 10)}`;
  const widget: CanvasWidget = {
    id,
    type,
    frame: { x: 80 + widgetList.value.length * 24, y: 80, w: 320, h: 220, z: 1 },
    config: { title: type },
    collapsed: false,
  };
  await applyOps(canvasId.value, [{ op: 'addWidget', widget }]);
}

async function onAsk(): Promise<void> {
  const text = chatInput.value.trim();
  if (!text) return;
  chatLog.value.push({ role: 'user', text });
  chatInput.value = '';
  const result = await askStudio(text);
  if (result?.answer) {
    chatLog.value.push({ role: 'assistant', text: result.answer });
  }
}

async function onSaveCheckpoint(): Promise<void> {
  await createRevision(canvasId.value, 'manual');
  const rev = await listRevisions(canvasId.value);
  revisions.value = rev.items || [];
}

async function onRestore(version: number): Promise<void> {
  await restoreRevision(canvasId.value, version);
  collab.disconnect();
  collab.connect();
  await loadMeta();
}

async function onExport(format: 'html' | 'pdf' | 'docx' | 'pptx' | 'xlsx'): Promise<void> {
  const job = await exportCanvas(canvasId.value, format);
  if (job?.content && typeof job.content === 'string' && format === 'html') {
    const blob = new Blob([job.content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return;
  }
  if (typeof job?.contentBase64 === 'string') {
    const bin = atob(job.contentBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: String(job.contentType || 'application/octet-stream') });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas.${format}`;
    a.click();
  }
}

async function onPostComment(): Promise<void> {
  const body = commentDraft.value.trim();
  if (!body) return;
  await createComment(canvasId.value, body);
  commentDraft.value = '';
  const com = await listComments(canvasId.value);
  comments.value = com.items || [];
}

async function onResolveSuggestion(id: string, action: 'accept' | 'dismiss'): Promise<void> {
  await resolveSuggestion(canvasId.value, id, action);
  const sug = await listSuggestions(canvasId.value);
  suggestions.value = sug.items || [];
}

watch(
  camera,
  (cam) => {
    if (!meta.value) return;
    if (cameraSaveTimer) clearTimeout(cameraSaveTimer);
    cameraSaveTimer = setTimeout(() => {
      void updateCanvas(canvasId.value, {
        layoutMeta: { cameraX: cam.x, cameraY: cam.y, zoom: cam.zoom },
      });
    }, 800);
  },
  { deep: true },
);

watch(canvasId, () => {
  collab.disconnect();
  collab.connect();
  void loadMeta();
});

collab.onDataChannel((msg) => {
  if (msg.type === 'widget.refresh' || msg.type === 'canvas_updated' || msg.type === 'refresh') {
    // Live CRM payloads — widgets refetch; layout stays in Yjs
  }
  if (msg.type === 'suggestion.created') {
    void listSuggestions(canvasId.value).then((sug) => {
      suggestions.value = sug.items || [];
    });
  }
});

onMounted(() => {
  collab.connect();
  void loadMeta();
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-neutral-50 dark:bg-neutral-950">
    <header class="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-4 py-2 dark:border-white/10">
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          {{ meta?.title || t('astraStudio.untitledCanvas') }}
        </h1>
        <p class="text-xs text-neutral-500">
          {{ collab.connected ? t('astraStudio.connected') : t('astraStudio.disconnected') }}
          · {{ canEditCanvas ? t('astraStudio.canEdit') : t('astraStudio.viewOnly') }}
        </p>
      </div>
      <div class="flex items-center gap-1">
        <span
          v-for="peer in remotePeers.slice(0, 5)"
          :key="peer.clientId"
          class="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
          :style="{ backgroundColor: peer.user?.color || '#6366f1' }"
          :title="peer.user?.name"
        >
          {{ (peer.user?.name || '?').slice(0, 1) }}
        </span>
      </div>
      <div class="flex gap-2">
        <button type="button" class="rounded-lg px-2 py-1 text-xs ring-1 ring-neutral-200 dark:ring-white/10" @click="onSaveCheckpoint">
          {{ t('astraStudio.saveRevision') }}
        </button>
        <button type="button" class="rounded-lg px-2 py-1 text-xs ring-1 ring-neutral-200 dark:ring-white/10" @click="onExport('html')">
          {{ t('astraStudio.export') }}
        </button>
        <button type="button" class="rounded-lg px-2 py-1 text-xs ring-1 ring-neutral-200 dark:ring-white/10" @click="onExport('docx')">
          {{ t('astraStudio.exportDocx') }}
        </button>
        <button type="button" class="rounded-lg px-2 py-1 text-xs ring-1 ring-neutral-200 dark:ring-white/10" @click="onExport('pptx')">
          {{ t('astraStudio.exportPptx') }}
        </button>
      </div>
    </header>

    <p v-if="loadError" class="px-4 py-2 text-sm text-red-600">{{ loadError }}</p>

    <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[12rem_minmax(0,1fr)_16rem_18rem]">
      <aside class="hidden overflow-y-auto border-r border-neutral-200 p-2 dark:border-white/10 lg:block">
        <p class="mb-2 text-xs font-semibold uppercase text-neutral-500">{{ t('astraStudio.palette') }}</p>
        <button
          v-for="wt in WIDGET_TYPES.slice(0, 24)"
          :key="wt"
          type="button"
          class="mb-1 w-full truncate rounded-lg px-2 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-white/5"
          :disabled="!canEditCanvas"
          @click="onAddWidget(wt)"
        >
          {{ wt }}
        </button>
      </aside>

      <main class="relative min-h-0">
        <CanvasViewport
          :camera-x="camera.x"
          :camera-y="camera.y"
          :zoom="camera.zoom"
          :selected-id="selectedId"
          :peers="collab.peers.value"
          @update:camera="(c) => { camera.x = c.x; camera.y = c.y; camera.zoom = c.zoom; }"
          @select="(id) => (selectedId = id)"
          @cursor-move="(p) => collab.setLocalCursor(p.x, p.y)"
        >
          <WidgetFrame
            v-for="w in visibleWidgets"
            :key="w.id"
            :widget="w"
            :selected="selectedId === w.id"
            :can-edit="canEditCanvas"
            @select="selectedId = w.id"
            @delete="onDeleteWidget(w.id)"
            @collapse="(c) => collab.applyLocalWidgetUpdate(w.id, { collapsed: c })"
            @update:frame="(f) => onFrameUpdate(w.id, f)"
          >
            <WidgetHost
              :widget="w"
              :can-edit="canEditCanvas"
              @update:config="(cfg) => onConfigUpdate(w.id, cfg)"
            />
          </WidgetFrame>
        </CanvasViewport>
      </main>

      <aside class="overflow-y-auto border-l border-neutral-200 p-3 text-sm dark:border-white/10">
        <section class="mb-4">
          <h2 class="mb-2 text-xs font-semibold uppercase text-neutral-500">{{ t('astraStudio.inspector') }}</h2>
          <pre v-if="selectedWidget" class="overflow-x-auto rounded bg-neutral-100 p-2 text-xs dark:bg-white/5">{{ selectedWidget.type }}</pre>
          <p v-else class="text-neutral-500">{{ t('astraStudio.selectWidget') }}</p>
        </section>
        <section class="mb-4">
          <h2 class="mb-2 text-xs font-semibold uppercase text-neutral-500">{{ t('astraStudio.suggestions') }}</h2>
          <div v-for="s in suggestions" :key="s._id" class="mb-2 rounded-lg border border-neutral-200 p-2 dark:border-white/10">
            <p class="font-medium">{{ s.message || s.title || s.body }}</p>
            <div class="mt-1 flex gap-2">
              <button type="button" class="text-xs text-indigo-600" @click="onResolveSuggestion(s._id, 'accept')">{{ t('astraStudio.accept') }}</button>
              <button type="button" class="text-xs text-neutral-500" @click="onResolveSuggestion(s._id, 'dismiss')">{{ t('astraStudio.dismiss') }}</button>
            </div>
          </div>
        </section>
        <section class="mb-4">
          <h2 class="mb-2 text-xs font-semibold uppercase text-neutral-500">{{ t('astraStudio.comments') }}</h2>
          <div v-for="c in comments" :key="c._id" class="mb-2 text-xs">
            <span class="font-medium">{{ c.authorName || t('astraStudio.anonymous') }}:</span>
            {{ c.body }}
          </div>
          <textarea v-model="commentDraft" class="w-full rounded border border-neutral-200 p-2 text-xs dark:border-white/10" rows="2" />
          <button type="button" class="mt-1 text-xs text-indigo-600" @click="onPostComment">{{ t('astraStudio.postComment') }}</button>
        </section>
        <section>
          <h2 class="mb-2 text-xs font-semibold uppercase text-neutral-500">{{ t('astraStudio.revisions') }}</h2>
          <button
            v-for="r in revisions"
            :key="r._id"
            type="button"
            class="mb-1 block w-full rounded px-2 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-white/5"
            @click="onRestore(r.versionNumber)"
          >
            v{{ r.versionNumber }}
          </button>
        </section>
      </aside>

      <aside class="flex min-h-0 flex-col border-l border-neutral-200 dark:border-white/10">
        <div class="border-b border-neutral-200 px-3 py-2 text-sm font-semibold dark:border-white/10">{{ t('astraStudio.askPanel') }}</div>
        <div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm">
          <div v-for="(m, idx) in chatLog" :key="idx" :class="m.role === 'user' ? 'text-right' : ''">
            <span class="inline-block rounded-lg px-2 py-1" :class="m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-white/10'">
              {{ m.text }}
            </span>
          </div>
          <p v-if="asking" class="text-neutral-500">{{ t('astraStudio.asking') }}</p>
          <p v-if="askError" class="text-red-600">{{ askError }}</p>
        </div>
        <div class="border-t border-neutral-200 p-2 dark:border-white/10">
          <textarea v-model="chatInput" rows="2" class="w-full rounded-lg border border-neutral-200 p-2 text-sm dark:border-white/10" :placeholder="t('astraStudio.askPlaceholder')" />
          <button type="button" class="mt-2 w-full rounded-lg bg-indigo-600 py-2 text-sm text-white disabled:opacity-50" :disabled="asking" @click="onAsk">
            {{ t('astraStudio.send') }}
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>
