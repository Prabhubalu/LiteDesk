<template>
  <div :class="ui.segmentGroup">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :title="t(option.labelKey)"
      :class="[ui.segmentBtn, value === option.value ? ui.segmentBtnActive : '']"
      @click="emit('update:value', option.value)"
    >
      <component :is="option.icon" class="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Bars3BottomLeftIcon,
  Bars3CenterLeftIcon,
  Bars3BottomRightIcon,
  Bars4Icon,
} from '@heroicons/vue/24/outline';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  value: { type: String, default: 'left' },
  allowJustify: { type: Boolean, default: false },
});

const emit = defineEmits(['update:value']);

const { t } = useI18n();
const ui = useBuilderUi();

const options = computed(() => {
  const base = [
    { value: 'left', labelKey: 'contentStudio.alignLeft', icon: Bars3BottomLeftIcon },
    { value: 'center', labelKey: 'contentStudio.alignCenter', icon: Bars3CenterLeftIcon },
    { value: 'right', labelKey: 'contentStudio.alignRight', icon: Bars3BottomRightIcon },
  ];
  if (props.allowJustify) {
    base.push({ value: 'justify', labelKey: 'contentStudio.alignJustify', icon: Bars4Icon });
  }
  return base;
});
</script>
