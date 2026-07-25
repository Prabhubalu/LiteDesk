import { ref, shallowRef, onUnmounted, type Ref } from 'vue';
import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import type { CanvasWidget, StudioPeer } from '@/astraStudio/types';

export type StudioDataMessage = Record<string, unknown> & { type?: string };

function buildWsUrl(canvasId: string, token: string): string {
  const httpBase = getApiUrlForFetch('/api/astra/studio/ws');
  const base =
    typeof window !== 'undefined' && !httpBase.startsWith('http')
      ? `${window.location.origin}${httpBase}`
      : httpBase;
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.search = new URLSearchParams({
    token,
    canvasId,
  }).toString();
  return url.toString();
}

function readWidgetsMap(widgetsMap: Y.Map<unknown>): Record<string, CanvasWidget> {
  const out: Record<string, CanvasWidget> = {};
  widgetsMap.forEach((raw, id) => {
    const normalized = normalizeWidget(raw, id);
    if (normalized) out[id] = normalized;
  });
  return out;
}

function normalizeWidget(raw: unknown, id: string): CanvasWidget | null {
  if (!raw || typeof raw !== 'object') return null;
  // Y.Map stored widget
  if (raw instanceof Y.Map) {
    const obj: Record<string, unknown> = {};
    raw.forEach((v, k) => {
      obj[k] = v;
    });
    return {
      id,
      type: String(obj.type || 'generic'),
      frame: (obj.frame as CanvasWidget['frame']) || { x: 0, y: 0, w: 320, h: 200, z: 1 },
      config: (obj.config as Record<string, unknown>) || {},
      collapsed: Boolean(obj.collapsed),
      sectionId: obj.sectionId as string | undefined,
      bindings: obj.bindings as CanvasWidget['bindings'],
      ai: obj.ai as CanvasWidget['ai'],
    };
  }
  const w = raw as CanvasWidget;
  return {
    ...w,
    id,
    type: w.type || 'generic',
    frame: w.frame || { x: 0, y: 0, w: 320, h: 200, z: 1 },
    config: w.config || {},
  };
}

function syncWidgetsFromDoc(doc: Y.Doc, target: Ref<Record<string, CanvasWidget>>): void {
  const root = doc.getMap('root');
  const widgetsMap = root.get('widgets');
  if (!(widgetsMap instanceof Y.Map)) {
    target.value = {};
    return;
  }
  target.value = readWidgetsMap(widgetsMap);
}

function peersFromAwareness(awareness: Awareness): StudioPeer[] {
  const peers: StudioPeer[] = [];
  awareness.getStates().forEach((state, clientId) => {
    const user = state?.user as StudioPeer['user'] | undefined;
    const cursor = state?.cursor as StudioPeer['cursor'] | undefined;
    peers.push({ clientId, user, cursor });
  });
  return peers;
}

export function useStudioCollab(canvasId: Ref<string | undefined>) {
  const doc = shallowRef<Y.Doc | null>(null);
  const awareness = shallowRef<Awareness | null>(null);
  const widgets = ref<Record<string, CanvasWidget>>({});
  const peers = ref<StudioPeer[]>([]);
  const connected = ref(false);
  const canEdit = ref(false);
  const lastDataMessage = ref<StudioDataMessage | null>(null);

  let socket: WebSocket | null = null;
  let localClientId: number | null = null;

  const dataListeners = new Set<(msg: StudioDataMessage) => void>();

  function onDataMessage(msg: StudioDataMessage): void {
    lastDataMessage.value = msg;
    if (msg.type === 'ready' && typeof msg.canEdit === 'boolean') {
      canEdit.value = msg.canEdit;
    }
    for (const fn of dataListeners) fn(msg);
  }

  function connect(): void {
    const id = canvasId.value;
    if (!id || socket) return;
    const authStore = useAuthStore();
    const token = authStore.user?.token;
    if (!token) return;

    const ydoc = new Y.Doc();
    const aw = new Awareness(ydoc);
    doc.value = ydoc;
    awareness.value = aw;
    localClientId = ydoc.clientID;

    const root = ydoc.getMap('root');
    const bindWidgetObservers = (): void => {
      const wm = root.get('widgets');
      if (wm instanceof Y.Map) {
        wm.observeDeep(() => {
          syncWidgetsFromDoc(ydoc, widgets);
        });
      }
    };
    root.observe(bindWidgetObservers);
    bindWidgetObservers();
    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (!canEdit.value) return;
      if (origin === 'remote' || origin === socket) return;
      if (socket?.readyState === WebSocket.OPEN) {
        const frame = new Uint8Array(update.length + 1);
        frame[0] = 0;
        frame.set(update, 1);
        socket.send(frame);
      }
    });

    aw.on('update', (change: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      const { added, updated, removed } = change;
      peers.value = peersFromAwareness(aw);
      if (origin === 'remote' || origin === socket) return;
      if (socket?.readyState !== WebSocket.OPEN) return;
      const changed = added.concat(updated, removed);
      const update = encodeAwarenessUpdate(aw, changed);
      const frame = new Uint8Array(update.length + 1);
      frame[0] = 1;
      frame.set(update, 1);
      socket.send(frame);
    });

    syncWidgetsFromDoc(ydoc, widgets);
    peers.value = peersFromAwareness(aw);

    const ws = new WebSocket(buildWsUrl(id, token));
    ws.binaryType = 'arraybuffer';
    socket = ws;

    ws.onopen = () => {
      connected.value = true;
    };

    ws.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
      if (typeof event.data === 'string') return;
      const buf = new Uint8Array(event.data);
      if (buf.length < 2) return;
      const type = buf[0];
      const payload = buf.subarray(1);
      if (type === 0) {
        Y.applyUpdate(ydoc, payload, 'remote');
        syncWidgetsFromDoc(ydoc, widgets);
      } else if (type === 1) {
        applyAwarenessUpdate(aw, payload, 'remote');
        peers.value = peersFromAwareness(aw);
      } else if (type === 2) {
        try {
          const text = new TextDecoder().decode(payload);
          const parsed = JSON.parse(text) as StudioDataMessage;
          onDataMessage(parsed);
        } catch {
          // ignore
        }
      }
    };

    ws.onclose = () => {
      connected.value = false;
    };

    ws.onerror = () => {
      connected.value = false;
    };
  }

  function disconnect(): void {
    if (socket) {
      socket.close();
      socket = null;
    }
    if (awareness.value && localClientId != null) {
      removeAwarenessStates(awareness.value, [localClientId], 'disconnect');
    }
    doc.value?.destroy();
    doc.value = null;
    awareness.value = null;
    connected.value = false;
    widgets.value = {};
    peers.value = [];
  }

  function applyLocalWidgetUpdate(widgetId: string, patch: Partial<CanvasWidget>): void {
    const ydoc = doc.value;
    if (!ydoc || !canEdit.value) return;
    const root = ydoc.getMap('root');
    let widgetsMap = root.get('widgets');
    if (!(widgetsMap instanceof Y.Map)) {
      widgetsMap = new Y.Map<unknown>();
      root.set('widgets', widgetsMap);
    }
    const map = widgetsMap as Y.Map<unknown>;
    const existing = map.get(widgetId) as CanvasWidget | undefined;
    if (!existing) return;
    const base = normalizeWidget(existing, widgetId);
    if (!base) return;
    ydoc.transact(() => {
      map.set(widgetId, {
        ...base,
        ...patch,
        id: widgetId,
        frame: patch.frame
          ? { ...base.frame, ...patch.frame }
          : base.frame,
        config: patch.config
          ? { ...base.config, ...patch.config }
          : base.config,
      });
    });
    syncWidgetsFromDoc(ydoc, widgets);
  }

  function upsertLocalWidget(widget: CanvasWidget): void {
    const ydoc = doc.value;
    if (!ydoc || !widget?.id) return;
    const root = ydoc.getMap('root');
    let widgetsMap = root.get('widgets');
    if (!(widgetsMap instanceof Y.Map)) {
      widgetsMap = new Y.Map<unknown>();
      root.set('widgets', widgetsMap);
    }
    const map = widgetsMap as Y.Map<unknown>;
    const prev = canEdit.value;
    canEdit.value = true;
    try {
      ydoc.transact(() => {
        map.set(widget.id, {
          ...widget,
          id: widget.id,
          frame: widget.frame || { x: 48, y: 48, w: 340, h: 260, z: 1 },
          config: widget.config || {},
          collapsed: Boolean(widget.collapsed),
        });
      });
      syncWidgetsFromDoc(ydoc, widgets);
    } finally {
      canEdit.value = prev || true;
    }
  }

  function removeWidget(widgetId: string): boolean {
    const ydoc = doc.value;
    if (!ydoc) {
      const next = { ...widgets.value };
      delete next[widgetId];
      widgets.value = next;
      return false;
    }
    const root = ydoc.getMap('root');
    const widgetsMap = root.get('widgets');
    if (!(widgetsMap instanceof Y.Map) || !widgetsMap.has(widgetId)) {
      const next = { ...widgets.value };
      delete next[widgetId];
      widgets.value = next;
      return false;
    }
    // Force canEdit so the outbound Yjs update is sent over WS
    const prev = canEdit.value;
    canEdit.value = true;
    try {
      ydoc.transact(() => {
        widgetsMap.delete(widgetId);
      });
      syncWidgetsFromDoc(ydoc, widgets);
    } finally {
      canEdit.value = prev || true;
    }
    return true;
  }

  function setLocalCursor(x: number, y: number): void {
    awareness.value?.setLocalStateField('cursor', { x, y });
  }

  function onDataChannel(listener: (msg: StudioDataMessage) => void): () => void {
    dataListeners.add(listener);
    return () => dataListeners.delete(listener);
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    doc,
    awareness,
    widgets,
    peers,
    connected,
    canEdit,
    lastDataMessage,
    connect,
    disconnect,
    applyLocalWidgetUpdate,
    upsertLocalWidget,
    removeWidget,
    setLocalCursor,
    onDataChannel,
  };
}
