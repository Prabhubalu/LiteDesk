<template>
  <div class="p-6 lg:p-8">
    <ReportBuilderStepHeader
      :title="t('analytics.builderStepHeading_selectModule')"
      :subtitle="t('analytics.builderStepHint_selectModule')"
    />

    <div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <div class="space-y-6">
        <section :class="[rbPanel, 'space-y-4 p-4']">
          <div>
            <label :class="rbLabel" for="report-builder-name">{{ t('analytics.fieldName') }}</label>
            <input
              id="report-builder-name"
              :value="reportName"
              type="text"
              :class="rbInput"
              :placeholder="t('analytics.builderNamePlaceholder')"
              @input="$emit('update:reportName', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div>
            <label :class="rbLabel" for="report-builder-description">{{ t('analytics.builderDescription') }}</label>
            <textarea
              id="report-builder-description"
              :value="reportDescription"
              rows="2"
              :class="rbTextarea"
              :placeholder="t('analytics.builderDescriptionPlaceholder')"
              @input="$emit('update:reportDescription', ($event.target as HTMLTextAreaElement).value)"
            />
          </div>
        </section>

        <div class="flex flex-wrap items-center gap-3">
          <div class="relative min-w-[200px] flex-1">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              v-model="searchQuery"
              type="search"
              :placeholder="t('analytics.builderSearchModules')"
              :class="[rbInput, 'pl-9']"
            />
          </div>
          <div :class="rbSegment">
            <button
              type="button"
              :class="viewMode === 'grid' ? rbSegmentBtnActive : rbSegmentBtn"
              @click="viewMode = 'grid'"
            >
              <Squares2X2Icon class="h-4 w-4" />
            </button>
            <button
              type="button"
              :class="viewMode === 'list' ? rbSegmentBtnActive : rbSegmentBtn"
              @click="viewMode = 'list'"
            >
              <ListBulletIcon class="h-4 w-4" />
            </button>
          </div>
        </div>

        <section>
          <p :class="[rbOverline, 'mb-3']">{{ t('analytics.builderPopularModules') }}</p>
          <div :class="viewMode === 'grid' ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'">
            <ModuleCard
              v-for="mod in filteredPopularModules"
              :key="mod.moduleKey"
              :module="mod"
              :selected="selectedModule === mod.moduleKey"
              :compact="viewMode === 'list'"
              @select="$emit('select-module', mod.moduleKey)"
            />
          </div>
        </section>

        <section v-if="filteredOtherModules.length">
          <p :class="[rbOverline, 'mb-3']">{{ t('analytics.builderAllModules') }}</p>
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <ModuleCard
              v-for="mod in filteredOtherModules"
              :key="mod.moduleKey"
              :module="mod"
              :selected="selectedModule === mod.moduleKey"
              :compact="true"
              @select="$emit('select-module', mod.moduleKey)"
            />
          </div>
        </section>
      </div>

      <aside class="hidden space-y-4 xl:block">
        <div :class="[rbPanel, 'p-4']">
          <p :class="rbOverline">{{ t('analytics.builderAboutModules') }}</p>
          <p class="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {{ t('analytics.builderAboutModulesBody') }}
          </p>
        </div>
        <div :class="[rbPanel, 'p-4']">
          <p :class="rbOverline">{{ t('analytics.builderProTip') }}</p>
          <p class="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {{ t('analytics.builderProTipBody') }}
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ListBulletIcon, MagnifyingGlassIcon, Squares2X2Icon } from '@heroicons/vue/24/outline';
import ModuleCard from '@/components/analytics/report-builder/ModuleCard.vue';
import ReportBuilderStepHeader from '@/components/analytics/report-builder/ReportBuilderStepHeader.vue';
import {
  rbInput,
  rbLabel,
  rbOverline,
  rbPanel,
  rbSegment,
  rbSegmentBtn,
  rbSegmentBtnActive,
  rbTextarea,
} from '@/components/analytics/report-builder/reportBuilderUi';
import type { AnalyticsCatalogModule } from '@/composables/useAnalyticsReports';

const props = defineProps<{
  popularModules: AnalyticsCatalogModule[];
  otherModules: AnalyticsCatalogModule[];
  selectedModule: string;
  reportName: string;
  reportDescription: string;
}>();

defineEmits<{
  (e: 'select-module', moduleKey: string): void;
  (e: 'update:reportName', value: string): void;
  (e: 'update:reportDescription', value: string): void;
}>();

const { t } = useI18n();
const searchQuery = ref('');
const viewMode = ref<'grid' | 'list'>('grid');

function filterModules(modules: AnalyticsCatalogModule[]) {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return modules;
  return modules.filter(
    (mod) =>
      mod.moduleKey.toLowerCase().includes(query) ||
      (mod.label || '').toLowerCase().includes(query),
  );
}

const filteredPopularModules = computed(() => filterModules(props.popularModules));
const filteredOtherModules = computed(() => filterModules(props.otherModules));
</script>
