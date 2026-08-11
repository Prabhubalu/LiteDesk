<template>
  <SettingsScrollPanel v-if="currentView === 'overview'">
    <template #header>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.integrationsTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.integrationsSubtitle') }}
        </p>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm text-red-800 dark:text-red-300">
          {{ error.message || t('settings.integrationsLoadFailed') }}
        </p>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <button
        v-for="integration in integrations"
        :key="integration.key"
        type="button"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer group text-left"
        @click="navigateToIntegration(integration)"
      >
        <div class="flex items-start gap-4">
          <div
            class="flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0 group-hover:scale-105 transition-transform"
            :class="getIntegrationIconMeta(integration.key).iconBg"
          >
            <component :is="getIntegrationIconMeta(integration.key).icon" class="w-6 h-6 text-white" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h4 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                {{ integration.name }}
              </h4>
              <span
                class="h-2 w-2 shrink-0 rounded-full"
                :class="integration.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'"
                :title="integrationStatusLabel(integration.enabled)"
              />
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
              {{ integration.description }}
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{{ scopeBadgeLabel(integration.scope) }}</span>
              <span v-if="integration.recommended">{{ t('settings.integrationsRecommended') }}</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  </SettingsScrollPanel>

  <SettingsScrollPanel v-else class="flex min-h-0 flex-1 flex-col overflow-hidden" :save-bar-visible="emailSettingsDirty">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            class="mt-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            :title="t('settings.integrationsBackTitle')"
            @click="navigateToOverview"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div v-if="selectedIntegration" class="min-w-0 flex-1">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedIntegration.name }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {{ selectedIntegration.description }}
            </p>
            <div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span
                :class="[
                  'inline-flex items-center rounded-full px-2 py-0.5 font-medium',
                  selectedIntegration.enabled
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                ]"
              >
                {{ integrationStatusLabel(selectedIntegration.enabled) }}
              </span>
              <span>{{ scopeBadgeLabel(selectedIntegration.scope) }}</span>
              <span v-if="selectedIntegration.recommended">{{ t('settings.integrationsRecommended') }}</span>
              <span v-if="selectedIntegration.key === 'email-provider' && selectedIntegration.configStatus">
                · {{ selectedIntegration.configStatus === 'configured'
                  ? t('settings.integrationsConfigConfigured')
                  : t('settings.integrationsConfigNotConfigured') }}
              </span>
            </div>
          </div>
        </div>
        <div v-if="selectedIntegration && !detailLoading" class="flex shrink-0 flex-wrap items-center gap-2">
          <button
            v-if="selectedIntegration.key === 'email-provider' && selectedIntegration.enabled && selectedIntegration.configStatus === 'configured'"
            type="button"
            @click="sendTestEmail"
            :disabled="testEmailLoading"
            class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {{ testEmailLoading ? t('settings.integrationsSendingTestEmail') : t('settings.integrationsSendTestEmail') }}
          </button>
          <button
            v-if="selectedIntegration.enabled"
            type="button"
            @click="confirmDisable"
            :disabled="actionLoading"
            class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            {{ t('settings.integrationsDisableButton') }}
          </button>
          <button
            v-else
            type="button"
            @click="confirmEnable"
            :disabled="actionLoading"
            class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ t('settings.integrationsEnableButton') }}
          </button>
        </div>
      </div>
    </template>

    <template #tabs>
      <nav v-if="selectedIntegration && detailTabs.length > 1" class="-mb-px flex gap-1 overflow-x-auto">
        <button
          v-for="tab in detailTabs"
          :key="tab.id"
          type="button"
          class="inline-flex shrink-0 items-center whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
          :class="activeDetailTab === tab.id
            ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
          @click="activeDetailTab = tab.id"
        >
          {{ t(tab.labelKey) }}
        </button>
      </nav>
    </template>

    <div v-if="selectedIntegration" class="space-y-5">
      <!-- Non-email integrations -->
      <div v-if="selectedIntegration.key !== 'email-provider' && activeDetailTab === 'general'" class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <details v-if="selectedIntegration.dataSharedSummary" class="group">
          <summary class="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
            {{ t('settings.integrationsDataSharedTitle') }}
          </summary>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ selectedIntegration.dataSharedSummary }}
          </p>
          <p v-if="selectedIntegration.dataSharedDetails" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ selectedIntegration.dataSharedDetails }}
          </p>
        </details>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ connectionStatusMessage(selectedIntegration.enabled) }}
        </p>
      </div>

      <!-- Email provider -->
      <template v-else-if="selectedIntegration.key === 'email-provider'">
        <div v-if="activeDetailTab === 'setup'" class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.integrationsCrmOutboundTitle') }}</h3>
          <p
            v-if="emailCriticalFieldsLocked"
            class="mt-3 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2"
          >
            {{ t('settings.integrationsCrmOutboundOwnerOnlyHint') }}
          </p>
          <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <label class="text-sm">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">
                  {{ t('settings.integrationsProviderLabel') }}
                  <span class="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{{ t('settings.integrationsOwnerOnlyBadge') }}</span>
                </span>
                <select v-model="emailConfig.provider" :disabled="emailCriticalFieldsLocked" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  <option value="amds">{{ t('settings.integrationsProviderOptionAmds') }}</option>
                  <option value="resend">{{ t('settings.integrationsProviderOptionResend') }}</option>
                  <option value="smtp">{{ t('settings.integrationsProviderOptionSmtp') }}</option>
                  <option value="gmail-smtp">{{ t('settings.integrationsProviderOptionGmailSmtp') }}</option>
                  <option value="aws-ses">{{ t('settings.integrationsProviderOptionAwsSes') }}</option>
                  <option value="oci-email-delivery">{{ t('settings.integrationsProviderOptionOci') }}</option>
                </select>
              </label>

              <p
                v-if="emailConfig.provider === 'amds'"
                class="md:col-span-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100"
              >
                <strong>{{ t('settings.integrationsAmdsHintTitle') }}</strong>
                {{ t('settings.integrationsAmdsHintBody') }}
                <span
                  :class="[
                    'ml-1 inline-flex items-center rounded-full px-2 py-0.5 font-medium',
                    amdsServerConfigured
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  ]"
                >
                  {{
                    amdsServerConfigured
                      ? t('settings.integrationsAmdsServerConfigured')
                      : t('settings.integrationsAmdsServerNotConfigured')
                  }}
                </span>
              </p>

              <p
                v-if="emailConfig.provider === 'resend'"
                class="md:col-span-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100"
              >
                <strong>{{ t('settings.integrationsResendHintTitle') }}</strong>{{ t('settings.integrationsResendHintBody', { smtpUser: t('settings.integrationsSmtpUserResend') }) }}
              </p>

              <p
                v-if="emailConfig.provider === 'gmail-smtp'"
                class="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100"
              >
                <strong>{{ t('settings.integrationsGmailSmtpHintTitle') }}</strong> {{ t('settings.integrationsGmailSmtpHintSetsRelay') }} <code class="font-mono text-[11px]">{{ t('settings.integrationsSettingsSmtpGmailCom587') }}</code>.
                {{ t('settings.integrationsGmailSmtpHintBody', { appPassword: t('settings.integrationsGmailSmtpHintAppPassword') }) }}
              </p>

              <p
                v-if="emailConfig.provider === 'smtp'"
                class="md:col-span-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-200"
              >
                <strong>{{ t('settings.integrationsCustomSmtpHintTitle') }}</strong>{{ t('settings.integrationsCustomSmtpHintBody') }}
              </p>

              <label v-if="emailConfig.provider === 'oci-email-delivery'" class="text-sm md:col-span-2">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">
                  {{ t('settings.integrationsOciRegionLabel') }}
                  <span class="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{{ t('settings.integrationsOwnerOnlyBadge') }}</span>
                </span>
                <input
                  v-model="emailConfig.ociRegion"
                  :disabled="emailCriticalFieldsLocked"
                  type="text"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  :placeholder="t('settings.integrationsPlaceholderOciRegion')"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('settings.integrationsOciRegionHint', { hostPattern: t('settings.integrationsOciHostPattern'), port465: t('settings.integrationsOciPort465') }) }}
                </p>
              </label>

              <label class="text-sm">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">
                  {{ t('settings.integrationsFromEmail') }}
                  <span class="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{{ t('settings.integrationsOwnerOnlyBadge') }}</span>
                </span>
                <input v-model="emailConfig.fromEmail" :disabled="emailCriticalFieldsLocked" type="email" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" :placeholder="t('settings.integrationsPlaceholderFromEmail')" />
              </label>

              <label class="text-sm">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">{{ t('settings.integrationsFromName') }}</span>
                <input v-model="emailConfig.fromName" type="text" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2" :placeholder="t('settings.integrationsPlaceholderFromName')" />
              </label>

              <label class="text-sm">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">{{ t('settings.integrationsReplyTo') }}</span>
                <input v-model="emailConfig.replyTo" type="email" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2" :placeholder="t('settings.integrationsPlaceholderReplyTo')" />
              </label>

              <p
                v-if="emailConfig.provider === 'aws-ses'"
                class="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
              >
                <strong>{{ t('settings.integrationsAwsSesHintTitle') }}</strong>{{ t('settings.integrationsAwsSesHintBody') }}
              </p>

              <label v-if="emailProviderUsesSmtp" class="text-sm">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">
                  {{ t('settings.integrationsSmtpHost') }}
                  <span class="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{{ t('settings.integrationsOwnerOnlyBadge') }}</span>
                </span>
                <input
                  v-model="emailConfig.smtpHost"
                  :disabled="emailCriticalFieldsLocked"
                  type="text"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  :placeholder="smtpHostPlaceholder"
                />
              </label>

              <template v-if="emailProviderUsesSmtp">
                <label class="text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">
                    {{ t('settings.integrationsSmtpPort') }}
                    <span class="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{{ t('settings.integrationsOwnerOnlyBadge') }}</span>
                  </span>
                  <input
                    v-model="emailConfig.smtpPort"
                    :disabled="emailCriticalFieldsLocked"
                    type="number"
                    class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    :placeholder="smtpPortPlaceholder"
                  >
                </label>

                <label class="text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">
                    {{ t('settings.integrationsSmtpUser') }}
                    <span class="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{{ t('settings.integrationsOwnerOnlyBadge') }}</span>
                  </span>
                  <input
                    v-model="emailConfig.smtpUser"
                    :disabled="emailCriticalFieldsLocked"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    :placeholder="smtpUserPlaceholder"
                  >
                </label>

                <label class="text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">
                    {{ t('settings.integrationsSmtpPassword') }}
                    <span class="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{{ t('settings.integrationsOwnerOnlyBadge') }}</span>
                    <span v-if="emailConfig.hasSmtpPass" class="text-xs text-gray-500 dark:text-gray-400">({{ emailConfig.smtpPassMasked || t('settings.integrationsSavedMask') }})</span>
                  </span>
                  <input v-model="emailConfig.smtpPass" :disabled="emailCriticalFieldsLocked" type="password" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed" :placeholder="t('settings.integrationsSecretKeepBlank')">
                </label>
              </template>

              <template v-if="emailConfig.provider === 'aws-ses'">
                <label class="text-sm md:col-span-2">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">
                    {{ t('settings.integrationsAwsRegion') }}
                    <span class="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{{ t('settings.integrationsOwnerOnlyBadge') }}</span>
                  </span>
                  <input
                    v-model="emailConfig.awsRegion"
                    :disabled="emailCriticalFieldsLocked"
                    type="text"
                    class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    :placeholder="t('settings.integrationsPlaceholderAwsRegion')"
                  >
                </label>
                <label class="text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">
                    {{ t('settings.integrationsAwsAccessKeyId') }}
                    <span class="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{{ t('settings.integrationsOwnerOnlyBadge') }}</span>
                  </span>
                  <input
                    v-model="emailConfig.awsAccessKeyId"
                    :disabled="emailCriticalFieldsLocked"
                    type="text"
                    autocomplete="off"
                    class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                </label>
                <label class="text-sm">
                  <span class="block mb-1 text-gray-700 dark:text-gray-300">
                    {{ t('settings.integrationsAwsSecretAccessKey') }}
                    <span class="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{{ t('settings.integrationsOwnerOnlyBadge') }}</span>
                    <span v-if="emailConfig.hasAwsSecretAccessKey" class="text-xs text-gray-500 dark:text-gray-400">({{ emailConfig.awsSecretAccessKeyMasked || t('settings.integrationsSavedMask') }})</span>
                  </span>
                  <input
                    v-model="emailConfig.awsSecretAccessKey"
                    :disabled="emailCriticalFieldsLocked"
                    type="password"
                    autocomplete="new-password"
                    class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    :placeholder="t('settings.integrationsSecretKeepBlank')"
                  >
                </label>
              </template>
            </div>

            <label
              v-if="emailProviderUsesSmtp"
              class="mt-3 inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <input
                v-model="emailConfig.smtpSecure"
                type="checkbox"
                class="rounded border-gray-300 dark:border-gray-600"
                :disabled="emailConfig.provider === 'oci-email-delivery'"
              />
              {{ t('settings.integrationsUseSecureSmtp') }}
              <span
                v-if="emailConfig.provider === 'oci-email-delivery'"
                class="text-xs text-gray-500 dark:text-gray-400"
              >{{ t('settings.integrationsOciSecureRequired') }}</span>
            </label>
        </div>

        <div v-else-if="activeDetailTab === 'policy'" class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div
            v-if="!emailPolicyLoaded && loadingEmailPolicy"
            class="mb-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
          >
            <div class="h-4 w-4 animate-spin rounded-full border-b-2 border-indigo-600"></div>
            {{ t('settings.integrationsRefreshing') }}
          </div>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('settings.integrationsOutboundPolicyTitle') }}</h4>
            <p
              v-if="communicationPolicyLocked"
              class="mb-3 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2"
            >
              {{ t('settings.integrationsOutboundPolicyOwnerOnly') }}
            </p>

            <div class="space-y-3">
              <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  v-model="communicationPolicy.outboundEmail.enabled"
                  type="checkbox"
                  class="rounded border-gray-300 dark:border-gray-600"
                  :disabled="communicationPolicyLocked"
                />
                {{ t('settings.integrationsEnableOutboundApi') }}
              </label>

              <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  v-model="communicationPolicy.outboundEmail.allowWorkspaceEmail"
                  type="checkbox"
                  class="rounded border-gray-300 dark:border-gray-600"
                  :disabled="communicationPolicyLocked"
                />
                {{ t('settings.integrationsAllowInboxStandalone') }}
              </label>

              <div class="rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-gray-600 dark:bg-gray-900/40 space-y-2">
                <p class="text-xs font-semibold text-gray-800 dark:text-gray-200">{{ t('settings.integrationsMailboxVsPlatform') }}</p>
                <label class="inline-flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    v-model="communicationPolicy.outboundEmail.disallowPlatformSmtpForWorkspace"
                    type="checkbox"
                    class="mt-0.5 rounded border-gray-300 dark:border-gray-600"
                    :disabled="communicationPolicyLocked"
                  />
                  <span>
                    <span class="font-medium">{{ t('settings.integrationsInboxRequiresMailbox') }}</span>
                    <span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {{ t('settings.integrationsInboxRequiresMailboxHint') }}
                    </span>
                  </span>
                </label>
                <label class="inline-flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    v-model="communicationPolicy.outboundEmail.requireMailboxProviderForAgentSend"
                    type="checkbox"
                    class="mt-0.5 rounded border-gray-300 dark:border-gray-600"
                    :disabled="communicationPolicyLocked"
                  />
                  <span>
                    <span class="font-medium">{{ t('settings.integrationsAllCrmRequiresMailbox') }}</span>
                    <span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {{ t('settings.integrationsAllCrmRequiresMailboxHint') }}
                    </span>
                  </span>
                </label>
              </div>

              <label class="inline-flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  v-model="communicationPolicy.outboundEmail.requireIdempotencyKey"
                  type="checkbox"
                  class="mt-0.5 rounded border-gray-300 dark:border-gray-600"
                  :disabled="communicationPolicyLocked"
                />
                <span>
                  <span class="font-medium">{{ t('settings.integrationsRequireIdempotency') }}</span>
                  <span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ t('settings.integrationsRequireIdempotencyHint', { header: t('settings.integrationsIdempotencyHeader') }) }}
                  </span>
                </span>
              </label>

              <label class="text-sm block">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">{{ t('settings.integrationsMaxRecipients') }}</span>
                <input
                  v-model.number="communicationPolicy.outboundEmail.maxRecipientsPerMessage"
                  type="number"
                  min="1"
                  max="1000"
                  class="w-full md:w-64 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  :disabled="communicationPolicyLocked"
                />
              </label>

              <div>
                <span class="block mb-1 text-sm text-gray-700 dark:text-gray-300">{{ t('settings.integrationsAllowedModules') }}</span>
                <div class="flex flex-wrap gap-2">
                  <label
                    v-for="moduleKey in communicationPolicy.supportedModuleKeys"
                    :key="`policy-${moduleKey}`"
                    class="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900"
                  >
                    <input
                      :value="moduleKey"
                      v-model="communicationPolicy.outboundEmail.allowedModuleKeys"
                      type="checkbox"
                      class="rounded border-gray-300 dark:border-gray-600"
                      :disabled="communicationPolicyLocked"
                    />
                    {{ moduleKey }}
                  </label>
                </div>
              </div>

              <div>
                <span class="block mb-1 text-sm text-gray-700 dark:text-gray-300">{{ t('settings.integrationsSuppressionPolicy') }}</span>
                <div class="flex flex-col gap-2">
                  <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      v-model="communicationPolicy.outboundEmail.suppression.autoSuppressOnBounce"
                      type="checkbox"
                      class="rounded border-gray-300 dark:border-gray-600"
                      :disabled="communicationPolicyLocked"
                    />
                    {{ t('settings.integrationsAutoSuppressBounce') }}
                  </label>
                  <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      v-model="communicationPolicy.outboundEmail.suppression.autoSuppressOnComplaint"
                      type="checkbox"
                      class="rounded border-gray-300 dark:border-gray-600"
                      :disabled="communicationPolicyLocked"
                    />
                    {{ t('settings.integrationsAutoSuppressComplaint') }}
                  </label>
                </div>
              </div>
            </div>

            <div class="mt-6 border-t border-gray-200 pt-4 dark:border-gray-600">
              <h4 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.integrationsGmailMailboxesTitle') }}</h4>
              <div
                v-if="selectedIntegration.gmailOAuthAppConfigured"
                class="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100"
              >
                <span class="font-medium">{{ t('settings.integrationsGmailReady') }}</span>
                {{ t('settings.integrationsGmailReadyBody', { inboxPath: t('settings.integrationsGmailInboxPath') }) }}
              </div>
              <div
                v-else
                class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-100"
              >
                <span class="font-medium">{{ t('settings.integrationsGmailNotEnabled') }}</span>
                {{ t('settings.integrationsGmailNotEnabledBody', { clientId: 'GOOGLE_GMAIL_CLIENT_ID', clientSecret: 'GOOGLE_GMAIL_CLIENT_SECRET', redirectUri: 'GOOGLE_GMAIL_REDIRECT_URI' }) }}
                <span class="mt-1 block">{{ t('settings.integrationsGmailNotEnabledNote', { emphasis: t('settings.integrationsGmailNotEnabledEmphasis') }) }}</span>
              </div>

              <details
                v-if="canManageGmailOAuthApp"
                class="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900/40"
              >
                <summary class="cursor-pointer text-xs font-medium text-gray-800 dark:text-gray-200">
                  {{ t('settings.integrationsGmailAdvancedTitle') }}
                </summary>
                <p class="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  <span class="font-medium text-gray-800 dark:text-gray-200">{{ t('settings.integrationsGmailAdvancedSkip') }}</span>
                  {{ t('settings.integrationsGmailAdvancedBody', { envVars: t('settings.integrationsGmailEnvVars'), callbackPath: t('settings.integrationsGmailCallbackPath') }) }}
                </p>
                <div class="mt-3 space-y-3">
                  <label class="block text-sm">
                    <span class="mb-1 block text-gray-700 dark:text-gray-300">{{ t('settings.integrationsClientId') }}</span>
                    <input
                      v-model="communicationPolicy.gmailInboxSync.clientId"
                      type="text"
                      autocomplete="off"
                      class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    >
                  </label>
                  <label class="block text-sm">
                    <span class="mb-1 block text-gray-700 dark:text-gray-300">{{ t('settings.integrationsClientSecret') }}</span>
                    <input
                      v-model="communicationPolicy.gmailInboxSync.clientSecret"
                      type="password"
                      autocomplete="new-password"
                      :placeholder="gmailClientSecretPlaceholder"
                      class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    >
                  </label>
                  <label class="block text-sm">
                    <span class="mb-1 block text-gray-700 dark:text-gray-300">{{ t('settings.integrationsRedirectUri') }}</span>
                    <input
                      v-model="communicationPolicy.gmailInboxSync.redirectUri"
                      type="url"
                      autocomplete="off"
                      :placeholder="t('settings.integrationsPlaceholderGmailRedirect')"
                      class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    >
                  </label>
                </div>
              </details>
            </div>
        </div>

        <PersonalSmtpSendersCard v-if="activeDetailTab === 'setup'" />

        <div v-else-if="activeDetailTab === 'credits'" class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <EmailPolicyCreditsPanel :can-manage="!communicationPolicyLocked" />
        </div>

        <div
          v-else-if="activeDetailTab === 'domain'"
          class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
        >
          <template v-if="emailConfig.provider === 'amds'">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {{ t('settings.integrationsAmdsDomainsTitle') }}
            </h3>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-4">
              {{ t('settings.integrationsAmdsDomainsDesc') }}
            </p>
            <p
              v-if="!amdsServerConfigured"
              class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
            >
              {{ t('settings.integrationsAmdsServerNotConfigured') }}
            </p>
            <div class="flex flex-wrap items-end gap-2">
              <label class="min-w-[220px] flex-1 text-sm">
                <span class="mb-1 block text-gray-700 dark:text-gray-300">{{ t('settings.integrationsAmdsDomainLabel') }}</span>
                <input
                  v-model.trim="amdsDomainInput"
                  type="text"
                  :disabled="emailCriticalFieldsLocked || amdsDomainLoading || !amdsServerConfigured"
                  :placeholder="t('settings.integrationsAmdsDomainPlaceholder')"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900 disabled:opacity-60"
                />
              </label>
              <button
                type="button"
                :disabled="emailCriticalFieldsLocked || amdsDomainLoading || !amdsServerConfigured || !amdsDomainInput"
                class="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                @click="registerAmdsDomain"
              >
                {{ amdsDomainLoading ? t('states.saving') : t('settings.integrationsAmdsDomainRegister') }}
              </button>
              <button
                v-if="amdsDomainResult?.domain || amdsDomainInput"
                type="button"
                :disabled="emailCriticalFieldsLocked || amdsDomainLoading || !amdsServerConfigured"
                class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                @click="verifyAmdsDomain"
              >
                {{ t('settings.integrationsAmdsDomainVerify') }}
              </button>
            </div>
            <div v-if="amdsDomainResult" class="mt-4 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs font-medium text-gray-900 dark:text-white">{{ amdsDomainResult.domain }}</span>
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  :class="amdsDomainResult.status === 'verified'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'"
                >
                  {{ amdsDomainResult.status === 'verified'
                    ? t('settings.integrationsAmdsDomainVerified')
                    : t('settings.integrationsAmdsDomainPending') }}
                </span>
                <span v-if="amdsDomainResult.spf_verified" class="text-[10px] text-green-700 dark:text-green-400">SPF ✓</span>
                <span v-if="amdsDomainResult.dkim_verified" class="text-[10px] text-green-700 dark:text-green-400">DKIM ✓</span>
                <span v-if="amdsDomainResult.dmarc_verified" class="text-[10px] text-green-700 dark:text-green-400">DMARC ✓</span>
              </div>
              <div
                v-for="(rec, idx) in amdsDomainResult.dns_records || []"
                :key="`${rec.purpose}-${idx}`"
                class="rounded border border-gray-200 bg-white px-3 py-2 text-[11px] dark:border-gray-700 dark:bg-gray-900"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-semibold uppercase text-gray-700 dark:text-gray-300">{{ rec.purpose }} ({{ rec.type }})</span>
                  <button
                    type="button"
                    class="shrink-0 text-indigo-600 hover:underline dark:text-indigo-400"
                    @click="copyAmdsDnsValue(rec.value)"
                  >
                    {{ t('settings.integrationsAmdsDnsCopy') }}
                  </button>
                </div>
                <p class="mt-1 break-all text-gray-600 dark:text-gray-400"><span class="text-gray-500">Name:</span> {{ rec.name }}</p>
                <p class="mt-0.5 break-all font-mono text-gray-800 dark:text-gray-200">{{ rec.value }}</p>
              </div>
            </div>
          </template>

          <template v-else>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('settings.integrationsSenderDomainTitle') }}</h3>
            <div class="flex items-center justify-between gap-3 mb-3">
              <p class="text-xs text-gray-600 dark:text-gray-300">
                {{ t('settings.integrationsDomainLabel') }}
                <span class="font-medium">{{ displayEmailDomainVerification.domain || t('settings.integrationsDomainNotSet') }}</span>
              </p>
              <button
                type="button"
                @click="checkEmailDomainStatus"
                :disabled="checkingDomainStatus"
                class="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ checkingDomainStatus ? t('settings.integrationsCheckingStatus') : t('settings.integrationsCheckStatus') }}
              </button>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.integrationsSenderDomainDnsHint') }}</p>
            <p class="text-[11px] text-gray-500 dark:text-gray-400 mb-3" v-if="displayEmailDomainVerification.checkedAt">
              {{ t('settings.integrationsLastChecked') }} {{ formatCheckedAt(displayEmailDomainVerification.checkedAt) }}
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div class="rounded-md border border-blue-200 dark:border-blue-700 px-3 py-2 bg-white dark:bg-gray-900/30">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold text-gray-900 dark:text-white">{{ t('settings.integrationsSenderIdentity') }}</p>
                  <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium', verificationStatusClass(displayEmailDomainVerification.senderIdentity?.status)]">
                    {{ displayEmailDomainVerification.senderIdentity?.status || 'not_checked' }}
                  </span>
                </div>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{{ displayEmailDomainVerification.senderIdentity?.note }}</p>
              </div>
              <div class="rounded-md border border-blue-200 dark:border-blue-700 px-3 py-2 bg-white dark:bg-gray-900/30">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold text-gray-900 dark:text-white">SPF</p>
                  <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium', verificationStatusClass(displayEmailDomainVerification.spf?.status)]">
                    {{ displayEmailDomainVerification.spf?.status || 'not_checked' }}
                  </span>
                </div>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{{ displayEmailDomainVerification.spf?.note }}</p>
              </div>
              <div class="rounded-md border border-blue-200 dark:border-blue-700 px-3 py-2 bg-white dark:bg-gray-900/30">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold text-gray-900 dark:text-white">{{ t('settings.integrationsDkim') }}</p>
                  <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium', verificationStatusClass(displayEmailDomainVerification.dkim?.status)]">
                    {{ displayEmailDomainVerification.dkim?.status || 'not_checked' }}
                  </span>
                </div>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{{ displayEmailDomainVerification.dkim?.note }}</p>
              </div>
              <div class="rounded-md border border-blue-200 dark:border-blue-700 px-3 py-2 bg-white dark:bg-gray-900/30">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs font-semibold text-gray-900 dark:text-white">{{ t('settings.integrationsDmarc') }}</p>
                  <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium', verificationStatusClass(displayEmailDomainVerification.dmarc?.status)]">
                    {{ displayEmailDomainVerification.dmarc?.status || 'not_checked' }}
                  </span>
                </div>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{{ displayEmailDomainVerification.dmarc?.note }}</p>
              </div>
            </div>
          </template>
        </div>

        <div v-else-if="activeDetailTab === 'diagnostics'" class="space-y-4">
          <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div class="flex items-center justify-between gap-3 mb-3">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.integrationsDeliveryDiagnosticsTitle') }}</h4>
              <button
                type="button"
                @click="loadPipelineDiagnostics"
                :disabled="loadingDiagnostics"
                class="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ loadingDiagnostics ? t('settings.integrationsRefreshing') : t('settings.integrationsRefresh') }}
              </button>
            </div>

            <div class="mb-4">
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">{{ t('settings.integrationsFailureCategories') }}</p>
              <div v-if="diagnostics.failureBreakdown.length > 0" class="flex flex-wrap gap-2">
                <span
                  v-for="row in diagnostics.failureBreakdown"
                  :key="`failure-${row.category}`"
                  :class="['inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium', failureCategoryClass(row.category)]"
                >
                  {{ row.category }}: {{ row.count }}
                </span>
              </div>
              <p v-else class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.integrationsNoFailures24h') }}</p>
            </div>

            <div>
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">{{ t('settings.integrationsRecentLifecycleEvents') }}</p>
              <div v-if="diagnostics.recentEvents.length > 0" class="space-y-2 max-h-56 overflow-auto pr-1">
                <div
                  v-for="evt in diagnostics.recentEvents"
                  :key="`evt-${evt._id}`"
                  class="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-semibold text-gray-900 dark:text-white">{{ evt.eventType }}</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400">{{ formatCheckedAt(evt.createdAt) }}</span>
                  </div>
                  <p class="text-[11px] text-gray-600 dark:text-gray-300 mt-1">
                    {{ t('settings.integrationsEventSourcePrefix') }} {{ evt.source }}<span v-if="evt.payload?.failureCategory"> | {{ t('settings.integrationsEventFailurePrefix') }} {{ evt.payload.failureCategory }}</span>
                  </p>
                  <p v-if="evt.payload?.error" class="text-[11px] text-red-700 dark:text-red-300 mt-1 break-words">
                    {{ t('settings.integrationsEventErrorPrefix') }} {{ evt.payload.error }}
                  </p>
                </div>
              </div>
              <p v-else class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.integrationsNoCommunicationEvents') }}</p>
            </div>
          </div>

          <div
            class="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
          >
            <div class="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div>
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.integrationsInboundMimeTitle') }}</h4>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                  {{ t('settings.integrationsInboundMimeDescIntro', { mimeType: t('settings.integrationsMimeType'), jsonShape: t('settings.integrationsJsonShape') }) }}
                  {{ t('settings.integrationsInboundMimeDescRouting', {
                    orgHeader: t('settings.integrationsOrgHeader'),
                    orgHeaderAlt: t('settings.integrationsOrgHeaderAlt'),
                    tokenHeader: t('settings.integrationsTokenHeader'),
                    secretEnv: t('settings.integrationsSecretEnv')
                  }) }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                  @click="copyInboundWebhookUrl"
                >
                  {{ t('settings.integrationsCopyUrl') }}
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  @click="copyInboundWebhookCurlExample"
                >
                  {{ t('settings.integrationsCopyCurl') }}
                </button>
              </div>
            </div>
            <p class="text-[11px] font-mono text-gray-700 dark:text-gray-300 break-all bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-2">
              {{ inboundMimeWebhookUrl }}
            </p>
          </div>

          <div
            class="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
          >
            <div class="flex items-center justify-between gap-3 mb-3">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.integrationsInboundDiagnosticsTitle') }}</h4>
              <button
                type="button"
                @click="loadInboundDiagnostics"
                :disabled="loadingInboundDiagnostics"
                class="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ loadingInboundDiagnostics ? t('settings.integrationsRefreshing') : t('settings.integrationsRefresh') }}
              </button>
            </div>
            <p class="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              {{ t('settings.integrationsInboundDiagnosticsHint') }}
            </p>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
              <div class="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2">
                <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('settings.integrationsQueueWaiting') }}</p>
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ Number(inboundDiagnostics.queue?.waiting || 0) }}</p>
              </div>
              <div class="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2">
                <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('settings.integrationsQueueActive') }}</p>
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ Number(inboundDiagnostics.queue?.active || 0) }}</p>
              </div>
              <button
                type="button"
                class="rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-left w-full hover:bg-amber-100/80 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
                :disabled="Number(inboundDiagnostics.deadLetter?.openCount || 0) === 0"
                @click="scrollToDeadLetterInspector()"
              >
                <p class="text-[11px] text-amber-800 dark:text-amber-300">{{ t('settings.integrationsOpenDeadLetters') }}</p>
                <p class="text-sm font-semibold text-amber-900 dark:text-amber-200">{{ Number(inboundDiagnostics.deadLetter?.openCount || 0) }}</p>
                <p class="text-[10px] text-amber-700/80 dark:text-amber-400 mt-0.5">{{ t('settings.integrationsClickOpenInspector') }}</p>
              </button>
            </div>

            <div v-if="(inboundDiagnostics.deadLetter?.recent || []).length > 0" class="mb-4">
              <div class="flex items-center justify-between gap-2 mb-2">
                <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('settings.integrationsRecentOpenDeadLetters') }}</p>
                <button
                  type="button"
                  class="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  @click="scrollToDeadLetterInspector()"
                >
                  {{ t('settings.integrationsOpenInspector') }}
                </button>
              </div>
              <div class="space-y-2 max-h-40 overflow-auto pr-1">
                <div
                  v-for="dl in inboundDiagnostics.deadLetter.recent"
                  :key="`diag-dl-${dl._id}`"
                  class="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 flex items-start justify-between gap-2"
                >
                  <div class="min-w-0">
                    <p class="text-[11px] font-semibold text-gray-900 dark:text-white">{{ dl.stage || '—' }}</p>
                    <p class="text-[10px] text-gray-600 dark:text-gray-300 mt-0.5 break-words line-clamp-2">{{ dl.reason || dl.error || '—' }}</p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{{ formatCheckedAt(dl.createdAt) }}</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    @click="scrollToDeadLetterInspector(dl._id)"
                  >
                    {{ t('settings.integrationsFocus') }}
                  </button>
                </div>
              </div>
            </div>

            <div class="mb-4">
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">{{ t('settings.integrationsThreadStrategyBreakdown') }}</p>
              <div v-if="inboundDiagnostics.threadStrategyBreakdown.length > 0" class="flex flex-wrap gap-2">
                <span
                  v-for="row in inboundDiagnostics.threadStrategyBreakdown"
                  :key="`inbound-strategy-${row.strategy}`"
                  class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                >
                  {{ row.strategy }}: {{ row.count }}
                </span>
              </div>
              <p v-else class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.integrationsNoInboundThreading') }}</p>
            </div>

            <div>
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">{{ t('settings.integrationsRecentInboundEvents') }}</p>
              <div v-if="inboundDiagnostics.recentEvents.length > 0" class="space-y-2 max-h-56 overflow-auto pr-1">
                <div
                  v-for="evt in inboundDiagnostics.recentEvents"
                  :key="`inbound-evt-${evt._id}`"
                  class="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-semibold text-gray-900 dark:text-white">{{ evt.eventType }}</span>
                    <span class="text-[11px] text-gray-500 dark:text-gray-400">{{ formatCheckedAt(evt.createdAt) }}</span>
                  </div>
                  <p class="text-[11px] text-gray-600 dark:text-gray-300 mt-1">
                    {{ t('settings.integrationsEventSourcePrefix') }} {{ evt.source }}<span v-if="evt.payload?.strategy"> | {{ t('settings.integrationsEventStrategyPrefix') }} {{ evt.payload.strategy }}</span>
                  </p>
                  <p v-if="evt.payload?.error" class="text-[11px] text-red-700 dark:text-red-300 mt-1 break-words">
                    {{ t('settings.integrationsEventErrorPrefix') }} {{ evt.payload.error }}
                  </p>
                </div>
              </div>
              <p v-else class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.integrationsNoInboundEvents') }}</p>
            </div>
          </div>

          <div
            id="inbound-dead-letter-inspector"
            ref="deadLetterInspectorRef"
            class="rounded-lg border border-gray-200 p-4 dark:border-gray-700 scroll-mt-4"
          >
            <div class="flex items-center justify-between gap-3 mb-3">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.integrationsDeadLetterInspectorTitle') }}</h4>
              <div class="flex flex-wrap items-center justify-end gap-2">
                <label class="inline-flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                  <input v-model="inboundIncludeResolved" type="checkbox" class="rounded border-gray-300 dark:border-gray-600" />
                  {{ t('settings.integrationsIncludeResolved') }}
                </label>
                <button
                  type="button"
                  @click="exportInboundDeadLettersCsv"
                  :disabled="inboundDeadLetters.length === 0"
                  class="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ t('settings.integrationsExportCsv') }}
                </button>
                <button
                  type="button"
                  @click="loadInboundDeadLetters"
                  :disabled="loadingInboundDeadLetters"
                  class="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ loadingInboundDeadLetters ? t('settings.integrationsRefreshing') : t('settings.integrationsRefresh') }}
                </button>
              </div>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
              {{ t('settings.integrationsDeadLetterReviewHint') }}
            </p>
            <div v-if="inboundDeadLetters.length > 0" class="space-y-2 max-h-72 overflow-auto pr-1">
              <div
                v-for="item in inboundDeadLetters"
                :key="`dead-letter-${item._id}`"
                :class="[
                  'rounded border px-3 py-2 flex items-start justify-between gap-3 transition-shadow',
                  String(item._id) === highlightedDeadLetterId
                    ? 'border-indigo-500 ring-2 ring-indigo-400/50 dark:ring-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40'
                ]"
              >
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-semibold text-gray-900 dark:text-white">{{ item.stage || 'unknown_stage' }}</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                      {{ t('settings.integrationsReplayCount') }} {{ Number(item.replayCount || 0) }}
                    </span>
                    <span
                      v-if="item.resolvedAt"
                      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                    >
                      {{ t('settings.integrationsResolvedBadge') }}
                    </span>
                    <span
                      v-if="deadLetterReplayOutcomeFor(item)?.outcome === 'success'"
                      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
                      :title="t('settings.integrationsLastReplaySucceeded')"
                    >
                      {{ t('settings.integrationsReplayOk') }}
                    </span>
                    <span
                      v-else-if="deadLetterReplayOutcomeFor(item)?.outcome === 'error'"
                      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 max-w-[200px] truncate"
                      :title="deadLetterReplayOutcomeFor(item)?.message || t('settings.integrationsNotifyReplayFailed')"
                    >
                      {{ t('settings.integrationsReplayFailed') }}
                    </span>
                  </div>
                  <p class="text-[11px] text-gray-600 dark:text-gray-300 mt-1 break-words">
                    {{ item.reason || item.error || t('settings.integrationsNoReasonProvided') }}
                  </p>
                  <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    {{ t('settings.integrationsCreatedPrefix') }} {{ formatCheckedAt(item.createdAt) }}
                    <span v-if="item.lastReplayAt"> | {{ t('settings.integrationsLastReplayPrefix') }} {{ formatCheckedAt(item.lastReplayAt) }}</span>
                  </p>
                </div>
                <button
                  type="button"
                  @click="replayInboundDeadLetter(item)"
                  :disabled="!isOwnerLike || replayingDeadLetterId === item._id || item.resolvedAt"
                  class="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                >
                  {{ replayingDeadLetterId === item._id ? t('settings.integrationsReplaying') : t('settings.integrationsReplay') }}
                </button>
              </div>
            </div>
            <p v-else class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.integrationsNoDeadLetterEntries') }}</p>
            <p v-if="!isOwnerLike" class="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
              {{ t('settings.integrationsOwnerOnlyReplay') }}
            </p>
          </div>

          <div
            class="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
          >
            <div class="flex items-center justify-between gap-3 mb-3">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.integrationsSuppressedRecipientsTitle') }}</h4>
              <button
                type="button"
                @click="loadSuppressions"
                :disabled="loadingSuppressions"
                class="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ loadingSuppressions ? t('settings.integrationsRefreshing') : t('settings.integrationsRefresh') }}
              </button>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
              {{ t('settings.integrationsSuppressedDesc') }}
            </p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
              <div class="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2">
                <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('settings.integrationsActiveTotal') }}</p>
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ suppressionStats.activeTotal }}</p>
              </div>
              <div class="rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                <p class="text-[11px] text-amber-800 dark:text-amber-300">{{ t('settings.integrationsBounced') }}</p>
                <p class="text-sm font-semibold text-amber-900 dark:text-amber-200">{{ suppressionStats.byReason.bounced }}</p>
              </div>
              <div class="rounded-md border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-3 py-2">
                <p class="text-[11px] text-red-800 dark:text-red-300">{{ t('settings.integrationsComplained') }}</p>
                <p class="text-sm font-semibold text-red-900 dark:text-red-200">{{ suppressionStats.byReason.complained }}</p>
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
              <label class="text-xs">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">{{ t('settings.integrationsSearchEmail') }}</span>
                <input
                  v-model.trim="suppressionSearch"
                  type="text"
                  :placeholder="t('settings.integrationsPlaceholderSearchEmail')"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2.5 py-1.5"
                />
              </label>
              <label class="text-xs">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">{{ t('settings.integrationsReasonFilter') }}</span>
                <select
                  v-model="suppressionReasonFilter"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2.5 py-1.5"
                >
                  <option value="all">{{ t('settings.integrationsReasonAll') }}</option>
                  <option value="bounced">{{ t('settings.integrationsReasonBounced') }}</option>
                  <option value="complained">{{ t('settings.integrationsReasonComplained') }}</option>
                </select>
              </label>
              <div class="text-xs text-gray-600 dark:text-gray-400 flex items-end">
                {{ t('settings.integrationsShowingCount', { shown: filteredSuppressionRows.length, total: suppressionRows.length }) }}
              </div>
            </div>
            <div v-if="filteredSuppressionRows.length > 0" class="space-y-2 max-h-56 overflow-auto pr-1">
              <div
                v-for="row in filteredSuppressionRows"
                :key="`sup-${row.email}`"
                class="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2 flex items-center justify-between gap-3"
              >
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-gray-900 dark:text-white break-all">{{ row.email }}</p>
                  <p class="text-[11px] text-gray-600 dark:text-gray-300 mt-1">
                    {{ t('settings.integrationsSuppressionReasonPrefix') }}
                    <span :class="['inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ml-1', suppressionReasonClass(row.reason)]">
                      {{ row.reason }}
                    </span>
                    <span class="ml-2">{{ t('settings.integrationsSuppressionLastEventPrefix') }} {{ formatCheckedAt(row.lastEventAt) }}</span>
                  </p>
                </div>
                <button
                  type="button"
                  @click="removeSuppressedRecipient(row.email)"
                  :disabled="!isOwnerLike || removingSuppressionEmail === row.email"
                  class="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                >
                  {{ removingSuppressionEmail === row.email ? t('settings.integrationsRemoving') : t('actions.remove') }}
                </button>
              </div>
            </div>
            <p v-else class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.integrationsNoSuppressedMatch') }}</p>
            <p v-if="!isOwnerLike" class="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
              {{ t('settings.integrationsOwnerOnlyRemoveSuppression') }}
            </p>
          </div>

          <div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">{{ t('settings.integrationsWebhookSimulatorTitle') }}</h4>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
              {{ t('settings.integrationsWebhookSimulatorDesc') }}
            </p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label class="text-sm">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">{{ t('settings.integrationsEventType') }}</span>
                <select
                  v-model="webhookSim.eventType"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                >
                  <option v-for="evt in webhookTemplates.supportedEventTypes" :key="`sim-${evt}`" :value="evt">{{ evt }}</option>
                </select>
              </label>
              <label class="text-sm">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">{{ t('settings.integrationsProviderLabelSim') }}</span>
                <input
                  v-model="webhookSim.provider"
                  type="text"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                  :placeholder="t('settings.integrationsPlaceholderWebhookProvider')"
                />
              </label>
              <div class="text-sm">
                <span class="block mb-1 text-gray-700 dark:text-gray-300">{{ t('settings.integrationsTargetMessage') }}</span>
                <p class="text-xs text-gray-600 dark:text-gray-400 break-all">
                  {{ webhookTemplates.latestExternalMessageId || t('settings.integrationsNoSentMessageYet') }}
                </p>
              </div>
            </div>
            <div class="mt-3">
              <button
                type="button"
                @click="runWebhookSimulation"
                :disabled="simulatingWebhook || (!webhookTemplates.latestCommunicationId && !webhookTemplates.latestExternalMessageId)"
                class="px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ simulatingWebhook ? t('settings.integrationsSimulatingWebhook') : t('settings.integrationsSimulateWebhook') }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <SettingsSaveBar
      :visible="emailSettingsDirty"
      :saving="savingConfig || savingGmailOAuthConfig"
      @reset="resetEmailSettings"
      @save="handleEmailSettingsSave"
    />
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import EmailPolicyCreditsPanel from '@/components/settings/EmailPolicyCreditsPanel.vue';
import PersonalSmtpSendersCard from '@/components/settings/PersonalSmtpSendersCard.vue';
import { computed, ref, onBeforeUnmount, watch, nextTick, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import { useNotifications } from '@/composables/useNotifications';

import { confirmAction } from '@/composables/useConfirmAction';
import { formatUserDateTime } from '@/utils/localeFormat';
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();

const INTEGRATION_KEYS = ['email-provider', 'calendar-sync', 'chat-notifications', 'webhooks'];

const EmailProviderIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  }),
]);

const CalendarSyncIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  }),
]);

const ChatNotificationsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  }),
]);

const WebhooksIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  }),
]);

const DefaultIntegrationIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z',
  }),
]);

const integrationIconMap = {
  'email-provider': { icon: EmailProviderIcon, iconBg: 'bg-gradient-to-br from-sky-500 to-sky-600' },
  'calendar-sync': { icon: CalendarSyncIcon, iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600' },
  'chat-notifications': { icon: ChatNotificationsIcon, iconBg: 'bg-gradient-to-br from-violet-500 to-violet-600' },
  webhooks: { icon: WebhooksIcon, iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600' },
};

function getIntegrationIconMeta(key) {
  return integrationIconMap[key] || { icon: DefaultIntegrationIcon, iconBg: 'bg-gradient-to-br from-gray-500 to-gray-600' };
}

const currentView = computed(() => {
  const view = route.query.integrationView;
  if (typeof view === 'string' && INTEGRATION_KEYS.includes(view)) {
    return view;
  }
  return 'overview';
});

function navigateToOverview() {
  const query = { ...route.query, tab: 'integrations' };
  delete query.integrationView;
  router.push({ path: '/settings', query });
}

function navigateToIntegration(integration) {
  router.push({
    path: '/settings',
    query: { ...route.query, tab: 'integrations', integrationView: integration.key },
  });
}

function integrationStatusLabel(enabled) {
  return enabled ? t('settings.settingsAppsStatusEnabled') : t('settings.settingsAppsStatusDisabled');
}

function scopeBadgeLabel(scope) {
  return scope === 'platform' ? t('settings.integrationsScopePlatform') : t('settings.integrationsScopeApp');
}

function connectionStatusMessage(enabled) {
  return enabled ? t('settings.integrationsConnectionActive') : t('settings.integrationsConnectionInactive');
}

const smtpHostPlaceholder = computed(() =>
  emailConfig.value.provider === 'oci-email-delivery'
    ? t('settings.integrationsPlaceholderSmtpHostOci')
    : t('settings.integrationsPlaceholderSmtpHostResend')
);

const emailProviderUsesSmtp = computed(
  () => !['aws-ses', 'amds'].includes(String(emailConfig.value.provider || '').toLowerCase())
);

const amdsDomainInput = ref('');
const amdsDomainLoading = ref(false);
const amdsDomainResult = ref(null);

const amdsServerConfigured = computed(() => {
  if (selectedIntegration.value?.amdsServerConfigured === true) return true;
  const fromList = integrations.value.find((item) => item.key === 'email-provider');
  return fromList?.amdsServerConfigured === true;
});

const smtpPortPlaceholder = computed(() =>
  emailConfig.value.provider === 'oci-email-delivery'
    ? t('settings.integrationsPlaceholderSmtpPortOci')
    : t('settings.integrationsPlaceholderSmtpPortDefault')
);

const smtpUserPlaceholder = computed(() =>
  emailConfig.value.provider === 'oci-email-delivery'
    ? t('settings.integrationsPlaceholderSmtpUserOci')
    : t('settings.integrationsPlaceholderSmtpUserResend')
);

const gmailClientSecretPlaceholder = computed(() =>
  communicationPolicy.value.gmailInboxSync.hasClientSecret
    ? t('settings.integrationsClientSecretReplace')
    : t('settings.integrationsClientSecretRequired')
);
const isOwnerLike = computed(() => authStore.isOwner || String(authStore.userRole || '').toLowerCase() === 'owner');
// Gmail OAuth client credentials are an Arivu-platform concern (they identify the
// Google Cloud project that owns the consent screen), not a per-tenant setting.
// The Advanced override block is therefore visible only to platform admins — customer
// workspace owners just see the "Ready for users" / "Not enabled" status above it.
/** Who may edit Advanced Gmail OAuth fields or save them (aligns with API). */
const canManageGmailOAuthApp = computed(() => authStore.isOwner === true || authStore.isPlatformAdmin === true);

const integrations = ref([]);
const selectedIntegration = ref(null);
const activeDetailTab = ref('setup');

const EMAIL_DETAIL_TABS = [
  { id: 'setup', labelKey: 'settings.integrationsTabSetup' },
  { id: 'policy', labelKey: 'settings.integrationsTabPolicy' },
  { id: 'credits', labelKey: 'settings.integrationsTabCredits' },
  { id: 'domain', labelKey: 'settings.integrationsTabDomain' },
  { id: 'diagnostics', labelKey: 'settings.integrationsTabDiagnostics' },
];

function extractDomainFromEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return normalized.includes('@') ? normalized.split('@')[1] : '';
}

function resolveEmailProvider(cfg, integration = {}) {
  const normalized = String(cfg?.provider || '').trim().toLowerCase();
  if (normalized) return normalized;
  if (integration.amdsServerConfigured === true) return 'amds';
  return integration.emailPlatformDefaults?.crmOutboundProvider || 'resend';
}

const EMPTY_EMAIL_DOMAIN_VERIFICATION = {
  domain: '',
  checkedAt: null,
  senderIdentity: {
    status: 'missing_sender',
    note: 'Set a valid From Email to evaluate sender domain.',
  },
  spf: { status: 'missing_sender', note: 'No sender domain available.' },
  dkim: { status: 'missing_sender', note: 'No sender domain available.' },
  dmarc: { status: 'missing_sender', note: 'No sender domain available.' },
};

function patchEmailDomainVerification(integration = {}) {
  if (integration.emailDomainVerification) return integration;
  const domain = extractDomainFromEmail(integration.emailConfig?.fromEmail);
  if (!domain) {
    return {
      ...integration,
      emailDomainVerification: { ...EMPTY_EMAIL_DOMAIN_VERIFICATION },
    };
  }
  return {
    ...integration,
    emailDomainVerification: {
      domain,
      checkedAt: null,
      senderIdentity: { status: 'not_checked', note: '' },
      spf: { status: 'not_checked', note: '' },
      dkim: { status: 'not_checked', note: '' },
      dmarc: { status: 'not_checked', note: '' },
    },
  };
}

const detailTabs = computed(() => {
  const integration = selectedIntegration.value;
  if (!integration) return [];
  if (integration.key === 'email-provider') {
    return EMAIL_DETAIL_TABS;
  }
  return [{ id: 'general', labelKey: 'settings.integrationsTabGeneral' }];
});

const displayEmailDomainVerification = computed(() => {
  const integration = selectedIntegration.value;
  const patched = patchEmailDomainVerification({
    ...(integration || {}),
    emailConfig: {
      ...(integration?.emailConfig || {}),
      fromEmail: integration?.emailConfig?.fromEmail || emailConfig.value.fromEmail,
    },
  });
  return patched.emailDomainVerification || EMPTY_EMAIL_DOMAIN_VERIFICATION;
});

watch(
  () => selectedIntegration.value?.key,
  (key) => {
    activeDetailTab.value = key === 'email-provider' ? 'setup' : 'general';
  },
);

watch(detailTabs, (tabs) => {
  if (!tabs.some((tab) => tab.id === activeDetailTab.value)) {
    activeDetailTab.value = tabs[0]?.id || 'setup';
  }
});

const loading = ref(true);
const detailLoading = ref(false);
const error = ref(null);
const actionLoading = ref(false);
const testEmailLoading = ref(false);
const savingConfig = ref(false);
const savingGmailOAuthConfig = ref(false);
const emailSettingsSnapshot = ref('');
const checkingDomainStatus = ref(false);
const emailDiagnosticsLoaded = ref(false);
const emailPolicyLoaded = ref(false);
const emailSetupHydrated = ref(false);
const loadingEmailPolicy = ref(false);
const loadingDiagnostics = ref(false);
const diagnostics = ref({
  failureBreakdown: [],
  recentEvents: []
});
const loadingInboundDiagnostics = ref(false);
const inboundDiagnostics = ref({
  queue: null,
  recentEvents: [],
  threadStrategyBreakdown: [],
  deadLetter: {
    openCount: 0,
    recent: []
  }
});
const loadingInboundDeadLetters = ref(false);
const replayingDeadLetterId = ref('');
/** @type {import('vue').Ref<Record<string, { outcome: 'success'|'error', message?: string }>>} */
const deadLetterReplayOutcomes = ref({});
const inboundDeadLetters = ref([]);
const inboundIncludeResolved = ref(false);
const deadLetterInspectorRef = ref(null);
/** Highlight a row in the inspector after jumping from diagnostics (`id` string). */
const highlightedDeadLetterId = ref(null);
let deadLetterHighlightClearTimer = null;
const webhookTemplates = ref({
  latestCommunicationId: '',
  latestExternalMessageId: '',
  supportedEventTypes: ['delivered', 'opened', 'bounced', 'complained']
});
const webhookSim = ref({
  eventType: 'delivered',
  provider: 'simulator'
});
const simulatingWebhook = ref(false);
const loadingSuppressions = ref(false);
const removingSuppressionEmail = ref('');
const suppressionRows = ref([]);
const suppressionSearch = ref('');
const suppressionReasonFilter = ref('all');
const suppressionStats = ref({
  activeTotal: 0,
  byReason: { bounced: 0, complained: 0 }
});
const emailConfig = ref({
  provider: 'amds',
  fromEmail: '',
  fromName: '',
  replyTo: '',
  ociRegion: '',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  smtpSecure: false,
  smtpPassMasked: '',
  hasSmtpPass: false,
  awsRegion: '',
  awsAccessKeyId: '',
  awsSecretAccessKey: '',
  awsSecretAccessKeyMasked: '',
  hasAwsSecretAccessKey: false
});

const buildOciSmtpHost = (region) => {
  const normalized = String(region || '').trim().toLowerCase();
  if (!normalized) return '';
  return `smtp.email.${normalized}.oci.oraclecloud.com`;
};

const isOciSmtpHost = (host) => {
  const value = String(host || '').toLowerCase();
  return value.includes('email.') && value.includes('.oci.oraclecloud.com');
};

const isResendLikeSmtpConfig = (cfg) => {
  const host = String(cfg?.smtpHost || '').toLowerCase();
  const user = String(cfg?.smtpUser || '').toLowerCase();
  return host.includes('resend.com') || user === 'resend';
};

const applyAmdsDefaults = ({ providerJustChanged = false } = {}) => {
  if (emailConfig.value.provider !== 'amds') return;
  if (providerJustChanged) {
    notifications.info(t('settings.integrationsNotifyAmdsSelected'));
  }
};

const copyAmdsDnsValue = async (value) => {
  try {
    await navigator.clipboard.writeText(String(value || ''));
    notifications.success(t('settings.integrationsAmdsDnsCopied'));
  } catch {
    notifications.error(t('settings.integrationsAmdsDnsCopyFailed'));
  }
};

const registerAmdsDomain = async () => {
  const domain = String(amdsDomainInput.value || '').trim().toLowerCase();
  if (!domain) return;
  amdsDomainLoading.value = true;
  try {
    const data = await apiClient('/settings/email/domains', {
      method: 'POST',
      body: JSON.stringify({ domain })
    });
    amdsDomainResult.value = data?.data || null;
    notifications.success(t('settings.integrationsAmdsDomainRegistered'));
  } catch (err) {
    notifications.error(err?.message || t('settings.integrationsAmdsDomainRegisterFailed'));
  } finally {
    amdsDomainLoading.value = false;
  }
};

const loadAmdsDomain = async (domain) => {
  const normalized = String(domain || '').trim().toLowerCase();
  if (!normalized) return;
  amdsDomainLoading.value = true;
  try {
    const data = await apiClient(`/settings/email/domains/${encodeURIComponent(normalized)}`, {
      method: 'GET'
    });
    amdsDomainResult.value = data?.data || null;
  } catch (err) {
    amdsDomainResult.value = null;
    console.warn('[IntegrationsSettings] loadAmdsDomain', err);
  } finally {
    amdsDomainLoading.value = false;
  }
};

const verifyAmdsDomain = async () => {
  const domain = String(amdsDomainResult.value?.domain || amdsDomainInput.value || '').trim().toLowerCase();
  if (!domain) return;
  amdsDomainLoading.value = true;
  try {
    const data = await apiClient(`/settings/email/domains/${encodeURIComponent(domain)}/verify`, {
      method: 'POST'
    });
    amdsDomainResult.value = data?.data || amdsDomainResult.value;
    if (amdsDomainResult.value?.status === 'verified') {
      notifications.success(t('settings.integrationsAmdsDomainVerifySuccess'));
    } else {
      notifications.info(t('settings.integrationsAmdsDomainVerifyPending'));
    }
  } catch (err) {
    notifications.error(err?.message || t('settings.integrationsAmdsDomainVerifyFailed'));
  } finally {
    amdsDomainLoading.value = false;
  }
};

const applyResendDefaults = ({ providerJustChanged = false } = {}) => {
  if (emailConfig.value.provider !== 'resend') return;
  emailConfig.value.smtpHost = 'smtp.resend.com';
  emailConfig.value.smtpPort = 587;
  emailConfig.value.smtpUser = 'resend';
  emailConfig.value.smtpSecure = false;
  if (providerJustChanged) {
    notifications.info(t('settings.integrationsNotifyResendSelected'));
  }
};

const applyGmailSmtpDefaults = ({ providerJustChanged = false } = {}) => {
  if (emailConfig.value.provider !== 'gmail-smtp') return;
  emailConfig.value.smtpHost = 'smtp.gmail.com';
  emailConfig.value.smtpPort = 587;
  emailConfig.value.smtpSecure = false;
  if (providerJustChanged) {
    notifications.info(t('settings.integrationsNotifyGmailSmtpSelected'));
  }
};

const applyOciEmailDefaults = ({ providerJustChanged = false } = {}) => {
  if (emailConfig.value.provider !== 'oci-email-delivery') return;

  // OCI Email Delivery: implicit TLS on port 465 only (not 587 + STARTTLS).
  emailConfig.value.smtpPort = 465;
  emailConfig.value.smtpSecure = true;

  const ociHost = buildOciSmtpHost(emailConfig.value.ociRegion);
  if (ociHost && !isOciSmtpHost(emailConfig.value.smtpHost)) {
    emailConfig.value.smtpHost = ociHost;
  }

  if (providerJustChanged || isResendLikeSmtpConfig(emailConfig.value)) {
    if (String(emailConfig.value.smtpUser || '').toLowerCase() === 'resend') {
      emailConfig.value.smtpUser = '';
    }
    if (providerJustChanged && emailConfig.value.hasSmtpPass) {
      emailConfig.value.smtpPass = '';
      emailConfig.value.hasSmtpPass = false;
      emailConfig.value.smtpPassMasked = '';
      notifications.info(t('settings.integrationsNotifyOciProviderChanged'));
    }
  }
};
const communicationPolicy = ref({
  outboundEmail: {
    enabled: true,
    maxRecipientsPerMessage: 50,
    allowWorkspaceEmail: true,
    disallowPlatformSmtpForWorkspace: false,
    requireMailboxProviderForAgentSend: false,
    requireIdempotencyKey: false,
    allowedModuleKeys: ['people', 'organizations', 'deals', 'tasks', 'cases', 'workspace'],
    suppression: {
      autoSuppressOnBounce: true,
      autoSuppressOnComplaint: true
    }
  },
  supportedModuleKeys: ['people', 'organizations', 'deals', 'tasks', 'cases', 'workspace'],
  gmailInboxSync: {
    clientId: '',
    redirectUri: '',
    clientSecret: '',
    hasClientSecret: false
  }
});
const emailCriticalFieldsLocked = computed(() => !isOwnerLike.value);
const communicationPolicyLocked = computed(() => !isOwnerLike.value);

const inboundMimeWebhookUrl = computed(() => {
  if (typeof window === 'undefined') return '/api/webhooks/email/inbound';
  return `${window.location.origin}/api/webhooks/email/inbound`;
});

const copyInboundWebhookUrl = async () => {
  const url = inboundMimeWebhookUrl.value;
  try {
    await navigator.clipboard.writeText(url);
    notifications.success(t('settings.integrationsNotifyWebhookUrlCopied'));
  } catch (err) {
    console.error(err);
    notifications.error(t('settings.integrationsNotifyUnableCopyUrl'));
  }
};

const copyInboundWebhookCurlExample = async () => {
  const url = inboundMimeWebhookUrl.value;
  const lines = [
    `curl -X POST '${url}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Authorization: Bearer YOUR_EMAIL_INBOUND_WEBHOOK_SECRET' \\`,
    `  -H 'X-Organization-Id: YOUR_WORKSPACE_ORG_ID' \\`,
    `  -d '{"rawMime":"<paste base64-encoded .eml>"}'`,
    '',
    '# Omit Authorization when EMAIL_INBOUND_WEBHOOK_SECRET is unset on the server.'
  ];
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    notifications.success(t('settings.integrationsNotifyCurlCopied'));
  } catch (err) {
    console.error(err);
    notifications.error(t('settings.integrationsNotifyUnableCopyCurl'));
  }
};

const verificationStatusClass = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'configured') return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
  if (value === 'missing' || value === 'no_record' || value === 'missing_sender' || value === 'unverified') {
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
  }
  if (value === 'dns_unreachable' || value === 'lookup_error') {
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
};

const needsDomainVerification = () => {
  const verification = selectedIntegration.value?.emailDomainVerification;
  if (!verification?.domain) return false;
  return !verification.checkedAt || verification.spf?.status === 'not_checked';
};

function suggestedSenderDomain() {
  return extractDomainFromEmail(emailConfig.value.fromEmail)
    || displayEmailDomainVerification.value?.domain
    || '';
}

function prepareDomainTab() {
  if (emailConfig.value.provider === 'amds') {
    const suggested = suggestedSenderDomain();
    if (!amdsDomainInput.value && suggested) {
      amdsDomainInput.value = suggested;
    }
    const loadDomain = String(amdsDomainResult.value?.domain || amdsDomainInput.value || '').trim();
    if (loadDomain && amdsServerConfigured.value) {
      void loadAmdsDomain(loadDomain);
    }
    return;
  }
  if (needsDomainVerification()) {
    void checkEmailDomainStatus();
  }
}

function applyEmailProviderIntegration(integration) {
  const patched = patchEmailDomainVerification(integration);
  selectedIntegration.value = {
    ...(selectedIntegration.value || { key: 'email-provider' }),
    ...patched,
    amdsServerConfigured: integration.amdsServerConfigured === true,
  };
  applyEmailSetupFromIntegration(patched);
  applyEmailPolicyFromIntegration(patched);
  emailSetupHydrated.value = true;
  emailPolicyLoaded.value = true;
  captureEmailSettingsSnapshot();
  const idx = integrations.value.findIndex((i) => i.key === 'email-provider');
  if (idx !== -1) {
    integrations.value[idx] = { ...integrations.value[idx], ...patched };
  }
  return patched;
}

const loadEmailPolicyData = async () => {
  if (emailPolicyLoaded.value || loadingEmailPolicy.value) return;
  if (selectedIntegration.value?.communicationPolicy) {
    applyEmailPolicyFromIntegration(selectedIntegration.value);
    emailPolicyLoaded.value = true;
    return;
  }
  loadingEmailPolicy.value = true;
  try {
    const data = await apiClient('/settings/integrations/email-provider', {
      method: 'GET',
      cache: 'no-store',
      params: { scope: 'policy', _t: Date.now() },
    });
    if (data?.success && data.integration) {
      applyEmailPolicyFromIntegration(data.integration);
      selectedIntegration.value = {
        ...(selectedIntegration.value || { key: 'email-provider' }),
        ...data.integration,
      };
      emailPolicyLoaded.value = true;
      captureEmailSettingsSnapshot();
    }
  } catch (err) {
    console.error('Failed to load email policy settings:', err);
  } finally {
    loadingEmailPolicy.value = false;
  }
};

const loadEmailDiagnosticsData = async () => {
  if (!selectedIntegration.value || selectedIntegration.value.key !== 'email-provider') return;
  await Promise.all([
    loadWebhookTemplates(),
    loadPipelineDiagnostics(),
    loadInboundDiagnostics(),
    loadInboundDeadLetters(),
    loadSuppressions(),
  ]);
  emailDiagnosticsLoaded.value = true;
};

const checkEmailDomainStatus = async () => {
  if (!selectedIntegration.value || selectedIntegration.value.key !== 'email-provider') return;
  checkingDomainStatus.value = true;
  try {
    const data = await apiClient('/settings/integrations/email-provider', {
      method: 'GET',
      cache: 'no-store',
      params: { _t: Date.now(), verifyDomain: '1', scope: 'setup' },
    });
    if (data?.success && data.integration?.emailDomainVerification) {
      selectedIntegration.value = {
        ...selectedIntegration.value,
        emailDomainVerification: data.integration.emailDomainVerification,
      };
    }
  } catch (err) {
    console.error('Failed to refresh email domain verification status:', err);
    notifications.error(t('settings.integrationsNotifyDomainRefreshFailed'));
  } finally {
    checkingDomainStatus.value = false;
  }
};

const failureCategoryClass = (category) => {
  const value = String(category || '').toLowerCase();
  if (value === 'auth_error' || value === 'config_error') {
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
  }
  if (value === 'network_error' || value === 'provider_rejected' || value === 'attachment_error') {
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
};

const suppressionReasonClass = (reason) => {
  const value = String(reason || '').toLowerCase();
  if (value === 'complained') {
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
  }
  if (value === 'bounced') {
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
};

const filteredSuppressionRows = computed(() => {
  const query = String(suppressionSearch.value || '').trim().toLowerCase();
  const reason = String(suppressionReasonFilter.value || 'all').toLowerCase();
  return suppressionRows.value.filter((row) => {
    const rowEmail = String(row?.email || '').toLowerCase();
    const rowReason = String(row?.reason || '').toLowerCase();
    const matchesQuery = !query || rowEmail.includes(query);
    const matchesReason = reason === 'all' || rowReason === reason;
    return matchesQuery && matchesReason;
  });
});

const loadSuppressionStats = async () => {
  if (!selectedIntegration.value || selectedIntegration.value.key !== 'email-provider') return;
  try {
    const data = await apiClient('/communications/suppressions/stats', { method: 'GET' });
    suppressionStats.value = {
      activeTotal: Number(data?.data?.activeTotal) || 0,
      byReason: {
        bounced: Number(data?.data?.byReason?.bounced) || 0,
        complained: Number(data?.data?.byReason?.complained) || 0
      }
    };
  } catch (err) {
    console.error('Failed to load suppression stats:', err);
    suppressionStats.value = {
      activeTotal: 0,
      byReason: { bounced: 0, complained: 0 }
    };
  }
};

const loadSuppressions = async () => {
  if (!selectedIntegration.value || selectedIntegration.value.key !== 'email-provider') return;
  loadingSuppressions.value = true;
  try {
    const data = await apiClient('/communications/suppressions', { method: 'GET' });
    suppressionRows.value = Array.isArray(data?.data?.suppressions) ? data.data.suppressions : [];
  } catch (err) {
    console.error('Failed to load suppression list:', err);
    suppressionRows.value = [];
  } finally {
    loadingSuppressions.value = false;
  }
  await loadSuppressionStats();
};

const removeSuppressedRecipient = async (email) => {
  if (!email) return;
  if (!isOwnerLike.value) {
    notifications.error(t('settings.integrationsNotifyOwnerOnlyRemoveSuppression'));
    return;
  }
  const ok = await confirmAction(t('settings.integrationsConfirmRemoveSuppression', { email }));
  if (!ok) return;
  removingSuppressionEmail.value = email;
  try {
    const data = await apiClient(`/communications/suppressions/${encodeURIComponent(email)}`, {
      method: 'DELETE'
    });
    if (data?.success) {
      suppressionRows.value = suppressionRows.value.filter((row) => row.email !== email);
      await loadSuppressionStats();
      notifications.success(t('settings.integrationsNotifySuppressionRemoved'));
    } else {
      notifications.error(data?.message || t('settings.integrationsNotifyRemoveSuppressionFailed'));
    }
  } catch (err) {
    console.error('Failed to remove suppression entry:', err);
    notifications.error(err?.response?.data?.message || err?.message || t('settings.integrationsNotifyRemoveSuppressionFailed'));
  } finally {
    removingSuppressionEmail.value = '';
  }
};

const loadPipelineDiagnostics = async () => {
  if (!selectedIntegration.value || selectedIntegration.value.key !== 'email-provider') return;
  loadingDiagnostics.value = true;
  try {
    const data = await apiClient('/communications/pipeline-diagnostics', { method: 'GET' });
    diagnostics.value = {
      failureBreakdown: data?.data?.failureBreakdown || [],
      recentEvents: data?.data?.recentEvents || []
    };
  } catch (err) {
    console.error('Failed to load communication diagnostics:', err);
    diagnostics.value = { failureBreakdown: [], recentEvents: [] };
  } finally {
    loadingDiagnostics.value = false;
  }
};

const loadInboundDiagnostics = async () => {
  if (!selectedIntegration.value || selectedIntegration.value.key !== 'email-provider') return;
  loadingInboundDiagnostics.value = true;
  try {
    const data = await apiClient('/communications/inbound/diagnostics', { method: 'GET' });
    inboundDiagnostics.value = {
      queue: data?.data?.queue || null,
      recentEvents: Array.isArray(data?.data?.recentEvents) ? data.data.recentEvents : [],
      threadStrategyBreakdown: Array.isArray(data?.data?.threadStrategyBreakdown) ? data.data.threadStrategyBreakdown : [],
      deadLetter: {
        openCount: Number(data?.data?.deadLetter?.openCount) || 0,
        recent: Array.isArray(data?.data?.deadLetter?.recent) ? data.data.deadLetter.recent : []
      }
    };
  } catch (err) {
    console.error('Failed to load inbound diagnostics:', err);
    inboundDiagnostics.value = {
      queue: null,
      recentEvents: [],
      threadStrategyBreakdown: [],
      deadLetter: { openCount: 0, recent: [] }
    };
  } finally {
    loadingInboundDiagnostics.value = false;
  }
};

const loadInboundDeadLetters = async () => {
  if (!selectedIntegration.value || selectedIntegration.value.key !== 'email-provider') return;
  loadingInboundDeadLetters.value = true;
  try {
    const data = await apiClient('/communications/inbound/dead-letter', {
      method: 'GET',
      params: {
        includeResolved: inboundIncludeResolved.value ? 'true' : 'false',
        limit: 50
      }
    });
    inboundDeadLetters.value = Array.isArray(data?.data?.items) ? data.data.items : [];
    pruneDeadLetterReplayOutcomes();
  } catch (err) {
    console.error('Failed to load inbound dead letters:', err);
    inboundDeadLetters.value = [];
  } finally {
    loadingInboundDeadLetters.value = false;
  }
};

async function scrollToDeadLetterInspector(focusRawId = null) {
  activeDetailTab.value = 'diagnostics';
  if (deadLetterHighlightClearTimer) {
    clearTimeout(deadLetterHighlightClearTimer);
    deadLetterHighlightClearTimer = null;
  }
  highlightedDeadLetterId.value = focusRawId != null ? String(focusRawId) : null;
  await loadInboundDeadLetters();
  await nextTick();
  deadLetterInspectorRef.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  if (highlightedDeadLetterId.value) {
    deadLetterHighlightClearTimer = setTimeout(() => {
      highlightedDeadLetterId.value = null;
      deadLetterHighlightClearTimer = null;
    }, 6000);
  }
}

function csvEscapeCell(value) {
  const t = String(value ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function exportInboundDeadLettersCsv() {
  const rows = inboundDeadLetters.value || [];
  if (!rows.length) {
    notifications.warning(t('settings.integrationsNotifyNoDeadLettersExport'));
    return;
  }
  const headers = ['id', 'stage', 'reason', 'error', 'replayCount', 'resolvedAt', 'createdAt', 'lastReplayAt', 'rawSizeBytes'];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const picked = headers.map((h) => {
      const v = row[h];
      if (v === undefined || v === null) return '';
      if (typeof v === 'object' && v !== null && typeof v.toISOString === 'function') return v.toISOString();
      return v;
    });
    lines.push(picked.map(csvEscapeCell).join(','));
  }
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inbound-dead-letters-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  notifications.success(t('settings.integrationsNotifyDeadLettersExported'));
}

function pruneDeadLetterReplayOutcomes() {
  const ids = new Set((inboundDeadLetters.value || []).map((row) => deadLetterOutcomeKey(row?._id)).filter(Boolean));
  const prev = deadLetterReplayOutcomes.value;
  let next = prev;
  for (const key of Object.keys(prev)) {
    if (!ids.has(key)) {
      if (next === prev) next = { ...prev };
      delete next[key];
    }
  }
  deadLetterReplayOutcomes.value = next;
}

function deadLetterOutcomeKey(rawId) {
  return rawId != null ? String(rawId) : '';
}

function deadLetterReplayOutcomeFor(row) {
  const key = deadLetterOutcomeKey(row?._id);
  return key ? deadLetterReplayOutcomes.value[key] : null;
}

function setDeadLetterReplayOutcome(deadLetterId, outcome, message = '') {
  const id = deadLetterOutcomeKey(deadLetterId);
  if (!id) return;
  deadLetterReplayOutcomes.value = {
    ...deadLetterReplayOutcomes.value,
    [id]: { outcome, message: String(message || '').trim() }
  };
}

const replayInboundDeadLetter = async (item) => {
  const id = item?._id;
  if (!id) return;
  if (!isOwnerLike.value) {
    notifications.error(t('settings.integrationsNotifyOwnerOnlyReplay'));
    return;
  }
  replayingDeadLetterId.value = id;
  try {
    const data = await apiClient(`/communications/inbound/dead-letter/${encodeURIComponent(id)}/replay`, {
      method: 'POST'
    });
    if (data?.success) {
      notifications.success(t('settings.integrationsNotifyDeadLetterReplayed'));
      setDeadLetterReplayOutcome(id, 'success', '');
      await Promise.all([loadInboundDiagnostics(), loadInboundDeadLetters()]);
    } else {
      const msg = data?.message || t('settings.integrationsNotifyReplayFailed');
      notifications.error(msg);
      setDeadLetterReplayOutcome(id, 'error', msg);
    }
  } catch (err) {
    console.error('Failed to replay dead letter:', err);
    const msg = err?.response?.data?.message || err?.message || t('settings.integrationsNotifyReplayFailed');
    notifications.error(msg);
    setDeadLetterReplayOutcome(id, 'error', msg);
  } finally {
    replayingDeadLetterId.value = '';
  }
};

const loadWebhookTemplates = async () => {
  if (!selectedIntegration.value || selectedIntegration.value.key !== 'email-provider') return;
  try {
    const data = await apiClient('/communications/webhook-test/templates', { method: 'GET' });
    webhookTemplates.value = {
      latestCommunicationId: data?.data?.latestCommunicationId || '',
      latestExternalMessageId: data?.data?.latestExternalMessageId || '',
      supportedEventTypes: data?.data?.supportedEventTypes || ['delivered', 'opened', 'bounced', 'complained']
    };
    if (!webhookTemplates.value.supportedEventTypes.includes(webhookSim.value.eventType)) {
      webhookSim.value.eventType = webhookTemplates.value.supportedEventTypes[0] || 'delivered';
    }
  } catch (err) {
    console.error('Failed to load webhook templates:', err);
  }
};

const runWebhookSimulation = async () => {
  if (!selectedIntegration.value || selectedIntegration.value.key !== 'email-provider') return;
  if (!webhookTemplates.value.latestCommunicationId && !webhookTemplates.value.latestExternalMessageId) {
    notifications.warning(t('settings.integrationsNotifyNoOutboundForWebhook'));
    return;
  }
  simulatingWebhook.value = true;
  try {
    const payload = {
      communicationId: webhookTemplates.value.latestCommunicationId || undefined,
      externalMessageId: webhookTemplates.value.latestExternalMessageId || undefined,
      eventType: webhookSim.value.eventType,
      provider: webhookSim.value.provider || 'simulator'
    };
    const data = await apiClient('/communications/webhook-test/simulate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (data?.success) {
      await loadPipelineDiagnostics();
      notifications.success(t('settings.integrationsNotifyWebhookSimulated', { eventType: webhookSim.value.eventType }));
    } else {
      notifications.error(data?.message || t('settings.integrationsNotifyWebhookSimFailed'));
    }
  } catch (err) {
    console.error('Webhook simulation failed:', err);
    notifications.error(err?.response?.data?.message || err?.message || t('settings.integrationsNotifyWebhookSimFailed'));
  } finally {
    simulatingWebhook.value = false;
  }
};

const formatCheckedAt = (value) => {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return formatUserDateTime(dt);
};

function hydrateEmailSetupFromList() {
  const item = integrations.value.find((entry) => entry.key === 'email-provider');
  if (!item?.emailConfig) return false;
  const patched = patchEmailDomainVerification(item);
  selectedIntegration.value = {
    ...(selectedIntegration.value || {}),
    ...patched,
  };
  applyEmailSetupFromIntegration(patched);
  emailSetupHydrated.value = true;
  captureEmailSettingsSnapshot();
  return true;
}

const loadEmailProviderData = async () => {
  primeSelectedIntegration('email-provider');
  emailPolicyLoaded.value = false;
  emailSetupHydrated.value = false;
  loadingEmailPolicy.value = true;
  error.value = null;
  try {
    await loadIntegrationsList({ forceRefresh: true, silent: true });
    const item = integrations.value.find((entry) => entry.key === 'email-provider');
    if (item) {
      applyEmailProviderIntegration(item);
    } else {
      hydrateEmailSetupFromList();
    }
  } catch (err) {
    console.error('Failed to load email provider settings:', err);
    error.value = err;
    hydrateEmailSetupFromList();
  } finally {
    loadingEmailPolicy.value = false;
  }
};

const fetchIntegrations = async () => {
  await loadIntegrationsList();
  if (currentView.value !== 'overview') {
    await fetchIntegrationDetail(currentView.value);
  } else {
    selectedIntegration.value = null;
  }
};

const primeSelectedIntegration = (key) => {
  const fromList = integrations.value.find((item) => item.key === key);
  if (fromList) {
    selectedIntegration.value = patchEmailDomainVerification({ ...fromList });
    return;
  }
  if (key === 'email-provider') {
    selectedIntegration.value = patchEmailDomainVerification({
      key: 'email-provider',
      enabled: true,
      emailConfig: emailConfig.value,
    });
  }
};

const loadIntegrationsList = async ({ forceRefresh = false, silent = false } = {}) => {
  if (!silent) loading.value = true;
  error.value = null;
  try {
    const data = await apiClient('/settings/integrations', {
      method: 'GET',
      cache: forceRefresh ? 'no-store' : undefined,
      params: forceRefresh ? { _t: Date.now() } : undefined,
    });
    if (data && data.success && data.integrations) {
      integrations.value = data.integrations;
      if (currentView.value !== 'overview') {
        primeSelectedIntegration(currentView.value);
        if (currentView.value === 'email-provider' && !emailSetupHydrated.value) {
          const item = integrations.value.find((entry) => entry.key === 'email-provider');
          if (item?.emailConfig || item?.amdsServerConfigured === true) {
            applyEmailProviderIntegration(item);
          } else {
            hydrateEmailSetupFromList();
          }
        }
      }
    } else {
      integrations.value = [];
    }
  } catch (err) {
    console.error('Failed to fetch integrations:', err);
    error.value = err;
  } finally {
    if (!silent) loading.value = false;
  }
};

function applyEmailSetupFromIntegration(integration) {
  const cfg = integration.emailConfig || {};
  const resolved = resolveEmailProvider(cfg, integration);
  const previousProvider = String(emailConfig.value.provider || '').trim().toLowerCase();
  const provider = resolved || previousProvider || 'amds';
  emailConfig.value = {
    provider,
    fromEmail: cfg.fromEmail || '',
    fromName: cfg.fromName || '',
    replyTo: cfg.replyTo || '',
    ociRegion: cfg.ociRegion || '',
    smtpHost: cfg.smtpHost || '',
    smtpPort: cfg.smtpPort || 587,
    smtpUser: cfg.smtpUser || '',
    smtpPass: '',
    smtpSecure: cfg.smtpSecure === true,
    smtpPassMasked: cfg.smtpPassMasked || '',
    hasSmtpPass: cfg.hasSmtpPass === true,
    awsRegion: cfg.awsRegion || '',
    awsAccessKeyId: cfg.awsAccessKeyId || '',
    awsSecretAccessKey: '',
    awsSecretAccessKeyMasked: cfg.awsSecretAccessKeyMasked || '',
    hasAwsSecretAccessKey: cfg.hasAwsSecretAccessKey === true
  };
  applyAmdsDefaults();
  applyOciEmailDefaults();
  applyResendDefaults();
  const patched = patchEmailDomainVerification({
    ...integration,
    emailConfig: { ...cfg, provider },
  });
  selectedIntegration.value = {
    ...(selectedIntegration.value || {}),
    ...patched,
    amdsServerConfigured: integration.amdsServerConfigured === true,
  };
}

function applyEmailPolicyFromIntegration(integration) {
  const policy = integration.communicationPolicy || {};
  communicationPolicy.value = {
    outboundEmail: {
      enabled: policy.outboundEmail?.enabled !== false,
      maxRecipientsPerMessage: Number(policy.outboundEmail?.maxRecipientsPerMessage) || 50,
      allowWorkspaceEmail: policy.outboundEmail?.allowWorkspaceEmail !== false,
      disallowPlatformSmtpForWorkspace:
        policy.outboundEmail?.disallowPlatformSmtpForWorkspace === true,
      requireMailboxProviderForAgentSend:
        policy.outboundEmail?.requireMailboxProviderForAgentSend === true,
      requireIdempotencyKey: policy.outboundEmail?.requireIdempotencyKey === true,
      allowedModuleKeys: Array.isArray(policy.outboundEmail?.allowedModuleKeys) && policy.outboundEmail.allowedModuleKeys.length > 0
        ? policy.outboundEmail.allowedModuleKeys
        : ['people', 'organizations', 'deals', 'tasks', 'cases', 'workspace'],
      suppression: {
        autoSuppressOnBounce: policy.outboundEmail?.suppression?.autoSuppressOnBounce !== false,
        autoSuppressOnComplaint: policy.outboundEmail?.suppression?.autoSuppressOnComplaint !== false
      }
    },
    supportedModuleKeys: Array.isArray(policy.supportedModuleKeys) && policy.supportedModuleKeys.length > 0
      ? policy.supportedModuleKeys
      : ['people', 'organizations', 'deals', 'tasks', 'cases', 'workspace'],
    gmailInboxSync: {
      clientId: policy.gmailInboxSync?.clientId || '',
      redirectUri: policy.gmailInboxSync?.redirectUri || '',
      hasClientSecret: policy.gmailInboxSync?.hasClientSecret === true,
      clientSecret: ''
    }
  };
}

const fetchIntegrationDetail = async (key, options = {}) => {
  const silent = options.silent === true;
  const scope = options.scope || 'full';
  const blocksUi = !silent && key !== 'email-provider';
  if (blocksUi) {
    detailLoading.value = true;
    primeSelectedIntegration(key);
  }
  try {
    const forceRefresh = options.forceRefresh === true;
    const verifyDomain = options.verifyDomain === true;
    const params = {};
    if (forceRefresh) params._t = Date.now();
    if (verifyDomain) params.verifyDomain = '1';
    if (key === 'email-provider') params.scope = scope;
    const data = await apiClient(`/settings/integrations/${key}`, {
      method: 'GET',
      cache: forceRefresh ? 'no-store' : undefined,
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    if (data && data.success && data.integration) {
      const integrationPayload = data.integration.key === 'email-provider'
        ? patchEmailDomainVerification(data.integration)
        : data.integration;
      selectedIntegration.value = {
        ...selectedIntegration.value,
        ...integrationPayload,
      };
      if (data.integration.key === 'email-provider') {
        if (scope === 'full' || scope === 'policy') {
          applyEmailProviderIntegration(integrationPayload);
        } else {
          applyEmailSetupFromIntegration(integrationPayload);
          emailSetupHydrated.value = true;
          captureEmailSettingsSnapshot();
        }
        emailDiagnosticsLoaded.value = false;
      }
      const idx = integrations.value.findIndex((i) => i.key === key);
      if (idx !== -1) {
        integrations.value[idx] = {
          ...integrations.value[idx],
          ...integrationPayload,
        };
      }
    }
  } catch (err) {
    console.error('Failed to fetch integration detail:', err);
  } finally {
    if (blocksUi) detailLoading.value = false;
  }
};

function buildEmailSettingsSnapshot() {
  return JSON.stringify({
    email: {
      provider: emailConfig.value.provider,
      fromEmail: emailConfig.value.fromEmail,
      fromName: emailConfig.value.fromName,
      replyTo: emailConfig.value.replyTo,
      ociRegion: emailConfig.value.ociRegion,
      smtpHost: emailConfig.value.smtpHost,
      smtpPort: Number(emailConfig.value.smtpPort) || 587,
      smtpUser: emailConfig.value.smtpUser,
      smtpSecure: emailConfig.value.smtpSecure === true,
      awsRegion: emailConfig.value.awsRegion,
      awsAccessKeyId: emailConfig.value.awsAccessKeyId,
    },
    policy: {
      outboundEmail: {
        enabled: communicationPolicy.value.outboundEmail.enabled !== false,
        maxRecipientsPerMessage: Number(communicationPolicy.value.outboundEmail.maxRecipientsPerMessage) || 50,
        allowWorkspaceEmail: communicationPolicy.value.outboundEmail.allowWorkspaceEmail !== false,
        disallowPlatformSmtpForWorkspace:
          communicationPolicy.value.outboundEmail.disallowPlatformSmtpForWorkspace === true,
        requireMailboxProviderForAgentSend:
          communicationPolicy.value.outboundEmail.requireMailboxProviderForAgentSend === true,
        requireIdempotencyKey: communicationPolicy.value.outboundEmail.requireIdempotencyKey === true,
        allowedModuleKeys: [...(communicationPolicy.value.outboundEmail.allowedModuleKeys || [])],
        suppression: {
          autoSuppressOnBounce: communicationPolicy.value.outboundEmail.suppression?.autoSuppressOnBounce !== false,
          autoSuppressOnComplaint: communicationPolicy.value.outboundEmail.suppression?.autoSuppressOnComplaint !== false,
        },
      },
      gmailInboxSync: {
        clientId: communicationPolicy.value.gmailInboxSync.clientId,
        redirectUri: communicationPolicy.value.gmailInboxSync.redirectUri,
      },
    },
  });
}

function captureEmailSettingsSnapshot() {
  emailSettingsSnapshot.value = buildEmailSettingsSnapshot();
}

const emailSettingsDirty = computed(() => {
  if (selectedIntegration.value?.key !== 'email-provider') return false;
  if (!emailSettingsSnapshot.value) return false;
  if (buildEmailSettingsSnapshot() !== emailSettingsSnapshot.value) return true;
  return !!(
    emailConfig.value.smtpPass
    || emailConfig.value.awsSecretAccessKey
    || communicationPolicy.value.gmailInboxSync.clientSecret
  );
});

function shouldIncludeGmailOAuthOnSave() {
  if (!canManageGmailOAuthApp.value) return false;
  if (communicationPolicy.value.gmailInboxSync.clientSecret) return true;
  try {
    const snap = JSON.parse(emailSettingsSnapshot.value || '{}');
    const saved = snap.policy?.gmailInboxSync || {};
    const current = communicationPolicy.value.gmailInboxSync;
    return current.clientId !== (saved.clientId || '') || current.redirectUri !== (saved.redirectUri || '');
  } catch {
    return false;
  }
}

async function resetEmailSettings() {
  if (selectedIntegration.value?.key !== 'email-provider') return;
  await fetchIntegrationDetail('email-provider', { scope: 'full', skipPolicyPrefetch: true });
}

async function handleEmailSettingsSave() {
  await saveEmailConfig(shouldIncludeGmailOAuthOnSave());
}

const saveEmailConfig = async (includeGmailOAuthApp = false) => {
  if (!selectedIntegration.value || selectedIntegration.value.key !== 'email-provider') return;
  if (includeGmailOAuthApp && !canManageGmailOAuthApp.value) {
    notifications.error(t('settings.integrationsNotifyGmailOAuthSaveDenied'));
    return;
  }
  if (includeGmailOAuthApp) savingGmailOAuthConfig.value = true;
  else savingConfig.value = true;
  try {
    const communicationPolicyPayload = {
      outboundEmail: {
        enabled: communicationPolicy.value.outboundEmail.enabled !== false,
        maxRecipientsPerMessage: Number(communicationPolicy.value.outboundEmail.maxRecipientsPerMessage) || 50,
        allowWorkspaceEmail: communicationPolicy.value.outboundEmail.allowWorkspaceEmail !== false,
        disallowPlatformSmtpForWorkspace:
          communicationPolicy.value.outboundEmail.disallowPlatformSmtpForWorkspace === true,
        requireMailboxProviderForAgentSend:
          communicationPolicy.value.outboundEmail.requireMailboxProviderForAgentSend === true,
        requireIdempotencyKey: communicationPolicy.value.outboundEmail.requireIdempotencyKey === true,
        allowedModuleKeys: communicationPolicy.value.outboundEmail.allowedModuleKeys,
        suppression: {
          autoSuppressOnBounce: communicationPolicy.value.outboundEmail.suppression?.autoSuppressOnBounce !== false,
          autoSuppressOnComplaint: communicationPolicy.value.outboundEmail.suppression?.autoSuppressOnComplaint !== false
        }
      }
    };
    if (includeGmailOAuthApp) {
      communicationPolicyPayload.gmailInboxSync = {
        clientId: communicationPolicy.value.gmailInboxSync.clientId,
        redirectUri: communicationPolicy.value.gmailInboxSync.redirectUri,
        clientSecret: communicationPolicy.value.gmailInboxSync.clientSecret
      };
    }

    applyOciEmailDefaults();
    applyResendDefaults();

    const payload = {
      provider: String(emailConfig.value.provider || 'amds').trim().toLowerCase(),
      fromEmail: emailConfig.value.fromEmail,
      fromName: emailConfig.value.fromName,
      replyTo: emailConfig.value.replyTo,
      ociRegion: emailConfig.value.ociRegion,
      smtpHost: emailConfig.value.smtpHost,
      smtpPort: Number(emailConfig.value.smtpPort) || 587,
      smtpUser: emailConfig.value.smtpUser,
      smtpPass: emailConfig.value.smtpPass,
      smtpSecure: !!emailConfig.value.smtpSecure,
      awsRegion: emailConfig.value.awsRegion,
      awsAccessKeyId: emailConfig.value.awsAccessKeyId,
      awsSecretAccessKey: emailConfig.value.awsSecretAccessKey,
      communicationPolicy: communicationPolicyPayload
    };

    const data = await apiClient('/settings/integrations/email-provider/config', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (data?.success) {
      notifications.success(
        includeGmailOAuthApp ? t('settings.integrationsNotifyGmailOAuthSaved') : t('settings.integrationsNotifyEmailSettingsSaved')
      );
      emailConfig.value.smtpPass = '';
      emailConfig.value.awsSecretAccessKey = '';
      communicationPolicy.value.gmailInboxSync.clientSecret = '';
      if (data.data) {
        applyEmailSetupFromIntegration({
          ...(selectedIntegration.value || { key: 'email-provider' }),
          emailConfig: data.data,
        });
        emailSetupHydrated.value = true;
        captureEmailSettingsSnapshot();
        const idx = integrations.value.findIndex((i) => i.key === 'email-provider');
        if (idx !== -1) {
          integrations.value[idx] = {
            ...integrations.value[idx],
            emailConfig: { ...data.data },
          };
        }
      }
    } else {
      notifications.error(data?.message || t('settings.integrationsNotifySaveEmailFailed'));
    }
  } catch (err) {
    console.error('Failed to save email config:', err);
    notifications.error(err?.response?.data?.message || err?.message || t('settings.integrationsNotifySaveEmailFailed'));
  } finally {
    savingConfig.value = false;
    savingGmailOAuthConfig.value = false;
  }
};

const confirmEnable = async () => {
  if (!selectedIntegration.value) return;
  const ok = await confirmAction(t('settings.integrationsConfirmEnable'));
  if (!ok) return;
  await enableIntegration(selectedIntegration.value.key);
};

const confirmDisable = async () => {
  if (!selectedIntegration.value) return;
  const ok = await confirmAction(t('settings.integrationsConfirmDisable'));
  if (!ok) return;
  await disableIntegration(selectedIntegration.value.key);
};

const enableIntegration = async (key) => {
  actionLoading.value = true;
  try {
    const data = await apiClient(`/settings/integrations/${key}/enable`, { method: 'POST' });
    if (data && data.success) {
      await fetchIntegrations();
      await fetchIntegrationDetail(key);
    } else {
      notifications.error(data.message || t('settings.integrationsNotifyEnableFailed'));
    }
  } catch (err) {
    console.error('Failed to enable integration:', err);
    notifications.error(err?.response?.data?.message || err?.message || t('settings.integrationsNotifyEnableFailed'));
  } finally {
    actionLoading.value = false;
  }
};

const disableIntegration = async (key) => {
  actionLoading.value = true;
  try {
    const data = await apiClient(`/settings/integrations/${key}/disable`, { method: 'POST' });
    if (data && data.success) {
      await fetchIntegrations();
      await fetchIntegrationDetail(key);
    } else {
      notifications.error(data.message || t('settings.integrationsNotifyDisableFailed'));
    }
  } catch (err) {
    console.error('Failed to disable integration:', err);
    notifications.error(err?.response?.data?.message || err?.message || t('settings.integrationsNotifyDisableFailed'));
  } finally {
    actionLoading.value = false;
  }
};

const sendTestEmail = async () => {
  if (!selectedIntegration.value || selectedIntegration.value.key !== 'email-provider') return;
  testEmailLoading.value = true;
  try {
    const data = await apiClient(`/settings/integrations/email-provider/test`, { method: 'POST' });
    if (data && data.success) {
      notifications.success(data.message || t('settings.integrationsNotifyTestEmailSent'));
      if (data.provider) {
        notifications.info(t('settings.integrationsNotifyTestEmailProvider', { provider: data.provider }));
      }
    } else {
      notifications.error(data.message || data.error || t('settings.integrationsNotifyTestEmailFailed'));
    }
  } catch (err) {
    console.error('Failed to send test email:', err);
    notifications.error(err?.response?.data?.message || err?.message || t('settings.integrationsNotifyTestEmailFailed'));
  } finally {
    testEmailLoading.value = false;
  }
};

watch(
  () => [route.query.tab, route.query.integrationView],
  async () => {
    if (route.query.tab !== 'integrations') return;

    const view = currentView.value;

    if (view === 'overview') {
      selectedIntegration.value = null;
      emailSetupHydrated.value = false;
      emailPolicyLoaded.value = false;
      if (integrations.value.length === 0) {
        await loadIntegrationsList();
      }
      return;
    }

    primeSelectedIntegration(view);

    if (view === 'email-provider') {
      await loadEmailProviderData();
      return;
    }

    if (selectedIntegration.value?.key === view && !detailLoading.value) {
      return;
    }

    if (integrations.value.length === 0) {
      await Promise.all([
        loadIntegrationsList(),
        fetchIntegrationDetail(view),
      ]);
      return;
    }

    await fetchIntegrationDetail(view);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (deadLetterHighlightClearTimer) clearTimeout(deadLetterHighlightClearTimer);
});

watch(inboundIncludeResolved, () => {
  if (selectedIntegration.value?.key !== 'email-provider') return;
  loadInboundDeadLetters();
});

watch(activeDetailTab, (tab) => {
  if (selectedIntegration.value?.key !== 'email-provider') return;
  if (tab === 'policy' && !emailPolicyLoaded.value) {
    void loadEmailPolicyData();
  }
  if (tab === 'diagnostics' && !emailDiagnosticsLoaded.value) {
    void loadEmailDiagnosticsData();
  }
  if (tab === 'domain') {
    prepareDomainTab();
  }
});

watch(
  () => emailConfig.value.provider,
  (next, prev) => {
    applyAmdsDefaults({ providerJustChanged: next === 'amds' && prev !== 'amds' });
    applyResendDefaults({ providerJustChanged: next === 'resend' && prev !== 'resend' });
    applyOciEmailDefaults({ providerJustChanged: next === 'oci-email-delivery' && prev !== 'oci-email-delivery' });
    applyGmailSmtpDefaults({ providerJustChanged: next === 'gmail-smtp' && prev !== 'gmail-smtp' });
  }
);

watch(
  () => emailConfig.value.ociRegion,
  () => {
    if (emailConfig.value.provider === 'oci-email-delivery') {
      applyOciEmailDefaults();
    }
  }
);
</script>
