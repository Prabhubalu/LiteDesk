<script setup lang="ts">
import { computed, onUnmounted, ref, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowPathIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  SparklesIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/vue/24/outline';
import type { CanvasWidget, WidgetFrame } from '@/astraStudio/types';

const props = withDefaults(
  defineProps<{
    widget: CanvasWidget;
    selected?: boolean;
    canEdit?: boolean;
    variant?: 'default' | 'living';
    layout?: 'absolute' | 'flow';
    /** Animate left/top when pushed aside during another widget's drag */
    smoothReflow?: boolean;
  }>(),
  { variant: 'default', layout: 'absolute', smoothReflow: false },
);

const emit = defineEmits<{
  select: [];
  delete: [];
  collapse: [collapsed: boolean];
  refresh: [];
  configure: [];
  'update:frame': [frame: WidgetFrame, meta?: { phase: 'preview' | 'commit' }];
}>();

const { t } = useI18n();
const menuOpen = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const dragging = ref(false);
const resizing = ref(false);
const resizeLive = ref<{ w: number; h: number } | null>(null);
/** Live left/top while dragging — must stay in Vue :style or Vue clears DOM writes. */
const dragPos = ref<{ x: number; y: number } | null>(null);

let detachDrag: (() => void) | null = null;
let detachResize: (() => void) | null = null;

const isInteracting = computed(() => dragging.value || resizing.value);

const frameStyle = computed(() => {
  const frame = props.widget.frame || { x: 0, y: 0, w: 320, h: 200, z: 1 };
  const w = resizeLive.value?.w ?? frame.w ?? 320;
  const h = resizeLive.value?.h ?? frame.h ?? 200;
  const height = props.widget.collapsed ? 'auto' : `${Math.max(120, h)}px`;
  const x = dragPos.value?.x ?? frame.x;
  const y = dragPos.value?.y ?? frame.y;

  if (props.layout === 'flow') {
    return {
      width: `${Math.max(200, w)}px`,
      height,
      maxWidth: '100%',
      flex: '0 0 auto' as const,
    };
  }

  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${Math.max(200, w)}px`,
    height,
    zIndex: isInteracting.value ? 80 : (frame.z ?? 1),
    // Inline transition must not be 'none' for pushed widgets — that kills the slide.
    transition: props.smoothReflow && !isInteracting.value
      ? 'left 280ms cubic-bezier(0.22, 1, 0.36, 1), top 280ms cubic-bezier(0.22, 1, 0.36, 1), width 280ms ease, height 280ms ease'
      : 'none',
    touchAction: 'none' as const,
  };
});

const title = computed(() => {
  const raw = props.widget.config?.title || props.widget.type;
  if (typeof raw === 'string' && raw.includes('.')) {
    return raw.split('.').pop()?.replace(/_/g, ' ') || raw;
  }
  return String(raw || '');
});

type Accent = { iconWrap: string; Icon: Component };

const accent = computed((): Accent => {
  const type = props.widget.type || '';
  if (type.includes('risk') || type.includes('objection')) {
    return { iconWrap: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', Icon: ExclamationTriangleIcon };
  }
  if (type.startsWith('ai.') || type.includes('insight') || type.includes('recommend')) {
    return { iconWrap: 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300', Icon: SparklesIcon };
  }
  if (type.includes('stakeholder') || type.includes('contact') || type.includes('relationship')) {
    return { iconWrap: 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300', Icon: UserGroupIcon };
  }
  if (type.startsWith('crm.') || type.includes('deal')) {
    return { iconWrap: 'bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300', Icon: BriefcaseIcon };
  }
  if (type.startsWith('analytics.') || type.includes('kpi') || type.includes('chart')) {
    return { iconWrap: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300', Icon: ChartBarIcon };
  }
  if (type.startsWith('comms.') || type.includes('meeting') || type.includes('email')) {
    return { iconWrap: 'bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300', Icon: ChatBubbleLeftRightIcon };
  }
  if (type.includes('note') || type.includes('agenda') || type.includes('summary') || type.startsWith('content.')) {
    return { iconWrap: 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300', Icon: DocumentTextIcon };
  }
  if (type.startsWith('viz.') || type.includes('strategy') || type.includes('signal')) {
    return { iconWrap: 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300', Icon: LightBulbIcon };
  }
  return { iconWrap: 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300', Icon: DocumentTextIcon };
});

function cleanupDrag(): void {
  if (detachDrag) {
    detachDrag();
    detachDrag = null;
  }
}

function cleanupResize(): void {
  if (detachResize) {
    detachResize();
    detachResize = null;
  }
}

function onHeaderPointerDown(e: PointerEvent): void {
  if (!props.canEdit || e.button !== 0) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest('button')) return;
  e.preventDefault();
  e.stopPropagation();
  emit('select');
  cleanupDrag();

  const startX = e.clientX;
  const startY = e.clientY;
  const originX = props.widget.frame.x;
  const originY = props.widget.frame.y;
  const originW = props.widget.frame.w;
  const originH = props.widget.frame.h;

  dragging.value = true;
  dragPos.value = { x: originX, y: originY };
  emit('update:frame', {
    ...props.widget.frame,
    x: originX,
    y: originY,
    w: originW,
    h: originH,
  }, { phase: 'preview' });

  const onMove = (ev: PointerEvent) => {
    const x = Math.max(0, originX + (ev.clientX - startX));
    const y = Math.max(0, originY + (ev.clientY - startY));
    dragPos.value = { x, y };
    emit('update:frame', {
      ...props.widget.frame,
      x,
      y,
      w: originW,
      h: originH,
    }, { phase: 'preview' });
  };

  const onUp = (ev: PointerEvent) => {
    cleanupDrag();
    const x = Math.max(0, Math.round(originX + (ev.clientX - startX)));
    const y = Math.max(0, Math.round(originY + (ev.clientY - startY)));
    // Keep visual position until parent commits snapped frame
    dragPos.value = { x, y };
    dragging.value = false;
    emit('update:frame', {
      ...props.widget.frame,
      x,
      y,
      w: originW,
      h: originH,
    }, { phase: 'commit' });
    // Clear after parent has new frame (next tick)
    requestAnimationFrame(() => {
      dragPos.value = null;
    });
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  detachDrag = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
}

function onDeleteClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  menuOpen.value = false;
  emit('delete');
}

function onResizePointerDown(e: PointerEvent, axes: 'both' | 'x' | 'y' = 'both'): void {
  if (!props.canEdit) return;
  e.preventDefault();
  e.stopPropagation();
  cleanupResize();
  resizing.value = true;
  emit('select');

  const start = {
    x: e.clientX,
    y: e.clientY,
    w: props.widget.frame?.w || 320,
    h: props.widget.frame?.h || 200,
    fx: props.widget.frame?.x || 0,
    fy: props.widget.frame?.y || 0,
  };
  const minW = 200;
  const minH = 120;
  resizeLive.value = { w: start.w, h: start.h };

  const emitResize = (w: number, h: number, phase: 'preview' | 'commit') => {
    emit('update:frame', {
      ...props.widget.frame,
      x: start.fx,
      y: start.fy,
      w,
      h,
    }, { phase });
  };

  emitResize(start.w, start.h, 'preview');

  const move = (ev: PointerEvent) => {
    const w = axes === 'y' ? start.w : Math.max(minW, Math.round(start.w + (ev.clientX - start.x)));
    const h = axes === 'x' ? start.h : Math.max(minH, Math.round(start.h + (ev.clientY - start.y)));
    resizeLive.value = { w, h };
    emitResize(w, h, 'preview');
  };

  const up = (ev: PointerEvent) => {
    cleanupResize();
    resizing.value = false;
    const w = axes === 'y' ? start.w : Math.max(minW, Math.round(start.w + (ev.clientX - start.x)));
    const h = axes === 'x' ? start.h : Math.max(minH, Math.round(start.h + (ev.clientY - start.y)));
    resizeLive.value = null;
    emitResize(w, h, 'commit');
  };

  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  detachResize = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
}

onUnmounted(() => {
  cleanupDrag();
  cleanupResize();
});
</script>

<template>
  <div
    ref="rootEl"
    data-studio-widget
    class="group/widget flex flex-col overflow-hidden"
    :class="[
      layout === 'flow' ? 'relative self-start' : 'absolute',
      isInteracting ? 'select-none' : '',
      variant === 'living' || layout === 'flow'
        ? [
            'rounded-[1.25rem] bg-white/95 backdrop-blur-sm',
            'shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_1px_2px_rgba(15,23,42,0.04),0_10px_36px_-14px_rgba(96,73,231,0.10)]',
            'ring-1',
            selected || isInteracting
              ? 'ring-primary-500/35 dark:ring-primary-400/40'
              : 'ring-black/[0.06]',
            isInteracting
              ? 'shadow-[0_16px_48px_-12px_rgba(15,23,42,0.28)]'
              : '',
            'dark:bg-neutral-900/90 dark:ring-white/[0.08]',
          ]
        : [
            'rounded-xl border bg-white shadow-md ring-1 dark:bg-neutral-900',
            selected
              ? 'border-primary-500 ring-primary-500/30'
              : 'border-neutral-200/80 ring-neutral-200/60 dark:border-white/10 dark:ring-white/10',
          ],
    ]"
    :style="frameStyle"
    @click.stop="emit('select')"
  >
    <header
      class="flex shrink-0 items-center gap-3"
      :class="[
        canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        variant === 'living' || layout === 'flow'
          ? 'px-4 pb-1.5 pt-3.5'
          : 'border-b border-neutral-200/70 px-3 py-2.5 dark:border-white/10',
      ]"
      @pointerdown="onHeaderPointerDown"
    >
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
        :class="accent.iconWrap"
      >
        <component :is="accent.Icon" class="h-[1.05rem] w-[1.05rem]" />
      </span>
      <span class="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.02em] text-neutral-900 dark:text-neutral-50">
        {{ title }}
      </span>
      <div class="relative flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          class="rounded-xl p-1.5 text-neutral-400 opacity-0 transition hover:bg-neutral-100/80 hover:text-neutral-700 group-hover/widget:opacity-100 dark:hover:bg-white/10"
          :title="t('astraStudio.moreActions')"
          @click.stop="menuOpen = !menuOpen"
        >
          <EllipsisHorizontalIcon class="h-4 w-4" />
        </button>
        <div
          v-if="menuOpen"
          class="absolute right-0 top-9 z-20 w-36 rounded-2xl bg-white/95 p-1 shadow-xl ring-1 ring-black/5 backdrop-blur dark:bg-neutral-900 dark:ring-white/10"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-white/5"
            @click.stop="menuOpen = false; emit('refresh')"
          >
            <ArrowPathIcon class="h-3.5 w-3.5" />
            {{ t('astraStudio.refreshWidget') }}
          </button>
          <button
            v-if="canEdit"
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            @pointerdown.stop
            @click="onDeleteClick"
          >
            <TrashIcon class="h-3.5 w-3.5" />
            {{ t('astraStudio.deleteWidget') }}
          </button>
        </div>
        <button
          type="button"
          class="rounded-xl p-1.5 text-neutral-400 transition hover:bg-neutral-100/80 hover:text-neutral-700 dark:hover:bg-white/10"
          :title="widget.collapsed ? t('astraStudio.expandWidget') : t('astraStudio.collapseWidget')"
          @click.stop="emit('collapse', !widget.collapsed)"
        >
          <component
            :is="widget.collapsed ? ChevronDownIcon : ChevronUpIcon"
            class="h-4 w-4"
          />
        </button>
      </div>
    </header>
    <div
      v-show="!widget.collapsed"
      class="min-h-0 flex-1 overflow-auto px-4 pb-4 pt-0.5 text-[13.5px] leading-[1.5] text-neutral-600 dark:text-neutral-300"
    >
      <slot />
    </div>
    <template v-if="canEdit && !widget.collapsed">
      <div
        class="absolute bottom-0 right-0 top-8 w-1.5 cursor-ew-resize opacity-0 transition-opacity group-hover/widget:opacity-100"
        :class="resizing ? 'opacity-100 bg-primary-400/40' : 'hover:bg-primary-400/30'"
        @pointerdown.stop="onResizePointerDown($event, 'x')"
      />
      <div
        class="absolute bottom-0 left-8 right-8 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover/widget:opacity-100"
        :class="resizing ? 'opacity-100 bg-primary-400/40' : 'hover:bg-primary-400/30'"
        @pointerdown.stop="onResizePointerDown($event, 'y')"
      />
      <div
        class="absolute bottom-1 right-1 z-10 flex h-4 w-4 cursor-se-resize items-end justify-end rounded-sm opacity-0 transition-opacity group-hover/widget:opacity-100"
        @pointerdown.stop="onResizePointerDown($event, 'both')"
      >
        <span class="h-2.5 w-2.5 rounded-sm border-b-2 border-r-2 border-neutral-400 dark:border-white/40" />
      </div>
    </template>
  </div>
</template>
