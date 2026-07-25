<template>
  <Teleport to="body">
    <Transition name="record-print-drawer">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[10000] flex justify-end overflow-x-hidden"
        @keydown.esc.prevent="close"
      >
        <div class="absolute inset-0 z-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" @click="close" />
        <aside
          class="relative z-10 flex h-full max-h-screen w-full max-w-[95vw] flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:w-[48rem]"
          role="dialog"
          aria-modal="true"
          :aria-label="t('records.printDrawerTitle')"
        >
          <div class="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-5 sm:px-6">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <h2 class="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                  {{ t('records.printDrawerTitle') }}
                </h2>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {{ t('records.printDrawerSubtitle') }}
                </p>
              </div>
              <button
                type="button"
                class="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                :aria-label="t('actions.close')"
                @click="close"
              >
                <XMarkIcon class="size-6" />
              </button>
            </div>
          </div>

          <div class="flex flex-shrink-0 items-end gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-6">
            <div class="min-w-0 flex-1">
              <label
                for="record-print-template"
                class="mb-1 block text-sm font-medium text-gray-900 dark:text-white"
              >
                {{ t('records.printTemplateLabel') }}
              </label>
              <select
                id="record-print-template"
                v-model="selectedTemplateId"
                class="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                :disabled="templatesLoading || !printTemplates.length"
              >
                <option v-if="!printTemplates.length" value="">
                  {{ t('records.printNoTemplates') }}
                </option>
                <option
                  v-for="tpl in printTemplates"
                  :key="tpl._id"
                  :value="tpl._id"
                >
                  {{ templateOptionLabel(tpl) }}
                </option>
              </select>
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              :disabled="!selectedTemplateId || previewLoading || pdfLoading"
              @click="refreshPreview"
            >
              {{ t('actions.refresh') }}
            </button>
          </div>

          <div class="relative flex min-h-0 flex-1 flex-col bg-neutral-200 dark:bg-neutral-900">
            <div
              v-if="templatesLoading && !printTemplates.length"
              class="flex min-h-0 flex-1 items-center justify-center text-sm text-gray-600 dark:text-gray-300"
            >
              {{ t('records.printLoadingTemplates') }}
            </div>
            <div
              v-else-if="loadError && !previewHtml"
              class="flex min-h-0 flex-1 items-center justify-center p-4 text-center text-sm text-red-600 dark:text-red-400"
            >
              {{ loadError }}
            </div>
            <div
              v-else-if="!printTemplates.length"
              class="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-gray-600 dark:text-gray-300"
            >
              {{ t('records.printNoTemplatesHint') }}
            </div>
            <div
              v-else
              ref="viewportRef"
              class="min-h-0 flex-1 overflow-y-auto p-3"
            >
              <div
                v-if="previewLoading && !previewHtml"
                class="flex h-full min-h-[12rem] items-center justify-center text-sm text-gray-600 dark:text-gray-300"
              >
                {{ t('templates.builderPreviewUpdating') }}
              </div>
              <div
                v-else-if="previewHtml"
                class="mx-auto w-full overflow-hidden"
                :style="scaledShellStyle"
                :class="{ invisible: viewportWidth <= 0 }"
              >
                <iframe
                  ref="previewIframeRef"
                  class="block border-0 bg-white shadow-md"
                  :style="iframeStyle"
                  :srcdoc="previewDocument"
                  :title="t('records.printDrawerTitle')"
                  sandbox="allow-same-origin allow-scripts"
                  @load="onPreviewIframeLoad"
                />
                <div
                  v-if="previewLoading"
                  class="absolute inset-0 flex items-center justify-center bg-neutral-200/70 text-sm text-gray-700 dark:bg-neutral-900/70 dark:text-gray-200"
                >
                  {{ t('templates.builderPreviewUpdating') }}
                </div>
              </div>
              <div
                v-else
                class="flex h-full min-h-[12rem] items-center justify-center p-4 text-center text-sm text-gray-600 dark:text-gray-300"
              >
                {{ t('templates.previewUnavailable') }}
              </div>
            </div>
          </div>

          <div class="flex flex-shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-6">
            <button
              type="button"
              class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              @click="close"
            >
              {{ t('actions.close') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              :disabled="!selectedTemplateId || pdfLoading || previewLoading"
              @click="downloadPdf"
            >
              <ArrowDownTrayIcon class="h-4 w-4" />
              {{ t('records.printDownloadPdf') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!previewHtml || previewLoading"
              @click="printPreview"
            >
              <PrinterIcon class="h-4 w-4" />
              {{ t('actions.print') }}
            </button>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowDownTrayIcon, PrinterIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useTemplates } from '@/composables/useTemplates';
import { fetchTemplatePreviewBlob } from '@/modules/template/services/templateApi';
import { resolvePreviewHtmlImageUrls } from '@/modules/template/utils/previewHtmlImages';
import {
  resolvePageDimensionsPx,
  resolvePageMarginsPx
} from '@/constants/contentPageSettings';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  moduleKey: { type: String, required: true },
  recordId: { type: String, required: true }
});

const emit = defineEmits(['close']);

const { t } = useI18n();
const { fetchTemplates, renderHtmlPreview } = useTemplates();

const templatesLoading = ref(false);
const previewLoading = ref(false);
const pdfLoading = ref(false);
const loadError = ref('');
const printTemplates = ref([]);
const selectedTemplateId = ref('');
const previewHtml = ref('');
const viewportRef = ref(null);
const previewIframeRef = ref(null);
const viewportWidth = ref(0);
const contentWidthPx = ref(0);

let resizeObserver = null;
let downloadBlobUrl = null;

const selectedTemplate = computed(() =>
  printTemplates.value.find((tpl) => tpl._id === selectedTemplateId.value) || null
);

const pageDimensions = computed(() =>
  resolvePageDimensionsPx({
    paperSize: selectedTemplate.value?.paperSize || 'A4',
    orientation: selectedTemplate.value?.orientation || 'portrait',
    customPageWidth: selectedTemplate.value?.customPageWidth,
    customPageHeight: selectedTemplate.value?.customPageHeight
  })
);

const pageMarginsPx = computed(() => resolvePageMarginsPx(selectedTemplate.value?.margins));

const contentHeightPx = computed(() => {
  const m = pageMarginsPx.value;
  return Math.max(0, pageDimensions.value.height - m.top - m.bottom);
});

const previewDocument = computed(() => {
  const html = resolvePreviewHtmlImageUrls(previewHtml.value || '');
  if (!html.includes('</head>')) return html;

  const m = pageMarginsPx.value;
  const contentH = contentHeightPx.value;
  const { width, height } = pageDimensions.value;
  const pixelPageStyle = `<style id="ld-record-print-preview-page">
    html, body { margin: 0; padding: 0; background: #fff; overflow: visible; }
    .page {
      width: ${width}px !important;
      min-height: ${height}px !important;
      padding: ${m.top}px ${m.right}px ${m.bottom}px ${m.left}px !important;
      box-sizing: border-box !important;
      overflow: visible !important;
    }
    .content.absolute-layout {
      width: 100% !important;
      min-height: ${contentH}px !important;
      box-sizing: border-box !important;
      overflow: visible !important;
    }
  </style>`;

  return html.replace('</head>', `${pixelPageStyle}</head>`);
});

/** Fit to drawer width; use content scrollWidth when template canvas is wider than paper. */
const fitScale = computed(() => {
  const available = viewportWidth.value;
  const pageW = Math.max(pageDimensions.value.width, contentWidthPx.value || 0);
  if (!available || !pageW) return 1;
  return available / pageW;
});

const scaledPageWidth = computed(() =>
  Math.max(pageDimensions.value.width, contentWidthPx.value || 0)
);

const iframeStyle = computed(() => ({
  width: `${scaledPageWidth.value}px`,
  height: `${pageDimensions.value.height}px`,
  transform: `scale(${fitScale.value})`,
  transformOrigin: 'top left'
}));

const scaledShellStyle = computed(() => ({
  position: 'relative',
  width: '100%',
  height: `${pageDimensions.value.height * fitScale.value}px`,
  overflow: 'hidden'
}));

function templateOptionLabel(tpl) {
  const name = String(tpl?.name || '').trim() || t('templates.detailTitle');
  if (tpl?.isDefault) return `${name} (${t('records.printDefaultBadge')})`;
  return name;
}

function isPrintTemplate(tpl) {
  return String(tpl?.outputFormat || 'pdf').toLowerCase() !== 'email';
}

function matchesModule(tpl) {
  const scope = String(tpl?.moduleScope || '').trim().toLowerCase();
  if (!scope) return true;
  return scope === String(props.moduleKey || '').trim().toLowerCase();
}

function revokeDownloadBlob() {
  if (downloadBlobUrl) {
    URL.revokeObjectURL(downloadBlobUrl);
    downloadBlobUrl = null;
  }
}

function measureViewport() {
  const el = viewportRef.value;
  if (!el) return;
  const style = window.getComputedStyle(el);
  const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  viewportWidth.value = Math.max(0, el.clientWidth - padX);
}

function measureIframeContentWidth() {
  const doc = previewIframeRef.value?.contentDocument;
  if (!doc) return;
  const measured = Math.max(
    doc.documentElement?.scrollWidth || 0,
    doc.body?.scrollWidth || 0,
    pageDimensions.value.width
  );
  contentWidthPx.value = measured;
}

function onPreviewIframeLoad() {
  measureIframeContentWidth();
  measureViewport();
}

function attachObserver() {
  detachObserver();
  const el = viewportRef.value;
  if (!el) return;
  measureViewport();
  resizeObserver = new ResizeObserver(() => {
    measureViewport();
  });
  resizeObserver.observe(el);
}

function detachObserver() {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}

function scheduleAttachObserver() {
  void nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        attachObserver();
        measureIframeContentWidth();
      });
    });
  });
}

function close() {
  emit('close');
}

async function loadTemplates() {
  templatesLoading.value = true;
  loadError.value = '';
  printTemplates.value = [];
  selectedTemplateId.value = '';
  previewHtml.value = '';

  try {
    const response = await fetchTemplates({
      page: 1,
      limit: 100,
      status: 'published',
      outputFormat: 'pdf'
    });
    const items = Array.isArray(response?.data) ? response.data : [];
    const filtered = items.filter((tpl) => isPrintTemplate(tpl) && matchesModule(tpl));
    filtered.sort((a, b) => {
      if (Boolean(a.isDefault) !== Boolean(b.isDefault)) return a.isDefault ? -1 : 1;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    printTemplates.value = filtered;
    selectedTemplateId.value = filtered[0]?._id || '';
  } catch (err) {
    loadError.value = err?.message || t('records.printLoadFailed');
  } finally {
    templatesLoading.value = false;
  }
}

async function refreshPreview() {
  if (!selectedTemplateId.value || !props.recordId || !props.moduleKey) {
    previewHtml.value = '';
    return;
  }

  previewLoading.value = true;
  loadError.value = '';
  try {
    previewHtml.value = await renderHtmlPreview(selectedTemplateId.value, {
      recordId: props.recordId,
      recordModuleKey: props.moduleKey
    });
  } catch (err) {
    previewHtml.value = '';
    loadError.value = err?.message || t('templates.renderFailed');
  } finally {
    previewLoading.value = false;
  }
}

function printPreview() {
  const iframe = previewIframeRef.value;
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
}

async function downloadPdf() {
  if (!selectedTemplateId.value) return;
  pdfLoading.value = true;
  loadError.value = '';
  try {
    const blob = await fetchTemplatePreviewBlob(selectedTemplateId.value, {
      recordId: props.recordId,
      recordModuleKey: props.moduleKey
    });
    revokeDownloadBlob();
    downloadBlobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadBlobUrl;
    const safeName = String(selectedTemplate.value?.name || 'print')
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 80);
    link.download = `${safeName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    loadError.value = err?.message || t('records.printPdfFailed');
  } finally {
    pdfLoading.value = false;
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      void loadTemplates();
    } else {
      detachObserver();
      revokeDownloadBlob();
      previewHtml.value = '';
      contentWidthPx.value = 0;
      viewportWidth.value = 0;
      loadError.value = '';
    }
  }
);

watch(selectedTemplateId, (id) => {
  if (!props.isOpen || !id) return;
  void refreshPreview();
});

watch(
  () => [props.isOpen, printTemplates.value.length, previewHtml.value, previewLoading.value],
  ([open, templateCount]) => {
    if (open && templateCount > 0) {
      scheduleAttachObserver();
      return;
    }
    detachObserver();
  }
);

onUnmounted(() => {
  detachObserver();
  revokeDownloadBlob();
});
</script>

<style scoped>
.record-print-drawer-enter-active,
.record-print-drawer-leave-active {
  transition: opacity 0.2s ease;
}
.record-print-drawer-enter-active aside,
.record-print-drawer-leave-active aside {
  transition: transform 0.3s ease;
}
.record-print-drawer-enter-from,
.record-print-drawer-leave-to {
  opacity: 0;
}
.record-print-drawer-enter-from aside,
.record-print-drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
