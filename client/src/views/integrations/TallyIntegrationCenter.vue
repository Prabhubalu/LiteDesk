<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-50 dark:bg-gray-900">
    <div class="border-b border-gray-200 bg-white px-6 py-5 dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tallyCenterTitle') }}</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyCenterDesc') }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span class="whitespace-nowrap">{{ t('settings.tallyCompanySwitcher') }}</span>
            <select
              v-model="selectedCompanyGuid"
              class="min-w-[12rem] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="onCompanyChange"
            >
              <option value="">{{ t('settings.tallyCompanySelect') }}</option>
              <option v-for="c in activeCompanies" :key="c.companyGuid" :value="c.companyGuid">
                {{ c.companyName }}
              </option>
            </select>
          </label>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="goSettings"
          >
            {{ t('settings.tallyBackSettings') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300"
            :disabled="syncBusy || syncBlocked"
            @click="runSync('dry_run')"
          >
            {{ t('settings.addonsTallyDryRun') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="syncBusy || refreshing || syncBlocked"
            @click="runSync('incremental')"
          >
            {{ syncBusy ? t('states.loading') : t('settings.addonsTallySyncNow') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-200"
            :disabled="syncBusy || syncBlocked || !selectedCompanyGuid"
            @click="syncItemsToTally"
          >
            {{ t('settings.tallySyncItems') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-teal-300 px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-700 dark:text-teal-200"
            :disabled="syncBusy || syncBlocked || !selectedCompanyGuid"
            @click="syncPartiesToTally"
          >
            {{ t('settings.tallySyncParties') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-sky-300 px-3 py-1.5 text-sm text-sky-800 hover:bg-sky-50 disabled:opacity-50 dark:border-sky-700 dark:text-sky-200"
            :disabled="syncBusy || !selectedCompanyGuid"
            @click="runReconcile"
          >
            {{ t('settings.tallyReconcileStock') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
            :disabled="refreshing"
            @click="refreshAll"
          >
            {{ refreshing ? t('states.loading') : t('actions.refresh') }}
          </button>
        </div>
      </div>
    </div>

    <div class="mx-auto w-full max-w-6xl space-y-6 px-6 py-6">
      <div
        v-if="tdlGateMessage"
        class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
      >
        {{ tdlGateMessage }}
      </div>

      <div
        class="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <label class="inline-flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <input
            v-model="autoOutboxFanOut"
            type="checkbox"
            class="rounded border-gray-300"
            :disabled="settingsSaving"
            @change="saveFanOutSetting"
          />
          {{ t('settings.tallyFanOutLinked') }}
        </label>
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.tallyFanOutLinkedHint') }}</span>
      </div>

      <div
        v-if="offlineBanner"
        class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
      >
        {{ offlineBanner }}
      </div>

      <div
        v-if="discoveryHint"
        class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
      >
        {{ discoveryHint }}
      </div>

      <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
      </div>

      <!-- 4-step connect wizard -->
      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyWizardTitle') }}</h2>
        <ol class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <li
            v-for="step in wizardSteps"
            :key="step.key"
            class="rounded-lg border px-3 py-3"
            :class="step.done ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ step.label }}</p>
            <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ step.hint }}</p>
            <button
              v-if="step.action"
              type="button"
              class="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              @click="step.action"
            >
              {{ step.actionLabel }}
            </button>
          </li>
        </ol>

        <div v-if="companies.length" class="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.tallyCompaniesTitle') }}</p>
          <ul class="mt-2 space-y-2">
            <li
              v-for="c in companies"
              :key="c.companyGuid"
              class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700"
            >
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ c.companyName }}</p>
                <p class="text-xs text-gray-500">{{ c.companyGuid }}{{ c.financialYear ? ` · FY ${c.financialYear}` : '' }}</p>
              </div>
              <button
                type="button"
                class="rounded-lg border border-indigo-300 px-2 py-1 text-xs text-indigo-700 dark:border-indigo-700 dark:text-indigo-300"
                :disabled="c.status === 'active' && c.enabled"
                @click="bindCompany(c)"
              >
                {{ c.status === 'active' && c.enabled ? t('settings.tallyCompanyActive') : t('settings.tallyCompanyBind') }}
              </button>
            </li>
          </ul>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="card in healthCards"
          :key="card.key"
          class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
        >
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ card.label }}</p>
          <p class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{{ card.value }}</p>
          <p v-if="card.hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ card.hint }}</p>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.tallyQueue') }}</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ counts.queued }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.tallyFailed') }}</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ counts.failed }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.tallyConflicts') }}</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ counts.conflicts }}</p>
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyLogTitle') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyLogDesc') }}</p>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('settings.tallyLogCount', { shown: logRows.length, total: logMeta.total }) }}
          </p>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label class="block xl:col-span-2">
            <span class="sr-only">{{ t('settings.tallyLogSearch') }}</span>
            <input
              v-model="logFilters.q"
              type="search"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              :placeholder="t('settings.tallyLogSearch')"
              @keydown.enter.prevent="applyLogFilters"
            />
          </label>
          <label class="block">
            <span class="sr-only">{{ t('settings.tallyLogSource') }}</span>
            <select
              v-model="logFilters.source"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="applyLogFilters"
            >
              <option value="all">{{ t('settings.tallyLogSourceAll') }}</option>
              <option value="event">{{ t('settings.tallyLogSourceEvents') }}</option>
              <option value="job">{{ t('settings.tallyLogSourceJobs') }}</option>
            </select>
          </label>
          <label class="block">
            <span class="sr-only">{{ t('settings.tallyLogLevel') }}</span>
            <select
              v-model="logFilters.level"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              :disabled="logFilters.source === 'job'"
              @change="applyLogFilters"
            >
              <option value="">{{ t('settings.tallyLogLevelAll') }}</option>
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </label>
          <label class="block">
            <span class="sr-only">{{ t('settings.tallyLogJobStatus') }}</span>
            <select
              v-model="logFilters.jobStatus"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              :disabled="logFilters.source === 'event'"
              @change="applyLogFilters"
            >
              <option value="">{{ t('settings.tallyLogJobStatusAll') }}</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              @click="applyLogFilters"
            >
              {{ t('settings.tallyLogApply') }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              :title="t('settings.tallyLogReset')"
              @click="resetLogFilters"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap gap-3">
          <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span>{{ t('settings.tallyLogFrom') }}</span>
            <input
              v-model="logFilters.from"
              type="datetime-local"
              class="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="applyLogFilters"
            />
          </label>
          <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span>{{ t('settings.tallyLogTo') }}</span>
            <input
              v-model="logFilters.to"
              type="datetime-local"
              class="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="applyLogFilters"
            />
          </label>
        </div>

        <div v-if="logLoading" class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.tallyLogLoading') }}</div>

        <ul v-else-if="logRows.length" class="mt-4 max-h-[32rem] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
          <li v-for="row in logRows" :key="row.id" class="py-3">
            <button
              type="button"
              class="flex w-full flex-wrap items-start justify-between gap-2 text-left"
              @click="toggleLogExpand(row.id)"
            >
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    :class="logBadgeClass(row)"
                  >
                    {{ row.badge }}
                  </span>
                  <span class="text-[10px] uppercase tracking-wide text-gray-400">{{ row.source }}</span>
                  <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ row.title }}</p>
                </div>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ row.detail }}</p>
              </div>
              <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">{{ formatDateTime(row.at) }}</span>
            </button>
            <pre
              v-if="expandedLogId === row.id && row.payloadText"
              class="mt-2 overflow-x-auto rounded-lg bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >{{ row.payloadText }}</pre>
          </li>
        </ul>
        <p v-else class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.tallyLogEmpty') }}</p>

        <div v-if="logMeta.hasMore" class="mt-4">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            :disabled="logLoading"
            @click="loadMoreLogs"
          >
            {{ t('settings.tallyLogLoadMore') }}
          </button>
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyMappingTitle') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyMappingDesc') }}</p>
          </div>
          <p class="text-xs text-gray-500">{{ t('settings.tallyLogCount', { shown: mappingRows.length, total: mappingMeta.total }) }}</p>
        </div>

        <div class="mt-4 flex flex-wrap gap-2 border-b border-gray-100 pb-3 dark:border-gray-700">
          <button
            v-for="tab in mappingTabs"
            :key="tab.id"
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-medium"
            :class="mappingTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'"
            @click="setMappingTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div v-if="mappingTab !== 'fields'" class="mt-3 flex flex-wrap gap-2">
          <input
            v-model="mappingFilters.q"
            type="search"
            class="min-w-[12rem] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.tallyMappingSearch')"
            @keydown.enter.prevent="loadMappingRows"
          />
          <select
            v-model="mappingFilters.entityType"
            class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            @change="loadMappingRows"
          >
            <option value="">{{ t('settings.tallyMappingEntityAll') }}</option>
            <option value="party">party</option>
            <option value="item">item</option>
            <option value="godown">godown</option>
            <option value="voucher">voucher</option>
            <option value="voucher_type">voucher_type</option>
          </select>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
            @click="loadMappingRows"
          >
            {{ t('settings.tallyLogApply') }}
          </button>
        </div>

        <div v-if="mappingTab === 'fields'" class="mt-4 space-y-3">
          <div class="flex flex-wrap gap-2">
            <select
              v-model="fieldMapEntity"
              class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="loadFieldMaps"
            >
              <option v-for="et in fieldMapEntities" :key="et" :value="et">{{ et }}</option>
            </select>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              :disabled="!selectedCompanyGuid || fieldMapSaving"
              @click="saveFieldMaps"
            >
              {{ t('settings.tallyFieldMapSave') }}
            </button>
          </div>
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700">
                <th class="py-2">{{ t('settings.tallyFieldMapArivu') }}</th>
                <th class="py-2">{{ t('settings.tallyFieldMapTally') }}</th>
                <th class="py-2">{{ t('settings.tallyFieldMapConfidence') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rule in fieldMapRules" :key="rule.arivuFieldKey" class="border-b border-gray-50 dark:border-gray-800">
                <td class="py-2 font-mono text-xs">{{ rule.arivuFieldKey }}</td>
                <td class="py-2">
                  <select
                    v-model="rule.externalFieldKey"
                    class="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900"
                  >
                    <option :value="null">—</option>
                    <option v-for="ext in fieldMapExternalOptions" :key="ext" :value="ext">{{ ext }}</option>
                  </select>
                </td>
                <td class="py-2 text-xs text-gray-500">{{ rule.confidence != null ? Math.round(rule.confidence * 100) + '%' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul v-else-if="mappingRows.length" class="mt-4 max-h-[28rem] space-y-2 overflow-y-auto">
          <li
            v-for="row in mappingRows"
            :key="row._id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
            :class="row.mappingStatus === 'pending'
              ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
              : row.mappingStatus === 'ignored'
                ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40'
                : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ row.entityType }} · {{ row.displayName || row.metadata?.remotePayload?.name || row.externalId }}
              </p>
              <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                {{ row.externalId }}
                <span v-if="row.mappingStatus === 'linked'"> · Arivu {{ row.arivuId }}</span>
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs capitalize text-gray-600 dark:text-gray-300">{{ row.mappingStatus }}</span>
              <template v-if="row.mappingStatus === 'pending'">
                <button
                  type="button"
                  class="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-700 dark:border-indigo-700 dark:text-indigo-300"
                  :disabled="mappingBusyId === row._id"
                  @click="mapCreate(row)"
                >
                  {{ t('settings.tallyMapCreate') }}
                </button>
                <button
                  type="button"
                  class="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
                  :disabled="mappingBusyId === row._id"
                  @click="mapLinkPrompt(row)"
                >
                  {{ t('settings.tallyMapLink') }}
                </button>
                <button
                  type="button"
                  class="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
                  :disabled="mappingBusyId === row._id"
                  @click="mapIgnore(row)"
                >
                  {{ t('settings.tallyMapIgnore') }}
                </button>
              </template>
            </div>
          </li>
        </ul>
        <p v-else class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.tallyMappingEmpty') }}</p>

        <div v-if="mappingMeta.hasMore && mappingTab !== 'fields'" class="mt-3">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600"
            @click="loadMoreMapping"
          >
            {{ t('settings.tallyLogLoadMore') }}
          </button>
        </div>
      </section>

      <section
        v-if="conflicts.length"
        class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyConflictsTitle') }}</h2>
        <ul class="mt-4 space-y-3">
          <li
            v-for="c in conflicts"
            :key="c._id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 px-3 py-2 dark:border-amber-800"
          >
            <div>
              <p class="text-sm font-medium">{{ c.entityType }} · {{ c.reason || c.externalId }}</p>
              <p class="text-xs text-gray-500">{{ c.arivuId }} ↔ {{ c.externalId }}</p>
            </div>
            <div class="flex flex-wrap gap-1">
              <button
                type="button"
                class="rounded border px-2 py-1 text-xs"
                @click="resolveConflict(c, 'use_arivu')"
              >
                {{ t('settings.tallyConflictUseArivu') }}
              </button>
              <button
                type="button"
                class="rounded border px-2 py-1 text-xs"
                @click="resolveConflict(c, 'use_external')"
              >
                {{ t('settings.tallyConflictUseTally') }}
              </button>
              <button
                type="button"
                class="rounded border px-2 py-1 text-xs"
                @click="resolveConflict(c, 'merge')"
              >
                {{ t('settings.tallyConflictMerge') }}
              </button>
              <button
                type="button"
                class="rounded border px-2 py-1 text-xs"
                @click="resolveConflict(c, 'ignore')"
              >
                {{ t('settings.tallyMapIgnore') }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyValidationTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyValidationDesc') }}</p>
        <ul class="mt-4 space-y-2">
          <li
            v-for="item in validationChecklist"
            :key="item.key"
            class="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700"
          >
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
              :class="item.ok ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'"
            >
              {{ item.ok ? '✓' : '·' }}
            </span>
            <span class="text-sm text-gray-800 dark:text-gray-200">{{ item.label }}</span>
          </li>
        </ul>
        <div class="mt-4 rounded-lg border border-dashed border-gray-300 p-3 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-400">
          <p class="font-medium text-gray-800 dark:text-gray-200">{{ t('settings.tallyE2eTitle') }}</p>
          <ol class="mt-2 list-decimal space-y-1 pl-4">
            <li>{{ t('settings.tallyE2eStep1') }}</li>
            <li>{{ t('settings.tallyE2eStep2') }}</li>
            <li>{{ t('settings.tallyE2eStep3') }}</li>
            <li>{{ t('settings.tallyE2eStep4') }}</li>
          </ol>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const router = useRouter();
const notifications = useNotifications();

const refreshing = ref(false);
const syncBusy = ref(false);
const error = ref('');
const dashboard = ref(null);
const jobs = ref([]);
const conflicts = ref([]);
const companies = ref([]);
const selectedCompanyGuid = ref('');
const autoOutboxFanOut = ref(true);
const settingsSaving = ref(false);
const mappingRows = ref([]);
const mappingMeta = ref({ total: 0, hasMore: false, skip: 0 });
const mappingTab = ref('pending');
const mappingFilters = ref({ q: '', entityType: '' });
const mappingBusyId = ref(null);
const fieldMapEntity = ref('item');
const fieldMapRules = ref([]);
const fieldMapExternalOptions = ref([]);
const fieldMapSaving = ref(false);
const events = ref([]);
const logRows = ref([]);
const logLoading = ref(false);
const logMeta = ref({ total: 0, hasMore: false, eventSkip: 0, jobSkip: 0 });
const expandedLogId = ref(null);
const logFilters = ref({
  q: '',
  source: 'all',
  level: '',
  jobStatus: '',
  from: '',
  to: '',
});
const LOG_PAGE = 100;
let pollTimer = null;

const activeCompanies = computed(() =>
  companies.value.filter((c) => c.enabled !== false && (c.status === 'active' || c.status === 'discovered' || !c.status))
);

const mappingTabs = computed(() => [
  { id: 'pending', label: t('settings.tallyMapTabPending') },
  { id: 'linked', label: t('settings.tallyMapTabLinked') },
  { id: 'ignored', label: t('settings.tallyMapTabIgnored') },
  { id: 'fields', label: t('settings.tallyMapTabFields') },
]);

const fieldMapEntities = [
  'party',
  'item',
  'godown',
  'invoice',
  'payment',
  'receipt',
  'purchase',
  'credit_note',
  'debit_note',
  'stock_journal',
];

const syncBlocked = computed(() => {
  if (!selectedCompanyGuid.value && activeCompanies.value.length !== 1) return true;
  if (tdlGateMessage.value) return true;
  return false;
});

const tdlGateMessage = computed(() => {
  const d = dashboard.value || {};
  const health = d.health || {};
  const tdlLoaded = health.tdlLoaded ?? health.checks?.tdlLoaded;
  const agentVer = String(d.agentVersion || '');
  if (tdlLoaded === false) {
    return t('settings.tallyTdlGateMissing');
  }
  if (agentVer && !/^0\.(3|[4-9])|^[1-9]/.test(agentVer) && agentVer.startsWith('0.2')) {
    return t('settings.tallyAgentVersionGate', { version: agentVer });
  }
  return null;
});

const counts = computed(() => ({
  queued: dashboard.value?.queuedJobs ?? jobs.value.filter((j) => ['queued', 'running'].includes(j.status)).length,
  failed: jobs.value.filter((j) => j.status === 'failed').length,
  conflicts: dashboard.value?.openConflicts ?? conflicts.value.length,
}));

const offlineBanner = computed(() => {
  const d = dashboard.value;
  if (!d?.connectionStatus || d.connectionStatus === 'none' || d.connectionStatus === 'revoked') {
    return t('settings.tallyOfflineNoAgent');
  }
  if (!d?.heartbeatAt) {
    // Paired but never heartbeated yet
    if (['paired', 'pending_pair'].includes(d.connectionStatus)) {
      return t('settings.tallyOfflineNoAgent');
    }
    return '';
  }
  const age = Date.now() - new Date(d.heartbeatAt).getTime();
  // Heartbeat is every 30s; allow clock skew + missed ticks (5 min)
  if (age > 5 * 60 * 1000) return t('settings.tallyOfflineStale');
  return '';
});

const discoveryHint = computed(() => {
  const d = dashboard.value || {};
  if ((d.companyCount || 0) > 0 || companies.value.length > 0) return '';
  return (
    d.health?.hint ||
    events.value.find((e) => e.payload?.hint)?.payload?.hint ||
    t('settings.tallyZeroCompaniesHint')
  );
});

const wizardSteps = computed(() => {
  const d = dashboard.value || {};
  const paired = Boolean(d.connectionStatus && !['none', 'pending_pair', 'revoked'].includes(d.connectionStatus));
  const discovered = (d.companyCount || 0) > 0 || companies.value.length > 0;
  const connected = paired && discovered && Boolean(d.health?.ok || d.health?.checks?.tallyRunning);
  return [
    {
      key: 'install',
      label: t('settings.tallyWizardStep1'),
      hint: t('settings.tallyWizardStep1Hint'),
      done: true,
      action: goSettings,
      actionLabel: t('settings.tallyWizardDownload'),
    },
    {
      key: 'pair',
      label: t('settings.tallyWizardStep2'),
      hint: paired ? t('settings.tallyWizardStep2Done') : t('settings.tallyWizardStep2Hint'),
      done: paired,
      action: goSettings,
      actionLabel: t('settings.tallyWizardPair'),
    },
    {
      key: 'discover',
      label: t('settings.tallyWizardStep3'),
      hint: discovered ? t('settings.tallyWizardStep3Done') : t('settings.tallyWizardStep3Hint'),
      done: discovered,
      action: () => runSync('dry_run'),
      actionLabel: t('settings.addonsTallyDryRun'),
    },
    {
      key: 'connect',
      label: t('settings.tallyWizardStep4'),
      hint: connected ? t('settings.tallyWizardStep4Done') : t('settings.tallyWizardStep4Hint'),
      done: connected,
      action: () => runSync('incremental'),
      actionLabel: t('settings.addonsTallySyncNow'),
    },
  ];
});

const healthCards = computed(() => {
  const d = dashboard.value || {};
  return [
    {
      key: 'connection',
      label: t('settings.tallyHealthConnection'),
      value: d.connectionStatus || '—',
      hint: d.heartbeatAt ? formatDateTime(d.heartbeatAt) : t('settings.tallyHealthNoHeartbeat'),
    },
    {
      key: 'agent',
      label: t('settings.tallyHealthAgent'),
      value: d.agentVersion || '—',
      hint: d.agentHostname || d.health?.mode || null,
    },
    {
      key: 'companies',
      label: t('settings.tallyHealthCompanies'),
      value: d.companyCount ?? companies.value.length ?? 0,
      hint: null,
    },
    {
      key: 'health',
      label: t('settings.tallyHealthOk'),
      value: d.health?.ok ? t('settings.tallyHealthOkValue') : t('settings.tallyHealthDegradedValue'),
      hint: d.health?.tallyVersion || d.health?.message || null,
    },
  ];
});

function toIsoLocal(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildLogQuery(skip = 0) {
  const params = new URLSearchParams();
  params.set('limit', String(LOG_PAGE));
  params.set('skip', String(skip));
  if (logFilters.value.q.trim()) params.set('q', logFilters.value.q.trim());
  const from = toIsoLocal(logFilters.value.from);
  const to = toIsoLocal(logFilters.value.to);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return params;
}

function mapEventRow(ev) {
  let payloadText = '';
  try {
    payloadText = JSON.stringify(
      {
        code: ev.code,
        level: ev.level,
        jobId: ev.jobId,
        runId: ev.runId,
        payload: ev.payload || {},
      },
      null,
      2
    );
  } catch {
    payloadText = '';
  }
  return {
    id: `event:${ev._id}`,
    source: 'event',
    badge: ev.level || 'info',
    title: ev.code || ev.level || 'event',
    detail: ev.message,
    at: ev.createdAt,
    payloadText,
    sortAt: new Date(ev.createdAt || 0).getTime(),
  };
}

function mapJobRow(job) {
  let payloadText = '';
  try {
    payloadText = JSON.stringify(
      {
        jobType: job.jobType,
        status: job.status,
        direction: job.direction,
        companyGuid: job.companyGuid,
        lastError: job.lastError,
        payload: job.payload || {},
        result: job.result || null,
      },
      null,
      2
    );
  } catch {
    payloadText = '';
  }
  const level =
    job.status === 'failed' ? 'error' : job.status === 'completed' ? 'info' : job.status === 'running' ? 'warn' : 'debug';
  return {
    id: `job:${job._id}`,
    source: 'job',
    badge: job.status || 'job',
    title: `${job.jobType || 'sync'} · ${job.status}`,
    detail: job.lastError || job.companyGuid || t('settings.tallyActivityJobDetail'),
    at: job.updatedAt || job.createdAt,
    payloadText,
    sortAt: new Date(job.updatedAt || job.createdAt || 0).getTime(),
    _level: level,
  };
}

function logBadgeClass(row) {
  const key = String(row.badge || row._level || '').toLowerCase();
  if (key === 'error' || key === 'failed') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  if (key === 'warn' || key === 'running' || key === 'warning') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  }
  if (key === 'debug' || key === 'queued' || key === 'cancelled') {
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
  }
  return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
}

function toggleLogExpand(id) {
  expandedLogId.value = expandedLogId.value === id ? null : id;
}

async function fetchLogs({ append = false } = {}) {
  logLoading.value = true;
  try {
    const source = logFilters.value.source;
    const wantEvents = source === 'all' || source === 'event';
    const wantJobs = source === 'all' || source === 'job';
    const eventSkip = append ? logMeta.value.eventSkip || 0 : 0;
    const jobSkip = append ? logMeta.value.jobSkip || 0 : 0;

    const eventParams = buildLogQuery(eventSkip);
    if (logFilters.value.level) eventParams.set('level', logFilters.value.level);

    const jobParams = buildLogQuery(jobSkip);
    if (logFilters.value.jobStatus) jobParams.set('status', logFilters.value.jobStatus);

    const [evRes, jobRes] = await Promise.all([
      wantEvents
        ? apiClient(`/connectors/tally/events?${eventParams.toString()}`, { method: 'GET' }).catch(() => null)
        : Promise.resolve(null),
      wantJobs
        ? apiClient(`/connectors/tally/sync/jobs?${jobParams.toString()}`, { method: 'GET' }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const rawEvents = Array.isArray(evRes?.data) ? evRes.data : [];
    const rawJobs = Array.isArray(jobRes?.data) ? jobRes.data : [];
    const eventList = rawEvents.map(mapEventRow);
    const jobList = rawJobs.map(mapJobRow);
    if (wantEvents && !append) {
      events.value = rawEvents;
    }

    let merged = [...eventList, ...jobList].sort((a, b) => b.sortAt - a.sortAt);
    if (logFilters.value.level && source === 'all') {
      const lvl = logFilters.value.level;
      merged = merged.filter((r) => {
        if (r.source === 'event') return r.badge === lvl;
        return r._level === lvl;
      });
    }

    if (append) {
      const seen = new Set(logRows.value.map((r) => r.id));
      logRows.value = [...logRows.value, ...merged.filter((r) => !seen.has(r.id))];
    } else {
      logRows.value = merged;
    }

    const evMeta = evRes?.meta || { total: 0, hasMore: false, limit: LOG_PAGE };
    const jobMeta = jobRes?.meta || { total: 0, hasMore: false, limit: LOG_PAGE };
    logMeta.value = {
      total: (wantEvents ? evMeta.total || 0 : 0) + (wantJobs ? jobMeta.total || 0 : 0),
      hasMore: Boolean((wantEvents && evMeta.hasMore) || (wantJobs && jobMeta.hasMore)),
      eventSkip: wantEvents ? eventSkip + rawEvents.length : 0,
      jobSkip: wantJobs ? jobSkip + rawJobs.length : 0,
    };
  } finally {
    logLoading.value = false;
  }
}

function applyLogFilters() {
  expandedLogId.value = null;
  fetchLogs({ append: false });
}

function resetLogFilters() {
  logFilters.value = { q: '', source: 'all', level: '', jobStatus: '', from: '', to: '' };
  applyLogFilters();
}

function loadMoreLogs() {
  fetchLogs({ append: true });
}

const validationChecklist = computed(() => {
  const d = dashboard.value || {};
  const checks = d.health?.checks || {};
  return [
    { key: 'agent', label: t('settings.tallyCheckAgent'), ok: Boolean(d.connectionStatus && d.connectionStatus !== 'none') },
    { key: 'tally', label: t('settings.tallyCheckTally'), ok: Boolean(checks.tallyRunning ?? d.health?.ok) },
    { key: 'xml', label: t('settings.tallyCheckXml'), ok: Boolean(checks.xmlEnabled ?? false) },
    {
      key: 'tdl',
      label: t('settings.tallyCheckTdl'),
      ok: Boolean(checks.tdlLoaded ?? d.health?.tdlLoaded ?? false),
    },
    { key: 'company', label: t('settings.tallyCheckCompany'), ok: (d.companyCount || companies.value.length || 0) > 0 },
    { key: 'fy', label: t('settings.tallyCheckFy'), ok: Boolean(checks.financialYear ?? false) },
  ];
});

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function goSettings() {
  router.push({ path: '/settings', query: { tab: 'addons', addonView: 'tally' } });
}

async function runSync(jobType) {
  const companyGuid = selectedCompanyGuid.value || (activeCompanies.value.length === 1 ? activeCompanies.value[0].companyGuid : '');
  if (!companyGuid) {
    notifications.error(t('settings.tallyCompanyRequired'));
    return;
  }
  if (syncBlocked.value && tdlGateMessage.value) {
    notifications.error(tdlGateMessage.value);
    return;
  }
  syncBusy.value = true;
  try {
    await apiClient.post('/connectors/tally/sync/trigger', {
      jobType,
      direction: 'bidirectional',
      companyGuid,
      payload: { dryRun: jobType === 'dry_run', companyGuid },
    });
    notifications.success(
      jobType === 'dry_run' ? t('settings.addonsTallyDryRunQueued') : t('settings.addonsTallySyncQueued')
    );
    await refreshAll();
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  } finally {
    syncBusy.value = false;
  }
}

async function syncItemsToTally() {
  const companyGuid = selectedCompanyGuid.value;
  if (!companyGuid) {
    notifications.error(t('settings.tallyCompanyRequired'));
    return;
  }
  syncBusy.value = true;
  try {
    await apiClient.post('/connectors/tally/masters/sync-items', { companyGuid, limit: 100 });
    notifications.success(t('settings.tallySyncItemsQueued'));
    await refreshAll();
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  } finally {
    syncBusy.value = false;
  }
}

async function syncPartiesToTally() {
  const companyGuid = selectedCompanyGuid.value;
  if (!companyGuid) {
    notifications.error(t('settings.tallyCompanyRequired'));
    return;
  }
  syncBusy.value = true;
  try {
    await apiClient.post('/connectors/tally/masters/sync-parties', { companyGuid, limit: 100 });
    notifications.success(t('settings.tallySyncPartiesQueued'));
    await refreshAll();
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  } finally {
    syncBusy.value = false;
  }
}

async function saveFanOutSetting() {
  settingsSaving.value = true;
  try {
    await apiClient.patch('/connectors/tally/settings', {
      autoOutboxFanOutToAllLinkedCompanies: autoOutboxFanOut.value,
    });
    notifications.success(t('settings.tallySettingsSaved'));
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  } finally {
    settingsSaving.value = false;
  }
}

async function runReconcile() {
  const companyGuid = selectedCompanyGuid.value;
  if (!companyGuid) {
    notifications.error(t('settings.tallyCompanyRequired'));
    return;
  }
  syncBusy.value = true;
  try {
    const res = await apiClient(
      `/connectors/tally/inventory/reconcile?companyGuid=${encodeURIComponent(companyGuid)}`,
      { method: 'GET' }
    );
    const drift = res?.data?.drift?.length ?? res?.data?.rows?.length ?? 0;
    notifications.success(t('settings.tallyReconcileDone', { count: drift }));
    await refreshAll();
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  } finally {
    syncBusy.value = false;
  }
}

function onCompanyChange() {
  loadMappingRows();
  if (mappingTab.value === 'fields') loadFieldMaps();
}

function setMappingTab(id) {
  mappingTab.value = id;
  if (id === 'fields') loadFieldMaps();
  else loadMappingRows();
}

async function loadMappingRows({ append = false } = {}) {
  if (mappingTab.value === 'fields') return;
  const status = mappingTab.value;
  const skip = append ? mappingRows.value.length : 0;
  const params = new URLSearchParams();
  params.set('limit', '50');
  params.set('skip', String(skip));
  params.set('status', status);
  if (selectedCompanyGuid.value) params.set('companyGuid', selectedCompanyGuid.value);
  if (mappingFilters.value.q) params.set('q', mappingFilters.value.q);
  if (mappingFilters.value.entityType) params.set('entityType', mappingFilters.value.entityType);
  const res = await apiClient(`/connectors/tally/external-objects?${params}`, { method: 'GET' }).catch(() => null);
  const rows = Array.isArray(res?.data) ? res.data : [];
  if (append) {
    const seen = new Set(mappingRows.value.map((r) => r._id));
    mappingRows.value = [...mappingRows.value, ...rows.filter((r) => !seen.has(r._id))];
  } else {
    mappingRows.value = rows;
  }
  mappingMeta.value = {
    total: res?.meta?.total || rows.length,
    hasMore: Boolean(res?.meta?.hasMore),
    skip,
  };
}

function loadMoreMapping() {
  loadMappingRows({ append: true });
}

async function mapCreate(row) {
  mappingBusyId.value = row._id;
  try {
    await apiClient.post(`/connectors/tally/external-objects/${row._id}/create`, {});
    notifications.success(t('settings.tallyMapCreateOk'));
    await loadMappingRows();
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  } finally {
    mappingBusyId.value = null;
  }
}

async function mapLinkPrompt(row) {
  const arivuId = window.prompt(t('settings.tallyMapLinkPrompt'));
  if (!arivuId) return;
  mappingBusyId.value = row._id;
  try {
    await apiClient.post(`/connectors/tally/external-objects/${row._id}/link`, { arivuId: arivuId.trim() });
    notifications.success(t('settings.tallyMapLinkOk'));
    await loadMappingRows();
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  } finally {
    mappingBusyId.value = null;
  }
}

async function mapIgnore(row) {
  mappingBusyId.value = row._id;
  try {
    await apiClient.post(`/connectors/tally/external-objects/${row._id}/ignore`, {});
    await loadMappingRows();
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  } finally {
    mappingBusyId.value = null;
  }
}

async function loadFieldMaps() {
  if (!selectedCompanyGuid.value && activeCompanies.value.length !== 1) {
    fieldMapRules.value = [];
    return;
  }
  const companyGuid = selectedCompanyGuid.value || activeCompanies.value[0]?.companyGuid;
  const res = await apiClient(
    `/connectors/tally/field-mappings?entityType=${encodeURIComponent(fieldMapEntity.value)}&companyGuid=${encodeURIComponent(companyGuid || '')}`,
    { method: 'GET' }
  ).catch(() => null);
  const suggestions = res?.data?.suggestions || [];
  const saved = res?.data?.saved?.rules || [];
  fieldMapExternalOptions.value = res?.data?.catalog?.external || [];
  if (saved.length) {
    fieldMapRules.value = saved.map((r) => ({
      arivuFieldKey: r.arivuFieldKey,
      externalFieldKey: r.externalFieldKey,
      confidence: r.confidence,
    }));
  } else {
    fieldMapRules.value = suggestions.map((s) => ({
      arivuFieldKey: s.arivuFieldKey,
      externalFieldKey: s.externalFieldKey,
      confidence: s.confidence,
    }));
  }
}

async function saveFieldMaps() {
  const companyGuid = selectedCompanyGuid.value || activeCompanies.value[0]?.companyGuid;
  if (!companyGuid) {
    notifications.error(t('settings.tallyCompanyRequired'));
    return;
  }
  fieldMapSaving.value = true;
  try {
    await apiClient.post('/connectors/tally/field-mappings/accept', {
      entityType: fieldMapEntity.value,
      companyGuid,
      rules: fieldMapRules.value.filter((r) => r.externalFieldKey),
    });
    notifications.success(t('settings.tallyFieldMapSaved'));
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  } finally {
    fieldMapSaving.value = false;
  }
}

async function resolveConflict(conflict, resolution) {
  try {
    await apiClient.post(`/connectors/tally/conflicts/${conflict._id}/resolve`, { resolution });
    notifications.success(t('settings.tallyConflictResolved'));
    await refreshAll();
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  }
}

async function bindCompany(c) {
  try {
    await apiClient.post('/connectors/tally/companies/bind', {
      companyGuid: c.companyGuid,
      companyName: c.companyName,
      financialYear: c.financialYear || null,
      enabled: true,
    });
    notifications.success(t('settings.tallyCompanyBound'));
    await refreshAll();
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  }
}

async function refreshAll() {
  refreshing.value = true;
  error.value = '';
  try {
    const [dashRes, jobsRes, conflictsRes, connRes, settingsRes] = await Promise.all([
      apiClient('/connectors/tally/dashboard', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/sync/jobs?limit=25', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/conflicts?status=open&limit=25', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/connection', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/settings', { method: 'GET' }).catch(() => null),
    ]);
    dashboard.value = dashRes?.data || {
      connectionStatus: 'none',
      queuedJobs: 0,
      openConflicts: 0,
      companyCount: 0,
      health: { ok: false },
    };
    jobs.value = Array.isArray(jobsRes?.data) ? jobsRes.data : [];
    conflicts.value = Array.isArray(conflictsRes?.data) ? conflictsRes.data : [];
    companies.value = Array.isArray(connRes?.data?.companies) ? connRes.data.companies : [];
    if (typeof settingsRes?.data?.autoOutboxFanOutToAllLinkedCompanies === 'boolean') {
      autoOutboxFanOut.value = settingsRes.data.autoOutboxFanOutToAllLinkedCompanies;
    }
    const active = companies.value.filter(
      (c) => c.enabled !== false && (c.status === 'active' || c.status === 'discovered' || !c.status)
    );
    if (!selectedCompanyGuid.value && active.length === 1) {
      selectedCompanyGuid.value = active[0].companyGuid;
    }
    if (
      selectedCompanyGuid.value &&
      !active.some((c) => c.companyGuid === selectedCompanyGuid.value)
    ) {
      selectedCompanyGuid.value = active.length === 1 ? active[0].companyGuid : '';
    }
    await Promise.all([fetchLogs({ append: false }), loadMappingRows()]);
    if (mappingTab.value === 'fields') await loadFieldMaps();
  } catch (err) {
    error.value = err?.message || t('settings.tallyLoadFailed');
  } finally {
    refreshing.value = false;
  }
}

onMounted(() => {
  refreshAll();
  pollTimer = setInterval(refreshAll, 15000);
});
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>
