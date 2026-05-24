<template>
  <section class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <div class="grid grid-cols-1 gap-2 md:grid-cols-4">
      <label class="space-y-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{{ t('dashboard.dashboardFiltersTeamRep') }}<select :value="repId" @change="$emit('update:repId', $event.target.value)" class="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <option value="all">{{ t('dashboard.dashboardFiltersAllReps') }}</option>
          <option v-for="rep in repFilterOptions" :key="rep.repId" :value="rep.repId">{{ rep.name }}</option>
        </select>
      </label>
      <label class="space-y-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{{ t('settings.assignRulesCondFieldPipeline') }}<select :value="pipeline" @change="$emit('update:pipeline', $event.target.value)" class="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <option value="all">{{ t('dashboard.dashboardFiltersAllPipelines') }}</option>
          <option v-for="item in pipelineFilterOptions" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <label class="space-y-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{{ t('dashboard.dashboardFiltersDealType') }}<select :value="dealType" @change="$emit('update:dealType', $event.target.value)" class="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <option value="all">{{ t('dashboard.dashboardFiltersAllTypes') }}</option>
          <option v-for="type in dealTypeOptions" :key="type" :value="type">{{ type }}</option>
        </select>
      </label>
      <div class="flex items-end">
        <button type="button" @click="$emit('reset')" class="w-full rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20">{{ t('settings.peopleTypesReset') }}</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
defineProps({
  repId: { type: String, required: true },
  pipeline: { type: String, required: true },
  dealType: { type: String, required: true },
  repFilterOptions: { type: Array, required: true },
  pipelineFilterOptions: { type: Array, required: true },
  dealTypeOptions: { type: Array, required: true }
});

const { t } = useI18n();

defineEmits(['update:repId', 'update:pipeline', 'update:dealType', 'reset']);
</script>
