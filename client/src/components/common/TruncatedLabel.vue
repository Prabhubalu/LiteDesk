<template>
  <HoverTooltip
    v-if="text"
    :content="text"
    :disabled="!showTooltip"
    wrap
    class="inline-flex min-w-0 max-w-full"
    :class="wrapperClass"
  >
    <component
      :is="tag"
      :class="[blockClass, 'min-w-0 max-w-full', tag === 'span' ? 'inline-flex' : 'flex']"
      v-bind="elementAttrs"
    >
      <span ref="textRef" :class="['block min-w-0 truncate', textClass]">{{ displayText }}</span>
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
  }>(),
  {
    tag: 'span',
    textClass: '',
    wrapperClass: '',
    maxChars: null,
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

const elementAttrs = computed(() => ({
  ...passthroughAttrs.value,
  title: showTooltip.value ? props.text : undefined,
}));

watch(showTooltip, (value) => emit('truncated-change', value), { immediate: true });
</script>
