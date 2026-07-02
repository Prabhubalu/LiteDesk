<template>
  <div
    class="overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-950"
    :class="readOnly ? 'opacity-90' : ''"
  >
    <div v-if="useMonaco && monacoAvailable" class="relative min-h-[320px] w-full">
      <div
        v-if="monacoLoading"
        class="absolute inset-0 z-10 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400"
      >
        {{ t('states.loading') }}
      </div>
      <div
        ref="monacoContainerRef"
        class="min-h-[320px] w-full"
        role="textbox"
        :aria-label="t('templates.htmlImport.codeEditorLabel')"
      />
    </div>
    <div v-else class="grid min-h-[320px] grid-cols-[auto_1fr]">
      <div
        ref="gutterRef"
        aria-hidden="true"
        class="select-none overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 px-2 py-3 text-right font-mono text-xs leading-6 text-gray-400"
      >
        <div v-for="line in lineCount" :key="line">{{ line }}</div>
      </div>
      <textarea
        ref="textareaRef"
        :value="modelValue"
        :readonly="readOnly"
        spellcheck="false"
        class="min-h-[320px] w-full resize-y bg-transparent px-3 py-3 font-mono text-sm leading-6 text-gray-900 dark:text-gray-100 focus:outline-none"
        :placeholder="placeholder"
        @input="onInput"
        @scroll="syncScroll"
      />
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue';
import { useI18n } from 'vue-i18n';
import { loadMonaco, resolveMonacoTheme } from '../../utils/monacoSetup';

const props = defineProps({
  modelValue: { type: String, default: '' },
  readOnly: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  useMonaco: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();

const gutterRef = ref(null);
const textareaRef = ref(null);
const monacoContainerRef = ref(null);
const monacoLoading = ref(false);
const monacoAvailable = ref(true);
let monacoEditor = null;
let monacoModule = null;
let themeObserver = null;

const lineCount = computed(() => {
  const lines = String(props.modelValue || '').split('\n').length;
  return Math.max(lines, 12);
});

function onInput(event) {
  emit('update:modelValue', event.target.value);
}

function syncScroll(event) {
  if (gutterRef.value) {
    gutterRef.value.scrollTop = event.target.scrollTop;
  }
}

async function mountMonaco() {
  if (!props.useMonaco || monacoEditor || !monacoContainerRef.value) return;

  monacoLoading.value = true;
  try {
    monacoModule = await loadMonaco();
    monacoEditor = monacoModule.editor.create(monacoContainerRef.value, {
      value: props.modelValue || '',
      language: 'html',
      theme: resolveMonacoTheme(),
      readOnly: props.readOnly,
      automaticLayout: true,
      minimap: { enabled: false },
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineNumbers: 'on',
      tabSize: 2,
      insertSpaces: true,
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'mouseover'
    });

    monacoEditor.onDidChangeModelContent(() => {
      if (props.readOnly || !monacoEditor) return;
      emit('update:modelValue', monacoEditor.getValue());
    });
  } catch {
    monacoAvailable.value = false;
  } finally {
    monacoLoading.value = false;
  }
}

function disposeMonaco() {
  monacoEditor?.dispose();
  monacoEditor = null;
  monacoModule = null;
}

function syncMonacoTheme() {
  if (!monacoModule || !monacoEditor) return;
  monacoModule.editor.setTheme(resolveMonacoTheme());
}

onMounted(async () => {
  if (!props.useMonaco) return;
  monacoAvailable.value = true;
  await nextTick();
  await mountMonaco();
  if (typeof MutationObserver !== 'undefined') {
    themeObserver = new MutationObserver(syncMonacoTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
});

onBeforeUnmount(() => {
  themeObserver?.disconnect();
  themeObserver = null;
  disposeMonaco();
});

watch(
  () => props.useMonaco,
  async (enabled) => {
    if (enabled) {
      monacoAvailable.value = true;
      await nextTick();
      await mountMonaco();
      return;
    }
    disposeMonaco();
  }
);

watch(
  () => props.modelValue,
  (next) => {
    if (monacoEditor && monacoEditor.getValue() !== next) {
      monacoEditor.setValue(String(next || ''));
    }
    if (textareaRef.value && textareaRef.value.scrollTop !== undefined && gutterRef.value) {
      gutterRef.value.scrollTop = textareaRef.value.scrollTop;
    }
  }
);

watch(
  () => props.readOnly,
  (readOnly) => {
    monacoEditor?.updateOptions({ readOnly });
  }
);
</script>
