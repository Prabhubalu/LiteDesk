<template>
  <SettingsScrollPanel
    :embed="activeTab === 'agents'"
    :dense="activeTab === 'agents'"
  >
    <template #header>
      <div>
        <h2
          class="font-bold text-gray-900 dark:text-white"
          :class="activeTab === 'agents' ? 'text-xl' : 'text-2xl'"
        >
          {{ t('settings.aiTitle') }}
        </h2>
        <p
          v-if="activeTab !== 'agents'"
          class="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl"
        >
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
            class="whitespace-nowrap text-sm font-medium border-b-2 transition-colors"
            :class="[
              activeTab === 'agents' ? 'px-3 py-2' : 'px-4 py-3',
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
            ]"
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
      :class="[
        activeTab === 'agents' ? 'flex min-h-0 flex-1 flex-col space-y-0' : 'space-y-6',
        (activeTab === 'usage' || activeTab === 'agents') ? 'w-full' : 'max-w-3xl',
      ]"
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
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiLlmProvider') }}</span>
            <HeadlessSelect
              v-model="form.llmProvider"
              wrapper-class="mt-1"
              :options="llmProviderSelectOptions"
              :placeholder="t('settings.aiLlmProvider')"
              teleport
              searchable
              @update:model-value="onProviderChange"
            />
            <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {{ form.llmProvider === 'arivu' ? t('settings.aiProviderModePlatformHint') : t('settings.aiProviderModeByokHint') }}
            </span>
          </label>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiLlmModel') }}</span>
            <HeadlessSelect
              v-model="form.llmModel"
              wrapper-class="mt-1"
              :options="llmModelSelectOptions"
              :disabled="modelsLoading || form.llmProvider === 'arivu'"
              :placeholder="t('settings.aiLlmModel')"
              teleport
              searchable
            />
            <span v-if="modelsLoading" class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {{ t('states.loading') }}
            </span>
            <span v-else-if="modelsError" class="mt-1 block text-xs text-amber-600 dark:text-amber-400">
              {{ modelsError }}
            </span>
            <span v-else-if="form.llmProvider === 'arivu'" class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.aiArivuModelHint') }}
            </span>
            <span v-else-if="form.llmModel === AUTO_MODEL" class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.aiModelAutoHint') }}
            </span>
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

        <div v-else class="mt-4 space-y-3">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
              <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('settings.aiTokensAvailable') }}
              </p>
              <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                {{ formatNumber(settings?.tokensAvailable ?? settings?.tokensBalance ?? 0) }}
              </p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
              <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('settings.aiTokensConsumed') }}
              </p>
              <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
                {{ formatNumber(settings?.tokensConsumed ?? 0) }}
              </p>
            </div>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.aiCreditsHint') }}</p>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            :disabled="resettingTokens"
            @click="resetTokenPool"
          >
            {{ resettingTokens ? t('states.loading') : t('settings.aiTokensReset') }}
          </button>
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
        <AiAgentsWorkspace class="min-h-0 flex-1" />
      </template>

      <template v-if="activeTab === 'knowledge'">
        <AiKnowledgeSourcesSettings class="min-h-0 flex-1" />
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

          <div class="mt-4 grid gap-3 sm:grid-cols-3">
            <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p class="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                {{ t('settings.aiTokensAvailable') }}
              </p>
              <p class="mt-1 text-2xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
                {{ formatNumber(tokenPool.available) }}
              </p>
              <p class="mt-1 text-[11px] text-emerald-800/80 dark:text-emerald-200/70">
                {{ t('settings.aiTokensConsumedLifetime', { count: formatNumber(tokenPool.consumed) }) }}
              </p>
            </div>
            <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p class="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                {{ t('settings.aiUsageSummaryCredits') }}
              </p>
              <p class="mt-1 text-2xl font-semibold tabular-nums text-amber-900 dark:text-amber-100">
                {{ formatNumber(usageSummary?.totalTokensBilled ?? usageSummary?.totalCreditsDebited ?? 0) }}
              </p>
              <p class="mt-1 text-[11px] text-amber-800/80 dark:text-amber-200/70">
                {{ t('settings.aiUsagePeriodHint') }}
              </p>
            </div>
            <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/40">
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('settings.aiUsageSummaryCalls') }}
              </p>
              <p class="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
                {{ formatNumber(usageSummary?.totalCalls || 0) }}
              </p>
              <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {{ t('settings.aiUsagePeriodHint') }}
              </p>
            </div>
          </div>

          <div class="mt-5">
            <DashboardDateRangeBar
              v-model="usageDateRange"
              @update:model-value="onUsageDateRangeChange"
            />
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
import { formatUserDateTime, formatNumber } from '@/utils/localeFormat';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import AiAgentsWorkspace from '@/components/settings/AiAgentsWorkspace.vue';
import AiKnowledgeSourcesSettings from '@/components/settings/AiKnowledgeSourcesSettings.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import DashboardDateRangeBar from '@/components/analytics/DashboardDateRangeBar.vue';
import apiClient from '@/utils/apiClient';
import {
  resolveDateRange,
} from '@/utils/analyticsDateRange';

const { t } = useI18n();

const aiTabs = [
  { id: 'general', labelKey: 'settings.aiTabGeneral' },
  { id: 'agents', labelKey: 'settings.aiTabAgents' },
  { id: 'knowledge', labelKey: 'settings.aiTabKnowledge' },
  { id: 'pii', labelKey: 'settings.aiTabPii' },
  { id: 'usage', labelKey: 'settings.aiTabUsage' },
];
const activeTab = ref('general');

const loading = ref(true);
const saving = ref(false);
const resettingTokens = ref(false);
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
const llmProviderOptions = ref(['arivu', 'openai', 'azure_openai', 'anthropic', 'gemini', 'openrouter', 'nvidia']);
const llmModelsByProvider = ref({});
const modelsLoading = ref(false);
const modelsError = ref('');
let modelRequestId = 0;

const usageLoading = ref(false);
const usageError = ref('');
const usageItems = ref([]);
const usageSummary = ref(null);
const usageDateRange = ref({ preset: 'last30days' });
const usagePagination = ref({
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 1,
});

const tokenPool = computed(() => {
  const s = settings.value || {};
  const available = Number(s.tokensAvailable ?? s.tokensBalance ?? s.creditsBalance ?? 0);
  const consumed = Number(s.tokensConsumed ?? 0);
  return {
    available: Number.isFinite(available) ? available : 0,
    consumed: Number.isFinite(consumed) ? consumed : 0,
  };
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

/** Ledger and usage debit amounts are tokens. */

function formatUsageTime(value) {
  if (!value) return '—';
  return formatUserDateTime(value);
}

/** Specialist that executed the turn (audit metadata); empty for non-agent abilities. */
function usageAgentLabel(row) {
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const name = String(meta.agentName || meta.name || meta.agentKey || '').trim();
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
    // Keep Available / Consumed in sync with the live token pool.
    try {
      const settingsPayload = await apiClient.get('/ai/settings');
      if (settingsPayload?.settings) {
        settings.value = {
          ...(settings.value || {}),
          ...settingsPayload.settings,
        };
      }
    } catch {
      // Non-blocking — usage table can still load.
    }

    const resolved = resolveDateRange(usageDateRange.value);
    const params = new URLSearchParams({
      page: String(usagePagination.value.page),
      limit: String(usagePagination.value.limit),
    });
    if (resolved.from) params.set('from', resolved.from);
    if (resolved.to) params.set('to', resolved.to);
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

function onUsageDateRangeChange(value) {
  usageDateRange.value = value;
  // Presets apply immediately; custom waits until both dates are set.
  if (value.preset !== 'custom' || (value.from && value.to)) {
    reloadUsageLog();
  }
}

function changeUsagePage(page) {
  usagePagination.value.page = page;
  void loadUsageLog();
}

const form = reactive({
  enabled: false,
  acceptDataUseConsent: false,
  llmProvider: 'arivu',
  llmModel: '__auto__',
  keyMode: 'platform',
  apiKey: '',
  creditsBalance: 0,
  tokensBalance: 0,
  azureResourceName: '',
  azureDeploymentName: '',
});

const AUTO_MODEL = '__auto__';

const llmModelOptions = computed(() => {
  if (form.llmProvider === 'arivu') {
    return [AUTO_MODEL];
  }
  const models = llmModelsByProvider.value?.[form.llmProvider];
  const base = Array.isArray(models) && models.length
    ? [...models]
    : (form.llmModel && form.llmModel !== AUTO_MODEL ? [form.llmModel] : []);
  return [AUTO_MODEL, ...base.filter((m) => m !== AUTO_MODEL)];
});

const llmProviderSelectOptions = computed(() => {
  const raw = [...llmProviderOptions.value];
  const withArivu = raw.includes('arivu') ? raw : ['arivu', ...raw];
  return withArivu.map((provider) => ({
    value: provider,
    label: provider === 'arivu' ? t('settings.aiProviderArivu') : provider,
  }));
});

const llmModelSelectOptions = computed(() =>
  llmModelOptions.value.map((model) => ({
    value: model,
    label: model === AUTO_MODEL ? t('settings.aiModelAuto') : model,
  }))
);

/** Arivu = platform keys; every other provider is BYOK. */
function syncKeyModeFromProvider(provider) {
  form.keyMode = provider === 'arivu' ? 'platform' : 'byok';
  if (provider === 'arivu') {
    form.llmModel = AUTO_MODEL;
  }
}

function onProviderChange(provider) {
  syncKeyModeFromProvider(provider);
}

watch(
  () => activeTab.value,
  (tab) => {
    if (tab === 'usage') {
      void loadUsageLog();
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
  if (!provider || provider === 'arivu') {
    modelsLoading.value = false;
    modelsError.value = '';
    return;
  }
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
    form.llmProvider = settings.value.llmProvider || 'arivu';
    form.llmModel = settings.value.autoModel || form.llmProvider === 'arivu'
      ? AUTO_MODEL
      : (settings.value.llmModel || AUTO_MODEL);
    syncKeyModeFromProvider(form.llmProvider);
    form.creditsBalance = Number(settings.value.tokensBalance ?? settings.value.creditsBalance ?? 0);
    form.tokensBalance = Number(settings.value.tokensBalance ?? settings.value.creditsBalance ?? 0);
    form.azureResourceName = settings.value.azureResourceName || '';
    form.azureDeploymentName = settings.value.azureDeploymentName || '';
    form.apiKey = '';
    clearKey.value = false;

    const supported = data.supported?.llmProviders || [];
    const planned = data.supported?.plannedLlmProviders || [];
    llmProviderOptions.value = [...new Set(['arivu', ...supported, ...planned, 'openai'])];

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
      llmModel: (form.llmModel === AUTO_MODEL || form.llmProvider === 'arivu') ? null : form.llmModel,
      keyMode: form.llmProvider === 'arivu' ? 'platform' : 'byok',
    };

    if (form.llmProvider === 'azure_openai') {
      patch.azureResourceName = form.azureResourceName.trim() || null;
      patch.azureDeploymentName = form.azureDeploymentName.trim() || null;
    }

    if (form.acceptDataUseConsent) {
      patch.acceptDataUseConsent = true;
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
    form.creditsBalance = Number(settings.value.tokensBalance ?? settings.value.creditsBalance ?? 0);
    form.tokensBalance = Number(settings.value.tokensBalance ?? settings.value.creditsBalance ?? 0);
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

async function resetTokenPool() {
  resettingTokens.value = true;
  error.value = '';
  try {
    const data = await apiClient.post('/ai/settings/reset-token-pool', {});
    settings.value = data.settings || settings.value;
    form.creditsBalance = Number(settings.value.tokensAvailable ?? settings.value.tokensBalance ?? 0);
    form.tokensBalance = form.creditsBalance;
    saveMessage.value = t('settings.aiTokensResetSuccess');
    if (activeTab.value === 'usage') {
      await loadUsageLog();
    }
  } catch (err) {
    error.value = err?.message || t('settings.aiTokensResetFailed');
  } finally {
    resettingTokens.value = false;
  }
}

onMounted(load);
</script>
