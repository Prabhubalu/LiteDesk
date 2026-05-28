<template>
  <div class="space-y-6 pb-24">
    <div class="flex items-start gap-3">
      <button
        type="button"
        class="mt-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        :title="t('settings.assignRulesBackTitle')"
        @click="goBackToAutomation"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.automationAssignmentRules') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.assignRulesSubtitle') }}
        </p>
      </div>
    </div>

    <div class="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-xl p-4">
      <div class="flex gap-3">
        <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="text-sm text-indigo-900 dark:text-indigo-100 space-y-2">
          <p class="font-medium">{{ t('settings.assignRulesInfoTitle') }}</p>
          <p class="text-indigo-800/90 dark:text-indigo-200/90">
            {{ t('settings.assignRulesInfoBody1') }}
          </p>
          <p class="text-indigo-800/90 dark:text-indigo-200/90">
            {{ t('settings.assignRulesInfoBody2Before') }}<span class="font-mono text-xs">{{ assignmentSchedulerEnvVar }}</span>{{ t('settings.assignRulesInfoBody2After') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Scope -->
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col lg:flex-row lg:items-end gap-4">
      <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesLabelApplication') }}</label>
          <select
            v-model="scopeApp"
            class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option v-for="app in appOptions" :key="app.key" :value="app.key">{{ app.label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesLabelModule') }}</label>
          <select
            v-model="scopeModule"
            class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option v-for="mod in moduleOptionsForApp" :key="mod.key" :value="mod.key">{{ mod.label }}</option>
          </select>
        </div>
      </div>
      <button
        type="button"
        class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        :disabled="loading"
        @click="loadRuleSet"
      >
        {{ t('actions.refresh') }}
      </button>
    </div>

    <div v-if="loadError" class="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {{ loadError }}
    </div>

    <div v-else-if="loading" class="flex justify-center py-16">
      <div class="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
    </div>

    <template v-else>
      <!-- Rule set controls -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.assignRulesRuleSetTitle') }}</h3>
          <div class="flex flex-wrap items-center gap-3">
            <label
              class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-help"
              :title="t('settings.assignRulesEnabledTitle')"
            >
              <input v-model="meta.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              {{ t('settings.assignRulesEnabled') }}
            </label>
            <label
              class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-help"
              :title="t('settings.assignRulesSimulationTitle')"
            >
              <input v-model="meta.simulationOnly" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              {{ t('settings.assignRulesSimulationOnly') }}
            </label>
          </div>
        </div>
        <p v-if="!meta.simulationOnly" class="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
          {{ t('settings.assignRulesLiveWarning') }}
        </p>
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesWhenRulesChange') }}</label>
          <select
            v-model="meta.applyStrategy"
            class="w-full max-w-md px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option v-for="opt in applyStrategyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>

      <!-- Rules -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.assignRulesRulesTitle') }}</h3>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            @click="addRule"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {{ t('settings.assignRulesAddRule') }}
          </button>
        </div>

        <p v-if="rules.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-8 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-xl px-4">
          {{ t('settings.assignRulesEmpty') }}
          <span class="block mt-2 text-xs text-gray-400 dark:text-gray-500">
            {{ t('settings.assignRulesEmptyHint') }}
          </span>
        </p>

        <div v-for="(rule, idx) in rules" :key="rule.ruleId + '-' + idx" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40"
            @click="toggleExpand(rule.ruleId)"
          >
            <svg
              class="w-4 h-4 text-gray-500 transition-transform flex-shrink-0"
              :class="{ 'rotate-90': expanded[rule.ruleId] }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            <span class="font-medium text-gray-900 dark:text-white truncate">{{ rule.name || t('settings.assignRulesUntitled') }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">#{{ rule.order }}</span>
            <span v-if="!rule.enabled" class="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200">{{ t('settings.assignRulesOff') }}</span>
            <span class="ml-auto text-xs text-gray-400">{{ triggerLabel(rule.triggerType) }}</span>
          </button>
          <div v-show="expanded[rule.ruleId]" class="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesLabelName') }}</label>
                <input v-model="rule.name" type="text" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div class="flex items-end gap-4">
                <div class="flex-1">
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesLabelOrder') }}</label>
                  <input v-model.number="rule.order" type="number" min="0" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pb-2">
                  <input v-model="rule.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                  {{ t('settings.assignRulesEnabled') }}
                </label>
              </div>
            </div>

            <div>
              <label
                class="block text-xs text-gray-500 dark:text-gray-400 mb-1 cursor-help"
                :title="t('settings.assignRulesTriggerTitle')"
              >{{ t('settings.assignRulesTrigger') }}</label>
              <select v-model="rule.triggerType" class="w-full max-w-md px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option v-for="opt in triggerTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <div v-if="rule.triggerType === 'delayed'" class="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesDelayMinutes') }}</label>
                <input v-model.number="rule.triggerConfig.delayMinutes" type="number" min="1" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
              </div>
              <label
                class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mt-6 cursor-help"
                :title="t('settings.assignRulesDelayedRecheckTitle')"
              >
                <input v-model="rule.triggerConfig.recheckConditionsAtExecution" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                {{ t('settings.assignRulesRecheckBeforeAssign') }}
              </label>
            </div>

            <div v-if="rule.triggerType === 'scheduled'" class="space-y-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesScheduleType') }}</label>
                  <select v-model="rule.triggerConfig.scheduleType" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                    <option v-for="opt in scheduleTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesFrequency') }}</label>
                  <select v-model="rule.triggerConfig.frequency" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                    <option v-for="opt in frequencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesCron') }}</label>
                  <input v-model.trim="rule.triggerConfig.cron" type="text" :placeholder="t('settings.assignRulesCronPh')" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-mono" />
                </div>
              </div>
              <label
                class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-help"
                :title="t('settings.assignRulesScheduledRecheckTitle')"
              >
                <input v-model="rule.triggerConfig.recheckConditionsAtExecution" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                {{ t('settings.assignRulesRecheckAtRun') }}
              </label>
            </div>

            <!-- Conditions -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesConditions') }}</label>
                <button type="button" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline" @click="addClause(rule)">{{ t('settings.assignRulesAddClause') }}</button>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {{ t('settings.assignRulesConditionsHintBefore') }}<span class="font-mono">{{ customFieldsPathExample }}</span>{{ t('settings.assignRulesConditionsHintAfter') }}
              </p>
              <div class="space-y-2">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs text-gray-500">{{ t('settings.assignRulesMatch') }}</span>
                  <select v-model="rule.conditions.combinator" class="text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1">
                    <option v-for="opt in combinatorOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div
                  v-for="(clause, cIdx) in rule.conditions.clauses"
                  :key="cIdx"
                  class="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
                >
                  <div class="md:col-span-3 space-y-1">
                    <label class="block text-xs text-gray-500 mb-1">{{ t('settings.assignRulesField') }}</label>
                    <select
                      :value="clauseFieldPresetValue(clause)"
                      class="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                      @change="onClauseFieldPresetChange(clause, $event)"
                    >
                      <option value="">{{ t('settings.assignRulesSelectField') }}</option>
                      <option v-for="opt in conditionFieldOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                      <option value="__custom__">{{ t('settings.assignRulesCustomPath') }}</option>
                    </select>
                    <input
                      v-if="clauseFieldIsCustom(clause)"
                      v-model.trim="clause.field"
                      type="text"
                      :placeholder="t('settings.assignRulesCustomPathPh')"
                      class="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-mono"
                    />
                  </div>
                  <div class="md:col-span-3">
                    <label class="block text-xs text-gray-500 mb-1">{{ t('settings.assignRulesOperator') }}</label>
                    <select
                      v-model="clause.operator"
                      class="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                      @change="onClauseOperatorChange(clause)"
                    >
                      <option v-for="op in operators" :key="op.value" :value="op.value">{{ op.label }}</option>
                    </select>
                  </div>
                  <div class="md:col-span-5">
                    <label class="block text-xs text-gray-500 mb-1">{{ t('settings.assignRulesValue') }}</label>
                    <template v-if="clause.operator === 'exists'">
                      <p class="text-xs text-gray-500 dark:text-gray-400 py-2">{{ t('settings.assignRulesNoValue') }}</p>
                    </template>
                    <select
                      v-else-if="clauseValueOptionList(clause)"
                      v-model="clause.value"
                      class="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">{{ t('settings.assignRulesSelectValue') }}</option>
                      <option v-for="opt in clauseValueOptionList(clause)" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
                    </select>
                    <input
                      v-else
                      v-model.trim="clause.value"
                      type="text"
                      :placeholder="clauseValuePlaceholder(clause)"
                      class="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div class="md:col-span-1 flex justify-end">
                    <button type="button" class="p-1.5 text-gray-400 hover:text-red-600" :title="t('settings.assignRulesRemoveTitle')" @click="removeClause(rule, cIdx)">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesPrimaryGroup') }}</label>
                <select v-model="rule.primaryGroupId" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                  <option disabled value="">{{ t('settings.assignRulesSelectGroup') }}</option>
                  <option v-for="g in groups" :key="g._id" :value="String(g._id)">{{ g.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesDistribution') }}</label>
                <select v-model="rule.distribution.mode" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                  <option v-for="opt in distributionModeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <p
                  v-if="rule.distribution.mode === 'availability_based'"
                  class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                >
                  {{ t('settings.assignRulesAvailabilityHint') }}
                </p>
              </div>
            </div>
            <div v-if="rule.distribution.mode === 'queue'" class="max-w-xs">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesClaimTimeout') }}</label>
              <input v-model.number="rule.distribution.queueClaimTimeoutMinutes" type="number" min="1" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
            </div>

            <div>
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesFallbackGroups') }}</label>
              <select v-model="rule.fallbackGroupIds" multiple class="w-full min-h-[88px] px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                <option v-for="g in groups" :key="'fb-' + g._id" :value="String(g._id)">{{ g.name }}</option>
              </select>
            </div>

            <div class="p-3 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
              <label class="inline-flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                <input v-model="rule.escalation.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                {{ t('settings.assignRulesEscalation') }}
              </label>
              <div v-if="rule.escalation.enabled" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">{{ t('settings.assignRulesAction') }}</label>
                  <select v-model="rule.escalation.actionType" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                    <option v-for="opt in escalationActionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">{{ t('settings.assignRulesThreshold') }}</label>
                  <input v-model.number="rule.escalation.thresholdPercent" type="number" min="1" max="100" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 mb-1">{{ t('settings.assignRulesCooldown') }}</label>
                  <input v-model.number="rule.escalation.cooldownMinutes" type="number" min="0" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                </div>
                <div class="md:col-span-2">
                  <label class="block text-xs text-gray-500 mb-1">{{ t('settings.assignRulesChainGroups') }}</label>
                  <select v-model="rule.escalation.chainGroupIds" multiple class="w-full min-h-[72px] px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                    <option v-for="g in groups" :key="'ch-' + g._id" :value="String(g._id)">{{ g.name }}</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="p-3 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
              <p class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ t('settings.assignRulesReassignment') }}</p>
              <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input v-model="rule.reassignment.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                {{ t('settings.assignRulesAllowReassign') }}
              </label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs text-gray-500 mb-1">{{ t('settings.assignRulesOnRevert') }}</label>
                  <select v-model="rule.reassignment.revertMode" class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                    <option v-for="opt in revertModeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mt-6">
                  <input v-model="rule.reassignment.lockOnManualOverride" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                  {{ t('settings.assignRulesLockManual') }}
                </label>
              </div>
            </div>

            <div class="flex justify-end">
              <button type="button" class="text-sm text-red-600 dark:text-red-400 hover:underline" @click="removeRule(idx)">{{ t('settings.assignRulesRemoveRule') }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Simulation -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.assignRulesSimulationTitle2') }}</h3>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 hover:opacity-90 disabled:opacity-50"
            :disabled="simulating"
            @click="runSimulation"
          >
            {{ simulating ? t('settings.assignRulesRunning') : t('settings.assignRulesRunSimulation') }}
          </button>
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesSampleRecord') }}</label>
          <textarea v-model="simulateRecordJson" rows="6" class="w-full px-3 py-2 font-mono text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.assignRulesContextJson') }}</label>
          <textarea v-model="simulateContextJson" rows="3" class="w-full px-3 py-2 font-mono text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
        </div>
        <div v-if="simulateError" class="text-sm text-red-600 dark:text-red-400">{{ simulateError }}</div>
        <pre v-if="simulateResult" class="text-xs overflow-x-auto p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">{{ formattedSimulation }}</pre>
      </div>
    </template>

    <!-- Sticky save -->
    <div
      class="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 py-3 flex flex-wrap items-center justify-end gap-3"
    >
      <span v-if="saveError" class="text-sm text-red-600 dark:text-red-400 mr-auto">{{ saveError }}</span>
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        :disabled="saving || loading"
        @click="loadRuleSet"
      >
        {{ t('settings.assignRulesReset') }}
      </button>
      <button
        type="button"
        class="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        :disabled="saving || loading || !isDirty"
        @click="save"
      >
        {{ saving ? t('states.saving') : t('settings.saveChanges') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { usePeopleTypes } from '@/composables/usePeopleTypes';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
/** Technical literals (not translated). */
const assignmentSchedulerEnvVar = 'ENABLE_ASSIGNMENT_SCHEDULER';
const customFieldsPathExample = 'customFields.myKey';
const route = useRoute();
const router = useRouter();
const { success: notifySuccess } = useNotifications();

const MODULE_LABEL_KEYS = {
  cases: 'settings.assignRulesModCases',
  people: 'settings.assignRulesModPeople',
  organizations: 'settings.assignRulesModOrganizations',
  deals: 'settings.assignRulesModDeals',
  tasks: 'settings.assignRulesModTasks',
  events: 'settings.assignRulesModEvents',
  items: 'settings.assignRulesModItems',
  forms: 'settings.assignRulesModForms'
};

const APP_MODULES = {
  HELPDESK: ['cases'],
  SALES: ['people', 'organizations', 'deals', 'tasks', 'events', 'items', 'forms']
};

/** Preset condition fields per scope (paths must match server record shape; engine supports dot paths). */
const ASSIGNMENT_CONDITION_FIELD_OPTIONS = {
  'HELPDESK:cases': [
    'priority',
    'status',
    'caseType',
    'channel',
    'title',
    'caseId',
    'contactId',
    'organizationRefId',
    'caseOwnerId',
    'source'
  ],
  'SALES:people': [
    'assignedTo',
    'lead_owner',
    'organization',
    'derivedStatus',
    'first_name',
    'last_name',
    'email',
    'type',
    'sales_type',
    'lead_status',
    'contact_status',
    'helpdesk_role',
    'role',
    'preferred_contact_method',
    'do_not_contact',
    'tags'
  ],
  'SALES:organizations': [
    'name',
    'assignedTo',
    'types',
    'customerStatus',
    'partnerStatus',
    'vendorStatus',
    'derivedStatus',
    'territory',
    'industry',
    'accountManager',
    'tags'
  ],
  'SALES:deals': [
    'name',
    'ownerId',
    'stage',
    'pipeline',
    'status',
    'priority',
    'amount',
    'probability',
    'accountId',
    'contactId',
    'type',
    'derivedStatus',
    'currency',
    'tags'
  ],
  'SALES:tasks': [
    'title',
    'assignedTo',
    'status',
    'priority',
    'dueDate',
    'projectId',
    'relatedTo.type',
    'tags'
  ],
  'SALES:events': ['title', 'status', 'name'],
  'SALES:items': ['name', 'status'],
  'SALES:forms': ['name', 'status'],
  _fallback: ['status', 'title', 'name']
};

function condFieldI18nKey(value) {
  const parts = String(value).replace(/\./g, '_').split('_').filter(Boolean);
  const suffix = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return `settings.assignRulesCondField${suffix}`;
}

function getConditionFieldOptions(appKey, moduleKey) {
  const key = `${String(appKey || '').toUpperCase()}:${String(moduleKey || '').toLowerCase()}`;
  return ASSIGNMENT_CONDITION_FIELD_OPTIONS[key] || ASSIGNMENT_CONDITION_FIELD_OPTIONS._fallback;
}

/** Mirrors `server/constants/caseLifecycle.js` — keep in sync for condition matching. */
const CASE_TYPE_VALUES = ['Support Ticket', 'Complaint', 'Service Request', 'Warranty Claim', 'Internal Case'];
const CASE_PRIORITY_VALUES = ['Low', 'Medium', 'High', 'Critical'];
const CASE_STATUS_VALUES = ['New', 'Assigned', 'In Progress', 'On Hold', 'Resolved', 'Closed'];
const CASE_CHANNEL_VALUES = ['Email', 'Live Chat', 'Phone', 'Customer Portal', 'Partner Portal', 'Internal'];

/**
 * People SALES/HELPDESK participation enums — align with `AttachToAppModal.vue` / People create flows.
 * `sales_type` / `type` / `helpdesk_role` use tenant people-types API via `usePeopleTypes` (fallbacks below).
 */
const PEOPLE_LEAD_STATUS_VALUES = ['New', 'Contacted', 'Qualified', 'Disqualified', 'Nurturing', 'Re-Engage'];
const PEOPLE_CONTACT_STATUS_VALUES = ['Active', 'Inactive', 'DoNotContact'];
const PEOPLE_CONTACT_ROLE_VALUES = ['Decision Maker', 'Influencer', 'Support', 'Other'];
const PEOPLE_PREFERRED_CONTACT_VALUES = ['Email', 'Phone', 'WhatsApp', 'SMS', 'None'];
const PEOPLE_SALES_CLASSIFIER_FALLBACK = ['Lead', 'Contact'];
const PEOPLE_HELPDESK_ROLE_FALLBACK = ['Customer', 'Agent'];

/**
 * Known picklist values per scope + field path (for equals / not_equals / contains UX).
 * For `in` / `not_in`, use JSON array in the text input.
 */
const ASSIGNMENT_CONDITION_VALUE_ENUMS = {
  'HELPDESK:cases': {
    priority: CASE_PRIORITY_VALUES,
    status: CASE_STATUS_VALUES,
    caseType: CASE_TYPE_VALUES,
    channel: CASE_CHANNEL_VALUES
  },
  'SALES:deals': {
    status: ['Open', 'Won', 'Lost', 'Stalled', 'Active', 'Abandoned'],
    priority: ['Low', 'Medium', 'High', 'Urgent'],
    type: ['New Business', 'Existing Customer', 'Existing Business', 'Upsell', 'Renewal', 'Cross-Sell']
  },
  'SALES:tasks': {
    status: ['todo', 'in_progress', 'waiting', 'completed', 'cancelled'],
    priority: ['low', 'medium', 'high', 'urgent'],
    'relatedTo.type': ['contact', 'deal', 'project', 'organization', 'none']
  },
  'SALES:organizations': {
    customerStatus: ['Active', 'Prospect', 'Churned', 'Lead Customer'],
    partnerStatus: ['Active', 'Onboarding', 'Inactive'],
    vendorStatus: ['Approved', 'Pending', 'Suspended']
  },
  'SALES:people': {
    lead_status: PEOPLE_LEAD_STATUS_VALUES,
    contact_status: PEOPLE_CONTACT_STATUS_VALUES,
    role: PEOPLE_CONTACT_ROLE_VALUES,
    preferred_contact_method: PEOPLE_PREFERRED_CONTACT_VALUES
  }
};

function getConditionValueEnumList(appKey, moduleKey, fieldPath) {
  const scopeKey = `${String(appKey || '').toUpperCase()}:${String(moduleKey || '').toLowerCase()}`;
  const f = String(fieldPath || '').trim();
  const map = ASSIGNMENT_CONDITION_VALUE_ENUMS[scopeKey];
  if (!map || !f) return null;
  const list = map[f];
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.map((v) => ({ value: v, label: v }));
}

function clauseValuePlaceholder(clause) {
  const op = String(clause?.operator || 'equals');
  if (op === 'in' || op === 'not_in') {
    return t('settings.assignRulesValueArrayPh');
  }
  return t('settings.assignRulesValuePh');
}

function onClauseOperatorChange(clause) {
  if (clause.operator === 'exists') {
    clause.value = '';
  }
}

const appOptions = computed(() => [
  { key: 'HELPDESK', label: t('settings.assignRulesAppHelpdesk') },
  { key: 'SALES', label: t('settings.assignRulesAppSales') }
]);

const operators = computed(() => [
  { value: 'equals', label: t('settings.assignRulesOpEquals') },
  { value: 'not_equals', label: t('settings.assignRulesOpNotEquals') },
  { value: 'contains', label: t('settings.assignRulesOpContains') },
  { value: 'in', label: t('settings.assignRulesOpIn') },
  { value: 'not_in', label: t('settings.assignRulesOpNotIn') },
  { value: 'exists', label: t('settings.assignRulesOpExists') },
  { value: 'gt', label: t('settings.assignRulesOpGt') },
  { value: 'gte', label: t('settings.assignRulesOpGte') },
  { value: 'lt', label: t('settings.assignRulesOpLt') },
  { value: 'lte', label: t('settings.assignRulesOpLte') }
]);

const applyStrategyOptions = computed(() => [
  { value: 'new_records_only', label: t('settings.assignRulesStrategyNewOnly') },
  { value: 'manual_re_evaluation', label: t('settings.assignRulesStrategyManual') },
  { value: 'freeze_mode', label: t('settings.assignRulesStrategyFreeze') }
]);

const triggerTypeOptions = computed(() => [
  { value: 'immediate', label: t('settings.assignRulesTriggerImmediate') },
  { value: 'delayed', label: t('settings.assignRulesTriggerDelayed') },
  { value: 'scheduled', label: t('settings.assignRulesTriggerScheduled') }
]);

const scheduleTypeOptions = computed(() => [
  { value: 'one_time', label: t('settings.assignRulesScheduleOneTime') },
  { value: 'recurring', label: t('settings.assignRulesScheduleRecurring') }
]);

const frequencyOptions = computed(() => [
  { value: 'daily', label: t('settings.assignRulesFreqDaily') },
  { value: 'weekly', label: t('settings.assignRulesFreqWeekly') },
  { value: 'custom', label: t('settings.assignRulesFreqCustom') }
]);

const combinatorOptions = computed(() => [
  { value: 'all', label: t('settings.assignRulesMatchAll') },
  { value: 'any', label: t('settings.assignRulesMatchAny') }
]);

const distributionModeOptions = computed(() => [
  { value: 'queue', label: t('settings.assignRulesDistQueue') },
  { value: 'round_robin', label: t('settings.assignRulesDistRoundRobin') },
  { value: 'weighted', label: t('settings.assignRulesDistWeighted') },
  { value: 'load_balanced', label: t('settings.assignRulesDistLoadBalanced') },
  { value: 'availability_based', label: t('settings.assignRulesDistAvailability') }
]);

const escalationActionOptions = computed(() => [
  { value: 'reassign_group', label: t('settings.assignRulesEscReassign') },
  { value: 'notify_owner', label: t('settings.assignRulesEscNotifyOwner') },
  { value: 'notify_leadership', label: t('settings.assignRulesEscNotifyLeadership') }
]);

const revertModeOptions = computed(() => [
  { value: 'reapply_rules', label: t('settings.assignRulesRevertReapply') },
  { value: 'revert_previous_owner', label: t('settings.assignRulesRevertPrevious') },
  { value: 'lock_current_owner', label: t('settings.assignRulesRevertLock') }
]);

const scopeApp = ref('HELPDESK');
const scopeModule = ref('cases');

const { types: salesPeopleTypeValues } = usePeopleTypes('SALES');
const { types: helpdeskPeopleTypeValues } = usePeopleTypes('HELPDESK');

/**
 * Picklist options for a condition field (used by Value dropdown and when the Field preset changes).
 */
function resolveConditionValueOptions(appKey, moduleKey, fieldKey) {
  const field = String(fieldKey || '').trim();
  if (!field) return null;
  const ak = String(appKey || '').toUpperCase();
  const mk = String(moduleKey || '').toLowerCase();

  if (ak === 'SALES' && mk === 'people') {
    if (field === 'sales_type' || field === 'type') {
      const t =
        Array.isArray(salesPeopleTypeValues.value) && salesPeopleTypeValues.value.length > 0
          ? salesPeopleTypeValues.value
          : PEOPLE_SALES_CLASSIFIER_FALLBACK;
      return t.map((v) => ({ value: v, label: v }));
    }
    if (field === 'helpdesk_role') {
      const t =
        Array.isArray(helpdeskPeopleTypeValues.value) && helpdeskPeopleTypeValues.value.length > 0
          ? helpdeskPeopleTypeValues.value
          : PEOPLE_HELPDESK_ROLE_FALLBACK;
      return t.map((v) => ({ value: v, label: v }));
    }
    if (field === 'do_not_contact') {
      return [
        { value: 'true', label: t('settings.assignRulesYes') },
        { value: 'false', label: t('settings.assignRulesNo') }
      ];
    }
  }

  return getConditionValueEnumList(appKey, moduleKey, field);
}

function clauseValueOptionList(clause) {
  const op = String(clause?.operator || 'equals');
  if (op === 'exists' || op === 'in' || op === 'not_in') return null;
  if (clauseFieldIsCustom(clause)) return null;
  const field = String(clause?.field || '').trim();
  if (!field) return null;
  return resolveConditionValueOptions(scopeApp.value, scopeModule.value, field);
}

const moduleOptionsForApp = computed(() =>
  (APP_MODULES[scopeApp.value] || APP_MODULES.HELPDESK).map((key) => ({
    key,
    label: t(MODULE_LABEL_KEYS[key] || MODULE_LABEL_KEYS.cases)
  }))
);

const conditionFieldOptions = computed(() =>
  getConditionFieldOptions(scopeApp.value, scopeModule.value).map((value) => ({
    value,
    label: t(condFieldI18nKey(value))
  }))
);

function inferClauseFieldSelect(field) {
  const f = String(field || '').trim();
  if (!f) return 'preset';
  const opts = getConditionFieldOptions(scopeApp.value, scopeModule.value);
  return opts.includes(f) ? 'preset' : 'custom';
}

function clauseFieldPresetValue(clause) {
  if (clause._fieldSelect === 'custom') return '__custom__';
  const f = String(clause?.field || '').trim();
  if (!f) return '';
  const opts = conditionFieldOptions.value;
  return opts.some((o) => o.value === f) ? f : '__custom__';
}

function onClauseFieldPresetChange(clause, event) {
  const v = event.target.value;
  if (v === '__custom__') {
    clause._fieldSelect = 'custom';
    clause.field = '';
    return;
  }
  if (v === '') {
    clause._fieldSelect = 'preset';
    clause.field = '';
    return;
  }
  clause._fieldSelect = 'preset';
  clause.field = v;
  const list = resolveConditionValueOptions(scopeApp.value, scopeModule.value, v);
  if (list && clause.value !== '' && clause.value != null && !list.some((o) => String(o.value) === String(clause.value))) {
    clause.value = '';
  }
}

function clauseFieldIsCustom(clause) {
  return clauseFieldPresetValue(clause) === '__custom__';
}

const syncingFromUrl = ref(false);
const loading = ref(true);
const loadError = ref('');
const saving = ref(false);
const saveError = ref('');
/** JSON fingerprint of last successfully loaded savable state; null until first successful load. */
const lastSavedFingerprint = ref(null);

const groups = ref([]);
const meta = reactive({
  enabled: true,
  simulationOnly: true,
  applyStrategy: 'new_records_only'
});
const rules = ref([]);
const expanded = reactive({});

const simulating = ref(false);
const simulateError = ref('');
const simulateResult = ref(null);
const simulateRecordJson = ref('{\n  "priority": "High",\n  "status": "New"\n}');
const simulateContextJson = ref('{}');

const formattedSimulation = computed(() => (simulateResult.value ? JSON.stringify(simulateResult.value, null, 2) : ''));

function triggerLabel(triggerType) {
  if (triggerType === 'delayed') return t('settings.assignRulesTriggerDelayed');
  if (triggerType === 'scheduled') return t('settings.assignRulesTriggerScheduled');
  return t('settings.assignRulesTriggerImmediate');
}

function toggleExpand(ruleId) {
  expanded[ruleId] = !expanded[ruleId];
}

function defaultTriggerConfig(triggerType) {
  const base = {
    delayMinutes: 5,
    scheduleType: 'recurring',
    frequency: 'daily',
    cron: '0 10 * * *',
    evaluateScope: null,
    recheckConditionsAtExecution: true
  };
  if (triggerType === 'immediate') {
    return { ...base, delayMinutes: null, scheduleType: null, frequency: null, cron: null };
  }
  if (triggerType === 'delayed') {
    return { ...base, scheduleType: null, frequency: null, cron: null };
  }
  return base;
}

function normalizeRule(r, index) {
  const triggerType = r.triggerType || 'immediate';
  return {
    ruleId: r.ruleId || `rule_${Date.now()}_${index}`,
    name: r.name || t('settings.assignRulesDefaultRuleName', { index: index + 1 }),
    enabled: r.enabled !== false,
    order: Number.isFinite(Number(r.order)) ? Number(r.order) : index,
    triggerType,
    triggerConfig: { ...defaultTriggerConfig(triggerType), ...r.triggerConfig },
    conditions: {
      combinator: r.conditions?.combinator || 'all',
      clauses: Array.isArray(r.conditions?.clauses)
        ? r.conditions.clauses.map((c) => {
            let v = c.value;
            const f = String(c.field || '').trim();
            if (f === 'do_not_contact') {
              if (typeof v === 'boolean') v = v ? 'true' : 'false';
              else if (v === true) v = 'true';
              else if (v === false) v = 'false';
            }
            if (Array.isArray(v)) v = JSON.stringify(v);
            else if (v !== null && typeof v === 'object') v = JSON.stringify(v);
            return {
              field: c.field,
              operator: c.operator || 'equals',
              value: v,
              _fieldSelect: c._fieldSelect || inferClauseFieldSelect(c.field)
            };
          })
        : []
    },
    primaryGroupId: r.primaryGroupId ? String(r.primaryGroupId) : '',
    distribution: {
      mode: r.distribution?.mode || 'queue',
      queueClaimTimeoutMinutes: r.distribution?.queueClaimTimeoutMinutes ?? null,
      userWeights: Array.isArray(r.distribution?.userWeights) ? r.distribution.userWeights : []
    },
    fallbackGroupIds: Array.isArray(r.fallbackGroupIds) ? r.fallbackGroupIds.map(String) : [],
    escalation: {
      enabled: !!r.escalation?.enabled,
      actionType: r.escalation?.actionType || 'reassign_group',
      thresholdPercent: r.escalation?.thresholdPercent ?? 100,
      cooldownMinutes: r.escalation?.cooldownMinutes ?? 30,
      chainGroupIds: Array.isArray(r.escalation?.chainGroupIds) ? r.escalation.chainGroupIds.map(String) : []
    },
    reassignment: {
      enabled: r.reassignment?.enabled !== false,
      revertMode: r.reassignment?.revertMode || 'reapply_rules',
      lockOnManualOverride: !!r.reassignment?.lockOnManualOverride
    },
    metadata: r.metadata && typeof r.metadata === 'object' ? { ...r.metadata } : {}
  };
}

function createEmptyRule() {
  const order = rules.value.length;
  const nr = normalizeRule({ name: t('settings.assignRulesDefaultRuleName', { index: order + 1 }), order }, order);
  if (groups.value[0]?._id) nr.primaryGroupId = String(groups.value[0]._id);
  return nr;
}

function addRule() {
  const r = createEmptyRule();
  rules.value = [...rules.value, r];
  expanded[r.ruleId] = true;
}

function removeRule(index) {
  const next = rules.value.filter((_, i) => i !== index);
  rules.value = next;
}

function addClause(rule) {
  if (!rule.conditions.clauses) rule.conditions.clauses = [];
  rule.conditions.clauses.push({ field: '', operator: 'equals', value: '', _fieldSelect: 'preset' });
}

function removeClause(rule, idx) {
  rule.conditions.clauses.splice(idx, 1);
}

function applyScopeFromRoute() {
  const a = route.query.assignmentApp;
  const m = route.query.assignmentModule;
  if (typeof a === 'string' && a.trim()) {
    const up = a.toUpperCase();
    if (APP_MODULES[up]) scopeApp.value = up;
  }
  if (typeof m === 'string' && m.trim()) {
    const low = m.toLowerCase();
    const ok = (APP_MODULES[scopeApp.value] || []).includes(low);
    if (ok) scopeModule.value = low;
  }
}

function goBackToAutomation() {
  const nextQuery = { ...route.query, tab: 'automation' };
  delete nextQuery.automationView;
  delete nextQuery.assignmentApp;
  delete nextQuery.assignmentModule;
  router.push({ path: '/settings', query: nextQuery });
}

function syncScopeToRoute() {
  router.replace({
    path: '/settings',
    query: {
      ...route.query,
      tab: 'automation',
      automationView: 'assignment-rules',
      assignmentApp: scopeApp.value,
      assignmentModule: scopeModule.value
    }
  });
}

async function fetchGroups() {
  try {
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('limit', '500');
    params.set('sortBy', 'name');
    params.set('sortOrder', 'asc');
    const data = await apiClient.get(`/groups?${params.toString()}`);
    if (data.success && Array.isArray(data.data)) {
      groups.value = data.data;
    } else {
      groups.value = [];
    }
  } catch {
    groups.value = [];
  }
}

function payloadRulesForApi() {
  return rules.value.map((r, index) => {
    const o = normalizeRule(r, index);
    const clauseValues = (o.conditions.clauses || [])
      .filter((c) => String(c.field || '').trim().length > 0)
      .map((c) => {
      let val = c.value;
      if ((c.operator === 'in' || c.operator === 'not_in') && typeof val === 'string' && val.trim().startsWith('[')) {
        try {
          val = JSON.parse(val);
        } catch {
          /* keep string */
        }
      }
      if (c.operator === 'exists') {
        val = null;
      }
      const isDnc = String(c.field || '').trim() === 'do_not_contact';
      if (isDnc && c.operator !== 'exists') {
        if ((c.operator === 'in' || c.operator === 'not_in') && Array.isArray(val)) {
          val = val.map((x) => {
            if (x === true || x === 'true') return true;
            if (x === false || x === 'false') return false;
            return x;
          });
        } else if (c.operator === 'equals' || c.operator === 'not_equals') {
          if (val === 'true' || val === true) val = true;
          else if (val === 'false' || val === false) val = false;
        }
      }
      return { field: c.field, operator: c.operator, value: val };
    });
    return {
      ...o,
      primaryGroupId: o.primaryGroupId || undefined,
      fallbackGroupIds: o.fallbackGroupIds.filter(Boolean),
      conditions: { ...o.conditions, clauses: clauseValues },
      distribution: {
        ...o.distribution,
        queueClaimTimeoutMinutes: o.distribution.queueClaimTimeoutMinutes || null
      }
    };
  });
}

function saveStateFingerprint() {
  return JSON.stringify({
    enabled: meta.enabled,
    simulationOnly: meta.simulationOnly,
    applyStrategy: meta.applyStrategy,
    rules: payloadRulesForApi()
  });
}

const isDirty = computed(() => {
  if (lastSavedFingerprint.value === null) return false;
  return saveStateFingerprint() !== lastSavedFingerprint.value;
});

async function loadRuleSet() {
  loadError.value = '';
  loading.value = true;
  saveError.value = '';
  try {
    await fetchGroups();
    const res = await apiClient.get('/settings/automation/assignment-rules', {
      params: { appKey: scopeApp.value, moduleKey: scopeModule.value }
    });
    if (!res?.success) throw new Error(res?.message || t('settings.assignRulesLoadFailed'));
    const row = res.data || {};
    meta.enabled = row.enabled !== false;
    meta.simulationOnly = row.simulationOnly !== false;
    meta.applyStrategy = row.applyStrategy || 'new_records_only';
    const list = Array.isArray(row.rules) ? row.rules : [];
    rules.value = list.map((r, i) => normalizeRule(r, i));
    Object.keys(expanded).forEach((k) => delete expanded[k]);
    rules.value.forEach((r, i) => {
      if (i < 3) expanded[r.ruleId] = true;
    });
    lastSavedFingerprint.value = saveStateFingerprint();
  } catch (e) {
    loadError.value = e.message || t('settings.assignRulesLoadFailed');
    lastSavedFingerprint.value = null;
  } finally {
    loading.value = false;
  }
}

async function save() {
  saveError.value = '';
  for (let i = 0; i < rules.value.length; i++) {
    const g = rules.value[i].primaryGroupId;
    if (!g) {
      saveError.value = t('settings.assignRulesPrimaryGroupRequired', {
        name: rules.value[i].name || String(i + 1)
      });
      return;
    }
  }
  saving.value = true;
  try {
    const body = {
      appKey: scopeApp.value,
      moduleKey: scopeModule.value,
      enabled: meta.enabled,
      simulationOnly: meta.simulationOnly,
      applyStrategy: meta.applyStrategy,
      rules: payloadRulesForApi()
    };
    const res = await apiClient.put('/settings/automation/assignment-rules', body);
    if (!res?.success) throw new Error(res?.message || t('settings.assignRulesSaveFailed'));
    notifySuccess(t('settings.assignRulesSaved'));
    await loadRuleSet();
  } catch (e) {
    const serverErr = e.response?.data?.error;
    const serverDetails = e.response?.data?.details;
    const extra =
      Array.isArray(serverDetails) && serverDetails.length > 0
        ? ` ${serverDetails.join('; ')}`
        : '';
    saveError.value = serverErr ? `${serverErr}${extra}` : (e.message || t('settings.assignRulesSaveFailed'));
  } finally {
    saving.value = false;
  }
}

async function runSimulation() {
  simulateError.value = '';
  simulateResult.value = null;
  let record;
  let context;
  try {
    record = JSON.parse(simulateRecordJson.value || '{}');
  } catch {
    simulateError.value = t('settings.assignRulesRecordJsonInvalid');
    return;
  }
  try {
    context = JSON.parse(simulateContextJson.value || '{}');
  } catch {
    simulateError.value = t('settings.assignRulesContextJsonInvalid');
    return;
  }
  simulating.value = true;
  try {
    const res = await apiClient.post('/settings/automation/assignment-rules/simulate', {
      appKey: scopeApp.value,
      moduleKey: scopeModule.value,
      rules: payloadRulesForApi(),
      record,
      context
    });
    if (!res?.success) throw new Error(res?.message || t('settings.assignRulesSimulationFailed'));
    simulateResult.value = res.data;
  } catch (e) {
    simulateError.value = e.message || t('settings.assignRulesSimulationFailed');
  } finally {
    simulating.value = false;
  }
}

watch([scopeApp, scopeModule], () => {
  if (syncingFromUrl.value) return;
  const mods = APP_MODULES[scopeApp.value] || [];
  if (!mods.includes(scopeModule.value)) {
    scopeModule.value = mods[0] || 'cases';
  }
  syncScopeToRoute();
  loadRuleSet();
});

watch(
  () => [route.query.tab, route.query.assignmentApp, route.query.assignmentModule],
  () => {
    if (route.query.tab !== 'automation') return;
    const qa = typeof route.query.assignmentApp === 'string' ? route.query.assignmentApp.toUpperCase() : '';
    const qm = typeof route.query.assignmentModule === 'string' ? route.query.assignmentModule.toLowerCase() : '';
    if (!qa || !APP_MODULES[qa]) return;
    if (!(APP_MODULES[qa] || []).includes(qm)) return;
    if (qa === scopeApp.value && qm === scopeModule.value) return;
    syncingFromUrl.value = true;
    scopeApp.value = qa;
    scopeModule.value = qm;
    nextTick(() => {
      syncingFromUrl.value = false;
      loadRuleSet();
    });
  }
);

onMounted(() => {
  syncingFromUrl.value = true;
  applyScopeFromRoute();
  syncScopeToRoute();
  nextTick(() => {
    syncingFromUrl.value = false;
    loadRuleSet();
  });
});
</script>
