<template>
  <span
    ref="triggerRef"
    class="inline-flex"
    v-bind="$attrs"
    @mouseenter="handleShow"
    @mouseleave="handleHide"
    @focusin="handleShow"
    @focusout="handleHide"
  >
    <slot />
  </span>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="tooltipRef"
      :class="[
        'pointer-events-none fixed z-[115] rounded-lg bg-slate-950 px-3 py-2 text-white shadow-2xl text-xs leading-4 text-slate-200',
        wrap ? 'max-w-xs whitespace-normal break-words' : 'whitespace-nowrap',
      ]"
      :style="tooltipStyle"
    >
      <slot name="content">
        {{ content }}
      </slot>
      <span
        :class="[
          'pointer-events-none absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-950',
          placement === 'above' ? 'top-full -mt-1' : 'bottom-full -mb-1'
        ]"
      ></span>
    </div>
  </Teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, onUnmounted } from 'vue';
import { Teleport } from 'vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  /** Tooltip text (used when no content slot) */
  content: {
    type: String,
    default: ''
  },
  /** CSS selector to find anchor element inside trigger (e.g. 'button' for icon center) */
  anchorSelector: {
    type: String,
    default: null
  },
  /** Delay before showing (ms) */
  showDelay: {
    type: Number,
    default: 50
  },
  /** Delay before hiding (ms) */
  hideDelay: {
    type: Number,
    default: 80
  },
  /** Gap between tooltip and trigger (px) */
  gap: {
    type: Number,
    default: 4
  },
  /** Allow multi-line tooltip content (for long labels) */
  wrap: {
    type: Boolean,
    default: false
  },
  /** Suppress tooltip (e.g. when label is not truncated) */
  disabled: {
    type: Boolean,
    default: false
  },
  /** Prefer above/below; auto picks based on viewport space */
  preferredPlacement: {
    type: String,
    default: 'auto',
    validator: (v) => ['auto', 'above', 'below'].includes(v)
  },
  /** Horizontal alignment relative to anchor */
  align: {
    type: String,
    default: 'center',
    validator: (v) => ['center', 'start'].includes(v)
  }
});

const { t } = useI18n();

const triggerRef = ref(null);
const tooltipRef = ref(null);
const visible = ref(false);
let showTimer = null;
let hideTimer = null;

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) visible.value = false;
  }
);

const anchorEl = computed(() => {
  const trigger = triggerRef.value;
  if (!trigger) return null;
  if (props.anchorSelector) {
    const el = trigger.querySelector(props.anchorSelector);
    return el || trigger;
  }
  return trigger;
});

function resolvePlacement(rect) {
  const tooltipHeight = 40;
  const gap = props.gap;
  if (props.preferredPlacement === 'above') return 'above';
  if (props.preferredPlacement === 'below') return 'below';
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;
  return spaceAbove >= tooltipHeight + gap || spaceAbove >= spaceBelow ? 'above' : 'below';
}

const tooltipStyle = computed(() => {
  const anchor = anchorEl.value;
  if (!anchor || !visible.value) return {};
  const rect = anchor.getBoundingClientRect();
  const tooltipHeight = 40;
  const gap = props.gap;
  const showAbove = resolvePlacement(rect) === 'above';
  const top = showAbove ? rect.top - tooltipHeight - gap : rect.bottom + gap;
  const minLeft = 8;
  const maxLeft = window.innerWidth - 8;
  const anchorX = props.align === 'start' ? rect.left : rect.left + rect.width / 2;
  const left = Math.max(minLeft, Math.min(anchorX, maxLeft));
  return {
    top: `${top}px`,
    left: `${left}px`,
    transform: props.align === 'start' ? 'none' : 'translateX(-50%)'
  };
});

const placement = computed(() => {
  const anchor = anchorEl.value;
  if (!anchor || !visible.value) return 'above';
  return resolvePlacement(anchor.getBoundingClientRect());
});

const handleShow = () => {
  if (props.disabled || !props.content) return;
  if (showTimer) clearTimeout(showTimer);
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  showTimer = setTimeout(() => {
    showTimer = null;
    visible.value = true;
  }, props.showDelay);
};

const handleHide = () => {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  hideTimer = setTimeout(() => {
    visible.value = false;
    hideTimer = null;
  }, props.hideDelay);
};

onUnmounted(() => {
  if (showTimer) clearTimeout(showTimer);
  if (hideTimer) clearTimeout(hideTimer);
  visible.value = false;
});
</script>
