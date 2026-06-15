<template>
  <HoverTooltip
    v-if="text"
    :content="text"
    :disabled="!showTooltip"
    :preferred-placement="tooltipPlacement"
    :align="tooltipAlign"
    anchor-selector=".truncated-label__text"
    wrap
    :class="['min-w-0 max-w-full', wrapperLayoutClass, wrapperClass]"
  >
    <component
      :is="tag"
      :class="[blockClass, innerLayoutClass, tag === 'span' ? 'inline-flex' : 'flex']"
      v-bind="passthroughAttrs"
    >
      <span ref="textRef" :class="['truncated-label__text block min-w-0 truncate', textClass]">{{ displayText }}</span>
    </component>
  </HoverTooltip>
</template>

<script setup lang="ts">
import { computed, useAttrs, ref, toRef, watch } from 'vue';
import HoverTooltip from '@/components/common/HoverTooltip.vue';
import { useTruncationObserver } from '@/composables/useTruncationObserver';
import {
  isTextTruncatedForDisplay,
  truncateTextForDisplay,
} from '@/utils/listViewNameLimits';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    text: string;
    tag?: string;
    textClass?: string;
    wrapperClass?: string;
    /** Optional character cap for display only; full `text` is kept for tooltip. */
    maxChars?: number | null;
    tooltipPlacement?: 'auto' | 'above' | 'below';
    tooltipAlign?: 'center' | 'start';
  }>(),
  {
    tag: 'span',
    textClass: '',
    wrapperClass: '',
    maxChars: null,
    tooltipPlacement: 'auto',
    tooltipAlign: 'center',
  }
);

const emit = defineEmits<{
  (e: 'truncated-change', truncated: boolean): void;
}>();

const attrs = useAttrs();
const textRef = ref<HTMLElement | null>(null);

const displayText = computed(() => {
  if (props.maxChars == null) return props.text;
  return truncateTextForDisplay(props.text, props.maxChars);
});

const isCharTruncated = computed(() => {
  if (props.maxChars == null) return false;
  return isTextTruncatedForDisplay(props.text, props.maxChars);
});

const { isTruncated: isOverflowTruncated } = useTruncationObserver(textRef, [
  toRef(props, 'text'),
  displayText,
]);

const showTooltip = computed(() => isCharTruncated.value || isOverflowTruncated.value);

const passthroughAttrs = computed(() => {
  const { class: _class, title: _title, ...rest } = attrs;
  return rest;
});

const blockClass = computed(() => {
  const cls = attrs.class;
  if (!cls) return '';
  return Array.isArray(cls) ? cls.join(' ') : String(cls);
});

const hasFlexGrow = computed(() => /\bflex-1\b/.test(blockClass.value));

const wrapperLayoutClass = computed(() =>
  hasFlexGrow.value ? 'flex flex-1 min-w-0' : 'inline-flex'
);

const innerLayoutClass = computed(() =>
  hasFlexGrow.value ? 'w-full min-w-0' : 'min-w-0 max-w-full'
);

watch(showTooltip, (value) => emit('truncated-change', value), { immediate: true });
</script>
