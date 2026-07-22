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
      :class="activeTab === 'agents' || activeTab === 'usage' ? 'w-full' : 'max-w-3xl'"
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
        <label class="mt-3 flex items-center gap-3">
          <input v-model="form.platformHomeAiFocus" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          <span class="text-sm text-gray-900 dark:text-gray-100">{{ t('settings.aiPlatformHomeFocusLabel') }}</span>
        </label>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.aiPlatformHomeFocusHint') }}</p>
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
      <div class="w-full">
        <p v-if="agentsError" class="mb-3 text-sm text-red-600 dark:text-red-400">{{ agentsError }}</p>

        <div class="flex flex-col lg:flex-row gap-4 min-h-[28rem]">
          <!-- Agent list -->
          <aside class="w-full lg:w-80 flex-none rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden flex flex-col">
            <div class="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-3 dark:border-gray-700">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.aiCustomAgentsTitle') }}</h3>
              <button
                type="button"
                class="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                :disabled="agentSaving"
                @click="startNewAgent"
              >
                {{ t('settings.aiCustomAgentCreate') }}
              </button>
            </div>

            <div class="flex-1 overflow-y-auto">
              <button
                type="button"
                class="w-full border-l-2 px-3 py-2.5 text-left transition-colors"
                :class="selectedAgentId === BUILTIN_AGENT_ID
                  ? 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-900/25'
                  : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-white/5'"
                @click="selectBuiltinAgent"
              >
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ t('settings.aiAssistantAgentTitle') }}</p>
                <p class="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{{ t('settings.aiAssistantAgentReadOnlyBadge') }}</p>
              </button>

              <button
                v-for="agent in tenantAgents"
                :key="agent._id"
                type="button"
                class="w-full border-l-2 px-3 py-2.5 text-left transition-colors"
                :class="selectedAgentId === String(agent._id)
                  ? 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-900/25'
                  : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-white/5'"
                @click="selectAgent(agent)"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ agent.name }}</p>
                  <span
                    class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    :class="agent.enabled
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400'"
                  >
                    {{ agent.enabled ? t('settings.aiCustomAgentEnabled') : t('settings.aiCustomAgentDisabled') }}
                  </span>
                </div>
                <p v-if="agent.description" class="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                  {{ agent.description }}
                </p>
              </button>

              <button
                v-if="selectedAgentId === NEW_AGENT_ID"
                type="button"
                class="w-full border-l-2 border-l-indigo-500 bg-indigo-50/80 px-3 py-2.5 text-left dark:bg-indigo-900/25"
              >
                <p class="text-sm font-medium text-indigo-800 dark:text-indigo-200">{{ t('settings.aiCustomAgentNewDraft') }}</p>
              </button>

              <p
                v-if="!agentsLoading && !tenantAgents.length && selectedAgentId !== NEW_AGENT_ID"
                class="px-3 py-4 text-xs text-gray-500 dark:text-gray-400"
              >
                {{ t('settings.aiCustomAgentsEmpty') }}
              </p>
            </div>
          </aside>

          <!-- Agent detail -->
          <section class="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <!-- Built-in Astra transparency -->
            <div v-if="selectedAgentId === BUILTIN_AGENT_ID" class="space-y-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiAssistantAgentTitle') }}</h3>
                  <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.aiAssistantAgentHint') }}</p>
                </div>
                <span class="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                  {{ t('settings.aiAssistantAgentReadOnlyBadge') }}
                </span>
              </div>

              <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {{ t('settings.aiAssistantAgentPromptLabel') }}
                </p>
                <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800 dark:text-gray-100">
                  {{ t('settings.aiAssistantAgentPromptSummary') }}
                </p>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.aiAssistantAgentContextTitle') }}</h4>
                  <ul class="mt-2 space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <li v-for="item in assistantContextItems" :key="item" class="flex gap-2">
                      <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden="true" />
                      <span>{{ t(item) }}</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.aiAssistantAgentActionsTitle') }}</h4>
                  <ul class="mt-2 space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <li v-for="item in assistantActionItems" :key="item" class="flex gap-2">
                      <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                      <span>{{ t(item) }}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                <h4 class="text-sm font-semibold text-amber-900 dark:text-amber-100">{{ t('settings.aiAssistantAgentGuardrailsTitle') }}</h4>
                <ul class="mt-2 space-y-1.5 text-sm text-amber-800 dark:text-amber-200">
                  <li v-for="item in assistantGuardrailItems" :key="item" class="flex gap-2">
                    <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                    <span>{{ t(item) }}</span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Custom agent editor -->
            <div v-else-if="selectedAgentId === NEW_AGENT_ID || editingAgentId" class="space-y-3">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ editingAgentId ? agentForm.name || t('settings.aiCustomAgentEdit') : t('settings.aiCustomAgentCreate') }}
                  </h3>
                  <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.aiCustomAgentsHint') }}</p>
                </div>
                <button
                  v-if="editingAgentId"
                  type="button"
                  class="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                  :disabled="agentSaving"
                  @click="removeSelectedAgent"
                >
                  {{ t('settings.aiCustomAgentDelete') }}
                </button>
              </div>

              <label class="block text-sm">
                <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiCustomAgentName') }}</span>
                <input
                  v-model="agentForm.name"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  :placeholder="t('settings.aiCustomAgentNamePlaceholder')"
                  @blur="maybeAutoSuggestTriggers"
                />
              </label>
              <label class="block text-sm">
                <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiCustomAgentDescription') }}</span>
                <input
                  v-model="agentForm.description"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  @blur="maybeAutoSuggestTriggers"
                />
              </label>
              <label class="block text-sm">
                <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiCustomAgentPrompt') }}</span>
                <textarea
                  v-model="agentForm.systemPrompt"
                  rows="8"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  :placeholder="t('settings.aiCustomAgentPromptPlaceholder')"
                  @blur="maybeAutoSuggestTriggers"
                />
              </label>
              <div class="block text-sm">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiCustomAgentTriggers') }}</span>
                  <button
                    type="button"
                    class="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 dark:text-indigo-400"
                    :disabled="triggerSuggesting || !canSuggestTriggers"
                    @click="suggestTriggers()"
                  >
                    {{ triggerSuggesting ? t('states.loading') : t('settings.aiCustomAgentTriggersGenerate') }}
                  </button>
                </div>
                <input
                  v-model="agentForm.triggerPhrasesText"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
                <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.aiCustomAgentTriggersHint') }}</span>
              </div>
              <label class="block text-sm">
                <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiCustomAgentModules') }}</span>
                <input
                  v-model="agentForm.moduleKeysText"
                  type="text"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
                <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.aiCustomAgentModulesHint') }}</span>
              </label>
              <label class="flex items-start gap-2 text-sm">
                <input v-model="agentForm.webResearch" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600" />
                <span>
                  <span class="block text-gray-900 dark:text-gray-100">{{ t('settings.aiCustomAgentWebResearch') }}</span>
                  <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.aiCustomAgentWebResearchHint') }}</span>
                </span>
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input v-model="agentForm.enabled" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                <span class="text-gray-900 dark:text-gray-100">{{ t('settings.aiCustomAgentEnabled') }}</span>
              </label>
              <div class="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  :disabled="agentSaving || !agentForm.name.trim() || !agentForm.systemPrompt.trim()"
                  @click="saveAgent"
                >
                  {{ agentSaving ? t('states.loading') : t('settings.aiCustomAgentSave') }}
                </button>
                <button
                  v-if="selectedAgentId === NEW_AGENT_ID"
                  type="button"
                  class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  :disabled="agentSaving"
                  @click="cancelAgentEdit"
                >
                  {{ t('settings.aiCustomAgentCancel') }}
                </button>
              </div>
            </div>

            <div v-else class="flex h-full min-h-[16rem] items-center justify-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.aiCustomAgentSelectHint') }}</p>
            </div>
          </section>
        </div>
      </div>
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

      <template v-if="activeTab === 'general'">
      <AiAskPanel />

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.aiAskGraph') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.aiAskGraphHint') }}</p>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.aiAskGraphRecordHint') }}</p>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiInboxTriageTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.aiInboxTriageHint') }}</p>
        <textarea
          v-model="triageText"
          rows="3"
          class="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          :placeholder="t('settings.aiInboxTriagePlaceholder')"
        />
        <button
          type="button"
          class="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
          :disabled="triageLoading || !triageText.trim()"
          @click="runInboxTriage"
        >
          {{ triageLoading ? t('states.loading') : t('settings.aiInboxTriageSubmit') }}
        </button>
        <p v-if="triageError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ triageError }}</p>
        <div v-if="triageSummary || triageProposals.length" class="mt-3 space-y-2">
          <p v-if="triageSummary" class="text-sm text-gray-900 dark:text-gray-100">{{ triageSummary }}</p>
          <ul class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <li v-for="(p, idx) in triageProposals" :key="`${p.action}-${idx}`">
              • {{ p.label || p.action }} — {{ p.rationale }}
            </li>
          </ul>
          <p class="text-xs text-amber-700 dark:text-amber-300">{{ t('settings.aiInboxTriageConfirmHint') }}</p>
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.aiOverdueBrief') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.aiOverdueBriefHint') }}</p>
        <button
          type="button"
          class="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          :disabled="overdueBriefLoading"
          @click="runOverdueBrief"
        >
          {{ overdueBriefLoading ? t('states.loading') : t('records.aiOverdueBrief') }}
        </button>
        <button
          type="button"
          class="mt-3 ml-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          :disabled="collectionAgentLoading"
          @click="runCollectionAgent"
        >
          {{ collectionAgentLoading ? t('states.loading') : t('settings.aiCollectionAgentSubmit') }}
        </button>
        <p v-if="overdueBriefError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ overdueBriefError }}</p>
        <pre
          v-if="overdueBriefText"
          class="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-sans text-sm text-gray-900 dark:bg-gray-900 dark:text-gray-100"
        >{{ overdueBriefText }}</pre>
        <p v-if="overdueBriefInvoiceIds.length" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.aiOverdueBriefPaymentHint') }}
        </p>
        <div v-if="collectionSummary || collectionProposals.length" class="mt-3 space-y-2">
          <p v-if="collectionSummary" class="text-sm text-gray-900 dark:text-gray-100">{{ collectionSummary }}</p>
          <ul class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <li v-for="(p, idx) in collectionProposals" :key="`${p.action}-${idx}`">
              • {{ p.label || p.action }} — {{ p.rationale }}
            </li>
          </ul>
          <p class="text-xs text-amber-700 dark:text-amber-300">{{ t('settings.aiCollectionAgentConfirmHint') }}</p>
        </div>
        <p v-if="collectionError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ collectionError }}</p>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiDigestPreviewTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.aiDigestPreviewHint') }}</p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiDigestPreviewApp') }}</span>
            <select
              v-model="digestAppKey"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="SALES">Sales</option>
              <option value="AUDIT">Audit</option>
              <option value="PORTAL">Portal</option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{ t('settings.aiDigestPreviewWindow') }}</span>
            <select
              v-model="digestWindow"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="daily">{{ t('settings.aiDigestPreviewDaily') }}</option>
              <option value="weekly">{{ t('settings.aiDigestPreviewWeekly') }}</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          class="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
          :disabled="digestLoading"
          @click="runDigestPreview"
        >
          {{ digestLoading ? t('states.loading') : t('settings.aiDigestPreviewSubmit') }}
        </button>
        <p v-if="digestError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ digestError }}</p>
        <div v-if="digestSubject || digestSummary || digestPriorities.length || digestActions.length" class="mt-3 space-y-2">
          <p v-if="digestSubject" class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ digestSubject }}</p>
          <pre
            v-if="digestSummary"
            class="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-sans text-sm text-gray-900 dark:bg-gray-900 dark:text-gray-100"
          >{{ digestSummary }}</pre>
          <ul v-if="digestPriorities.length" class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <li v-for="(p, idx) in digestPriorities" :key="`priority-${idx}`">• {{ p }}</li>
          </ul>
          <ul v-if="digestActions.length" class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <li v-for="(a, idx) in digestActions" :key="`action-${idx}`">-&gt; {{ a }}</li>
          </ul>
          <p class="text-xs text-amber-700 dark:text-amber-300">{{ t('settings.aiDigestPreviewConfirmHint') }}</p>
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
import AiAskPanel from '@/components/ai/AiAskPanel.vue';
import apiClient from '@/utils/apiClient';
import { trackAiAbilityUsed } from '@/utils/aiFeedback';

const { t } = useI18n();

const aiTabs = [
  { id: 'general', labelKey: 'settings.aiTabGeneral' },
  { id: 'agents', labelKey: 'settings.aiTabAgents' },
  { id: 'pii', labelKey: 'settings.aiTabPii' },
  { id: 'usage', labelKey: 'settings.aiTabUsage' },
];
const activeTab = ref('general');

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
const overdueBriefLoading = ref(false);
const overdueBriefText = ref('');
const overdueBriefError = ref('');
const overdueBriefInvoiceIds = ref([]);
const collectionAgentLoading = ref(false);
const collectionError = ref('');
const collectionSummary = ref('');
const collectionProposals = ref([]);
const triageText = ref('');
const triageLoading = ref(false);
const triageError = ref('');
const triageSummary = ref('');
const triageProposals = ref([]);
const digestAppKey = ref('SALES');
const digestWindow = ref('daily');
const digestLoading = ref(false);
const digestError = ref('');
const digestSubject = ref('');
const digestSummary = ref('');
const digestPriorities = ref([]);
const digestActions = ref([]);
const tenantAgents = ref([]);
const agentsLoading = ref(false);
const agentsError = ref('');
const agentSaving = ref(false);
const triggerSuggesting = ref(false);
const BUILTIN_AGENT_ID = '__builtin__';
const NEW_AGENT_ID = '__new__';
const selectedAgentId = ref(BUILTIN_AGENT_ID);
const editingAgentId = ref('');
const agentForm = reactive({
  name: '',
  description: '',
  systemPrompt: '',
  triggerPhrasesText: '',
  moduleKeysText: '',
  webResearch: false,
  enabled: true,
});

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

const canSuggestTriggers = computed(() => Boolean(
  agentForm.name.trim() || agentForm.systemPrompt.trim() || agentForm.description.trim(),
));

const assistantContextItems = [
  'settings.aiAssistantAgentContextRecord',
  'settings.aiAssistantAgentContextRelated',
  'settings.aiAssistantAgentContextActivities',
  'settings.aiAssistantAgentContextKnowledge',
];

const assistantActionItems = [
  'settings.aiAssistantAgentActionEmail',
  'settings.aiAssistantAgentActionTask',
  'settings.aiAssistantAgentActionReview',
  'settings.aiAssistantAgentActionStatus',
  'settings.aiAssistantAgentActionAgent',
];

const assistantGuardrailItems = [
  'settings.aiAssistantAgentGuardrailProposeOnly',
  'settings.aiAssistantAgentGuardrailNoInvent',
  'settings.aiAssistantAgentGuardrailValidatedActions',
  'settings.aiAssistantAgentGuardrailSensitiveData',
];

const form = reactive({
  enabled: false,
  acceptDataUseConsent: false,
  platformHomeAiFocus: false,
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
    form.platformHomeAiFocus = Boolean(settings.value.platformHomeAiFocus);
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
    await loadAgents();
  } catch (err) {
    error.value = err?.message || t('settings.aiLoadFailed');
  } finally {
    loading.value = false;
  }
}

function splitCsv(text) {
  return String(text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function resetAgentForm() {
  editingAgentId.value = '';
  agentForm.name = '';
  agentForm.description = '';
  agentForm.systemPrompt = '';
  agentForm.triggerPhrasesText = '';
  agentForm.moduleKeysText = '';
  agentForm.webResearch = false;
  agentForm.enabled = true;
}

function selectBuiltinAgent() {
  resetAgentForm();
  selectedAgentId.value = BUILTIN_AGENT_ID;
  agentsError.value = '';
}

function selectAgent(agent) {
  if (!agent?._id) return;
  editingAgentId.value = String(agent._id);
  selectedAgentId.value = String(agent._id);
  agentForm.name = agent.name || '';
  agentForm.description = agent.description || '';
  agentForm.systemPrompt = agent.systemPrompt || '';
  agentForm.triggerPhrasesText = Array.isArray(agent.triggerPhrases) ? agent.triggerPhrases.join(', ') : '';
  agentForm.moduleKeysText = Array.isArray(agent.moduleKeys) ? agent.moduleKeys.join(', ') : '';
  agentForm.webResearch = Array.isArray(agent.capabilities)
    && agent.capabilities.map((c) => String(c).toLowerCase()).includes('web_research');
  agentForm.enabled = agent.enabled !== false;
  agentsError.value = '';
}

function startNewAgent() {
  resetAgentForm();
  selectedAgentId.value = NEW_AGENT_ID;
  agentsError.value = '';
}

function cancelAgentEdit() {
  if (tenantAgents.value.length) {
    selectAgent(tenantAgents.value[0]);
  } else {
    selectBuiltinAgent();
  }
}

async function loadAgents() {
  agentsLoading.value = true;
  agentsError.value = '';
  try {
    const data = await apiClient.get('/ai/tenant-agents');
    tenantAgents.value = Array.isArray(data?.agents) ? data.agents : [];
    const current = selectedAgentId.value;
    if (current === NEW_AGENT_ID) {
      // keep draft selection
    } else if (current && current !== BUILTIN_AGENT_ID) {
      const match = tenantAgents.value.find((a) => String(a._id) === current);
      if (match) selectAgent(match);
      else if (tenantAgents.value.length) selectAgent(tenantAgents.value[0]);
      else selectBuiltinAgent();
    } else if (!current) {
      selectBuiltinAgent();
    }
  } catch (err) {
    agentsError.value = err?.message || t('settings.aiCustomAgentLoadFailed');
    tenantAgents.value = [];
  } finally {
    agentsLoading.value = false;
  }
}

async function suggestTriggers({ force = true } = {}) {
  if (triggerSuggesting.value || !canSuggestTriggers.value) return;
  if (!force && agentForm.triggerPhrasesText.trim()) return;

  triggerSuggesting.value = true;
  agentsError.value = '';
  try {
    const data = await apiClient.post('/ai/tenant-agents/suggest-triggers', {
      name: agentForm.name.trim(),
      description: agentForm.description.trim(),
      systemPrompt: agentForm.systemPrompt.trim(),
      moduleKeysText: agentForm.moduleKeysText.trim(),
    });
    const phrases = Array.isArray(data?.triggerPhrases) ? data.triggerPhrases : [];
    if (phrases.length) {
      agentForm.triggerPhrasesText = phrases.join(', ');
    } else {
      agentsError.value = t('settings.aiCustomAgentTriggersGenerateEmpty');
    }
    trackAiAbilityUsed({
      abilityKey: 'tenant_agent_triggers',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
      tokens: data?.usage?.totalTokens,
    });
  } catch (err) {
    agentsError.value = err?.message || t('settings.aiCustomAgentTriggersGenerateFailed');
  } finally {
    triggerSuggesting.value = false;
  }
}

function maybeAutoSuggestTriggers() {
  if (!agentForm.triggerPhrasesText.trim() && canSuggestTriggers.value) {
    suggestTriggers({ force: false });
  }
}

async function saveAgent() {
  if (agentSaving.value) return;
  agentSaving.value = true;
  agentsError.value = '';
  try {
    if (!agentForm.triggerPhrasesText.trim() && canSuggestTriggers.value) {
      await suggestTriggers({ force: false });
    }
    const payload = {
      name: agentForm.name.trim(),
      description: agentForm.description.trim(),
      systemPrompt: agentForm.systemPrompt.trim(),
      triggerPhrases: splitCsv(agentForm.triggerPhrasesText),
      moduleKeys: splitCsv(agentForm.moduleKeysText),
      capabilities: agentForm.webResearch ? ['web_research'] : [],
      enabled: Boolean(agentForm.enabled),
    };
    let savedId = editingAgentId.value;
    if (editingAgentId.value) {
      const data = await apiClient.put(`/ai/tenant-agents/${encodeURIComponent(editingAgentId.value)}`, payload);
      savedId = String(data?.agent?._id || editingAgentId.value);
    } else {
      const data = await apiClient.post('/ai/tenant-agents', payload);
      savedId = String(data?.agent?._id || '');
    }
    selectedAgentId.value = savedId || BUILTIN_AGENT_ID;
    await loadAgents();
  } catch (err) {
    agentsError.value = err?.message || t('settings.aiCustomAgentSaveFailed');
  } finally {
    agentSaving.value = false;
  }
}

async function removeSelectedAgent() {
  if (!editingAgentId.value) return;
  const agent = tenantAgents.value.find((a) => String(a._id) === editingAgentId.value);
  if (!agent) return;
  await removeAgent(agent);
}

async function removeAgent(agent) {
  if (!agent?._id) return;
  if (!window.confirm(t('settings.aiCustomAgentDeleteConfirm'))) return;
  agentsError.value = '';
  try {
    await apiClient.delete(`/ai/tenant-agents/${encodeURIComponent(agent._id)}`);
    selectBuiltinAgent();
    await loadAgents();
  } catch (err) {
    agentsError.value = err?.message || t('settings.aiCustomAgentDeleteFailed');
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
      platformHomeAiFocus: form.platformHomeAiFocus,
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

async function runOverdueBrief() {
  overdueBriefLoading.value = true;
  overdueBriefError.value = '';
  overdueBriefText.value = '';
  overdueBriefInvoiceIds.value = [];
  try {
    const data = await apiClient.post('/ai/invoices/overdue-brief', { limit: 25 });
    overdueBriefText.value = String(data?.text || '').trim();
    overdueBriefInvoiceIds.value = Array.isArray(data?.proposedPaymentLinkInvoiceIds)
      ? data.proposedPaymentLinkInvoiceIds
      : [];
    trackAiAbilityUsed({
      abilityKey: 'invoice_collection_brief',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
    if (!overdueBriefText.value) {
      overdueBriefError.value = t('settings.aiOverdueBriefEmpty');
    }
  } catch (err) {
    overdueBriefError.value = err?.message || t('settings.aiOverdueBriefFailed');
  } finally {
    overdueBriefLoading.value = false;
  }
}

async function runCollectionAgent() {
  if (collectionAgentLoading.value) return;
  collectionAgentLoading.value = true;
  collectionError.value = '';
  collectionSummary.value = '';
  collectionProposals.value = [];
  try {
    const data = await apiClient.post('/ai/agents/collection', { limit: 25 });
    collectionSummary.value = String(data?.summary || '').trim();
    collectionProposals.value = Array.isArray(data?.proposals) ? data.proposals : [];
    trackAiAbilityUsed({
      abilityKey: 'collection_agent',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
    if (!collectionSummary.value && !collectionProposals.value.length) {
      collectionError.value = t('settings.aiCollectionAgentEmpty');
    }
  } catch (err) {
    collectionError.value = err?.message || t('settings.aiCollectionAgentFailed');
  } finally {
    collectionAgentLoading.value = false;
  }
}

async function runInboxTriage() {
  const text = triageText.value.trim();
  if (!text || triageLoading.value) return;
  triageLoading.value = true;
  triageError.value = '';
  triageSummary.value = '';
  triageProposals.value = [];
  try {
    const data = await apiClient.post('/ai/agents/inbox-triage', { text });
    triageSummary.value = String(data?.summary || '').trim();
    triageProposals.value = Array.isArray(data?.proposals) ? data.proposals : [];
    trackAiAbilityUsed({
      abilityKey: 'inbox_triage',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
    if (!triageSummary.value && !triageProposals.value.length) {
      triageError.value = t('settings.aiInboxTriageEmpty');
    }
  } catch (err) {
    triageError.value = err?.message || t('settings.aiInboxTriageFailed');
  } finally {
    triageLoading.value = false;
  }
}

async function runDigestPreview() {
  if (digestLoading.value) return;
  digestLoading.value = true;
  digestError.value = '';
  digestSubject.value = '';
  digestSummary.value = '';
  digestPriorities.value = [];
  digestActions.value = [];
  try {
    const data = await apiClient.post('/ai/digests/brief-preview', {
      appKey: digestAppKey.value,
      window: digestWindow.value,
    });
    digestSubject.value = String(data?.subject || '').trim();
    digestSummary.value = String(data?.summary || '').trim();
    digestPriorities.value = Array.isArray(data?.priorities) ? data.priorities : [];
    digestActions.value = Array.isArray(data?.suggestedActions) ? data.suggestedActions : [];
    trackAiAbilityUsed({
      abilityKey: 'scheduled_digest',
      provider: data?.provider,
      model: data?.model,
      keyMode: data?.keyMode,
    });
    if (!digestSubject.value && !digestSummary.value && !digestPriorities.value.length && !digestActions.value.length) {
      digestError.value = data?.empty ? t('settings.aiDigestPreviewEmpty') : t('settings.aiDigestPreviewFailed');
    }
  } catch (err) {
    digestError.value = err?.message || t('settings.aiDigestPreviewFailed');
  } finally {
    digestLoading.value = false;
  }
}

onMounted(load);
</script>
