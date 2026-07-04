<template>
  <div class="space-y-5">
    <div class="grid gap-4 xl:grid-cols-2">
      <section :class="rbPanel">
        <div class="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {{ t('analytics.builderReportInformation') }}
          </p>
        </div>
        <div class="space-y-4 p-4">
          <div>
            <p :class="rbLabel">{{ t('analytics.fieldName') }}</p>
            <p class="text-sm text-zinc-800 dark:text-zinc-200">{{ formName || '—' }}</p>
          </div>
          <div v-if="formDescription">
            <p :class="rbLabel">{{ t('analytics.builderDescription') }}</p>
            <p class="text-sm text-zinc-800 dark:text-zinc-200">{{ formDescription }}</p>
          </div>
          <div>
            <p :class="rbLabel">{{ t('analytics.fieldType') }}</p>
            <p class="text-sm text-zinc-800 dark:text-zinc-200">{{ reportTypeLabel }}</p>
          </div>
          <div v-if="folderOptions.length">
            <label :class="rbLabel" for="save-report-folder">{{ t('analytics.fieldFolder') }}</label>
            <HeadlessSelect
              id="save-report-folder"
              :model-value="formFolderId"
              :options="folderOptions"
              allow-empty
              :empty-label="t('analytics.filterUnfiled')"
              :placeholder="t('analytics.filterUnfiled')"
              wrapper-class="mt-0"
              teleport
              @update:model-value="$emit('update:formFolderId', $event)"
            />
          </div>
          <div>
            <label :class="rbLabel" for="save-report-tags">{{ t('analytics.builderTags') }}</label>
            <input
              id="save-report-tags"
              :value="tagsInput"
              type="text"
              :class="rbInput"
              :placeholder="t('analytics.builderTagsPlaceholder')"
              @input="onTagsInput"
              @blur="commitTags"
            />
            <div v-if="formTags.length" class="mt-2 flex flex-wrap gap-1.5">
              <span v-for="tag in formTags" :key="tag" :class="rbChip">{{ tag }}</span>
            </div>
          </div>
        </div>
      </section>

      <section :class="rbPanel">
        <div class="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {{ t('analytics.builderSharingTitle') }}
          </p>
        </div>
        <div class="space-y-4 p-4">
          <ReportSharePanel
            :visibility="visibility"
            :shared-with="sharedWith"
            @update:visibility="$emit('update:visibility', $event)"
            @update:shared-with="$emit('update:sharedWith', $event)"
          />
          <ReportPermissionsPanel
            :permissions="permissions"
            @update:permissions="$emit('update:permissions', $event)"
          />
        </div>
      </section>

      <section :class="rbPanel">
        <div class="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {{ t('analytics.builderOtherSettings') }}
          </p>
        </div>
        <div class="space-y-4 p-4">
          <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <input
              type="checkbox"
              :checked="cacheEnabled"
              class="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
              @change="$emit('update:cacheEnabled', ($event.target as HTMLInputElement).checked)"
            />
            {{ t('analytics.builderCacheEnabled') }}
          </label>
          <div v-if="cacheEnabled">
            <label :class="rbLabel" for="cache-duration">{{ t('analytics.builderCacheDuration') }}</label>
            <HeadlessSelect
              id="cache-duration"
              :model-value="String(cacheDuration)"
              :options="cacheDurationOptions"
              wrapper-class="mt-0"
              teleport
              @update:model-value="$emit('update:cacheDuration', Number($event))"
            />
          </div>
          <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <input
              type="checkbox"
              :checked="runtimeFilters"
              class="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
              @change="$emit('update:runtimeFilters', ($event.target as HTMLInputElement).checked)"
            />
            {{ t('analytics.builderRuntimeFilters') }}
          </label>
          <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <input
              type="checkbox"
              :checked="listedInHome"
              class="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
              @change="$emit('update:listedInHome', ($event.target as HTMLInputElement).checked)"
            />
            {{ t('analytics.builderListedInHome') }}
          </label>
        </div>
      </section>

      <section :class="rbPanel">
        <div class="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {{ t('analytics.builderScheduleOptional') }}
          </p>
        </div>
        <div class="p-4">
          <ReportBuilderSchedulePanel
            :enabled="scheduleEnabled"
            :frequency="scheduleFrequency"
            :timezone="scheduleTimezone"
            :hour="scheduleHour"
            :minute="scheduleMinute"
            :day-of-week="scheduleDayOfWeek"
            :day-of-month="scheduleDayOfMonth"
            :export-formats="scheduleExportFormats"
            :start-date="scheduleStartDate"
            :end-date="scheduleEndDate"
            :recipients-text="scheduleRecipientsText"
            :send-copy-to-owner="scheduleSendCopyToOwner"
            @update:enabled="$emit('update:scheduleEnabled', $event)"
            @update:frequency="$emit('update:scheduleFrequency', $event)"
            @update:timezone="$emit('update:scheduleTimezone', $event)"
            @update:hour="$emit('update:scheduleHour', $event)"
            @update:minute="$emit('update:scheduleMinute', $event)"
            @update:day-of-week="$emit('update:scheduleDayOfWeek', $event)"
            @update:day-of-month="$emit('update:scheduleDayOfMonth', $event)"
            @update:export-formats="$emit('update:scheduleExportFormats', $event)"
            @update:start-date="$emit('update:scheduleStartDate', $event)"
            @update:end-date="$emit('update:scheduleEndDate', $event)"
            @update:recipients-text="$emit('update:scheduleRecipientsText', $event)"
            @update:send-copy-to-owner="$emit('update:scheduleSendCopyToOwner', $event)"
          />
        </div>
      </section>
    </div>

    <div
      :class="[
        rbPanel,
        'flex flex-wrap items-center justify-between gap-3 border-emerald-200/80 bg-emerald-50/50 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/5',
      ]"
    >
      <div class="flex flex-wrap items-center gap-4">
        <p class="text-sm text-emerald-800 dark:text-emerald-300">
          {{
            readyToPublish
              ? t('analytics.builderReadyToPublish')
              : t('analytics.builderNotReadyToPublish')
          }}
        </p>
        <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            :checked="addToFavorites"
            class="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
            @change="$emit('update:addToFavorites', ($event.target as HTMLInputElement).checked)"
          />
          {{ t('analytics.builderAddToFavorites') }}
        </label>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          :class="rbBtnSecondary"
          class="!py-1.5 !text-xs"
          :disabled="saving"
          @click="$emit('save-draft')"
        >
          {{ saving ? t('states.saving') : t('analytics.saveDraft') }}
        </button>
        <ReportBuilderPublishMenu
          :disabled="saving || !readyToPublish"
          @publish="$emit('publish')"
          @publish-with-schedule="$emit('publish-with-schedule')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ReportSharePanel from '@/components/analytics/report-builder/ReportSharePanel.vue';
import ReportPermissionsPanel from '@/components/analytics/report-builder/ReportPermissionsPanel.vue';
import ReportBuilderSchedulePanel from '@/components/analytics/report-builder/ReportBuilderSchedulePanel.vue';
import ReportBuilderPublishMenu from '@/components/analytics/report-builder/ReportBuilderPublishMenu.vue';
import {
  rbBtnSecondary,
  rbChip,
  rbInput,
  rbLabel,
  rbPanel,
} from '@/components/analytics/report-builder/reportBuilderUi';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import type {
  AnalyticsReportPermissions,
  AnalyticsShareTarget,
  AnalyticsVisibility,
} from '@/types/analytics.types';

const props = defineProps<{
  formName: string;
  formDescription: string;
  reportTypeLabel: string;
  formFolderId: string;
  formTags: string[];
  folderOptions: Array<{ value: string; label: string }>;
  visibility: AnalyticsVisibility;
  sharedWith: AnalyticsShareTarget[];
  permissions: AnalyticsReportPermissions;
  cacheEnabled: boolean;
  cacheDuration: number;
  runtimeFilters: boolean;
  listedInHome: boolean;
  addToFavorites: boolean;
  scheduleEnabled: boolean;
  scheduleFrequency: string;
  scheduleTimezone: string;
  scheduleHour: number;
  scheduleMinute: number;
  scheduleDayOfWeek: number;
  scheduleDayOfMonth: number;
  scheduleExportFormats: string[];
  scheduleStartDate: string;
  scheduleEndDate: string;
  scheduleRecipientsText: string;
  scheduleSendCopyToOwner: boolean;
  readyToPublish: boolean;
  saving: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:formFolderId', value: string): void;
  (e: 'update:formTags', value: string[]): void;
  (e: 'update:visibility', value: AnalyticsVisibility): void;
  (e: 'update:sharedWith', value: AnalyticsShareTarget[]): void;
  (e: 'update:permissions', value: AnalyticsReportPermissions): void;
  (e: 'update:cacheEnabled', value: boolean): void;
  (e: 'update:cacheDuration', value: number): void;
  (e: 'update:runtimeFilters', value: boolean): void;
  (e: 'update:listedInHome', value: boolean): void;
  (e: 'update:addToFavorites', value: boolean): void;
  (e: 'update:scheduleEnabled', value: boolean): void;
  (e: 'update:scheduleFrequency', value: string): void;
  (e: 'update:scheduleTimezone', value: string): void;
  (e: 'update:scheduleHour', value: number): void;
  (e: 'update:scheduleMinute', value: number): void;
  (e: 'update:scheduleDayOfWeek', value: number): void;
  (e: 'update:scheduleDayOfMonth', value: number): void;
  (e: 'update:scheduleExportFormats', value: string[]): void;
  (e: 'update:scheduleStartDate', value: string): void;
  (e: 'update:scheduleEndDate', value: string): void;
  (e: 'update:scheduleRecipientsText', value: string): void;
  (e: 'update:scheduleSendCopyToOwner', value: boolean): void;
  (e: 'save-draft'): void;
  (e: 'publish'): void;
  (e: 'publish-with-schedule'): void;
}>();

const { t } = useI18n();

const tagsInput = ref(props.formTags.join(', '));

const cacheDurationOptions = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '60 min' },
  { value: '120', label: '120 min' },
];

watch(
  () => props.formTags,
  (tags) => {
    tagsInput.value = tags.join(', ');
  },
);

function onTagsInput(event: Event) {
  tagsInput.value = (event.target as HTMLInputElement).value;
  commitTags();
}

function commitTags() {
  const tags = tagsInput.value
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  emit('update:formTags', tags);
}
</script>
