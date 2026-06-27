<template>
  <div
    ref="starterRef"
    contenteditable="true"
    class="min-h-[2.5rem] w-full outline-none text-lg leading-relaxed text-neutral-800 dark:text-neutral-100 empty:before:text-neutral-400 empty:before:content-[attr(data-placeholder)]"
    :data-placeholder="t('templates.builderDocStartTyping')"
    @focus="onStart"
    @input="onStart"
    @keydown.stop
  />
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const emit = defineEmits(['start-typing']);

const { t } = useI18n();
const starterRef = ref(null);
let started = false;

function readText() {
  return String(starterRef.value?.innerText || '').replace(/\u00a0/g, ' ').trim();
}

function onStart() {
  if (started) return;
  started = true;
  emit('start-typing', readText());
}

defineExpose({
  focus() {
    starterRef.value?.focus();
  }
});
</script>
