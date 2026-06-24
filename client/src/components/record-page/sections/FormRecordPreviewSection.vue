<template>
  <div class="overflow-hidden rounded-xl border border-gray-200 bg-gray-100/80 dark:border-gray-700 dark:bg-gray-900/60">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-700 dark:bg-gray-800">
      <div class="flex items-center gap-2 min-w-0">
        <EyeIcon class="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
        <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
          {{ record?.name || t('records.tabPreview') }}
        </span>
        <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-700 dark:text-gray-400">
          {{ t('forms.recordPreviewReadOnly') }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <div class="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-600">
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium transition-colors"
            :class="previewWidth === 'desktop'
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
            @click="previewWidth = 'desktop'"
          >
            {{ t('forms.recordPreviewDesktop') }}
          </button>
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium transition-colors"
            :class="previewWidth === 'mobile'
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
            @click="previewWidth = 'mobile'"
          >
            {{ t('forms.recordPreviewMobile') }}
          </button>
        </div>
        <button
          v-if="publicPreviewUrl"
          type="button"
          class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
          @click="openPublicPreview"
        >
          <ArrowTopRightOnSquareIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {{ t('forms.recordPreviewOpenTab') }}
        </button>
      </div>
    </div>

    <div class="p-4 sm:p-6">
      <div
        class="mx-auto transition-all duration-200"
        :class="previewWidth === 'mobile' ? 'max-w-sm' : 'max-w-2xl'"
      >
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <FormPreview
            v-if="record"
            :form="record"
            :read-only="true"
            :hide-header="true"
            embedded
          />
          <p v-else class="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            {{ t('records.genericNoRecordLoaded') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowTopRightOnSquareIcon, EyeIcon } from '@heroicons/vue/24/outline';
import FormPreview from '@/components/forms/FormPreview.vue';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();

const previewWidth = ref('desktop');

const publicPreviewUrl = computed(() => {
  const link = props.record?.publicLink;
  if (!link?.enabled || !link?.slug) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/forms/public/${link.slug}`;
});

function openPublicPreview() {
  if (!publicPreviewUrl.value) return;
  window.open(publicPreviewUrl.value, '_blank', 'noopener,noreferrer');
}
</script>
