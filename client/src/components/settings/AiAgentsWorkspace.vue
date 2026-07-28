<template>
  <div class="flex h-full min-h-0 flex-1 flex-col gap-2">
    <div class="flex shrink-0 flex-wrap items-center gap-2">
      <h3
        class="text-sm font-semibold text-gray-900 dark:text-white"
        :title="t('settings.aiAgentsHint')"
      >
        {{ t('settings.aiAgentsTitle') }}
      </h3>
      <p v-if="meta" class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('settings.aiAgentsCatalogNote', {
          agentCount: meta.agentCount,
          toolCount: meta.toolCount,
          customized: meta.customizedAgents || 0,
        }) }}
      </p>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <label class="block w-44 sm:w-52 text-sm">
          <span class="sr-only">{{ t('settings.aiAgentsSearchPlaceholder') }}</span>
          <input
            v-model="searchQuery"
            type="search"
            class="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.aiAgentsSearchPlaceholder')"
          />
        </label>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          @click="openWizard()"
        >
          <PlusIcon class="h-4 w-4" />
          {{ t('settings.aiAgentsNew') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex flex-1 items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>
    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
    >
      {{ error }}
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
      <!-- Left: agent list -->
      <aside class="flex max-h-48 w-full flex-none flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/60 lg:max-h-none lg:h-full lg:w-64">
        <div class="flex shrink-0 items-center gap-2 border-b border-gray-200 px-2 py-1.5 dark:border-white/10">
          <button
            v-for="f in listFilters"
            :key="f.id"
            type="button"
            class="rounded-md px-2 py-0.5 text-xs font-medium transition-colors"
            :class="listFilter === f.id
              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200'
              : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'"
            @click="listFilter = f.id"
          >
            {{ t(f.labelKey) }}
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <button
            v-for="agent in filteredAgents"
            :key="agent.key || agent.name"
            type="button"
            class="flex w-full items-start gap-2 border-l-2 px-2.5 py-1.5 text-left transition-colors"
            :class="selectedKey === (agent.key || agent.name)
              ? 'border-l-indigo-500 bg-indigo-50/80 dark:bg-indigo-900/25'
              : 'border-l-transparent hover:bg-gray-50 dark:hover:bg-white/5'"
            @click="selectAgent(agent.key || agent.name)"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ agent.title }}</p>
                <span
                  v-if="agent.defaultKey"
                  class="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                >
                  {{ t('settings.aiAgentsPlatformBadge') }}
                </span>
                <span
                  v-if="agent.isCustomized"
                  class="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                >
                  {{ t('settings.aiAgentsModifiedBadge') }}
                </span>
                <span
                  v-if="agent.enabled === false"
                  class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  {{ t('settings.aiAgentsDisabledBadge') }}
                </span>
              </div>
              <p class="truncate text-[11px] text-gray-500 dark:text-gray-400">{{ agent.key || agent.name }}</p>
            </div>
          </button>
          <p v-if="!filteredAgents.length" class="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.aiAgentsEmpty') }}
          </p>
        </div>
      </aside>

      <!-- Right: detail -->
      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
        <template v-if="currentAgent">
          <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-white/10">
            <div class="min-w-0">
              <h4 class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ draft.title || currentAgent.title }}</h4>
              <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ currentAgent.key || currentAgent.name }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
                :disabled="trying"
                @click="tryOpen = !tryOpen"
              >
                {{ t('settings.aiAgentsTry') }}
              </button>
              <button
                v-if="currentAgent.canRevert"
                type="button"
                class="rounded-lg border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20"
                :disabled="saving || !currentAgent.isCustomized"
                @click="confirmRevertAgent"
              >
                {{ t('settings.aiAgentsRevert') }}
              </button>
              <button
                v-if="!currentAgent.defaultKey && !currentAgent.canRevert"
                type="button"
                class="rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                :disabled="saving"
                @click="confirmDeleteAgent"
              >
                {{ t('settings.aiAgentsDelete') }}
              </button>
              <button
                type="button"
                class="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                :disabled="saving || !dirty"
                @click="saveAgent"
              >
                {{ saving ? t('settings.aiAgentsSaving') : t('settings.aiAgentsSave') }}
              </button>
            </div>
          </div>

          <div class="flex shrink-0 gap-1 border-b border-gray-200 px-3 dark:border-white/10">
            <button
              v-for="tab in detailTabs"
              :key="tab.id"
              type="button"
              class="border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors"
              :class="detailTab === tab.id
                ? 'border-indigo-500 text-indigo-700 dark:text-indigo-300'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400'"
              @click="detailTab = tab.id"
            >
              {{ t(tab.labelKey) }}
            </button>
          </div>

          <div
            class="min-h-0 flex-1 p-3"
            :class="detailTab === 'tools' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'"
          >
            <p v-if="actionMessage" class="mb-3 text-sm text-green-700 dark:text-green-400">{{ actionMessage }}</p>
            <p v-if="actionError" class="mb-3 text-sm text-red-600 dark:text-red-400">{{ actionError }}</p>

            <div v-if="tryOpen" class="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-800 dark:bg-indigo-950/30">
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('settings.aiAgentsTryLabel') }}</label>
              <textarea
                v-model="tryQuery"
                rows="2"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                :placeholder="t('settings.aiAgentsTryPlaceholder')"
              />
              <div class="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  :disabled="trying || !tryQuery.trim()"
                  @click="runTry"
                >
                  {{ trying ? t('settings.aiAgentsTrying') : t('settings.aiAgentsTryRun') }}
                </button>
                <button type="button" class="text-xs text-gray-500 hover:text-gray-800" @click="tryOpen = false">
                  {{ t('settings.aiAgentsTryClose') }}
                </button>
              </div>
              <p v-if="tryAnswer" class="mt-3 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ tryAnswer }}</p>
            </div>

            <template v-if="detailTab === 'details'">
              <div class="space-y-4">
                <label class="block text-sm">
                  <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('settings.aiAgentsFieldTitle') }}</span>
                  <input
                    v-model="draft.title"
                    type="text"
                    class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
                <label class="block text-sm">
                  <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('settings.aiAgentsFieldDescription') }}</span>
                  <textarea
                    v-model="draft.description"
                    rows="2"
                    class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
                <label class="block text-sm">
                  <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('settings.aiAgentsFieldPrompt') }}</span>
                  <textarea
                    v-model="draft.systemHint"
                    rows="6"
                    class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
                <div class="flex flex-wrap gap-4">
                  <label class="block text-sm">
                    <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('settings.aiAgentsFieldAutonomy') }}</span>
                    <select
                      v-model="draft.autonomy"
                      class="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="assist">assist</option>
                      <option value="confirm">confirm</option>
                    </select>
                  </label>
                  <label class="flex items-center gap-2 pt-6 text-sm text-gray-700 dark:text-gray-300">
                    <input v-model="draft.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                    {{ t('settings.aiAgentsFieldEnabled') }}
                  </label>
                </div>
              </div>
            </template>

            <template v-else-if="detailTab === 'tools'">
              <div class="flex min-h-0 flex-1 flex-col space-y-2">
              <p class="mb-2 shrink-0 text-xs text-gray-600 dark:text-gray-400" :title="t('settings.aiAgentsToolsHint')">
                {{ t('settings.aiAgentsToolsHint') }}
              </p>
              <div class="mb-0 flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
                  @click="selectFabricTools"
                >
                  {{ t('settings.aiAgentsSelectFabricTools') }}
                </button>
                <button
                  type="button"
                  class="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
                  @click="draft.tools = []"
                >
                  {{ t('settings.aiAgentsClearTools') }}
                </button>
                <label class="ml-auto flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <input v-model="showAllTools" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                  {{ t('settings.aiAgentsShowAllTools') }}
                </label>
              </div>
              <div class="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-1.5 dark:border-gray-700">
                <p
                  v-if="!showAllTools"
                  class="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-500"
                >
                  {{ t('settings.aiAgentsFabricToolsHeading') }}
                </p>
                <label
                  v-for="tool in displayedTools"
                  :key="tool.name"
                  class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 hover:bg-gray-50 dark:hover:bg-white/5"
                  :class="tool.enabled === false ? 'opacity-50' : ''"
                >
                  <input
                    type="checkbox"
                    class="mt-0.5 rounded border-gray-300 text-indigo-600"
                    :checked="draft.tools.includes(tool.name)"
                    :disabled="tool.enabled === false"
                    @change="toggleTool(tool.name, $event.target.checked)"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="flex flex-wrap items-center gap-1.5">
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ tool.title || tool.name }}</span>
                      <span class="text-[11px] text-gray-400">{{ tool.name }}</span>
                      <span
                        v-if="isFabricTool(tool.name)"
                        class="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                      >
                        {{ t('settings.aiAgentsFabricBadge') }}
                      </span>
                      <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" :class="toolRiskClass(tool.risk)">
                        {{ toolRiskLabel(tool.risk) }}
                      </span>
                    </span>
                    <span class="block text-xs text-gray-500 dark:text-gray-400">{{ tool.description }}</span>
                  </span>
                  <button
                    type="button"
                    class="shrink-0 text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    @click.prevent="openToolEditor(tool)"
                  >
                    {{ t('settings.aiAgentsEditTool') }}
                  </button>
                </label>
              </div>
              </div>
            </template>
          </div>
        </template>
        <div v-else class="flex flex-1 items-center justify-center p-8 text-sm text-gray-500 dark:text-gray-400">
          {{ t('settings.aiAgentsSelectPrompt') }}
        </div>
      </section>
    </div>

    <!-- Astra agent composer -->
    <div
      v-if="wizardOpen"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="t('settings.aiMasterTitle')"
      @click.self="closeWizard"
      @keydown.esc.prevent="closeWizard"
    >
      <div class="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-gray-900 sm:rounded-2xl">
        <header class="flex shrink-0 items-start gap-3 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <SparklesIcon class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0 flex-1 pt-0.5">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.aiMasterTitle') }}</h4>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.aiMasterHint') }}</p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            :aria-label="t('settings.aiAgentsCancel')"
            @click="closeWizard"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </header>

        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div>
            <label for="astra-agent-instruction" class="block text-sm font-medium text-gray-800 dark:text-gray-200">
              {{ t('settings.aiMasterInstruction') }}
            </label>
            <textarea
              id="astra-agent-instruction"
              ref="wizardInputRef"
              v-model="wizard.instruction"
              rows="8"
              class="mt-2 min-h-[11rem] w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3.5 text-sm leading-relaxed text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500"
              :placeholder="t('settings.aiMasterInstructionPlaceholder')"
              @input="onWizardInstructionInput"
            />
            <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.aiMasterInstructionHelp') }}</p>
          </div>

          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('settings.aiMasterExamplesLabel') }}
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-for="ex in wizardExamples"
                :key="ex.id"
                type="button"
                class="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-left text-xs text-gray-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-900 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-100"
                @click="applyWizardExample(ex.text)"
              >
                {{ ex.label }}
              </button>
            </div>
          </div>

          <div
            v-if="wizard.proposal"
            class="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                :class="proposalActionClass"
              >
                {{ proposalActionLabel }}
              </span>
              <span
                v-if="wizard.proposal.authoredBy === 'llm'"
                class="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
              >
                {{ t('settings.aiMasterAuthoredByAi') }}
              </span>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ wizard.proposal.title || t('settings.aiMasterPreviewFallback') }}
              </p>
            </div>
            <p v-if="wizard.proposal.reason" class="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {{ wizard.proposal.reason }}
            </p>
            <div v-if="wizard.proposal.tools?.length" class="mt-3">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.aiMasterToolsLabel') }}</p>
              <div class="mt-1.5 flex flex-wrap gap-1.5">
                <span
                  v-for="tool in wizard.proposal.tools.slice(0, 10)"
                  :key="tool"
                  class="rounded-md bg-white/80 px-2 py-0.5 font-mono text-[11px] text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900/80 dark:text-gray-300 dark:ring-gray-700"
                >
                  {{ tool }}
                </span>
                <span
                  v-if="wizard.proposal.tools.length > 10"
                  class="rounded-md px-2 py-0.5 text-[11px] text-gray-500"
                >
                  +{{ wizard.proposal.tools.length - 10 }}
                </span>
              </div>
            </div>
          </div>

          <p v-if="wizardError" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {{ wizardError }}
          </p>
        </div>

        <footer class="flex shrink-0 flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/80 px-6 py-4 dark:border-gray-800 dark:bg-gray-950/50">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            @click="closeWizard"
          >
            {{ t('settings.aiAgentsCancel') }}
          </button>
          <div class="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              :disabled="wizardSaving || !wizard.instruction.trim()"
              @click="proposeMaster"
            >
              <EyeIcon class="h-4 w-4" aria-hidden="true" />
              {{ wizardSaving && !wizard.proposal ? t('settings.aiAgentsSaving') : t('settings.aiMasterPropose') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="wizardSaving || !wizard.instruction.trim()"
              @click="createAgent"
            >
              <PlusIcon class="h-4 w-4" aria-hidden="true" />
              {{ wizardSaving ? t('settings.aiAgentsSaving') : t('settings.aiMasterCreate') }}
            </button>
          </div>
        </footer>
      </div>
    </div>

    <!-- Tool editor modal -->
    <div
      v-if="toolEditor"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="toolEditor = null"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiAgentsToolEditorTitle') }}</h4>
        <p class="mt-1 text-xs text-gray-500">{{ toolEditor.name }}</p>
        <div class="mt-4 space-y-3">
          <label class="block text-sm">
            <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('settings.aiAgentsFieldTitle') }}</span>
            <input
              v-model="toolDraft.title"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('settings.aiAgentsFieldDescription') }}</span>
            <textarea
              v-model="toolDraft.description"
              rows="3"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input v-model="toolDraft.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
            {{ t('settings.aiAgentsFieldEnabled') }}
          </label>
        </div>
        <div class="mt-5 flex flex-wrap justify-end gap-2">
          <button
            v-if="toolEditor.canRevert && toolEditor.isCustomized"
            type="button"
            class="mr-auto rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:text-amber-200"
            :disabled="toolSaving"
            @click="revertTool"
          >
            {{ t('settings.aiAgentsRevert') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
            @click="toolEditor = null"
          >
            {{ t('settings.aiAgentsCancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            :disabled="toolSaving"
            @click="saveTool"
          >
            {{ toolSaving ? t('settings.aiAgentsSaving') : t('settings.aiAgentsSave') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { EyeIcon, PlusIcon, SparklesIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';

import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const actionMessage = ref('');
const actionError = ref('');
const agents = ref([]);
const toolsCatalog = ref([]);
const showAllTools = ref(false);

/** CapIndex fabric + common CRM reads — default tool surface for specialists. */
const FABRIC_TOOL_NAMES = [
  'module.search',
  'module.get',
  'module.create',
  'module.update',
  'search.crm',
  'crm.record.get',
  'knowledge.search',
  'relationships.context',
  'reports.run',
  'email.draft',
  'crm.deals',
  'crm.cases',
  'crm.people',
  'crm.tasks',
];

function isFabricTool(name) {
  return FABRIC_TOOL_NAMES.includes(name) || String(name || '').startsWith('module.');
}
const meta = ref(null);
const searchQuery = ref('');
const listFilter = ref('all');
const selectedKey = ref('');
const detailTab = ref('details');
const draft = reactive({
  title: '',
  description: '',
  systemHint: '',
  autonomy: 'assist',
  enabled: true,
  tools: [],
});

const tryOpen = ref(false);
const tryQuery = ref('');
const tryAnswer = ref('');
const trying = ref(false);

const wizardOpen = ref(false);
const wizardSaving = ref(false);
const wizardError = ref('');
const wizardInputRef = ref(null);
const wizard = reactive({
  instruction: '',
  proposal: null,
});

const wizardExamples = computed(() => [
  {
    id: 'support',
    label: t('settings.aiMasterExampleSupportLabel'),
    text: t('settings.aiMasterExampleSupportText'),
  },
  {
    id: 'sales',
    label: t('settings.aiMasterExampleSalesLabel'),
    text: t('settings.aiMasterExampleSalesText'),
  },
  {
    id: 'faq',
    label: t('settings.aiMasterExampleFaqLabel'),
    text: t('settings.aiMasterExampleFaqText'),
  },
]);

const proposalActionLabel = computed(() => {
  const action = String(wizard.proposal?.action || 'create');
  if (action === 'merge' || action === 'reuse') return t('settings.aiMasterActionReuse');
  if (action === 'suggest_create' || action === 'auto_create' || action === 'create') {
    return t('settings.aiMasterActionCreate');
  }
  return action;
});

const proposalActionClass = computed(() => {
  const action = String(wizard.proposal?.action || 'create');
  if (action === 'merge' || action === 'reuse') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200';
  }
  return 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-200';
});

const toolEditor = ref(null);
const toolSaving = ref(false);
const toolDraft = reactive({
  title: '',
  description: '',
  enabled: true,
});

const listFilters = [
  { id: 'all', labelKey: 'settings.aiAgentsFilterAll' },
  { id: 'modified', labelKey: 'settings.aiAgentsFilterModified' },
  { id: 'disabled', labelKey: 'settings.aiAgentsFilterDisabled' },
];

const detailTabs = [
  { id: 'details', labelKey: 'settings.aiAgentsTabDetails' },
  { id: 'tools', labelKey: 'settings.aiAgentsTabTools' },
];

const currentAgent = computed(() =>
  agents.value.find((a) => (a.key || a.name) === selectedKey.value) || null,
);

const displayedTools = computed(() => {
  const all = toolsCatalog.value || [];
  if (showAllTools.value) return all;
  const selected = new Set(draft.tools || []);
  const primary = all.filter((t) => isFabricTool(t.name) || selected.has(t.name));
  // Keep stable order: fabric first, then other selected
  const fabric = primary.filter((t) => isFabricTool(t.name));
  const rest = primary.filter((t) => !isFabricTool(t.name));
  return [...fabric, ...rest];
});

const filteredAgents = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return agents.value.filter((agent) => {
    if (listFilter.value === 'modified' && !agent.isCustomized) return false;
    if (listFilter.value === 'disabled' && agent.enabled !== false) return false;
    if (!q) return true;
    const hay = [
      agent.name,
      agent.key,
      agent.title,
      agent.description,
      agent.systemHint,
      ...(agent.tools || []),
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });
});

const dirty = computed(() => {
  const agent = currentAgent.value;
  if (!agent) return false;
  return (
    draft.title !== (agent.title || '')
    || draft.description !== (agent.description || '')
    || draft.systemHint !== (agent.systemHint || '')
    || draft.autonomy !== (agent.autonomy || 'assist')
    || draft.enabled !== (agent.enabled !== false)
    || JSON.stringify([...(draft.tools || [])].sort()) !== JSON.stringify([...(agent.tools || [])].sort())
  );
});

function toolRiskLabel(risk) {
  const r = String(risk || 'read').toLowerCase();
  if (r === 'write') return t('settings.aiAgentsRiskWrite');
  if (r === 'destructive') return t('settings.aiAgentsRiskDestructive');
  return t('settings.aiAgentsRiskRead');
}

function toolRiskClass(risk) {
  const r = String(risk || 'read').toLowerCase();
  if (r === 'write') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  if (r === 'destructive') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
}

function syncDraftFromAgent(agent) {
  if (!agent) return;
  draft.title = agent.title || '';
  draft.description = agent.description || '';
  draft.systemHint = agent.systemHint || '';
  draft.autonomy = agent.autonomy || 'assist';
  draft.enabled = agent.enabled !== false;
  draft.tools = Array.isArray(agent.tools) ? [...agent.tools] : [];
}

function selectAgent(key) {
  selectedKey.value = key;
  detailTab.value = 'details';
  tryOpen.value = false;
  tryAnswer.value = '';
  actionMessage.value = '';
  actionError.value = '';
  const agent = agents.value.find((a) => (a.key || a.name) === key);
  syncDraftFromAgent(agent);
}

function toggleTool(name, checked) {
  if (checked) {
    if (!draft.tools.includes(name)) draft.tools.push(name);
  } else {
    draft.tools = draft.tools.filter((n) => n !== name);
  }
}

function selectAllTools() {
  draft.tools = toolsCatalog.value.filter((t) => t.enabled !== false).map((t) => t.name);
}

function selectFabricTools() {
  const names = FABRIC_TOOL_NAMES.filter((name) =>
    toolsCatalog.value.some((t) => t.name === name && t.enabled !== false),
  );
  draft.tools = [...new Set([...(draft.tools || []).filter((n) => isFabricTool(n) === false), ...names])];
  // Prefer fabric-only defaults for new specialists
  draft.tools = names;
}

function toggleWizardTool(name, checked) {
  if (checked) {
    if (!wizard.tools.includes(name)) wizard.tools.push(name);
  } else {
    wizard.tools = wizard.tools.filter((n) => n !== name);
  }
}

async function loadCatalog() {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiClient.get('/ai/v2/agents');
    agents.value = Array.isArray(data?.agents) ? data.agents : [];
    toolsCatalog.value = Array.isArray(data?.tools) ? data.tools : [];
    meta.value = data?.meta || {
      agentCount: agents.value.length,
      toolCount: toolsCatalog.value.length,
    };
    if (!toolsCatalog.value.length) {
      const toolsData = await apiClient.get('/ai/v2/tools');
      toolsCatalog.value = Array.isArray(toolsData?.tools) ? toolsData.tools : [];
    }
    if (!selectedKey.value && agents.value.length) {
      selectAgent(agents.value[0].key || agents.value[0].name);
    } else if (selectedKey.value) {
      const still = agents.value.find((a) => (a.key || a.name) === selectedKey.value);
      if (still) syncDraftFromAgent(still);
      else if (agents.value.length) selectAgent(agents.value[0].key || agents.value[0].name);
    }
  } catch (err) {
    error.value = err?.message || t('settings.aiAgentsLoadFailed');
    agents.value = [];
    toolsCatalog.value = [];
    meta.value = null;
  } finally {
    loading.value = false;
  }
}

async function saveAgent() {
  if (!currentAgent.value || !dirty.value) return;
  saving.value = true;
  actionError.value = '';
  actionMessage.value = '';
  try {
    const key = currentAgent.value.key || currentAgent.value.name;
    const data = await apiClient.put(`/ai/v2/agents/${encodeURIComponent(key)}`, {
      title: draft.title,
      description: draft.description,
      systemHint: draft.systemHint,
      autonomy: draft.autonomy,
      enabled: draft.enabled,
      tools: draft.tools,
    });
    const updated = data?.agent;
    if (updated) {
      const idx = agents.value.findIndex((a) => (a.key || a.name) === key);
      if (idx >= 0) agents.value[idx] = updated;
      syncDraftFromAgent(updated);
    }
    actionMessage.value = t('settings.aiAgentsSaved');
  } catch (err) {
    actionError.value = err?.message || t('settings.aiAgentsSaveFailed');
  } finally {
    saving.value = false;
  }
}

async function confirmRevertAgent() {
  if (!currentAgent.value?.canRevert) return;
  if (!await confirmAction(t('settings.aiAgentsRevertConfirm', { name: currentAgent.value.title }))) return;
  saving.value = true;
  actionError.value = '';
  try {
    const key = currentAgent.value.key || currentAgent.value.name;
    const data = await apiClient.post(`/ai/v2/agents/${encodeURIComponent(key)}/revert`, {});
    const updated = data?.agent;
    if (updated) {
      const idx = agents.value.findIndex((a) => (a.key || a.name) === key);
      if (idx >= 0) agents.value[idx] = updated;
      syncDraftFromAgent(updated);
    }
    actionMessage.value = t('settings.aiAgentsReverted');
  } catch (err) {
    actionError.value = err?.message || t('settings.aiAgentsSaveFailed');
  } finally {
    saving.value = false;
  }
}

async function confirmDeleteAgent() {
  if (!currentAgent.value) return;
  if (!await confirmAction(t('settings.aiAgentsDeleteConfirm', { name: currentAgent.value.title }))) return;
  saving.value = true;
  try {
    const key = currentAgent.value.key || currentAgent.value.name;
    await apiClient.delete(`/ai/v2/agents/${encodeURIComponent(key)}`);
    agents.value = agents.value.filter((a) => (a.key || a.name) !== key);
    if (agents.value.length) selectAgent(agents.value[0].key || agents.value[0].name);
    else selectedKey.value = '';
    actionMessage.value = t('settings.aiAgentsDeleted');
  } catch (err) {
    actionError.value = err?.message || t('settings.aiAgentsSaveFailed');
  } finally {
    saving.value = false;
  }
}

async function runTry() {
  if (!currentAgent.value || !tryQuery.value.trim()) return;
  trying.value = true;
  tryAnswer.value = '';
  try {
    const key = currentAgent.value.key || currentAgent.value.name;
    const data = await apiClient.post(`/ai/v2/agents/${encodeURIComponent(key)}/try`, {
      query: tryQuery.value.trim(),
    });
    tryAnswer.value = data?.answer || t('settings.aiAgentsTryEmpty');
  } catch (err) {
    tryAnswer.value = err?.message || t('settings.aiAgentsTryFailed');
  } finally {
    trying.value = false;
  }
}

function closeWizard() {
  wizardOpen.value = false;
  wizardError.value = '';
}

function onWizardInstructionInput() {
  if (wizard.proposal) wizard.proposal = null;
  if (wizardError.value) wizardError.value = '';
}

function applyWizardExample(text) {
  wizard.instruction = text;
  wizard.proposal = null;
  wizardError.value = '';
  nextTick(() => wizardInputRef.value?.focus?.());
}

async function openWizard() {
  wizard.instruction = '';
  wizard.proposal = null;
  wizardError.value = '';
  wizardOpen.value = true;
  await nextTick();
  wizardInputRef.value?.focus?.();
}

watch(wizardOpen, (open, _prev, onCleanup) => {
  if (!open) return;
  const onKey = (e) => {
    if (e.key === 'Escape') closeWizard();
  };
  window.addEventListener('keydown', onKey);
  onCleanup(() => window.removeEventListener('keydown', onKey));
});

async function proposeMaster() {
  wizardSaving.value = true;
  wizardError.value = '';
  try {
    const data = await apiClient.post('/ai/v2/master/propose', {
      instruction: wizard.instruction.trim(),
    });
    wizard.proposal = data?.proposal || null;
  } catch (err) {
    wizardError.value = err?.message || t('settings.aiAgentsSaveFailed');
  } finally {
    wizardSaving.value = false;
  }
}

async function createAgent() {
  wizardSaving.value = true;
  wizardError.value = '';
  try {
    const data = await apiClient.post('/ai/v2/master/create', {
      instruction: wizard.instruction.trim(),
      proposal: wizard.proposal || undefined,
    });
    const key = data?.key;
    await loadCatalog();
    closeWizard();
    if (key) selectAgent(key);
    actionMessage.value = data?.reused
      ? t('settings.aiMasterReused')
      : t('settings.aiAgentsCreated');
  } catch (err) {
    wizardError.value = err?.message || t('settings.aiAgentsSaveFailed');
  } finally {
    wizardSaving.value = false;
  }
}

function openToolEditor(tool) {
  toolEditor.value = tool;
  toolDraft.title = tool.title || tool.name;
  toolDraft.description = tool.description || '';
  toolDraft.enabled = tool.enabled !== false;
}

async function saveTool() {
  if (!toolEditor.value) return;
  toolSaving.value = true;
  try {
    const name = toolEditor.value.name;
    const data = await apiClient.put(`/ai/v2/tools/${encodeURIComponent(name)}`, {
      title: toolDraft.title,
      description: toolDraft.description,
      enabled: toolDraft.enabled,
    });
    const updated = data?.tool;
    if (updated) {
      const idx = toolsCatalog.value.findIndex((t) => t.name === name);
      if (idx >= 0) toolsCatalog.value[idx] = updated;
      toolEditor.value = null;
      actionMessage.value = t('settings.aiAgentsToolSaved');
    }
  } catch (err) {
    actionError.value = err?.message || t('settings.aiAgentsSaveFailed');
  } finally {
    toolSaving.value = false;
  }
}

async function revertTool() {
  if (!toolEditor.value) return;
  if (!await confirmAction(t('settings.aiAgentsToolRevertConfirm', { name: toolEditor.value.name }))) return;
  toolSaving.value = true;
  try {
    const name = toolEditor.value.name;
    const data = await apiClient.post(`/ai/v2/tools/${encodeURIComponent(name)}/revert`, {});
    const updated = data?.tool;
    if (updated) {
      const idx = toolsCatalog.value.findIndex((t) => t.name === name);
      if (idx >= 0) toolsCatalog.value[idx] = updated;
      toolEditor.value = null;
      actionMessage.value = t('settings.aiAgentsToolReverted');
    }
  } catch (err) {
    actionError.value = err?.message || t('settings.aiAgentsSaveFailed');
  } finally {
    toolSaving.value = false;
  }
}

onMounted(() => {
  void loadCatalog();
});

defineExpose({ reload: loadCatalog });
</script>
