<template>
  <SettingsScrollPanel>
    <template #header>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.aiTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
          {{ t('settings.aiSubtitle') }}
        </p>
      </div>
    </template>

    <template #tabs>
      <nav class="overflow-x-auto">
        <div class="flex gap-1 min-w-max -mb-px">
          <button
            v-for="tab in aiTabs"
            :key="tab.id"
            type="button"
            class="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors"
            :class="activeTab === tab.id
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            @click="activeTab = tab.id"
          >
            {{ t(tab.labelKey) }}
          </button>
        </div>
      </nav>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div
      v-else
      class="space-y-6"
      :class="(activeTab === 'usage' || activeTab === 'agents') ? 'w-full' : 'max-w-3xl'"
    >
      <template v-if="activeTab === 'general'">
      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiEnableTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.aiEnableHint') }}</p>
        <label class="mt-4 flex items-center gap-3">
          <input v-model="form.enabled" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          <span class="text-sm text-gray-900 dark:text-gray-100">{{ t('settings.aiEnabledLabel') }}</span>
        </label>
        <label class="mt-3 flex items-center gap-3">
          <input v-model="form.acceptDataUseConsent" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          <span class="text-sm text-gray-900 dark:text-gray-100">{{ t('settings.aiConsentLabel') }}</span>
        </label>
        <p v-if="settings?.dataUseConsent?.accepted" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.aiConsentAccepted') }}
        </p>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiProviderTitle') }}</h3>
        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiLlmProvider') }}</span>
            <select
              v-model="form.llmProvider"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option v-for="provider in llmProviderOptions" :key="provider" :value="provider">
                {{ provider }}
              </option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiLlmModel') }}</span>
            <select
              v-model="form.llmModel"
              :disabled="modelsLoading || !llmModelOptions.length"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option v-for="model in llmModelOptions" :key="model" :value="model">
                {{ model === AUTO_MODEL ? t('settings.aiModelAuto') : model }}
              </option>
            </select>
            <span v-if="modelsLoading" class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {{ t('states.loading') }}
            </span>
            <span v-else-if="modelsError" class="mt-1 block text-xs text-amber-600 dark:text-amber-400">
              {{ modelsError }}
            </span>
            <span v-else-if="form.llmModel === AUTO_MODEL" class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.aiModelAutoHint') }}
            </span>
          </label>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiKeyMode') }}</span>
            <select
              v-model="form.keyMode"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="platform">{{ t('settings.aiKeyModePlatform') }}</option>
              <option value="byok">{{ t('settings.aiKeyModeByok') }}</option>
            </select>
          </label>
        </div>

        <div v-if="form.llmProvider === 'azure_openai'" class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiAzureResource') }}</span>
            <input
              v-model="form.azureResourceName"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              :placeholder="t('settings.aiAzureResourcePlaceholder')"
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiAzureDeployment') }}</span>
            <input
              v-model="form.azureDeploymentName"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              :placeholder="t('settings.aiAzureDeploymentPlaceholder')"
            />
          </label>
        </div>

        <div v-if="form.keyMode === 'byok'" class="mt-4 space-y-3">
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiByokKey') }}</span>
            <input
              v-model="form.apiKey"
              type="password"
              autocomplete="off"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              :placeholder="settings?.hasByokKey ? t('settings.aiByokKeyPlaceholderMasked', { last4: settings.apiKeyLast4 }) : t('settings.aiByokKeyPlaceholder')"
            />
          </label>
          <button
            v-if="settings?.hasByokKey"
            type="button"
            class="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
            @click="clearKey = true"
          >
            {{ t('settings.aiClearByokKey') }}
          </button>
        </div>

        <div v-else class="mt-4">
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiCreditsBalance') }}</span>
            <input
              v-model.number="form.creditsBalance"
              type="number"
              min="0"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.aiCreditsHint') }}</p>
        </div>
      </section>

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? t('settings.aiSaving') : t('settings.aiSave') }}
        </button>
        <p v-if="saveMessage" class="text-sm text-green-700 dark:text-green-400">{{ saveMessage }}</p>
      </div>
      </template>

      <template v-if="activeTab === 'agents'">
        <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiAgentsTitle') }}</h3>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">{{ t('settings.aiAgentsHint') }}</p>
              <p v-if="agentsMeta" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {{ t('settings.aiAgentsOotbNote', {
                  agentCount: agentsMeta.agentCount,
                  toolCount: agentsMeta.toolCount,
                }) }}
              </p>
            </div>
            <label class="block w-full sm:w-72 text-sm">
              <span class="sr-only">{{ t('settings.aiAgentsSearchPlaceholder') }}</span>
              <input
                v-model="agentsQuery"
                type="search"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                :placeholder="t('settings.aiAgentsSearchPlaceholder')"
              />
            </label>
          </div>

          <div v-if="agentsLoading" class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
          <div v-else-if="agentsError" class="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {{ agentsError }}
          </div>
          <div v-else-if="!filteredAgents.length" class="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.aiAgentsEmpty') }}
          </div>
          <ul v-else class="mt-4 space-y-3">
            <li
              v-for="agent in filteredAgents"
              :key="agent.name"
              class="rounded-xl border border-gray-100 dark:border-gray-700/80 overflow-hidden"
            >
              <button
                type="button"
                class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900/40"
                @click="toggleAgentExpanded(agent.name)"
              >
                <span class="mt-0.5 text-gray-400" aria-hidden="true">{{ expandedAgents[agent.name] ? '▾' : '▸' }}</span>
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ agent.title || agent.name }}</span>
                    <span class="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-gray-900 dark:text-gray-300">{{ agent.name }}</span>
                    <span class="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                      {{ t('settings.aiAgentsAutonomy', { level: agent.autonomy || 'assist' }) }}
                    </span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400">
                      {{ t('settings.aiAgentsToolCount', { count: (agent.tools || []).length }) }}
                    </span>
                  </span>
                  <span v-if="agent.description" class="mt-1 block text-sm text-gray-600 dark:text-gray-400">{{ agent.description }}</span>
                </span>
              </button>
              <div v-if="expandedAgents[agent.name]" class="border-t border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-700/80 dark:bg-gray-900/30">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{{ t('settings.aiAgentsToolsHeading') }}</p>
                <p v-if="!(agent.toolDetails || []).length" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {{ t('settings.aiAgentsNoTools') }}
                </p>
                <ul v-else class="mt-2 space-y-2">
                  <li
                    v-for="tool in agent.toolDetails"
                    :key="`${agent.name}-${tool.name}`"
                    class="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-mono text-xs font-medium text-gray-900 dark:text-gray-100">{{ tool.name }}</span>
                      <span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600 dark:bg-gray-900 dark:text-gray-300">{{ tool.family }}</span>
                      <span
                        class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                        :class="toolRiskClass(tool.risk)"
                      >{{ toolRiskLabel(tool.risk) }}</span>
                    </div>
                    <p v-if="tool.description" class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ tool.description }}</p>
                  </li>
                </ul>
              </div>
            </li>
          </ul>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiAgentsAllToolsTitle') }}</h3>
          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-full px-3 py-1 text-xs font-medium border"
              :class="toolsFamilyFilter === ''
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200'
                : 'border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-300'"
              @click="toolsFamilyFilter = ''"
            >
              {{ t('settings.aiAgentsFilterAll') }}
            </button>
            <button
              v-for="family in toolFamilies"
              :key="family"
              type="button"
              class="rounded-full px-3 py-1 text-xs font-medium border"
              :class="toolsFamilyFilter === family
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200'
                : 'border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-300'"
              @click="toolsFamilyFilter = family"
            >
              {{ family }}
            </button>
          </div>
          <div class="mt-4 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                <tr>
                  <th class="px-3 py-2 font-medium">{{ t('settings.aiAgentsColTool') }}</th>
                  <th class="px-3 py-2 font-medium">{{ t('settings.aiAgentsColFamily') }}</th>
                  <th class="px-3 py-2 font-medium">{{ t('settings.aiAgentsColRisk') }}</th>
                  <th class="px-3 py-2 font-medium">{{ t('settings.aiAgentsColDescription') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700/60">
                <tr
                  v-for="tool in filteredToolsCatalog"
                  :key="tool.name"
                  class="text-gray-800 dark:text-gray-200"
                >
                  <td class="px-3 py-2 font-mono text-xs whitespace-nowrap">{{ tool.name }}</td>
                  <td class="px-3 py-2 text-xs">{{ tool.family }}</td>
                  <td class="px-3 py-2 text-xs">
                    <span class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase" :class="toolRiskClass(tool.risk)">
                      {{ toolRiskLabel(tool.risk) }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ tool.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-if="activeTab === 'pii'">
        <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiPiiTitle') }}</h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.aiPiiHint') }}
          </p>
          <p class="mt-3 text-sm text-gray-700 dark:text-gray-300">
            {{ piiCatalog?.summary || t('settings.aiPiiSummaryFallback') }}
          </p>

          <ul class="mt-6 divide-y divide-gray-100 dark:divide-gray-700">
            <li
              v-for="item in builtInPiiItems"
              :key="item.id"
              class="py-4 first:pt-0 last:pb-0"
            >
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ item.label }}
                </h4>
                <code class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  {{ item.placeholder }}
                </code>
              </div>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {{ item.description }}
              </p>
              <p class="mt-1 font-mono text-xs text-gray-500 dark:text-gray-500">
                {{ item.example }}
              </p>
              <p
                v-if="item.note"
                class="mt-2 text-xs text-amber-700 dark:text-amber-300"
              >
                {{ item.note }}
              </p>
            </li>
          </ul>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiPiiCustomTitle') }}</h3>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.aiPiiCustomHint') }}</p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
              :disabled="customPiiRules.length >= maxCustomPiiRules"
              @click="addCustomPiiRule"
            >
              {{ t('settings.aiPiiCustomAdd') }}
            </button>
          </div>

          <p
            v-if="piiSaveError"
            class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          >
            {{ piiSaveError }}
          </p>
          <p
            v-if="piiSaveMessage"
            class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
          >
            {{ piiSaveMessage }}
          </p>

          <div
            v-if="!customPiiRules.length"
            class="mt-4 rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400"
          >
            {{ t('settings.aiPiiCustomEmpty') }}
          </div>

          <ul v-else class="mt-4 space-y-4">
            <li
              v-for="(rule, index) in customPiiRules"
              :key="rule.id"
              class="rounded-lg border border-gray-200 p-4 dark:border-gray-600"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <label class="flex items-center gap-2 text-sm">
                  <input
                    v-model="rule.enabled"
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <span class="font-medium text-gray-900 dark:text-white">{{ t('settings.aiPiiCustomEnabled') }}</span>
                </label>
                <button
                  type="button"
                  class="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                  @click="removeCustomPiiRule(index)"
                >
                  {{ t('actions.delete') }}
                </button>
              </div>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <label class="block text-sm sm:col-span-2">
                  <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiPiiCustomLabel') }}</span>
                  <input
                    v-model="rule.label"
                    type="text"
                    maxlength="80"
                    class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    :placeholder="t('settings.aiPiiCustomLabelPlaceholder')"
                  />
                </label>
                <label class="block text-sm">
                  <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiPiiCustomMatchType') }}</span>
                  <select
                    v-model="rule.matchType"
                    class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="literal">{{ t('settings.aiPiiCustomMatchLiteral') }}</option>
                    <option value="regex">{{ t('settings.aiPiiCustomMatchRegex') }}</option>
                  </select>
                </label>
                <label class="block text-sm">
                  <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiPiiCustomReplacement') }}</span>
                  <input
                    v-model="rule.replacement"
                    type="text"
                    maxlength="40"
                    class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    placeholder="[CUSTOM]"
                  />
                </label>
                <label class="block text-sm sm:col-span-2">
                  <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiPiiCustomPattern') }}</span>
                  <input
                    v-model="rule.pattern"
                    type="text"
                    maxlength="200"
                    class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    :placeholder="rule.matchType === 'regex' ? '\\bSSN-\\d{3}-\\d{2}-\\d{4}\\b' : 'ACME-CONFIDENTIAL'"
                  />
                </label>
              </div>
            </li>
          </ul>

          <div class="mt-6 flex justify-end">
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="piiSaving"
              @click="savePiiRules"
            >
              {{ piiSaving ? t('states.saving') : t('settings.aiPiiCustomSave') }}
            </button>
          </div>
        </section>
      </template>

      <template v-if="activeTab === 'usage'">
        <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiUsageTitle') }}</h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.aiUsageHint') }}</p>

          <div class="mt-4 flex flex-wrap items-end gap-3">
            <label class="block text-sm">
              <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiUsageDays') }}</span>
              <select
                v-model.number="usageDays"
                class="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                @change="reloadUsageLog"
              >
                <option :value="7">{{ t('settings.aiUsageDays7') }}</option>
                <option :value="30">{{ t('settings.aiUsageDays30') }}</option>
                <option :value="90">{{ t('settings.aiUsageDays90') }}</option>
              </select>
            </label>
            <label class="block text-sm">
              <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiUsageAbilityFilter') }}</span>
              <select
                v-model="usageAbilityFilter"
                class="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                @change="reloadUsageLog"
              >
                <option value="">{{ t('settings.aiUsageAbilityAll') }}</option>
                <option
                  v-for="ability in usageAbilityOptions"
                  :key="ability"
                  :value="ability"
                >
                  {{ ability }}
                </option>
              </select>
            </label>
            <label class="block text-sm">
              <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiUsageStatusFilter') }}</span>
              <select
                v-model="usageStatusFilter"
                class="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                @change="reloadUsageLog"
              >
                <option value="">{{ t('settings.aiUsageStatusAll') }}</option>
                <option value="success">success</option>
                <option value="failed">failed</option>
                <option value="not_configured">not_configured</option>
              </select>
            </label>
          </div>

          <div v-if="usageSummary" class="mt-4 grid gap-3 sm:grid-cols-3">
            <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
              <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.aiUsageSummaryCalls') }}</p>
              <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{{ formatNumber(usageSummary.totalCalls) }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
              <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.aiUsageSummaryTokens') }}</p>
              <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{{ formatNumber(usageSummary.totalTokens) }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
              <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.aiUsageSummaryCredits') }}</p>
              <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{{ formatNumber(usageSummary.totalCreditsDebited) }}</p>
            </div>
          </div>

          <div v-if="usageSummary?.byAbility?.length" class="mt-4">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.aiUsageTopAbilities') }}</h4>
            <div class="mt-2 overflow-x-auto">
              <table class="min-w-full text-xs">
                <thead>
                  <tr class="text-left text-gray-500 dark:text-gray-400">
                    <th class="py-1 pr-4 font-medium">{{ t('settings.aiUsageColAbility') }}</th>
                    <th class="py-1 pr-4 font-medium">{{ t('settings.aiUsageSummaryCalls') }}</th>
                    <th class="py-1 pr-4 font-medium">{{ t('settings.aiUsageColTokens') }}</th>
                    <th class="py-1 font-medium">{{ t('settings.aiUsageColCredits') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in usageSummary.byAbility.slice(0, 10)"
                    :key="row.abilityKey"
                    class="border-t border-gray-100 dark:border-gray-700/60"
                  >
                    <td class="py-1.5 pr-4 font-mono text-gray-900 dark:text-gray-100">{{ row.abilityKey }}</td>
                    <td class="py-1.5 pr-4 text-gray-700 dark:text-gray-300">{{ formatNumber(row.calls) }}</td>
                    <td class="py-1.5 pr-4 text-gray-700 dark:text-gray-300">{{ formatNumber(row.totalTokens) }}</td>
                    <td class="py-1.5 text-gray-700 dark:text-gray-300">{{ formatNumber(row.creditsDebited) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
          <div v-if="usageLoading" class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
          <div v-else-if="usageError" class="p-6 text-sm text-red-600 dark:text-red-400">{{ usageError }}</div>
          <div v-else-if="!usageItems.length" class="p-6 text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.aiUsageEmpty') }}
          </div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                <tr>
                  <th class="px-4 py-3 font-medium">{{ t('settings.aiUsageColTime') }}</th>
                  <th class="px-4 py-3 font-medium">{{ t('settings.aiUsageColAbility') }}</th>
                  <th class="px-4 py-3 font-medium">{{ t('settings.aiUsageColAgent') }}</th>
                  <th class="px-4 py-3 font-medium">{{ t('settings.aiUsageColUser') }}</th>
                  <th class="px-4 py-3 font-medium">{{ t('settings.aiUsageColModel') }}</th>
                  <th class="px-4 py-3 font-medium">{{ t('settings.aiUsageColStatus') }}</th>
                  <th class="px-4 py-3 font-medium text-right">{{ t('settings.aiUsageColTokens') }}</th>
                  <th class="px-4 py-3 font-medium text-right">{{ t('settings.aiUsageColCredits') }}</th>
                  <th class="px-4 py-3 font-medium text-right">{{ t('settings.aiUsageColLatency') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700/60">
                <tr
                  v-for="row in usageItems"
                  :key="row.id"
                  class="text-gray-800 dark:text-gray-200"
                >
                  <td class="px-4 py-3 whitespace-nowrap text-xs">{{ formatUsageTime(row.createdAt) }}</td>
                  <td class="px-4 py-3 font-mono text-xs">{{ row.abilityKey }}</td>
                  <td class="px-4 py-3 text-xs">{{ usageAgentLabel(row) }}</td>
                  <td class="px-4 py-3 text-xs">{{ row.user?.name || t('settings.aiUsageSystemUser') }}</td>
                  <td class="px-4 py-3 text-xs">{{ row.model }}</td>
                  <td class="px-4 py-3 text-xs">
                    <span
                      class="rounded px-1.5 py-0.5"
                      :class="usageStatusClass(row.status)"
                    >
                      {{ row.status }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right text-xs tabular-nums">
                    <span>{{ formatNumber(row.usage?.totalTokens || 0) }}</span>
                    <span
                      v-if="row.metadata?.cached"
                      class="ml-1 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-medium uppercase text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                    >{{ t('settings.aiUsageCached') }}</span>
                  </td>
                  <td class="px-4 py-3 text-right text-xs tabular-nums">{{ formatNumber(row.creditsDebited || 0) }}</td>
                  <td class="px-4 py-3 text-right text-xs tabular-nums">{{ formatLatency(row.latencyMs) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="usagePagination.totalPages > 1"
            class="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700"
          >
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.aiUsagePaginationRange', usagePaginationRange) }}
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-gray-600"
                :disabled="usagePagination.page <= 1 || usageLoading"
                @click="changeUsagePage(usagePagination.page - 1)"
              >
                {{ t('actions.previous') }}
              </button>
              <button
                type="button"
                class="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-gray-600"
                :disabled="usagePagination.page >= usagePagination.totalPages || usageLoading"
                @click="changeUsagePage(usagePagination.page + 1)"
              >
                {{ t('actions.next') }}
              </button>
            </div>
          </div>
        </section>
      </template>

    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();

const aiTabs = [
  { id: 'general', labelKey: 'settings.aiTabGeneral' },
  { id: 'agents', labelKey: 'settings.aiTabAgents' },
  { id: 'pii', labelKey: 'settings.aiTabPii' },
  { id: 'usage', labelKey: 'settings.aiTabUsage' },
];
const activeTab = ref('general');

const agentsLoading = ref(false);
const agentsError = ref('');
const agentsList = ref([]);
const toolsCatalog = ref([]);
const agentsMeta = ref(null);
const agentsQuery = ref('');
const toolsFamilyFilter = ref('');
const expandedAgents = reactive({});

const filteredAgents = computed(() => {
  const q = agentsQuery.value.trim().toLowerCase();
  if (!q) return agentsList.value;
  return agentsList.value.filter((agent) => {
    const hay = [
      agent.name,
      agent.title,
      agent.description,
      ...(agent.tools || []),
      ...(agent.toolDetails || []).map((tool) => `${tool.name} ${tool.description || ''}`),
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });
});

const toolFamilies = computed(() => {
  const set = new Set(toolsCatalog.value.map((tool) => tool.family).filter(Boolean));
  return Array.from(set).sort();
});

const filteredToolsCatalog = computed(() => {
  const q = agentsQuery.value.trim().toLowerCase();
  return toolsCatalog.value.filter((tool) => {
    if (toolsFamilyFilter.value && tool.family !== toolsFamilyFilter.value) return false;
    if (!q) return true;
    return `${tool.name} ${tool.family} ${tool.description || ''}`.toLowerCase().includes(q);
  });
});

function toggleAgentExpanded(name) {
  expandedAgents[name] = !expandedAgents[name];
}

function toolRiskLabel(risk) {
  const r = String(risk || 'read').toLowerCase();
  if (r === 'write') return t('settings.aiAgentsRiskWrite');
  if (r === 'destructive') return t('settings.aiAgentsRiskDestructive');
  return t('settings.aiAgentsRiskRead');
}

function toolRiskClass(risk) {
  const r = String(risk || 'read').toLowerCase();
  if (r === 'write') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  }
  if (r === 'destructive') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  }
  return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
}

async function loadAgentsCatalog() {
  agentsLoading.value = true;
  agentsError.value = '';
  try {
    const data = await apiClient.get('/ai/v2/agents');
    agentsList.value = Array.isArray(data?.agents) ? data.agents : [];
    toolsCatalog.value = Array.isArray(data?.tools) ? data.tools : [];
    agentsMeta.value = data?.meta || {
      agentCount: agentsList.value.length,
      toolCount: toolsCatalog.value.length,
    };
    if (!toolsCatalog.value.length) {
      const toolsData = await apiClient.get('/ai/v2/tools');
      toolsCatalog.value = Array.isArray(toolsData?.tools) ? toolsData.tools : [];
      if (agentsMeta.value) {
        agentsMeta.value = {
          ...agentsMeta.value,
          toolCount: toolsCatalog.value.length,
        };
      }
    }
  } catch (err) {
    agentsError.value = err?.message || t('settings.aiAgentsLoadFailed');
    agentsList.value = [];
    toolsCatalog.value = [];
    agentsMeta.value = null;
  } finally {
    agentsLoading.value = false;
  }
}

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const saveMessage = ref('');
const settings = ref(null);
const piiCatalog = ref(null);
const customPiiRules = ref([]);
const maxCustomPiiRules = ref(20);
const piiSaving = ref(false);
const piiSaveError = ref('');
const piiSaveMessage = ref('');
const clearKey = ref(false);

function cloneCustomPiiRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules.map((row, index) => ({
    id: String(row?.id || `custom_${index + 1}_${Date.now()}`),
    label: String(row?.label || ''),
    pattern: String(row?.pattern || ''),
    replacement: String(row?.replacement || '[CUSTOM]'),
    matchType: row?.matchType === 'regex' ? 'regex' : 'literal',
    enabled: row?.enabled !== false,
  }));
}

function addCustomPiiRule() {
  if (customPiiRules.value.length >= maxCustomPiiRules.value) return;
  customPiiRules.value.push({
    id: `custom_${Date.now().toString(36)}`,
    label: '',
    pattern: '',
    replacement: '[CUSTOM]',
    matchType: 'literal',
    enabled: true,
  });
}

function removeCustomPiiRule(index) {
  customPiiRules.value.splice(index, 1);
}

async function savePiiRules() {
  piiSaving.value = true;
  piiSaveError.value = '';
  piiSaveMessage.value = '';
  try {
    const payload = {
      piiCustomRules: customPiiRules.value.map((rule) => ({
        id: rule.id,
        label: rule.label.trim(),
        pattern: rule.pattern.trim(),
        replacement: (rule.replacement.trim() || '[CUSTOM]').toUpperCase(),
        matchType: rule.matchType,
        enabled: Boolean(rule.enabled),
      })),
    };
    const data = await apiClient.put('/ai/settings', payload);
    settings.value = data.settings || settings.value;
    piiCatalog.value = data.piiRedaction || piiCatalog.value;
    customPiiRules.value = cloneCustomPiiRules(settings.value?.piiCustomRules);
    if (data.piiRedaction?.maxCustomRules) {
      maxCustomPiiRules.value = Number(data.piiRedaction.maxCustomRules);
    }
    piiSaveMessage.value = t('settings.aiPiiCustomSaveSuccess');
  } catch (err) {
    piiSaveError.value = err?.message || t('settings.aiPiiCustomSaveFailed');
  } finally {
    piiSaving.value = false;
  }
}
const llmProviderOptions = ref(['openai', 'azure_openai', 'anthropic', 'gemini']);
const llmModelsByProvider = ref({});
const modelsLoading = ref(false);
const modelsError = ref('');
let modelRequestId = 0;

const usageLoading = ref(false);
const usageError = ref('');
const usageItems = ref([]);
const usageSummary = ref(null);
const usageDays = ref(30);
const usageAbilityFilter = ref('');
const usageStatusFilter = ref('');
const usagePagination = ref({
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 1,
});

const usageAbilityOptions = computed(() => {
  const fromSummary = (usageSummary.value?.byAbility || [])
    .map((row) => row.abilityKey)
    .filter(Boolean);
  const fromRows = usageItems.value.map((row) => row.abilityKey).filter(Boolean);
  return [...new Set([...fromSummary, ...fromRows])].sort();
});

const piiItems = computed(() => (
  Array.isArray(piiCatalog.value?.items) ? piiCatalog.value.items : []
));

const builtInPiiItems = computed(() => piiItems.value.filter((item) => !item.custom));

const usagePaginationRange = computed(() => {
  const { page, limit, total } = usagePagination.value;
  if (!total) {
    return { from: 0, to: 0, total: 0 };
  }
  return {
    from: (page - 1) * limit + 1,
    to: Math.min(page * limit, total),
    total,
  };
});

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatUsageTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

/** Specialist that executed the turn (audit metadata); empty for non-agent abilities. */
function usageAgentLabel(row) {
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const name = String(meta.agentName || meta.name || '').trim();
  return name || '—';
}

function formatLatency(ms) {
  const value = Number(ms || 0);
  if (value <= 0) return '—';
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

function usageStatusClass(status) {
  if (status === 'success') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  }
  if (status === 'failed') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  }
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
}

async function loadUsageLog() {
  usageLoading.value = true;
  usageError.value = '';
  try {
    const params = new URLSearchParams({
      page: String(usagePagination.value.page),
      limit: String(usagePagination.value.limit),
      days: String(usageDays.value),
      summaryDays: String(usageDays.value),
    });
    if (usageAbilityFilter.value) params.set('abilityKey', usageAbilityFilter.value);
    if (usageStatusFilter.value) params.set('status', usageStatusFilter.value);
    const data = await apiClient.get(`/ai/audit-log?${params.toString()}`);
    usageItems.value = Array.isArray(data?.items) ? data.items : [];
    usageSummary.value = data?.summary || null;
    usagePagination.value = {
      page: Number(data?.pagination?.page || 1),
      limit: Number(data?.pagination?.limit || 25),
      total: Number(data?.pagination?.total || 0),
      totalPages: Number(data?.pagination?.totalPages || 1),
    };
  } catch (err) {
    usageError.value = err?.message || t('settings.aiUsageLoadFailed');
    usageItems.value = [];
    usageSummary.value = null;
  } finally {
    usageLoading.value = false;
  }
}

function reloadUsageLog() {
  usagePagination.value.page = 1;
  void loadUsageLog();
}

function changeUsagePage(page) {
  usagePagination.value.page = page;
  void loadUsageLog();
}

const form = reactive({
  enabled: false,
  acceptDataUseConsent: false,
  llmProvider: 'openai',
  llmModel: 'gpt-4o',
  keyMode: 'platform',
  apiKey: '',
  creditsBalance: 0,
  azureResourceName: '',
  azureDeploymentName: '',
});

const AUTO_MODEL = '__auto__';

const llmModelOptions = computed(() => {
  const models = llmModelsByProvider.value?.[form.llmProvider];
  const base = Array.isArray(models) && models.length
    ? [...models]
    : (form.llmModel && form.llmModel !== AUTO_MODEL ? [form.llmModel] : []);
  return [AUTO_MODEL, ...base.filter((m) => m !== AUTO_MODEL)];
});

watch(
  () => activeTab.value,
  (tab) => {
    if (tab === 'usage') {
      void loadUsageLog();
    }
    if (tab === 'agents' && !agentsList.value.length && !agentsLoading.value) {
      void loadAgentsCatalog();
    }
  },
);

watch(
  () => form.llmProvider,
  (provider, previousProvider) => {
    // Only auto-switch model when the user changes provider, not during initial load.
    if (previousProvider && previousProvider !== provider) {
      if (!llmModelOptions.value.includes(form.llmModel) && llmModelOptions.value.length) {
        form.llmModel = llmModelOptions.value[0];
      }
    }
    void loadProviderModels({ preserveModel: form.llmModel });
  },
);

async function loadProviderModels({ preserveModel = null } = {}) {
  const provider = form.llmProvider;
  if (!provider) return;
  const requestId = ++modelRequestId;
  modelsLoading.value = true;
  modelsError.value = '';
  try {
    const data = await apiClient.get(`/ai/settings/models?provider=${encodeURIComponent(provider)}`);
    if (requestId !== modelRequestId) return;
    const models = Array.isArray(data?.models) ? data.models : [];
    const keepModel = String(preserveModel || form.llmModel || '').trim();
    const merged = keepModel && !models.includes(keepModel)
      ? [keepModel, ...models]
      : models;
    if (merged.length) {
      llmModelsByProvider.value = {
        ...llmModelsByProvider.value,
        [provider]: merged,
      };
      // Never replace a saved/selected model — only fill empty selection.
      if (!String(form.llmModel || '').trim()) {
        form.llmModel = merged[0];
      } else if (!merged.includes(form.llmModel) && keepModel) {
        form.llmModel = keepModel;
      }
    }
  } catch (err) {
    if (requestId !== modelRequestId) return;
    modelsError.value = err?.message || t('settings.aiModelsLoadFailed');
  } finally {
    if (requestId === modelRequestId) modelsLoading.value = false;
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiClient.get('/ai/settings');
    settings.value = data.settings || {};
    piiCatalog.value = data.piiRedaction || null;
    customPiiRules.value = cloneCustomPiiRules(settings.value?.piiCustomRules);
    if (data.piiRedaction?.maxCustomRules) {
      maxCustomPiiRules.value = Number(data.piiRedaction.maxCustomRules);
    }
    form.enabled = Boolean(settings.value.enabled);
    form.acceptDataUseConsent = Boolean(settings.value.dataUseConsent?.accepted);
    form.llmProvider = settings.value.llmProvider || 'openai';
    form.llmModel = settings.value.autoModel ? AUTO_MODEL : (settings.value.llmModel || AUTO_MODEL);
    form.keyMode = settings.value.keyMode || 'platform';
    form.creditsBalance = Number(settings.value.creditsBalance || 0);
    form.azureResourceName = settings.value.azureResourceName || '';
    form.azureDeploymentName = settings.value.azureDeploymentName || '';
    form.apiKey = '';
    clearKey.value = false;

    const supported = data.supported?.llmProviders || [];
    const planned = data.supported?.plannedLlmProviders || [];
    llmProviderOptions.value = [...new Set([...supported, ...planned, 'openai'])];

    // Seed catalog from static list, but always keep the saved model visible.
    const staticByProvider = data.supported?.llmModelsByProvider || {};
    const savedModel = form.llmModel === AUTO_MODEL ? '' : String(form.llmModel || '').trim();
    const providerModels = Array.isArray(staticByProvider[form.llmProvider])
      ? [...staticByProvider[form.llmProvider]]
      : [];
    if (savedModel && !providerModels.includes(savedModel)) {
      providerModels.unshift(savedModel);
    }
    llmModelsByProvider.value = {
      ...staticByProvider,
      [form.llmProvider]: providerModels,
    };

    await loadProviderModels({ preserveModel: savedModel });
  } catch (err) {
    error.value = err?.message || t('settings.aiLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  saveMessage.value = '';
  error.value = '';
  try {
    const patch = {
      enabled: form.enabled,
      llmProvider: form.llmProvider,
      // Auto = clear override; server routes best model per ability tier.
      llmModel: form.llmModel === AUTO_MODEL ? null : form.llmModel,
      keyMode: form.keyMode,
    };

    if (form.llmProvider === 'azure_openai') {
      patch.azureResourceName = form.azureResourceName.trim() || null;
      patch.azureDeploymentName = form.azureDeploymentName.trim() || null;
    }

    if (form.acceptDataUseConsent) {
      patch.acceptDataUseConsent = true;
    }

    if (form.keyMode === 'platform') {
      patch.creditsBalance = Number(form.creditsBalance || 0);
    }

    if (form.keyMode === 'byok' && form.apiKey.trim()) {
      patch.apiKey = form.apiKey.trim();
    }

    if (clearKey.value) {
      patch.clearByokKey = true;
    }

    const data = await apiClient.put('/ai/settings', patch);
    settings.value = data.settings || {};
    form.apiKey = '';
    clearKey.value = false;
    form.creditsBalance = Number(settings.value.creditsBalance || 0);
    form.llmProvider = settings.value.llmProvider || form.llmProvider;
    form.llmModel = settings.value.autoModel ? AUTO_MODEL : (settings.value.llmModel || form.llmModel);
    // Keep the just-saved model in the dropdown even if provider catalog is stale.
    const savedModel = form.llmModel === AUTO_MODEL ? '' : String(form.llmModel || '').trim();
    if (savedModel) {
      const current = Array.isArray(llmModelsByProvider.value[form.llmProvider])
        ? llmModelsByProvider.value[form.llmProvider]
        : [];
      if (!current.includes(savedModel)) {
        llmModelsByProvider.value = {
          ...llmModelsByProvider.value,
          [form.llmProvider]: [savedModel, ...current],
        };
      }
    }
    saveMessage.value = t('settings.aiSaveSuccess');
  } catch (err) {
    error.value = err?.message || t('settings.aiSaveFailed');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
