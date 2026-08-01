<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-50 dark:bg-gray-900">
    <!-- Page header -->
    <div class="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="px-4 pt-5 sm:px-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                {{ t('settings.tallyCenterTitle') }}
              </h1>
              <button
                type="button"
                class="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
                @click="goSettings"
              >
                {{ t('settings.tallyBackSettings') }}
              </button>
            </div>
            <p class="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              {{ t('settings.tallyCenterDescSimple') }}
            </p>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            <div class="flex min-w-[12rem] flex-col gap-1">
              <span class="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                {{ t('settings.tallyCompanySwitcher') }}
              </span>
              <Listbox v-model="selectedCompanyGuid" as="div" class="relative">
                <ListboxButton
                  class="relative w-full cursor-default rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-9 text-left text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <span class="block truncate">{{ selectedCompanyLabel }}</span>
                  <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronUpDownIcon class="h-4 w-4 text-gray-400" aria-hidden="true" />
                  </span>
                </ListboxButton>
                <Transition
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0"
                >
                  <ListboxOptions
                    class="absolute z-40 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                  >
                    <ListboxOption v-slot="{ active, selected }" value="" as="template">
                      <li
                        :class="[
                          active ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-200' : 'text-gray-900 dark:text-gray-100',
                          'relative cursor-pointer select-none py-2 pl-3 pr-9',
                        ]"
                      >
                        <span :class="[selected ? 'font-semibold' : 'font-normal', 'block truncate']">
                          {{ t('settings.tallyCompanySelect') }}
                        </span>
                      </li>
                    </ListboxOption>
                    <ListboxOption
                      v-for="c in activeCompanies"
                      :key="c.companyGuid"
                      v-slot="{ active, selected }"
                      :value="c.companyGuid"
                      as="template"
                    >
                      <li
                        :class="[
                          active ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-200' : 'text-gray-900 dark:text-gray-100',
                          'relative cursor-pointer select-none py-2 pl-3 pr-9',
                        ]"
                      >
                        <span :class="[selected ? 'font-semibold' : 'font-normal', 'block truncate']">
                          {{ c.companyName }}
                        </span>
                        <span
                          v-if="selected"
                          class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-300"
                        >
                          <CheckIcon class="h-4 w-4" aria-hidden="true" />
                        </span>
                      </li>
                    </ListboxOption>
                  </ListboxOptions>
                </Transition>
              </Listbox>
            </div>
            <button
              type="button"
              class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              :disabled="refreshing"
              @click="onCompanyChange"
            >
              {{ refreshing ? t('states.loading') : t('actions.refresh') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              :disabled="syncBusy || refreshing || !companyGuid"
              @click="runSync('incremental')"
            >
              {{ syncBusy ? t('states.loading') : t('settings.addonsTallySyncNow') }}
            </button>
          </div>
        </div>
      </div>

      <TabGroup :selected-index="tabIndex" @change="onTabChange">
        <TabList class="mt-4 flex gap-0 overflow-x-auto border-b border-gray-200 px-4 sm:px-6 dark:border-gray-700">
          <Tab
            v-for="(tab, i) in tabs"
            :key="tab.id"
            v-slot="{ selected }"
            as="template"
          >
            <button
              type="button"
              :class="[
                selected
                  ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:hover:text-gray-200',
                i > 0 && tab.group !== tabs[i - 1].group ? 'ml-4' : '',
                'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium focus:outline-none',
              ]"
            >
              {{ t(tab.labelKey) }}
            </button>
          </Tab>
        </TabList>
      </TabGroup>
    </div>

    <div class="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <TallyAtipWizardPanel
        v-if="activeTab === 'wizard'"
        :company-guid="companyGuid || ''"
        @synced="loadSyncLogs"
      />

      <TallyAtipHealthPanel v-else-if="activeTab === 'health'" />

      <TallyAtipCatalogPanel
        v-else-if="activeTab === 'catalog'"
        :company-guid="companyGuid || ''"
      />

      <TallyAtipActivityPanel v-else-if="activeTab === 'activity'" />

      <TallyAtipMappingPanel
        v-else-if="activeTab === 'mapping'"
        :company-guid="companyGuid || ''"
      />

      <TallyAtipConflictsPanel v-else-if="activeTab === 'conflicts'" />

      <!-- SYNC SETTINGS -->
      <template v-else-if="activeTab === 'settings'">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <input
              v-model="settingsForm.scheduledSyncEnabled"
              type="checkbox"
              class="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              @change="saveSettings"
            />
            <span>
              <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyScheduledSync') }}</span>
              <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.tallyScheduledSyncDesc') }}</span>
            </span>
          </label>
          <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <label class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.tallySyncInterval') }}</label>
            <input
              v-model.number="settingsForm.syncIntervalMinutes"
              type="number"
              min="1"
              max="1440"
              class="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="saveSettings"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.tallySyncIntervalDesc') }}</p>
          </div>
          <label
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <input
              v-model="settingsForm.dryRunDefault"
              type="checkbox"
              class="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              @change="saveSettings"
            />
            <span>
              <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyDryRunDefault') }}</span>
              <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.tallyDryRunDefaultDesc') }}</span>
            </span>
          </label>
          <label
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <input
              v-model="settingsForm.migrationMode"
              type="checkbox"
              class="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              @change="saveSettings"
            />
            <span>
              <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyMigrationMode') }}</span>
              <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.tallyMigrationModeDesc') }}</span>
            </span>
          </label>
          <label
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <input
              v-model="settingsForm.preventProductTaxUpdate"
              type="checkbox"
              class="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              @change="saveSettings"
            />
            <span>
              <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyPreventProductTax') }}</span>
              <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.tallyPreventProductTaxDesc') }}</span>
            </span>
          </label>
          <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <label class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyRecordsPerCycle') }}</label>
            <input
              v-model.number="settingsForm.recordsPerSyncCycle"
              type="number"
              min="50"
              max="500"
              class="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="saveSettings"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.tallyRecordsPerCycleDesc') }}</p>
          </div>
        </div>
        <p
          v-if="settingsForm.scheduledSyncEnabled && settingsForm.dryRunDefault"
          class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
        >
          {{ t('settings.tallyScheduledBlockedByDryRun') }}
        </p>

        <!-- Module mapping table (product table shell) -->
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
            <div>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyModuleMappingTitle') }}</h2>
              <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.tallyModuleMappingDesc') }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                @click="resetFull"
              >
                {{ t('settings.tallyResetFull') }}
              </button>
              <button
                type="button"
                class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                :disabled="savingMaps"
                @click="saveAllMappings"
              >
                {{ savingMaps ? t('states.loading') : t('settings.tallySaveMappings') }}
              </button>
            </div>
          </div>

          <div class="max-h-[min(28rem,calc(100vh-22rem))] overflow-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th class="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:pl-6">
                    {{ t('settings.tallyColTallyModule') }}
                  </th>
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {{ t('settings.tallyColArivuModule') }}
                  </th>
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {{ t('settings.tallyColSyncWay') }}
                  </th>
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {{ t('settings.tallyColFilter') }}
                  </th>
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {{ t('settings.tallyColInboundCreate') }}
                  </th>
                  <th
                    v-if="settingsForm.migrationMode"
                    class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    {{ t('settings.tallyColSyncFrom') }}
                  </th>
                  <th class="relative py-3 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">{{ t('actions.edit') }}</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700/80">
                <tr
                  v-for="row in moduleRows"
                  :key="row.tallyModuleKey"
                  class="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-900/30"
                >
                  <td class="whitespace-nowrap py-3 pl-4 pr-3 sm:pl-6">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">{{ row.tallyModuleName }}</div>
                    <div v-if="row.discoverOnly && !row.arivuModuleKey" class="text-xs text-amber-600 dark:text-amber-400">
                      {{ t('settings.tallyDiscoverOnlyHint') }}
                    </div>
                  </td>
                  <td class="px-3 py-3">
                    <HeadlessSelect
                      v-model="row.arivuModuleKey"
                      :options="arivuSelectOptions"
                      :teleport="true"
                      :allow-empty="true"
                      :empty-label="t('settings.tallyNoneOption')"
                      empty-value=""
                      wrapper-class="min-w-[12rem]"
                      button-class="!py-1.5 !px-3"
                      options-class="max-h-56"
                    />
                  </td>
                  <td class="px-3 py-3">
                    <HeadlessSelect
                      v-model="row.syncWay"
                      :options="syncWaySelectOptions"
                      :teleport="true"
                      :searchable="false"
                      wrapper-class="min-w-[10rem]"
                      button-class="!py-1.5 !px-3"
                      options-class="max-h-56"
                    />
                  </td>
                  <td class="px-3 py-3">
                    <button
                      type="button"
                      class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
                      @click="openFilter(row)"
                    >
                      {{ filterSummary(row) }}
                    </button>
                  </td>
                  <td class="px-3 py-3">
                    <HeadlessSelect
                      v-if="isVoucherModuleRow(row)"
                      v-model="row.inboundCreatePolicy"
                      :options="inboundCreatePolicyOptions"
                      :teleport="true"
                      :searchable="false"
                      wrapper-class="min-w-[11rem]"
                      button-class="!py-1.5 !px-3"
                      options-class="max-h-56"
                    />
                    <span v-else class="text-xs text-gray-400">—</span>
                  </td>
                  <td v-if="settingsForm.migrationMode" class="px-3 py-3">
                    <input
                      v-model="row.syncFromLocal"
                      type="date"
                      class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    />
                  </td>
                  <td class="whitespace-nowrap py-3 pl-3 pr-4 text-right sm:pr-6">
                    <button
                      type="button"
                      class="text-xs font-medium text-red-600 hover:text-red-500 dark:text-red-400"
                      @click="resetModule(row.tallyModuleKey)"
                    >
                      {{ t('settings.tallyResetModule') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tax mapping -->
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div class="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyTaxMappingTitle') }}</h2>
            <p class="mt-0.5 text-sm text-gray-500">{{ t('settings.tallyTaxMappingDesc') }}</p>
          </div>
          <div class="flex flex-wrap gap-2 px-4 py-4 sm:px-6">
            <input
              v-model="taxForm.tallyLedgerName"
              :placeholder="t('settings.tallyTaxLedger')"
              class="rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <input
              v-model="taxForm.arivuTaxCode"
              :placeholder="t('settings.tallyTaxCode')"
              class="rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <input
              v-model.number="taxForm.arivuTaxRatePercent"
              type="number"
              :placeholder="t('settings.tallyTaxRate')"
              class="w-24 rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <button
              type="button"
              class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              @click="addTaxMap"
            >
              {{ t('settings.tallyTaxAdd') }}
            </button>
          </div>
          <ul class="divide-y divide-gray-100 px-4 pb-4 sm:px-6 dark:divide-gray-700">
            <li v-for="tax in taxRows" :key="tax._id" class="flex items-center justify-between py-2.5 text-sm">
              <span class="text-gray-800 dark:text-gray-200">
                {{ tax.tallyLedgerName }} → {{ tax.arivuTaxCode || '—' }}
                <span v-if="tax.arivuTaxRatePercent != null" class="text-gray-500">({{ tax.arivuTaxRatePercent }}%)</span>
              </span>
              <button type="button" class="text-red-600 hover:text-red-500" @click="removeTaxMap(tax._id)">×</button>
            </li>
          </ul>
        </div>
      </template>

      <!-- SYNC LOGS -->
      <template v-else-if="activeTab === 'logs'">
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div class="max-h-[min(28rem,calc(100vh-16rem))] overflow-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th class="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">{{ t('settings.tallySyncLogDate') }}</th>
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{{ t('settings.tallySyncLogTime') }}</th>
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{{ t('settings.tallySyncLogModule') }}</th>
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{{ t('settings.tallySyncLogCompany') }}</th>
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{{ t('settings.tallySyncLogArivu') }}</th>
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{{ t('settings.tallySyncLogTally') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700/80">
                <tr v-if="!syncLogs.length">
                  <td colspan="6" class="px-4 py-10 text-center text-sm text-gray-500">{{ t('settings.tallySyncLogEmpty') }}</td>
                </tr>
                <tr v-for="log in syncLogs" :key="log._id" class="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
                  <td class="whitespace-nowrap py-3 pl-4 pr-3 text-sm sm:pl-6">{{ formatDate(log.startedAt) }}</td>
                  <td class="whitespace-nowrap px-3 py-3 text-sm">{{ formatTime(log.startedAt) }}</td>
                  <td class="px-3 py-3 text-sm">{{ log.tallyModuleName || log.tallyModuleKey || '—' }}</td>
                  <td class="px-3 py-3 text-sm">{{ log.companyName || log.companyGuid || '—' }}</td>
                  <td class="px-3 py-3 text-sm">
                    <button class="font-medium text-indigo-600 hover:underline" @click="openLogRecords(log, 'arivu', 'created')">
                      {{ t('settings.tallySyncLogCreated') }} {{ log.arivu?.created || 0 }}
                    </button>
                    ·
                    <button class="font-medium text-indigo-600 hover:underline" @click="openLogRecords(log, 'arivu', 'updated')">
                      {{ t('settings.tallySyncLogUpdated') }} {{ log.arivu?.updated || 0 }}
                    </button>
                    ·
                    <button class="font-medium text-indigo-600 hover:underline" @click="openLogRecords(log, 'arivu', 'skipped')">
                      {{ t('settings.tallySyncLogSkipped') }} {{ log.arivu?.skipped || 0 }}
                    </button>
                  </td>
                  <td class="px-3 py-3 text-sm">
                    <button class="font-medium text-indigo-600 hover:underline" @click="openLogRecords(log, 'tally', 'created')">
                      {{ t('settings.tallySyncLogCreated') }} {{ log.tally?.created || 0 }}
                    </button>
                    ·
                    <button class="font-medium text-indigo-600 hover:underline" @click="openLogRecords(log, 'tally', 'updated')">
                      {{ t('settings.tallySyncLogUpdated') }} {{ log.tally?.updated || 0 }}
                    </button>
                    ·
                    <button class="font-medium text-indigo-600 hover:underline" @click="openLogRecords(log, 'tally', 'skipped')">
                      {{ t('settings.tallySyncLogSkipped') }} {{ log.tally?.skipped || 0 }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <!-- ADVANCED field maps -->
      <template v-else-if="activeTab === 'advanced'">
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div class="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
            <HeadlessSelect
              v-model="fieldMapEntity"
              :options="fieldMapEntitySelectOptions"
              :teleport="true"
              :searchable="true"
              wrapper-class="min-w-[16rem]"
              button-class="!rounded-xl"
              options-class="max-h-72"
            />
            <button
              type="button"
              class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!!unmappedMandatoryFields.length || savingFieldMaps"
              @click="acceptAllFieldMaps"
            >
              {{ savingFieldMaps ? t('states.loading') : t('settings.tallySaveMappings') }}
            </button>
            <button
              type="button"
              class="rounded-xl border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300"
              :disabled="syncBusy"
              @click="runSync('dry_run')"
            >
              {{ t('settings.addonsTallyDryRun') }}
            </button>
          </div>
          <div
            v-if="unmappedMandatoryFields.length"
            class="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:mx-6 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
            role="status"
          >
            <p class="font-medium">{{ t('settings.tallyMandatoryBannerTitle') }}</p>
            <p class="mt-1 text-amber-800 dark:text-amber-200">
              {{ t('settings.tallyMandatoryBannerBody', { fields: unmappedMandatoryLabels }) }}
            </p>
          </div>
          <div
            v-else-if="fieldMapSaveError"
            class="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:mx-6 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
            role="alert"
          >
            {{ fieldMapSaveError }}
          </div>
          <p class="px-4 pt-3 text-xs text-gray-500 sm:px-6">{{ currentFieldMapHint }}</p>
          <div class="max-h-[min(28rem,calc(100vh-18rem))] overflow-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th class="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">
                    {{ t('settings.tallyFieldArivu') }}
                  </th>
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {{ t('settings.tallyFieldTally') }}
                  </th>
                  <th class="px-3 py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pr-6">
                    {{ t('settings.tallyFieldMatch') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700/80">
                <tr
                  v-for="(rule, idx) in fieldMapRules"
                  :key="rule.arivuFieldKey || idx"
                  :class="[
                    'hover:bg-gray-50/80 dark:hover:bg-gray-900/30',
                    rule.required && !rule.externalFieldKey ? 'bg-amber-50/70 dark:bg-amber-950/20' : '',
                  ]"
                >
                  <td class="py-2.5 pl-4 pr-3 sm:pl-6">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ rule.arivuFieldLabel }}
                      <span
                        v-if="rule.required"
                        class="ml-0.5 text-red-500"
                        :title="t('settings.tallyMandatoryMarkerTitle')"
                      >*</span>
                    </div>
                  </td>
                  <td class="px-3 py-2">
                    <HeadlessSelect
                      v-model="rule.externalFieldKey"
                      :options="tallyFieldSelectOptions"
                      :teleport="true"
                      :allow-empty="true"
                      empty-label="—"
                      empty-value=""
                      :invalid="Boolean(rule.required && !rule.externalFieldKey)"
                      wrapper-class="min-w-[12rem]"
                      button-class="!py-1.5 !px-3"
                      options-class="max-h-56"
                    />
                  </td>
                  <td class="whitespace-nowrap px-3 py-2 pr-4 tabular-nums text-gray-600 dark:text-gray-300 sm:pr-6">
                    {{ Math.round((rule.confidence || 0) * 100) }}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <TallyAtipAssistantPanel
        v-else-if="activeTab === 'assistant'"
        :company-guid="companyGuid || ''"
      />
    </div>

    <!-- Filter dialog -->
    <TransitionRoot appear :show="!!filterRow" as="template">
      <Dialog as="div" class="relative z-50" @close="filterRow = null">
        <TransitionChild
          as="template"
          enter="duration-200 ease-out"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="duration-150 ease-in"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-black/40" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as="template"
              enter="duration-200 ease-out"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="duration-150 ease-in"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
                <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t('settings.tallyFilterEdit') }}
                </DialogTitle>
                <label class="mt-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input v-model="filterDraft.postedOnly" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                  {{ t('settings.tallyFilterPostedOnly') }}
                </label>
                <label class="mt-3 block text-sm text-gray-700 dark:text-gray-200">
                  {{ t('settings.tallyFilterDateDays') }}
                  <input
                    v-model.number="filterDraft.dateWindowDays"
                    type="number"
                    min="1"
                    max="3650"
                    class="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </label>
                <label class="mt-3 block text-sm text-gray-700 dark:text-gray-200">
                  {{ t('settings.tallyFilterParents') }}
                </label>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('settings.tallyFilterParentsHint') }}
                </p>
                <div
                  v-if="ledgerGroupsLoading"
                  class="mt-2 text-xs text-gray-500"
                >
                  {{ t('states.loading') }}
                </div>
                <div
                  v-else-if="ledgerGroupOptions.length"
                  class="mt-2 max-h-48 overflow-auto rounded-xl border border-gray-200 dark:border-gray-600"
                >
                  <label
                    v-for="g in ledgerGroupOptions"
                    :key="g.value"
                    class="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                  >
                    <input
                      v-model="filterDraft.parents"
                      type="checkbox"
                      :value="g.value"
                      class="rounded border-gray-300 text-indigo-600"
                    />
                    <span class="truncate text-gray-800 dark:text-gray-200">{{ g.name }}</span>
                  </label>
                </div>
                <p
                  v-else
                  class="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                >
                  {{ t('settings.tallyFilterParentsEmpty') }}
                </p>
                <input
                  v-model="filterDraft.parentsText"
                  type="text"
                  class="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  :placeholder="t('settings.tallyFilterParentsManual')"
                />
                <div class="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
                    @click="filterRow = null"
                  >
                    {{ t('actions.cancel') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                    @click="applyFilter"
                  >
                    {{ t('actions.save') }}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Log records drawer -->
    <TransitionRoot appear :show="!!logDrawer" as="template">
      <Dialog as="div" class="relative z-50" @close="logDrawer = null">
        <TransitionChild as="template" enter="duration-200 ease-out" enter-from="opacity-0" enter-to="opacity-100" leave="duration-150 ease-in" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-black/40" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-hidden">
          <div class="absolute inset-0 overflow-hidden">
            <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <TransitionChild
                as="template"
                enter="transform transition duration-300 ease-out"
                enter-from="translate-x-full"
                enter-to="translate-x-0"
                leave="transform transition duration-200 ease-in"
                leave-from="translate-x-0"
                leave-to="translate-x-full"
              >
                <DialogPanel class="pointer-events-auto w-screen max-w-lg">
                  <div class="flex h-full flex-col bg-white shadow-xl dark:bg-gray-800">
                    <div class="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-700">
                      <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
                        {{ t('settings.tallySyncLogRecordsTitle') }} · {{ logDrawer?.action }} ({{ logDrawer?.side }})
                      </DialogTitle>
                      <div class="flex gap-2">
                        <button type="button" class="text-sm font-medium text-indigo-600" @click="downloadLogCsv">
                          {{ t('settings.tallySyncLogDownload') }}
                        </button>
                        <button type="button" class="text-gray-500" @click="logDrawer = null">×</button>
                      </div>
                    </div>
                    <ul class="flex-1 overflow-auto p-4 text-sm">
                      <li
                        v-for="rec in logDrawer?.records || []"
                        :key="rec._id || `${rec.recordId}-${rec.recordName}`"
                        class="border-b border-gray-100 py-2 dark:border-gray-700"
                      >
                        <div class="font-medium text-gray-900 dark:text-white">{{ rec.recordName || rec.recordId || '—' }}</div>
                        <div class="text-gray-500">{{ rec.moduleKey || rec.tallyModuleKey }} · {{ rec.reason || '' }}</div>
                        <button
                          v-if="rec.recordId && logDrawer?.side === 'arivu'"
                          type="button"
                          class="mt-1 text-indigo-600 hover:underline"
                          @click="openArivuRecord(rec)"
                        >
                          {{ t('settings.tallyOpenRecord') }}
                        </button>
                      </li>
                      <li v-if="!(logDrawer?.records || []).length" class="py-8 text-center text-gray-500">—</li>
                    </ul>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  TabGroup,
  TabList,
  Tab,
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/20/solid';
import apiClient from '@/utils/apiClient';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import TallyAtipWizardPanel from '@/components/integrations/tally/TallyAtipWizardPanel.vue';
import TallyAtipHealthPanel from '@/components/integrations/tally/TallyAtipHealthPanel.vue';
import TallyAtipActivityPanel from '@/components/integrations/tally/TallyAtipActivityPanel.vue';
import TallyAtipMappingPanel from '@/components/integrations/tally/TallyAtipMappingPanel.vue';
import TallyAtipConflictsPanel from '@/components/integrations/tally/TallyAtipConflictsPanel.vue';
import TallyAtipAssistantPanel from '@/components/integrations/tally/TallyAtipAssistantPanel.vue';
import TallyAtipCatalogPanel from '@/components/integrations/tally/TallyAtipCatalogPanel.vue';

import { confirmAction } from '@/composables/useConfirmAction';
import { formatTime as formatLocaleTime, formatUserDate } from '@/utils/localeFormat';
const { t } = useI18n();
const router = useRouter();

const VOUCHER_MODULE_KEYS = new Set([
  'sales',
  'purchase',
  'credit_note',
  'debit_note',
  'sales_order',
  'purchase_order',
  'journal',
  'payment',
  'receipt',
  'contra',
]);

const tabs = [
  { id: 'wizard', labelKey: 'settings.tallyTabSetup', group: 'setup' },
  { id: 'health', labelKey: 'settings.tallyTabOverview', group: 'monitor' },
  { id: 'activity', labelKey: 'settings.tallyActivityTitle', group: 'monitor' },
  { id: 'conflicts', labelKey: 'settings.tallyConflictsTitle', group: 'monitor' },
  { id: 'catalog', labelKey: 'settings.tallyCatalogTitle', group: 'data' },
  { id: 'mapping', labelKey: 'settings.tallyMappingTitle', group: 'data' },
  { id: 'settings', labelKey: 'settings.tallyTabSyncSettings', group: 'ops' },
  { id: 'logs', labelKey: 'settings.tallyTabSyncLogs', group: 'ops' },
  { id: 'advanced', labelKey: 'settings.tallyTabAdvanced', group: 'ops' },
  { id: 'assistant', labelKey: 'settings.tallyAssistantTitle', group: 'help' },
];

const activeTab = ref('wizard');
const tabIndex = computed(() => Math.max(0, tabs.findIndex((x) => x.id === activeTab.value)));

function onTabChange(index) {
  activeTab.value = tabs[index]?.id || 'wizard';
  if (activeTab.value === 'logs') loadSyncLogs();
  if (activeTab.value === 'advanced') loadFieldMaps();
}

const refreshing = ref(false);
const syncBusy = ref(false);
const savingMaps = ref(false);
const selectedCompanyGuid = ref('');
const activeCompanies = ref([]);
const moduleRows = ref([]);
const arivuOptions = ref([]);
const taxRows = ref([]);
const syncLogs = ref([]);
const fieldMapEntity = ref('party');
const fieldMapRules = ref([]);
const fieldMapEntityOptions = ref([{ entityType: 'party', label: 'Ledger → Organizations', tallyLabel: 'Ledger', arivuLabel: 'Organizations' }]);
const tallyFieldOptions = ref([]);
const savingFieldMaps = ref(false);
const fieldMapSaveError = ref('');

const settingsForm = ref({
  migrationMode: false,
  preventProductTaxUpdate: false,
  recordsPerSyncCycle: 200,
  syncIntervalMinutes: 5,
  scheduledSyncEnabled: false,
  dryRunDefault: true,
  defaultOwnerUserId: null,
  autoOutboxFanOutToAllLinkedCompanies: true,
});

const taxForm = ref({ tallyLedgerName: '', arivuTaxCode: '', arivuTaxRatePercent: null });
const filterRow = ref(null);
const filterDraft = ref({
  postedOnly: false,
  dateWindowDays: 30,
  parentsText: '',
  parents: [],
});
const ledgerGroupOptions = ref([]);
const ledgerGroupsLoading = ref(false);
const logDrawer = ref(null);

let pollTimer = null;

const companyGuid = computed(() => selectedCompanyGuid.value || null);

const selectedCompanyLabel = computed(() => {
  if (!selectedCompanyGuid.value) return t('settings.tallyCompanySelect');
  const c = activeCompanies.value.find((x) => x.companyGuid === selectedCompanyGuid.value);
  return c?.companyName || selectedCompanyGuid.value;
});

const arivuOptionsNormalized = computed(() => {
  const opts = Array.isArray(arivuOptions.value) ? [...arivuOptions.value] : [];
  if (!opts.some((o) => o.key === null || o.key === '' || o.key === undefined)) {
    opts.unshift({ key: '', label: t('settings.tallyNoneOption') });
  }
  return opts.map((o) => ({
    key: o.key == null ? '' : o.key,
    label: o.label || String(o.key || ''),
  }));
});

const arivuSelectOptions = computed(() =>
  arivuOptionsNormalized.value
    .filter((o) => o.key !== '')
    .map((o) => ({ value: o.key, label: o.label }))
);

const syncWayOptions = computed(() => [
  { value: 'disabled', label: t('settings.tallySyncWayDisabled') },
  { value: 'tally_to_arivu', label: t('settings.tallySyncWayTallyToArivu') },
  { value: 'arivu_to_tally', label: t('settings.tallySyncWayArivuToTally') },
  { value: 'bidirectional', label: t('settings.tallySyncWayBidirectional') },
]);

const syncWaySelectOptions = computed(() => syncWayOptions.value);

const inboundCreatePolicyOptions = computed(() => [
  { value: 'draft', label: 'draft' },
  { value: 'posted_if_valid', label: 'posted_if_valid' },
  { value: 'review_only', label: 'review_only' },
]);

function isVoucherModuleRow(row) {
  const key = String(row?.tallyModuleKey || '').toLowerCase();
  if (VOUCHER_MODULE_KEYS.has(key)) return true;
  return String(row?.entityType || '').toLowerCase().includes('voucher');
}

const currentFieldMapHint = computed(() => {
  const opt = fieldMapEntityOptions.value.find((o) => o.entityType === fieldMapEntity.value);
  if (!opt) return '';
  return `${opt.tallyLabel || 'Tally'} ↔ ${opt.arivuLabel || 'Arivu'}`;
});

const fieldMapEntitySelectOptions = computed(() =>
  fieldMapEntityOptions.value.map((o) => ({
    value: o.entityType,
    label: o.label || o.entityType,
  }))
);

const tallyFieldSelectOptions = computed(() =>
  (tallyFieldOptions.value || []).map((f) => ({ value: f, label: f }))
);

const unmappedMandatoryFields = computed(() =>
  (fieldMapRules.value || []).filter((r) => r.required && !r.externalFieldKey)
);

const unmappedMandatoryLabels = computed(() =>
  unmappedMandatoryFields.value.map((r) => r.arivuFieldLabel || r.arivuFieldKey).join(', ')
);

watch(selectedCompanyGuid, () => {
  refreshAll();
});

watch(fieldMapEntity, () => {
  if (activeTab.value === 'advanced') loadFieldMaps();
});

function goSettings() {
  router.push({ path: '/settings', query: { tab: 'addons', addonView: 'tally' } });
}

function formatDate(iso) {
  if (!iso) return '—';
  return formatUserDate(iso);
}
function formatTime(iso) {
  if (!iso) return '—';
  return formatLocaleTime(iso);
}

function filterSummary(row) {
  const f = row.filter || {};
  const bits = [];
  if (f.postedOnly) bits.push(t('settings.tallyFilterPostedOnly'));
  if (f.dateWindowDays) bits.push(`${f.dateWindowDays}d`);
  if (Array.isArray(f.parents) && f.parents.length) bits.push(f.parents.join(', '));
  return bits.length ? bits.join(' · ') : t('settings.tallyFilterEdit');
}

async function loadLedgerGroups() {
  ledgerGroupOptions.value = [];
  if (!companyGuid.value) return;
  ledgerGroupsLoading.value = true;
  try {
    const q = encodeURIComponent(companyGuid.value);
    const res = await apiClient.get(`/connectors/tally/atip/ledger-groups?companyGuid=${q}`);
    const data = res?.data ?? res;
    const payload = data?.data || data || {};
    const groups = Array.isArray(payload.groups) ? payload.groups : [];
    ledgerGroupOptions.value = groups.map((g) => ({
      name: g.name || g.value || g,
      value: g.value || g.name || g,
    }));
  } catch {
    ledgerGroupOptions.value = [];
  } finally {
    ledgerGroupsLoading.value = false;
  }
}

function openFilter(row) {
  filterRow.value = row;
  const selected = Array.isArray(row.filter?.parents) ? [...row.filter.parents] : [];
  filterDraft.value = {
    postedOnly: Boolean(row.filter?.postedOnly),
    dateWindowDays: row.filter?.dateWindowDays || 30,
    parentsText: '',
    parents: selected,
  };
  loadLedgerGroups();
}

function applyFilter() {
  if (!filterRow.value) return;
  const fromChecks = Array.isArray(filterDraft.value.parents) ? filterDraft.value.parents : [];
  const fromText = String(filterDraft.value.parentsText || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const parents = [...new Set([...fromChecks, ...fromText])];
  filterRow.value.filter = {
    ...(filterRow.value.filter || {}),
    postedOnly: filterDraft.value.postedOnly,
    dateWindowDays: filterDraft.value.dateWindowDays || undefined,
    parents: parents.length ? parents : undefined,
  };
  filterRow.value = null;
}

async function onCompanyChange() {
  await refreshAll();
}

async function loadMappings() {
  const guid = companyGuid.value || '';
  const res = await apiClient(`/connectors/tally/module-mappings?companyGuid=${encodeURIComponent(guid)}`, {
    method: 'GET',
  }).catch(() => null);
  const data = res?.data || res;
  moduleRows.value = (data?.rows || []).map((r) => ({
    ...r,
    arivuModuleKey: r.arivuModuleKey || '',
    inboundCreatePolicy: r.inboundCreatePolicy || 'review_only',
    syncFromLocal: r.syncFrom ? String(r.syncFrom).slice(0, 10) : '',
  }));
  arivuOptions.value = data?.arivuModuleOptions || [];
  if (data?.settings) {
    settingsForm.value = { ...settingsForm.value, ...data.settings };
  }
}

async function loadTax() {
  const guid = companyGuid.value || '';
  const res = await apiClient(`/connectors/tally/tax-mappings?companyGuid=${encodeURIComponent(guid)}`, {
    method: 'GET',
  }).catch(() => null);
  taxRows.value = res?.data || res || [];
  if (!Array.isArray(taxRows.value)) taxRows.value = [];
}

async function loadSyncLogs() {
  const guid = companyGuid.value || '';
  const res = await apiClient(`/connectors/tally/sync-logs?companyGuid=${encodeURIComponent(guid)}&limit=50`, {
    method: 'GET',
  }).catch(() => null);
  syncLogs.value = res?.data?.rows || res?.rows || [];
}

async function loadFieldMaps() {
  const guid = companyGuid.value || '';
  const res = await apiClient(
    `/connectors/tally/field-mappings?entityType=${encodeURIComponent(fieldMapEntity.value)}&companyGuid=${encodeURIComponent(guid)}`,
    { method: 'GET' }
  ).catch(() => null);
  const data = res?.data || res;
  if (Array.isArray(data?.entityOptions) && data.entityOptions.length) {
    fieldMapEntityOptions.value = data.entityOptions;
  }
  tallyFieldOptions.value = data?.tallyFields || data?.catalog?.external || [];
  fieldMapRules.value = (data?.suggestions || []).map((s) => ({
    arivuFieldKey: s.arivuFieldKey,
    arivuFieldLabel: s.arivuFieldLabel || data?.arivuFieldLabels?.[s.arivuFieldKey] || s.arivuFieldKey,
    required: Boolean(s.required),
    externalFieldKey: s.externalFieldKey || '',
    confidence: s.confidence ?? 0,
    approved: Boolean(s.approved),
  }));
  fieldMapSaveError.value = '';
}

async function loadDashboard() {
  const dash = await apiClient('/connectors/tally/dashboard', { method: 'GET' }).catch(() => null);
  const companies = dash?.data?.companies || dash?.companies || [];
  activeCompanies.value = companies.filter((c) => c.enabled === true);
  if (!selectedCompanyGuid.value && activeCompanies.value[0]) {
    selectedCompanyGuid.value = activeCompanies.value[0].companyGuid;
  }
}

async function refreshAll() {
  refreshing.value = true;
  try {
    await loadDashboard();
    await Promise.all([loadMappings(), loadTax(), loadSyncLogs()]);
    if (activeTab.value === 'advanced') await loadFieldMaps();
  } finally {
    refreshing.value = false;
  }
}

async function saveSettings() {
  await apiClient.patch('/connectors/tally/settings', { ...settingsForm.value });
}

async function saveAllMappings() {
  savingMaps.value = true;
  try {
    const rows = moduleRows.value.map((r) => ({
      tallyModuleKey: r.tallyModuleKey,
      syncWay: r.syncWay,
      arivuModuleKey: r.arivuModuleKey || null,
      filter: r.filter || {},
      syncFrom: settingsForm.value.migrationMode && r.syncFromLocal ? r.syncFromLocal : null,
      ...(isVoucherModuleRow(r) ? { inboundCreatePolicy: r.inboundCreatePolicy || 'review_only' } : {}),
    }));
    await apiClient.put('/connectors/tally/module-mappings', {
      companyGuid: companyGuid.value,
      rows,
    });
    await loadMappings();
  } finally {
    savingMaps.value = false;
  }
}

async function resetModule(tallyModuleKey) {
  await apiClient.post('/connectors/tally/reset/module', {
    companyGuid: companyGuid.value,
    tallyModuleKey,
  });
  await loadMappings();
}

async function resetFull() {
  if (!await confirmAction(t('settings.tallyResetFullConfirm'))) return;
  await apiClient.post('/connectors/tally/reset/full', { companyGuid: companyGuid.value });
  await refreshAll();
}

async function addTaxMap() {
  if (!taxForm.value.tallyLedgerName) return;
  await apiClient.post('/connectors/tally/tax-mappings', {
    companyGuid: companyGuid.value,
    ...taxForm.value,
  });
  taxForm.value = { tallyLedgerName: '', arivuTaxCode: '', arivuTaxRatePercent: null };
  await loadTax();
}

async function removeTaxMap(id) {
  await apiClient.delete(`/connectors/tally/tax-mappings/${id}?companyGuid=${encodeURIComponent(companyGuid.value || '')}`);
  await loadTax();
}

async function runSync(jobType) {
  syncBusy.value = true;
  try {
    await apiClient.post('/connectors/tally/sync/trigger', {
      jobType,
      companyGuid: companyGuid.value,
      dryRun: jobType === 'dry_run',
    });
    await loadSyncLogs();
  } finally {
    syncBusy.value = false;
  }
}

async function acceptAllFieldMaps() {
  fieldMapSaveError.value = '';
  if (unmappedMandatoryFields.value.length) {
    fieldMapSaveError.value = t('settings.tallyMandatoryBannerBody', {
      fields: unmappedMandatoryLabels.value,
    });
    return;
  }
  savingFieldMaps.value = true;
  try {
    await apiClient.post('/connectors/tally/field-mappings/accept', {
      entityType: fieldMapEntity.value,
      companyGuid: companyGuid.value,
      rules: fieldMapRules.value.map((r) => ({
        ...r,
        externalFieldKey: r.externalFieldKey || null,
      })),
    });
    await loadFieldMaps();
  } catch (err) {
    const message =
      err?.response?.data?.message ||
      err?.message ||
      t('settings.tallyMandatorySaveFailed');
    fieldMapSaveError.value = message;
  } finally {
    savingFieldMaps.value = false;
  }
}

async function openLogRecords(log, side, action) {
  const res = await apiClient(
    `/connectors/tally/sync-logs/${log._id}/records?side=${encodeURIComponent(side)}&action=${encodeURIComponent(action)}`,
    { method: 'GET' }
  ).catch(() => null);
  logDrawer.value = {
    logId: log._id,
    side,
    action,
    records: res?.data?.records || res?.records || [],
  };
}

function downloadLogCsv() {
  if (!logDrawer.value) return;
  const records = logDrawer.value.records || [];
  const header = ['side', 'action', 'moduleKey', 'tallyModuleKey', 'recordId', 'recordName', 'externalId', 'reason'];
  const lines = [header.join(',')];
  for (const r of records) {
    lines.push(header.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tally-sync-${logDrawer.value.logId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function openArivuRecord(rec) {
  if (!rec.recordId) return;
  const moduleKey = rec.moduleKey || 'organizations';
  router.push(`/${moduleKey}/${rec.recordId}`);
}

onMounted(async () => {
  await refreshAll();
  pollTimer = setInterval(() => {
    if (activeTab.value === 'logs') loadSyncLogs();
  }, 15000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>
