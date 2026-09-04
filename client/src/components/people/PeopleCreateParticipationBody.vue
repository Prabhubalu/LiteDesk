<template>
  <div class="flex flex-col gap-4">
    <div v-if="optionalAppParticipation && contextAppKeyIsNull">
      <div v-if="availableParticipationApps.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('people.peopleQuickCreateDrawerNoParticipationApps') }}
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          v-for="appKey in availableParticipationApps"
          :key="appKey"
          type="button"
          class="relative flex items-center gap-3 rounded-lg border p-3.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          :class="isAppSelected(appKey)
            ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/25'
            : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600'"
          :aria-pressed="isAppSelected(appKey)"
          @click="$emit('toggle-app', appKey)"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            :class="getParticipationAppMeta(appKey).iconBg"
          >
            <component
              :is="getParticipationAppMeta(appKey).icon"
              class="h-5 w-5"
              :class="getParticipationAppMeta(appKey).iconColor"
              aria-hidden="true"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {{ getAppLabel(appKey) }}
            </div>
            <div
              v-if="isAppSelected(appKey) && getAppForm(appKey).participationType"
              class="truncate text-xs text-indigo-600 dark:text-indigo-400"
            >
              {{ getAppForm(appKey).participationType }}
            </div>
            <div
              v-else-if="!isAppSelected(appKey)"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ t('people.peopleQuickCreateDrawerTapToAdd') }}
            </div>
          </div>
          <CheckCircleIcon
            v-if="isAppSelected(appKey)"
            class="absolute right-2 top-2 h-5 w-5 text-indigo-600 dark:text-indigo-400"
            aria-hidden="true"
          />
        </button>
      </div>

      <div v-if="selectedOptionalAppKeys.length > 0" class="mt-5 space-y-4">
        <div
          v-for="appKey in selectedOptionalAppKeys"
          :key="`config-${appKey}`"
          class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40"
        >
          <div class="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
            <div
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              :class="getParticipationAppMeta(appKey).iconBg"
            >
              <component
                :is="getParticipationAppMeta(appKey).icon"
                class="h-4 w-4"
                :class="getParticipationAppMeta(appKey).iconColor"
                aria-hidden="true"
              />
            </div>
            <span class="text-sm font-medium text-gray-900 dark:text-white">
              {{ getAppLabel(appKey) }}
            </span>
            <button
              type="button"
              class="ml-auto text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
              @click="$emit('toggle-app', appKey)"
            >
              {{ t('actions.remove') }}
            </button>
          </div>
          <div class="p-4">
            <AppSection
              :app-key="appKey"
              :model-value="getAppForm(appKey)"
              embedded
              collapsible-dependent-fields
              hide-section-title
              :single-column="singleColumn"
              :module-override="peopleModuleOverride"
              :errors="getAppErrors(appKey)"
              @update:model-value="(value) => $emit('set-app-form', { appKey, value })"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="effectiveAppKey"
      class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40"
    >
      <div class="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <div
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          :class="getParticipationAppMeta(effectiveAppKey).iconBg"
        >
          <component
            :is="getParticipationAppMeta(effectiveAppKey).icon"
            class="h-4 w-4"
            :class="getParticipationAppMeta(effectiveAppKey).iconColor"
            aria-hidden="true"
          />
        </div>
        <span class="text-sm font-medium text-gray-900 dark:text-white">
          {{ getAppLabel(effectiveAppKey) }}
        </span>
      </div>
      <div class="p-4">
        <AppSection
          :app-key="effectiveAppKey"
          :model-value="singleAppForm"
          embedded
          collapsible-dependent-fields
          hide-section-title
          :single-column="singleColumn"
          :module-override="peopleModuleOverride"
          :errors="getAppErrors(effectiveAppKey)"
          @update:model-value="$emit('update:single-app-form', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';
import { toRefs } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircleIcon } from '@heroicons/vue/24/solid';
import AppSection, { type AppSectionModelValue } from '@/components/people/AppSection.vue';
import type { PeopleParticipationAppKey } from '@/utils/peopleParticipationUi';

const props = withDefaults(
  defineProps<{
    optionalAppParticipation?: boolean;
    contextAppKeyIsNull?: boolean;
    availableParticipationApps?: PeopleParticipationAppKey[];
    selectedOptionalAppKeys?: PeopleParticipationAppKey[];
    effectiveAppKey?: PeopleParticipationAppKey | null;
    singleColumn?: boolean;
    peopleModuleOverride?: Record<string, unknown> | null;
    isAppSelected: (appKey: PeopleParticipationAppKey) => boolean;
    getParticipationAppMeta: (appKey: string) => {
      icon: Component;
      iconBg: string;
      iconColor: string;
    };
    getAppLabel: (appKey: string) => string;
    getAppForm: (appKey: string) => AppSectionModelValue;
    getAppErrors: (appKey: string) => Record<string, string>;
    singleAppForm: AppSectionModelValue;
  }>(),
  {
    optionalAppParticipation: false,
    contextAppKeyIsNull: false,
    availableParticipationApps: () => [],
    selectedOptionalAppKeys: () => [],
    effectiveAppKey: null,
    singleColumn: true,
    peopleModuleOverride: null
  }
);

defineEmits<{
  'toggle-app': [appKey: PeopleParticipationAppKey];
  'set-app-form': [payload: { appKey: string; value: AppSectionModelValue }];
  'update:single-app-form': [value: AppSectionModelValue];
}>();

const { t } = useI18n();
const { availableParticipationApps, selectedOptionalAppKeys } = toRefs(props);
</script>
