<template>
  <div class="space-y-6" :class="isDirty ? SETTINGS_SAVE_BAR_CONTENT_CLASS : ''">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="h-full flex flex-col lg:flex-row gap-4 min-h-0">
      <!-- Pipeline sidebar -->
      <aside class="w-full lg:w-72 flex-none bg-white dark:bg-gray-900/60 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div class="px-3 py-3 border-b border-l-2 border-l-transparent border-gray-200 dark:border-white/10 flex items-center justify-between gap-2">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.salesPipeSidebarPipelines') }}</div>
          <button
            type="button"
            @click="addPipeline"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <PlusIcon class="w-3.5 h-3.5" />
            {{ t('actions.add') }}
          </button>
        </div>
        <div
          class="flex-1 overflow-y-auto"
          @dragover.prevent="onPipelineListDragOver"
          @drop.prevent="onPipelineListDrop"
        >
          <div
            v-for="(pipeline, index) in pipelineSettings"
            :key="pipeline.key || index"
            :class="[
              'group relative flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors border-l-2',
              selectedPipelineKey === pipeline.key
                ? 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-900/25'
                : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-white/5',
              pipelineDragOverIndex === index ? 'ring-2 ring-inset ring-indigo-400/50' : ''
            ]"
            draggable="true"
            @click="selectedPipelineKey = pipeline.key"
            @dragstart="onPipelineDragStart(index, $event)"
            @dragover.prevent="onPipelineDragOver(index)"
            @drop.prevent="onPipelineDrop(index)"
            @dragend="resetPipelineDrag"
          >
            <button
              type="button"
              class="cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 flex-shrink-0"
              :title="t('settings.salesPipeDragReorder')"
              @click.stop
            >
              <Bars3Icon class="w-4 h-4" />
            </button>
            <span
              class="w-2.5 h-2.5 rounded-full border border-white shadow flex-shrink-0"
              :style="{ backgroundColor: pipeline.color || DEFAULT_PIPELINE_COLOR }"
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ pipeline.name }}</p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ stageCountLabel(pipeline.stages?.length || 0) }}</p>
            </div>
            <button
              v-if="pipelineSettings.length > 1"
              type="button"
              :class="[
                'p-1 rounded-md flex-shrink-0 transition-colors',
                pipeline.isDefault
                  ? 'text-amber-500'
                  : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-amber-500 dark:text-gray-600'
              ]"
              :title="pipeline.isDefault ? t('settings.salesPipeDefaultBadge') : t('settings.salesPipeSetDefaultTitle')"
              @click.stop="setDefaultPipeline(pipeline.key)"
            >
              <StarIcon :class="['w-4 h-4', pipeline.isDefault ? 'fill-current' : '']" />
            </button>
            <button
              v-if="pipelineSettings.length > 1 && !pipeline.isDefault"
              type="button"
              class="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-950/30 flex-shrink-0 transition-colors"
              :title="t('settings.salesPipeRemovePipelineTitle')"
              @click.stop="removePipeline(pipeline.key)"
            >
              <TrashIcon class="w-4 h-4" />
            </button>
          </div>

          <!-- Drop indicator at end of list -->
          <div
            v-if="pipelineSettings.length > 1"
            class="mx-3 my-1 h-0.5 rounded-full transition-all duration-150"
            :class="pipelineDragOverIndex === pipelineSettings.length ? 'bg-indigo-400 h-1' : 'bg-transparent'"
            @dragover.prevent="onPipelineDragOver(pipelineSettings.length)"
            @drop.prevent="onPipelineDrop(pipelineSettings.length)"
          />

          <div v-if="!pipelineSettings.length" class="p-8 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.salesPipeEmptyPipelines') }}</p>
            <button
              type="button"
              @click="addPipeline"
              class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <PlusIcon class="w-3.5 h-3.5" />
              {{ t('settings.salesPipeCreatePipeline') }}
            </button>
          </div>
        </div>
      </aside>

      <!-- Pipeline detail -->
      <section ref="pipelineDetailRef" class="flex-1 min-w-0 bg-white dark:bg-gray-900/60 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-0">
        <div v-if="currentPipeline" class="flex flex-col min-h-0 flex-1">
          <!-- Sticky header -->
          <div class="sticky top-0 z-10 shrink-0 border-b border-gray-200 dark:border-white/10 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 py-3 space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <span
                  class="w-3 h-3 rounded-full border border-white shadow flex-shrink-0"
                  :style="{ backgroundColor: currentPipeline.color || DEFAULT_PIPELINE_COLOR }"
                />
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ currentPipeline.name }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ stageCountLabel(currentPipeline.stages?.length || 0) }}
                    <template v-if="pipelineSettings.length > 1">
                      · {{ currentPipeline.isDefault ? t('settings.salesPipeDefaultPipelineLabel') : t('settings.salesPipeCustomPipelineLabel') }}
                    </template>
                  </p>
                </div>
              </div>
              <button
                v-if="pipelineSettings.length > 1 && !currentPipeline.isDefault"
                type="button"
                @click="setDefaultPipeline(currentPipeline.key)"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-colors flex-shrink-0"
              >
                <StarIcon class="w-3.5 h-3.5" />
                {{ t('settings.salesPipeSetAsDefault') }}
              </button>
            </div>

            <!-- Pipeline flow preview -->
            <div v-if="currentPipeline.stages?.length" class="flex items-center gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <template v-for="(stage, stageIndex) in currentPipeline.stages" :key="stage.key || stageIndex">
                <div
                  class="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
                  :class="getStagePreviewClasses(stage)"
                  :style="getStagePreviewStyle(stage)"
                >
                  <span class="max-w-[5rem] truncate">{{ stage.name || t('settings.salesPipeStageFallback') }}</span>
                  <span class="text-[10px] opacity-70">{{ stage.probability }}%</span>
                </div>
                <ChevronRightIcon
                  v-if="stageIndex < currentPipeline.stages.length - 1"
                  class="w-3 h-3 flex-shrink-0 text-gray-300 dark:text-gray-600"
                />
              </template>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-5">
            <!-- Pipeline settings -->
            <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{{ t('settings.salesPipeLabelPipelineName') }}</label>
                <input
                  v-model="currentPipeline.name"
                  class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{{ t('settings.salesPipeLabelColor') }}</label>
                <div class="flex items-center gap-2">
                  <label class="relative cursor-pointer">
                    <input type="color" v-model="currentPipeline.color" class="sr-only" />
                    <span
                      class="block w-10 h-10 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-sm hover:scale-105 transition-transform"
                      :style="{ backgroundColor: currentPipeline.color || DEFAULT_PIPELINE_COLOR }"
                    />
                  </label>
                </div>
              </div>
            </div>

            <!-- Stages section -->
            <div>
              <div class="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.salesPipeStagesTitle') }}</h4>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.salesPipeStagesSubtitle') }}</p>
                </div>
                <button
                  type="button"
                  @click="addStageToPipeline(currentPipeline)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  <PlusIcon class="w-3.5 h-3.5" />
                  {{ t('settings.salesPipeAddStage') }}
                </button>
              </div>

              <!-- Stage table header (desktop) -->
              <div
                class="hidden lg:grid gap-x-3 gap-y-0 px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500"
                :class="STAGE_GRID_CLASS"
              >
                <span class="w-[2.625rem]" aria-hidden="true" />
                <span>{{ t('settings.salesPipeLabelStageName') }}</span>
                <span>{{ t('settings.salesPipeLabelColor') }}</span>
                <span>{{ t('settings.salesPipeColProbability') }}</span>
                <span>{{ t('settings.salesPipeLabelStatus') }}</span>
                <span class="w-8" aria-hidden="true" />
              </div>

              <div class="space-y-1.5 pb-16" @dragover.prevent="onStageListDragOver" @drop.prevent="onStageListDrop">
                <div
                  v-for="(stage, stageIndex) in currentPipeline.stages"
                  :key="stage.key || stageIndex"
                  :class="[
                    'group/stage rounded-lg border transition-all duration-200',
                    highlightedStageKey === (stage.key || stageIndex)
                      ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900/40 hover:border-gray-300 dark:hover:border-gray-600',
                    !highlightedStageKey && stageDragOverIndex === stageIndex ? 'ring-2 ring-indigo-400/40' : ''
                  ]"
                  draggable="true"
                  @dragstart="onStageDragStart(stageIndex, $event)"
                  @dragover.prevent="onStageDragOver(stageIndex)"
                  @drop.prevent="onStageDrop(stageIndex)"
                  @dragend="resetStageDrag"
                >
                  <div class="grid grid-cols-1 gap-x-3 gap-y-2 items-center px-3 py-2.5" :class="STAGE_GRID_CLASS">
                    <!-- Drag handle + index -->
                    <div class="flex w-[2.625rem] flex-shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        class="cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
                        :title="t('settings.salesPipeDragReorder')"
                        @click.stop
                      >
                        <Bars3Icon class="w-4 h-4" />
                      </button>
                      <span class="text-[11px] font-medium text-gray-400 dark:text-gray-500 w-4 text-center">{{ stageIndex + 1 }}</span>
                    </div>

                    <!-- Stage name -->
                    <div>
                      <label class="lg:sr-only text-xs text-gray-500 dark:text-gray-400 mb-1 block">{{ t('settings.salesPipeLabelStageName') }}</label>
                      <input
                        v-model="stage.name"
                        class="w-full px-2.5 py-1.5 rounded-md bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                      />
                    </div>

                    <!-- Color -->
                    <div class="flex items-center gap-1.5">
                      <label class="lg:sr-only text-xs text-gray-500 dark:text-gray-400">{{ t('settings.salesPipeLabelColor') }}</label>
                      <label class="relative cursor-pointer flex-shrink-0">
                        <input
                          type="color"
                          :value="stage.color || DEFAULT_STAGE_COLOR"
                          @input="stage.color = $event.target.value"
                          class="sr-only"
                          :title="t('settings.salesPipeStageColorTitle')"
                        />
                        <span
                          class="block w-8 h-8 rounded-md border border-gray-200 dark:border-gray-600 hover:scale-105 transition-transform"
                          :style="{ backgroundColor: stage.color || DEFAULT_STAGE_COLOR }"
                        />
                      </label>
                      <span
                        class="hidden sm:inline-flex flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-white whitespace-nowrap"
                        :style="{ backgroundColor: stage.color || DEFAULT_STAGE_COLOR }"
                      >
                        {{ stage.name || t('settings.salesPipeStageFallback') }}
                      </span>
                    </div>

                    <!-- Probability -->
                    <div>
                      <label class="lg:sr-only text-xs text-gray-500 dark:text-gray-400 mb-1 block">{{ t('settings.salesPipeLabelProbability') }}</label>
                      <div class="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          v-model.number="stage.probability"
                          :disabled="stage.status === 'won' || stage.status === 'lost'"
                          @change="clampStageProbability(stage)"
                          @blur="clampStageProbability(stage)"
                          class="w-full px-2.5 py-1.5 pr-6 rounded-md bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">%</span>
                      </div>
                    </div>

                    <!-- Status (headless dropdown) -->
                    <div>
                      <label class="lg:sr-only text-xs text-gray-500 dark:text-gray-400 mb-1 block">{{ t('settings.salesPipeLabelStatus') }}</label>
                      <HeadlessSelect
                        :model-value="stage.status"
                        :options="pipelineStageStatusOptions"
                        :searchable="false"
                        teleport
                        button-class="!py-1.5 !px-2.5 !text-sm !rounded-md !bg-gray-50 dark:!bg-white/5 !border !border-gray-200 dark:!border-gray-700"
                        @update:model-value="(val) => updateStageStatus(stage, val)"
                      />
                    </div>

                    <!-- Delete -->
                    <div class="flex justify-end">
                      <button
                        type="button"
                        class="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors"
                        :title="t('settings.salesPipeRemoveStageTitle')"
                        @click="removeStageFromPipeline(currentPipeline, stageIndex)"
                      >
                        <TrashIcon class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Drop indicator at end of stage list -->
                <div
                  ref="stageListEndRef"
                  class="mx-3 h-0.5 rounded-full transition-all duration-150"
                  :class="stageDragOverIndex === currentPipeline.stages.length ? 'bg-indigo-400 h-1' : 'bg-transparent'"
                  @dragover.prevent="onStageDragOver(currentPipeline.stages.length)"
                  @drop.prevent="onStageDrop(currentPipeline.stages.length)"
                />
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex-1 flex items-center justify-center p-8">
          <div class="text-center space-y-4 max-w-xs">
            <div class="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center">
              <PlusIcon class="w-6 h-6 text-gray-400" />
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.salesPipeNoPipelineSelected') }}</p>
            <button
              type="button"
              @click="addPipeline"
              class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <PlusIcon class="w-4 h-4" />
              {{ t('settings.salesPipeCreatePipeline') }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <SettingsSaveBar
      :visible="isDirty"
      :saving="isSaving"
      @reset="discardChanges"
      @save="savePipelines"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { TrashIcon, Bars3Icon, PlusIcon, StarIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { SETTINGS_SAVE_BAR_CONTENT_CLASS } from '@/components/settings/settingsSaveBar';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();


function stageCountLabel(count) {
  return count === 1
    ? t('settings.salesPipeStageCountOne', { count })
    : t('settings.salesPipeStageCountOther', { count });
}

const STAGE_STATUS_PREVIEW = {
  open: 'border-gray-200 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200',
  won: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200',
  lost: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-200',
  stalled: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200'
};

function getStagePreviewClasses(stage) {
  return STAGE_STATUS_PREVIEW[stage.status] || STAGE_STATUS_PREVIEW.open;
}

function getStagePreviewStyle(stage) {
  if (stage.status === 'open' && stage.color) {
    return { borderColor: `${stage.color}40`, backgroundColor: `${stage.color}12` };
  }
  return {};
}

function updateStageStatus(stage, value) {
  stage.status = value;
  onStageStatusChange(stage);
}

const loading = ref(true);
const error = ref('');
const dealsModule = ref(null);
const pipelineSettings = ref([]);
const selectedPipelineKey = ref('');
const isSaving = ref(false);
const originalSnapshot = ref('');
const stageDragSourceIndex = ref(null);
const stageDragOverIndex = ref(null);
const pipelineDragSourceIndex = ref(null);
const pipelineDragOverIndex = ref(null);
const pipelineDetailRef = ref(null);
const stageListEndRef = ref(null);
const highlightedStageKey = ref(null);

const STAGE_GRID_CLASS = 'lg:grid-cols-[2.625rem_minmax(0,1fr)_10rem_5.5rem_9rem_2rem]';

const DEFAULT_PIPELINE_COLOR = '#2563EB';
const DEFAULT_STAGE_COLOR = '#6B7280';
const DEFAULT_STAGE_COLORS = ['#6B7280', '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

function getDefaultStageDefinitions() {
  return [
    { name: t('settings.salesPipeStageNew'), probability: 0, status: 'open', color: DEFAULT_STAGE_COLORS[0] },
    { name: t('settings.salesPipeStageQualification'), probability: 25, status: 'open', color: DEFAULT_STAGE_COLORS[1] },
    { name: t('settings.salesPipeStageProposal'), probability: 50, status: 'open', color: DEFAULT_STAGE_COLORS[2] },
    { name: t('settings.salesPipeStageNegotiation'), probability: 70, status: 'open', color: DEFAULT_STAGE_COLORS[3] },
    { name: t('settings.salesPipeStageContractSent'), probability: 85, status: 'open', color: DEFAULT_STAGE_COLORS[4] },
    { name: t('settings.salesPipeStageClosedWon'), probability: 100, status: 'won', color: DEFAULT_STAGE_COLORS[5] },
    { name: t('settings.salesPipeStageClosedLost'), probability: 0, status: 'lost', color: DEFAULT_STAGE_COLORS[6] }
  ];
}

const pipelineStageStatusOptions = computed(() => [
  { value: 'open', label: t('settings.salesPipeStatusOpen') },
  { value: 'won', label: t('settings.salesPipeStatusWon') },
  { value: 'lost', label: t('settings.salesPipeStatusLost') }
]);

const currentPipeline = computed(() => {
  if (!pipelineSettings.value.length) return null;
  if (selectedPipelineKey.value) {
    return pipelineSettings.value.find(p => p.key === selectedPipelineKey.value) || pipelineSettings.value[0] || null;
  }
  return pipelineSettings.value[0] || null;
});

const isDirty = computed(() => {
  if (!originalSnapshot.value) return false;
  return JSON.stringify(normalizePipelineSettings(pipelineSettings.value)) !== originalSnapshot.value;
});

function slugify(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePipelineSettings(settings = []) {
  const defaultStageDefs = getDefaultStageDefinitions();
  const source = Array.isArray(settings) && settings.length ? settings : getDefaultPipelineSettingsLocal();
  const normalized = source.map((pipeline, pipelineIndex) => {
    const name = (pipeline.name || t('settings.salesPipeDefaultNameNumbered', { number: pipelineIndex + 1 })).trim();
    let key = pipeline.key ? slugify(pipeline.key) : slugify(name);
    if (!key) key = `pipeline-${pipelineIndex + 1}`;
    const color = pipeline.color || DEFAULT_PIPELINE_COLOR;
    const stagesSource = Array.isArray(pipeline.stages) && pipeline.stages.length ? pipeline.stages : defaultStageDefs;
    const stages = stagesSource.map((stage, stageIndex) => {
      const stageName = (stage.name || defaultStageDefs[stageIndex]?.name || t('settings.salesPipeDefaultStageNumbered', { number: stageIndex + 1 })).trim();
      let stageKeyRaw = stage.key ? slugify(stage.key) : slugify(`${key}-${stageName}`);
      if (!stageKeyRaw) stageKeyRaw = `${key}-stage-${stageIndex + 1}`;
      const status = ['open', 'won', 'lost', 'stalled'].includes(stage.status) ? stage.status : (defaultStageDefs[stageIndex]?.status || 'open');
      let probability = typeof stage.probability === 'number' ? stage.probability : (defaultStageDefs[stageIndex]?.probability ?? 0);
      if (status === 'won') probability = 100;
      if (status === 'lost') probability = 0;
      probability = Math.min(100, Math.max(0, Number(probability) || 0));
      const color = stage.color && /^#[0-9A-Fa-f]{6}$/.test(stage.color) ? stage.color : (defaultStageDefs[stageIndex]?.color || DEFAULT_STAGE_COLOR);
      return {
        key: stageKeyRaw,
        name: stageName,
        description: stage.description || '',
        probability,
        status,
        order: stageIndex,
        color,
        isClosedWon: status === 'won',
        isClosedLost: status === 'lost',
        playbook: stage.playbook || { enabled: false, actions: [], mode: 'sequential', exitCriteria: { type: 'manual' }, notes: '' }
      };
    });
    return {
      key,
      name,
      description: pipeline.description || '',
      color,
      isDefault: pipeline.isDefault === true,
      order: pipelineIndex,
      stages
    };
  });

  if (!normalized.length) {
    return normalizePipelineSettings(getDefaultPipelineSettingsLocal());
  }

  const seenKeys = new Set();
  normalized.forEach((pipeline, index) => {
    const baseKey = pipeline.key;
    while (seenKeys.has(pipeline.key)) {
      pipeline.key = `${baseKey}-${index}`;
    }
    seenKeys.add(pipeline.key);
    pipeline.order = index;
  });

  let defaultFound = false;
  normalized.forEach((pipeline, index) => {
    if (pipeline.isDefault && !defaultFound) {
      defaultFound = true;
    } else if (pipeline.isDefault && defaultFound) {
      pipeline.isDefault = false;
    }
    pipeline.order = index;
  });
  if (!defaultFound && normalized.length) {
    normalized[0].isDefault = true;
  }

  return normalized;
}

function getDefaultPipelineSettingsLocal() {
  return [createDefaultPipeline(t('settings.salesPipeDefaultNameSales'), { isDefault: true })];
}

function createDefaultPipeline(name = t('settings.salesPipeDefaultNamePipeline'), { isDefault = false } = {}) {
  const defaultStageDefs = getDefaultStageDefinitions();
  const pipelineKey = slugify(name) || `pipeline-${Date.now()}`;
  const stages = defaultStageDefs.map((def, index) => {
    const status = ['open', 'won', 'lost', 'stalled'].includes(def.status) ? def.status : 'open';
    let probability = typeof def.probability === 'number' ? def.probability : 0;
    if (status === 'won') probability = 100;
    if (status === 'lost') probability = 0;
    probability = Math.min(100, Math.max(0, Number(probability) || 0));
    const key = slugify(`${pipelineKey}-${def.name}-${index}`) || `${pipelineKey}-stage-${index + 1}`;
    const color = (def.color && /^#[0-9A-Fa-f]{6}$/.test(def.color)) ? def.color : (DEFAULT_STAGE_COLORS[index] || DEFAULT_STAGE_COLOR);
    return {
      key,
      name: def.name,
      description: '',
      probability,
      status,
      order: index,
      color,
      isClosedWon: status === 'won',
      isClosedLost: status === 'lost',
      playbook: { enabled: false, actions: [], mode: 'sequential', exitCriteria: { type: 'manual' }, notes: '' }
    };
  });
  return {
    key: pipelineKey,
    name,
    description: '',
    color: DEFAULT_PIPELINE_COLOR,
    isDefault,
    order: 0,
    stages
  };
}

function applyPipelineSettingsFromSource(raw, preferredPipelineKey = '') {
  const normalized = normalizePipelineSettings(
    Array.isArray(raw) ? JSON.parse(JSON.stringify(raw)) : []
  );
  pipelineSettings.value = normalized;
  if (!normalized.length) {
    selectedPipelineKey.value = '';
    return;
  }
  const preferredStillExists = preferredPipelineKey
    && normalized.some((pipeline) => pipeline.key === preferredPipelineKey);
  selectedPipelineKey.value = preferredStillExists ? preferredPipelineKey : normalized[0].key;
  originalSnapshot.value = JSON.stringify(normalizePipelineSettings(pipelineSettings.value));
}

async function fetchDealsModule(preferredPipelineKey = '') {
  loading.value = true;
  error.value = '';
  try {
    const deals = await fetchModuleDefinitionCached('deals');
    if (!deals) {
      error.value = t('settings.salesPipeErrDealsModule');
      return;
    }
    dealsModule.value = deals;
    applyPipelineSettingsFromSource(deals.pipelineSettings, preferredPipelineKey || selectedPipelineKey.value);
  } catch (err) {
    console.error('Error fetching deals module:', err);
    error.value = err.message || t('settings.salesPipeErrLoadFailed');
  } finally {
    loading.value = false;
  }
}

function discardChanges() {
  if (!originalSnapshot.value) return;
  try {
    const restored = JSON.parse(originalSnapshot.value);
    pipelineSettings.value = normalizePipelineSettings(Array.isArray(restored) ? restored : []);
    if (pipelineSettings.value.length && !pipelineSettings.value.some(p => p.key === selectedPipelineKey.value)) {
      selectedPipelineKey.value = pipelineSettings.value[0].key;
    }
    highlightedStageKey.value = null;
  } catch (e) {
    console.error('Discard changes failed', e);
  }
}

async function savePipelines() {
  if (!dealsModule.value || isSaving.value) return;
  isSaving.value = true;
  const preferredPipelineKey = selectedPipelineKey.value;
  try {
    const normalized = normalizePipelineSettings(pipelineSettings.value);
    const url = dealsModule.value.type === 'system'
      ? `/api/modules/system/${dealsModule.value.key}`
      : `/api/modules/${dealsModule.value._id}`;
    const data = await apiClient.put(url, { pipelineSettings: normalized });
    if (!data.success) {
      notifications.error(data.message || t('settings.salesPipeAlertSaveFailed'));
      return;
    }
    const savedPipelines = data.data?.pipelineSettings;
    if (Array.isArray(savedPipelines) && savedPipelines.length) {
      applyPipelineSettingsFromSource(savedPipelines, preferredPipelineKey);
    } else {
      applyPipelineSettingsFromSource(normalized, preferredPipelineKey);
    }
    highlightedStageKey.value = null;
    notifications.success(t('settings.salesPipeAlertSaveSuccess'));
  } catch (e) {
    console.error('Save pipelines failed', e);
    notifications.error(t('settings.salesPipeAlertSaveError', { message: e.message || t('settings.salesPipeUnknownError') }));
  } finally {
    isSaving.value = false;
  }
}

function refreshPipelineOrders() {
  pipelineSettings.value.forEach((pipeline, index) => {
    pipeline.order = index;
    pipeline.stages.forEach((stage, stageIndex) => {
      stage.order = stageIndex;
    });
  });
}

function addPipeline() {
  const count = pipelineSettings.value.length;
  const name = count === 0 ? t('settings.salesPipeDefaultNameSales') : t('settings.salesPipeDefaultNameNumbered', { number: count + 1 });
  const isDefault = count === 0 && !pipelineSettings.value.some(p => p.isDefault);
  const pipeline = createDefaultPipeline(name, { isDefault });
  pipeline.order = count;
  pipelineSettings.value.push(pipeline);
  selectedPipelineKey.value = pipeline.key;
  refreshPipelineOrders();
}

function removePipeline(pipelineKey) {
  const pipeline = pipelineSettings.value.find(p => p.key === pipelineKey);
  if (!pipeline) return;
  if (pipeline.isDefault) {
    notifications.error(t('settings.salesPipeAlertSetDefaultFirst'));
    return;
  }
  if (pipelineSettings.value.length <= 1) {
    notifications.warning(t('settings.salesPipeAlertMinOnePipeline'));
    return;
  }
  const index = pipelineSettings.value.findIndex(p => p.key === pipelineKey);
  pipelineSettings.value.splice(index, 1);
  refreshPipelineOrders();
  if (selectedPipelineKey.value === pipelineKey) {
    selectedPipelineKey.value = pipelineSettings.value[0]?.key || '';
  }
}

function resetPipelineDrag() {
  pipelineDragSourceIndex.value = null;
  pipelineDragOverIndex.value = null;
}

function onPipelineDragStart(index, event) {
  pipelineDragSourceIndex.value = index;
  pipelineDragOverIndex.value = index;
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
}

function onPipelineDragOver(index) {
  pipelineDragOverIndex.value = index;
}

function onPipelineDrop(toIndex) {
  const from = pipelineDragSourceIndex.value;
  if (from === null) return;
  let to = toIndex;
  if (to > pipelineSettings.value.length) to = pipelineSettings.value.length;
  if (from === to) {
    resetPipelineDrag();
    return;
  }
  const [pipeline] = pipelineSettings.value.splice(from, 1);
  if (from < to) to -= 1;
  pipelineSettings.value.splice(to, 0, pipeline);
  refreshPipelineOrders();
  if (selectedPipelineKey.value === pipeline.key) {
    selectedPipelineKey.value = pipeline.key;
  }
  resetPipelineDrag();
}

function onPipelineListDragOver() {
  pipelineDragOverIndex.value = pipelineSettings.value.length;
}

function onPipelineListDrop() {
  onPipelineDrop(pipelineSettings.value.length);
}

function setDefaultPipeline(pipelineKey) {
  pipelineSettings.value.forEach(p => {
    p.isDefault = (p.key === pipelineKey);
  });
}

function addStageToPipeline(pipeline) {
  if (!pipeline) return;
  const stageIndex = pipeline.stages.length;
  const stageName = t('settings.salesPipeDefaultStageNumbered', { number: stageIndex + 1 });
  const status = 'open';
  const probability = 0;
  const key = slugify(`${pipeline.key}-${stageName}-${stageIndex}`) || `${pipeline.key}-stage-${stageIndex + 1}`;
  const newStage = {
    key,
    name: stageName,
    description: '',
    probability,
    status,
    order: stageIndex,
    color: DEFAULT_STAGE_COLOR,
    isClosedWon: false,
    isClosedLost: false,
    playbook: { enabled: false, actions: [], mode: 'sequential', exitCriteria: { type: 'manual' }, notes: '' }
  };
  pipeline.stages.push(newStage);
  pipeline.stages.forEach((stage, idx) => (stage.order = idx));
  highlightedStageKey.value = newStage.key;
  nextTick(() => {
    stageListEndRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
}

function removeStageFromPipeline(pipeline, stageIndex) {
  if (!pipeline) return;
  if (pipeline.stages.length <= 1) {
    notifications.warning(t('settings.salesPipeAlertMinOneStage'));
    return;
  }
  pipeline.stages.splice(stageIndex, 1);
  pipeline.stages.forEach((stage, idx) => (stage.order = idx));
}

function resetStageDrag() {
  stageDragSourceIndex.value = null;
  stageDragOverIndex.value = null;
}

function onStageDragStart(stageIndex, event) {
  stageDragSourceIndex.value = stageIndex;
  stageDragOverIndex.value = stageIndex;
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(stageIndex));
  }
}

function onStageDragOver(stageIndex) {
  stageDragOverIndex.value = stageIndex;
}

function onStageDrop(stageIndex) {
  const pipeline = currentPipeline.value;
  if (!pipeline?.stages?.length) {
    resetStageDrag();
    return;
  }
  const from = stageDragSourceIndex.value;
  if (from === null) {
    resetStageDrag();
    return;
  }
  let to = stageIndex;
  if (to > pipeline.stages.length) to = pipeline.stages.length;
  if (from === to) {
    resetStageDrag();
    return;
  }
  const [stage] = pipeline.stages.splice(from, 1);
  if (from < to) to -= 1;
  pipeline.stages.splice(to, 0, stage);
  pipeline.stages.forEach((s, idx) => (s.order = idx));
  resetStageDrag();
}

function onStageListDragOver() {
  if (currentPipeline.value?.stages?.length != null) {
    stageDragOverIndex.value = currentPipeline.value.stages.length;
  }
}

function onStageListDrop() {
  if (!currentPipeline.value?.stages?.length) {
    resetStageDrag();
    return;
  }
  onStageDrop(currentPipeline.value.stages.length);
}

function clampStageProbability(stage) {
  if (stage.status === 'won') {
    stage.probability = 100;
  } else if (stage.status === 'lost') {
    stage.probability = 0;
  } else {
    stage.probability = Math.min(100, Math.max(0, Number(stage.probability) || 0));
  }
}

function onStageStatusChange(stage) {
  if (stage.status === 'won') {
    stage.probability = 100;
    stage.isClosedWon = true;
    stage.isClosedLost = false;
  } else if (stage.status === 'lost') {
    stage.probability = 0;
    stage.isClosedWon = false;
    stage.isClosedLost = true;
  } else {
    stage.isClosedWon = false;
    stage.isClosedLost = false;
  }
}

onMounted(() => {
  fetchDealsModule();
});
</script>
