<template>
  <div class="space-y-6" :class="isDirty ? SETTINGS_SAVE_BAR_CONTENT_CLASS : ''">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="h-full flex flex-col lg:flex-row gap-4">
      <aside class="w-full lg:w-80 flex-none bg-white dark:bg-gray-900/60 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.salesPipeSidebarPipelines') }}</div>
          <button @click="addPipeline" class="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm hover:shadow">
            {{ t('actions.add') }}
          </button>
        </div>
        <div
          class="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800"
          @dragover.prevent="onPipelineListDragOver"
          @drop.prevent="onPipelineListDrop"
        >
          <div
            v-for="(pipeline, index) in pipelineSettings"
            :key="pipeline.key || index"
            :class="[
              'p-4 cursor-pointer transition-all duration-200',
              selectedPipelineKey === pipeline.key
                ? 'bg-indigo-50 dark:bg-indigo-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-white/5',
              pipelineDragOverIndex === index ? 'ring-2 ring-indigo-500/60 dark:ring-indigo-400/70' : ''
            ]"
            draggable="true"
            @click="selectedPipelineKey = pipeline.key"
            @dragstart="onPipelineDragStart(index, $event)"
            @dragover.prevent="onPipelineDragOver(index)"
            @drop.prevent="onPipelineDrop(index)"
            @dragend="resetPipelineDrag"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 min-w-0">
                <div class="cursor-grab active:cursor-grabbing select-none text-gray-400 dark:text-gray-500 flex-shrink-0" :title="t('settings.salesPipeDragReorder')">⋮⋮</div>
                <span class="w-2.5 h-2.5 rounded-full border border-white shadow flex-shrink-0" :style="{ backgroundColor: pipeline.color || DEFAULT_PIPELINE_COLOR }"></span>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ pipeline.name }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ stageCountLabel(pipeline.stages?.length || 0) }}</p>
                </div>
              </div>
              <span v-if="pipelineSettings.length > 1 && pipeline.isDefault" class="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex-shrink-0">{{ t('settings.salesPipeDefaultBadge') }}</span>
            </div>
            <div v-if="pipelineSettings.length > 1" class="flex items-center gap-2 mt-3">
              <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="radio"
                  name="default-pipeline"
                  class="text-indigo-600 border-gray-300 dark:border-gray-600 focus:ring-indigo-500"
                  :checked="pipeline.isDefault"
                  @change.stop="setDefaultPipeline(pipeline.key)"
                />
                {{ t('settings.salesPipeDefaultBadge') }}
              </label>
              <div class="ml-auto flex items-center gap-1">
                <button
                  class="p-1 rounded text-red-500 hover:text-red-600 transition-colors"
                  @click.stop="removePipeline(pipeline.key)"
                  :title="t('settings.salesPipeRemovePipelineTitle')"
                >
                  <TrashIcon class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div
            v-if="pipelineSettings.length > 1"
            class="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50/40 dark:bg-white/5 text-center text-xs text-gray-500 dark:text-gray-400 transition-colors"
            :class="pipelineDragOverIndex === pipelineSettings.length ? 'border-indigo-400 text-indigo-600 dark:text-indigo-300' : ''"
            @dragover.prevent="onPipelineDragOver(pipelineSettings.length)"
            @drop.prevent="onPipelineDrop(pipelineSettings.length)"
          >
            {{ t('settings.salesPipeDropPipelineEnd') }}
          </div>
          <div v-if="!pipelineSettings.length" class="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.salesPipeEmptyPipelines') }}
          </div>
        </div>
      </aside>
      <section ref="pipelineDetailRef" class="flex-1 min-w-0 bg-white dark:bg-gray-900/60 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col">
        <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {{ currentPipeline?.name || t('settings.salesPipeSelectPipeline') }}
            </p>
            <p v-if="currentPipeline" class="text-xs text-gray-500 dark:text-gray-400">
              {{ stageCountLabel(currentPipeline.stages?.length || 0) }}
              <template v-if="pipelineSettings.length > 1"> · {{ currentPipeline.isDefault ? t('settings.salesPipeDefaultPipelineLabel') : t('settings.salesPipeCustomPipelineLabel') }}</template>
            </p>
          </div>
        </div>
        <div v-if="currentPipeline" class="p-4 space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.salesPipeLabelPipelineName') }}</label>
              <input v-model="currentPipeline.name" class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.salesPipeLabelColor') }}</label>
              <div class="flex items-center gap-3">
                <input type="color" v-model="currentPipeline.color" class="w-14 h-10 border border-gray-300 dark:border-gray-600 rounded focus:outline-none" />
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.salesPipeColorHint') }}</span>
              </div>
            </div>
            <div v-if="pipelineSettings.length > 1" class="md:col-span-2 flex items-center gap-3">
              <span v-if="currentPipeline.isDefault" class="px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">{{ t('settings.salesPipeDefaultPipelineLabel') }}</span>
              <button
                v-else
                @click="setDefaultPipeline(currentPipeline.key)"
                class="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
              >
                {{ t('settings.salesPipeSetAsDefault') }}
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3">
            <div>
              <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.salesPipeStagesTitle') }}</h4>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.salesPipeStagesSubtitle') }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button @click="addStageToPipeline(currentPipeline)" class="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm hover:shadow">
                {{ t('settings.salesPipeAddStage') }}
              </button>
            </div>
          </div>

          <div class="pr-1 space-y-3 pb-16" @dragover.prevent="onStageListDragOver" @drop.prevent="onStageListDrop">
            <div
              v-for="(stage, stageIndex) in currentPipeline.stages"
              :key="stage.key || stageIndex"
              class="border rounded-xl p-4 transition-all duration-300"
              :class="[
                highlightedStageKey === (stage.key || stageIndex)
                  ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/60 dark:ring-indigo-400/70 bg-indigo-50/80 dark:bg-indigo-900/30 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50',
                !highlightedStageKey && stageDragOverIndex === stageIndex ? 'ring-2 ring-indigo-500/60 dark:ring-indigo-400/70' : ''
              ]"
              draggable="true"
              @dragstart="onStageDragStart(stageIndex, $event)"
              @dragover.prevent="onStageDragOver(stageIndex)"
              @drop.prevent="onStageDrop(stageIndex)"
              @dragend="resetStageDrag"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="cursor-grab select-none text-gray-400 dark:text-gray-500 flex-shrink-0" :title="t('settings.salesPipeDragReorder')">⋮⋮</div>
                  <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{{ t('settings.salesPipeStageNumber', { number: stageIndex + 1 }) }}</span>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button
                    class="p-1 rounded text-red-500 hover:text-red-600 transition-colors"
                    @click="removeStageFromPipeline(currentPipeline, stageIndex)"
                    :title="t('settings.salesPipeRemoveStageTitle')"
                  >
                    <TrashIcon class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.salesPipeLabelStageName') }}</label>
                  <input v-model="stage.name" class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.salesPipeLabelColor') }}</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="color"
                      :value="stage.color || DEFAULT_STAGE_COLOR"
                      @input="stage.color = $event.target.value"
                      class="h-9 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-white p-0.5 dark:bg-gray-800"
                      :title="t('settings.salesPipeStageColorTitle')"
                    />
                    <span class="px-2.5 py-1 rounded-full text-xs font-medium text-white truncate max-w-[6rem]" :style="{ backgroundColor: stage.color || DEFAULT_STAGE_COLOR }">{{ stage.name || t('settings.salesPipeStageFallback') }}</span>
                  </div>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.salesPipeLabelProbability') }}</label>
                  <input type="number" min="0" max="100" v-model.number="stage.probability" @change="clampStageProbability(stage)" @blur="clampStageProbability(stage)" class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.salesPipeLabelStatus') }}</label>
                  <select v-model="stage.status" @change="onStageStatusChange(stage)" class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm">
                    <option v-for="option in pipelineStageStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </div>
              </div>
            </div>
            <div
              ref="stageListEndRef"
              class="border border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/40 dark:bg-white/5 text-center text-xs text-gray-500 dark:text-gray-400 py-4 transition-colors"
              :class="stageDragOverIndex === currentPipeline.stages.length ? 'border-indigo-400 text-indigo-600 dark:text-indigo-300' : ''"
              @dragover.prevent="onStageDragOver(currentPipeline.stages.length)"
              @drop.prevent="onStageDrop(currentPipeline.stages.length)"
            >
              {{ t('settings.salesPipeDropStageEnd') }}
            </div>
          </div>
        </div>
        <div v-else class="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
          <div class="text-center space-y-3">
            <p>{{ t('settings.salesPipeNoPipelineSelected') }}</p>
            <button @click="addPipeline" class="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">{{ t('settings.salesPipeCreatePipeline') }}</button>
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
import { TrashIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import { SETTINGS_SAVE_BAR_CONTENT_CLASS } from '@/components/settings/settingsSaveBar';

const { t } = useI18n();

function stageCountLabel(count) {
  return count === 1
    ? t('settings.salesPipeStageCountOne', { count })
    : t('settings.salesPipeStageCountOther', { count });
}
const authStore = useAuthStore();
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
  { value: 'lost', label: t('settings.salesPipeStatusLost') },
  { value: 'stalled', label: t('settings.salesPipeStatusStalled') }
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

async function fetchDealsModule() {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiClient.get('/modules');
    if (data.success) {
      const deals = data.data.find(m => m.key === 'deals');
      if (!deals) {
        error.value = t('settings.salesPipeErrDealsModule');
        return;
      }
      dealsModule.value = deals;
      const raw = Array.isArray(deals.pipelineSettings) ? JSON.parse(JSON.stringify(deals.pipelineSettings)) : [];
      pipelineSettings.value = normalizePipelineSettings(raw);
      if (pipelineSettings.value.length) {
        selectedPipelineKey.value = pipelineSettings.value[0].key;
      }
      originalSnapshot.value = JSON.stringify(normalizePipelineSettings(pipelineSettings.value));
    } else {
      error.value = data.message || t('settings.salesPipeErrLoadFailed');
    }
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
  try {
    const normalized = normalizePipelineSettings(pipelineSettings.value);
    const url = dealsModule.value.type === 'system' ? `/api/modules/system/${dealsModule.value.key}` : `/api/modules/${dealsModule.value._id}`;
    const payload = { pipelineSettings: normalized };
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authStore.user?.token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.message || t('settings.salesPipeAlertSaveFailed'));
      return;
    }
    await fetchDealsModule();
    highlightedStageKey.value = null;
    alert(t('settings.salesPipeAlertSaveSuccess'));
  } catch (e) {
    console.error('Save pipelines failed', e);
    alert(t('settings.salesPipeAlertSaveError', { message: e.message || t('settings.salesPipeUnknownError') }));
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
    alert(t('settings.salesPipeAlertSetDefaultFirst'));
    return;
  }
  if (pipelineSettings.value.length <= 1) {
    alert(t('settings.salesPipeAlertMinOnePipeline'));
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
    alert(t('settings.salesPipeAlertMinOneStage'));
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
