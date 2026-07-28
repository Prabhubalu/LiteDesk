<template>
  <SettingsScrollPanel :save-bar-visible="!loading && !error && hasChanges">
    <template #header>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabSecurity') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.secPageSubtitle') }}
        </p>
      </div>
    </template>

    <div class="space-y-6">
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <div>
          <h3 class="text-sm font-semibold text-blue-800 dark:text-blue-300">{{ t('settings.secBannerTitle') }}</h3>
          <p class="text-sm text-blue-700 dark:text-blue-400 mt-1">
            {{ t('settings.secBannerBody') }}
          </p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm text-red-800 dark:text-red-300">
          {{ error.message || t('settings.secLoadFailed') }}
        </p>
      </div>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.secPasswordPolicy') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.secPasswordPolicyDesc') }}</p>
          </div>
        </div>
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('settings.secMinLength') }}
              </label>
              <input
                v-model.number="form.passwordPolicy.minLength"
                type="number"
                min="6"
                max="128"
                class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('settings.secExpirationDays') }}
              </label>
              <input
                v-model.number="form.passwordPolicy.expirationDays"
                type="number"
                min="0"
                max="365"
                class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.secNoExpiration') }}</p>
            </div>
          </div>
          <div class="space-y-3">
            <label class="flex items-center gap-3 cursor-pointer">
              <HeadlessCheckbox
                v-model="form.passwordPolicy.requireUppercase"
                checkbox-class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
              />
              <div>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.secRequireUpper') }}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.secRequireUpperDesc') }}</p>
              </div>
            </label>
            <label class="flex items-center gap-3 cursor-pointer">
              <HeadlessCheckbox
                v-model="form.passwordPolicy.requireLowercase"
                checkbox-class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
              />
              <div>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.secRequireLower') }}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.secRequireLowerDesc') }}</p>
              </div>
            </label>
            <label class="flex items-center gap-3 cursor-pointer">
              <HeadlessCheckbox
                v-model="form.passwordPolicy.requireNumbers"
                checkbox-class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
              />
              <div>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.secRequireNumbers') }}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.secRequireNumbersDesc') }}</p>
              </div>
            </label>
            <label class="flex items-center gap-3 cursor-pointer">
              <HeadlessCheckbox
                v-model="form.passwordPolicy.requireSpecialChars"
                checkbox-class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
              />
              <div>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.secRequireSpecial') }}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.secRequireSpecialDesc') }}</p>
              </div>
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('settings.secPreventReuse') }}
            </label>
            <input
              v-model.number="form.passwordPolicy.preventReuse"
              type="number"
              min="0"
              max="24"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.secNoRestriction') }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.secSessionRules') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.secSessionRulesDesc') }}</p>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('settings.secSessionDuration') }}
            </label>
            <input
              v-model.number="form.sessionRules.durationHours"
              type="number"
              min="1"
              max="168"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('settings.secIdleTimeout') }}
            </label>
            <input
              v-model.number="form.sessionRules.idleTimeoutMinutes"
              type="number"
              min="5"
              max="480"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('settings.secMaxSessions') }}
            </label>
            <input
              v-model.number="form.sessionRules.maxConcurrentSessions"
              type="number"
              min="1"
              max="20"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.secLoginRestrictions') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.secLoginRestrictionsDesc') }}</p>
          </div>
        </div>
        <div class="space-y-4">
          <div>
            <label class="flex items-center gap-3 cursor-pointer mb-3">
              <HeadlessCheckbox
                v-model="form.loginRestrictions.blockFailedAttempts"
                checkbox-class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
              />
              <div>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.secBlockFailed') }}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.secBlockFailedDesc') }}</p>
              </div>
            </label>
            <div v-if="form.loginRestrictions.blockFailedAttempts" class="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ t('settings.secMaxFailedAttempts') }}
                </label>
                <input
                  v-model.number="form.loginRestrictions.maxFailedAttempts"
                  type="number"
                  min="1"
                  max="10"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ t('settings.secLockoutDuration') }}
                </label>
                <input
                  v-model.number="form.loginRestrictions.lockoutDurationMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('settings.secAllowedIps') }}
            </label>
            <textarea
              v-model="ipWhitelistText"
              @blur="updateIpWhitelist"
              rows="3"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
              :placeholder="t('settings.secAllowedIpsPlaceholder')"
            ></textarea>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.secAllowedIpsHint') }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('settings.secBlockedIps') }}
            </label>
            <textarea
              v-model="ipBlacklistText"
              @blur="updateIpBlacklist"
              rows="3"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
              :placeholder="t('settings.secBlockedIpsPlaceholder')"
            ></textarea>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.secBlockedIpsHint') }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.secTwoFactor') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.secTwoFactorDesc') }}</p>
          </div>
        </div>
        <div class="space-y-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <HeadlessCheckbox
              v-model="form.twoFactorAuth.enabled"
              checkbox-class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
            />
            <div>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.secEnable2fa') }}</span>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.secEnable2faDesc') }}</p>
            </div>
          </label>
          <label v-if="form.twoFactorAuth.enabled" class="flex items-center gap-3 cursor-pointer">
            <HeadlessCheckbox
              v-model="form.twoFactorAuth.required"
              checkbox-class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
            />
            <div>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.secRequire2fa') }}</span>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.secRequire2faDesc') }}</p>
            </div>
          </label>
          <div v-if="form.twoFactorAuth.enabled">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('settings.sec2faMethods') }}
            </label>
            <div class="space-y-2">
              <label class="flex items-center gap-3 cursor-pointer">
                <HeadlessCheckbox
                  :checked="form.twoFactorAuth.methods.includes('totp')"
                  @change="toggle2FAMethod('totp')"
                  checkbox-class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
                />
                <span class="text-sm text-gray-900 dark:text-white">{{ t('settings.sec2faTotp') }}</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <HeadlessCheckbox
                  :checked="form.twoFactorAuth.methods.includes('sms')"
                  @change="toggle2FAMethod('sms')"
                  checkbox-class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
                />
                <span class="text-sm text-gray-900 dark:text-white">{{ t('settings.sec2faSms') }}</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <HeadlessCheckbox
                  :checked="form.twoFactorAuth.methods.includes('email')"
                  @change="toggle2FAMethod('email')"
                  checkbox-class="w-5 h-5 text-indigo-600 focus:ring-indigo-500 rounded"
                />
                <span class="text-sm text-gray-900 dark:text-white">{{ t('settings.sec2faEmail') }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

    </form>

    <SettingsSaveBar
      :visible="!loading && !error && hasChanges"
      :saving="saving"
      :reset-label="t('settings.secReset')"
      :save-label="t('settings.secSave')"
      @reset="resetForm"
      @save="handleSubmit"
    />

    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.secActivity') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.secActivityDesc') }}</p>
          </div>
        </div>
        <button
          @click="fetchSecurityActivity"
          class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {{ t('settings.secRefresh') }}
        </button>
      </div>
      <div v-if="activityLoading" class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
      </div>
      <div v-else-if="securityActivity.length === 0" class="text-center py-8">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.secNoActivity') }}</p>
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="event in securityActivity"
          :key="event.id"
          class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
        >
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-2 h-2 rounded-full',
                event.status === 'success' ? 'bg-green-500' : 'bg-red-500'
              ]"
            ></div>
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ event.type === 'LOGIN_SUCCESS' ? t('settings.secLoginSuccess') : t('settings.secLoginFailed') }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ event.userEmail }} • {{ formatDate(event.timestamp) }}
              </p>
            </div>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ event.ip }}
          </div>
        </div>
      </div>
    </div>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

import { useNotifications } from '@/composables/useNotifications';
import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
const notifications = useNotifications();


const loading = ref(true);
const saving = ref(false);
const activityLoading = ref(false);
const error = ref(null);
const originalForm = ref({});
const securityActivity = ref([]);

const form = ref({
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    expirationDays: 90,
    preventReuse: 5
  },
  sessionRules: {
    durationHours: 24,
    idleTimeoutMinutes: 30,
    maxConcurrentSessions: 5
  },
  loginRestrictions: {
    ipWhitelist: [],
    ipBlacklist: [],
    allowedRegions: [],
    blockFailedAttempts: true,
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 15
  },
  twoFactorAuth: {
    enabled: false,
    required: false,
    methods: ['totp']
  }
});

const ipWhitelistText = ref('');
const ipBlacklistText = ref('');

const hasChanges = computed(() => {
  return JSON.stringify(form.value) !== JSON.stringify(originalForm.value);
});

const updateIpWhitelist = () => {
  form.value.loginRestrictions.ipWhitelist = ipWhitelistText.value
    .split('\n')
    .map(ip => ip.trim())
    .filter(ip => ip.length > 0);
};

const updateIpBlacklist = () => {
  form.value.loginRestrictions.ipBlacklist = ipBlacklistText.value
    .split('\n')
    .map(ip => ip.trim())
    .filter(ip => ip.length > 0);
};

const toggle2FAMethod = (method) => {
  const methods = form.value.twoFactorAuth.methods || [];
  const index = methods.indexOf(method);
  if (index > -1) {
    methods.splice(index, 1);
  } else {
    methods.push(method);
  }
  form.value.twoFactorAuth.methods = methods;
};

const fetchSecuritySettings = async () => {
  loading.value = true;
  error.value = null;

  try {
    const data = await apiClient('/settings/security', {
      method: 'GET'
    });

    if (data && data.success && data.data) {
      form.value = {
        passwordPolicy: data.data.passwordPolicy,
        sessionRules: data.data.sessionRules,
        loginRestrictions: data.data.loginRestrictions,
        twoFactorAuth: data.data.twoFactorAuth
      };
      originalForm.value = JSON.parse(JSON.stringify(form.value));

      ipWhitelistText.value = form.value.loginRestrictions.ipWhitelist.join('\n');
      ipBlacklistText.value = form.value.loginRestrictions.ipBlacklist.join('\n');
    } else {
      error.value = new Error('Invalid response from server');
    }
  } catch (err) {
    console.error('Failed to fetch security settings:', err);
    error.value = err;
  } finally {
    loading.value = false;
  }
};

const fetchSecurityActivity = async () => {
  activityLoading.value = true;
  try {
    const data = await apiClient('/settings/security/activity', {
      method: 'GET'
    });

    if (data && data.success && data.data) {
      securityActivity.value = data.data.activity || [];
    }
  } catch (err) {
    console.error('Failed to fetch security activity:', err);
  } finally {
    activityLoading.value = false;
  }
};

const resetForm = () => {
  form.value = JSON.parse(JSON.stringify(originalForm.value));
  ipWhitelistText.value = form.value.loginRestrictions.ipWhitelist.join('\n');
  ipBlacklistText.value = form.value.loginRestrictions.ipBlacklist.join('\n');
};

const handleSubmit = async () => {
  const requiresConfirmation =
    form.value.twoFactorAuth.required !== originalForm.value.twoFactorAuth.required ||
    form.value.loginRestrictions.blockFailedAttempts !== originalForm.value.loginRestrictions.blockFailedAttempts;

  if (requiresConfirmation) {
    const confirmed = await confirmAction(t('settings.secConfirmRisk'));
    if (!confirmed) return;
  }

  saving.value = true;
  error.value = null;

  updateIpWhitelist();
  updateIpBlacklist();

  try {
    const { pickDirtyFields } = await import('@/utils/pickDirtyFields');
    const payload = pickDirtyFields(
      {
        passwordPolicy: form.value.passwordPolicy,
        sessionRules: form.value.sessionRules,
        loginRestrictions: form.value.loginRestrictions,
        twoFactorAuth: form.value.twoFactorAuth
      },
      {
        passwordPolicy: originalForm.value.passwordPolicy,
        sessionRules: originalForm.value.sessionRules,
        loginRestrictions: originalForm.value.loginRestrictions,
        twoFactorAuth: originalForm.value.twoFactorAuth
      }
    );

    if (Object.keys(payload).length === 0) {
      saving.value = false;
      return;
    }

    const data = await apiClient('/settings/security', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (data && data.success) {
      originalForm.value = JSON.parse(JSON.stringify(form.value));
      notifications.success(t('settings.secSaveSuccess'));
    } else {
      error.value = new Error(data.message || t('settings.secLoadFailed'));
    }
  } catch (err) {
    console.error('Failed to update security settings:', err);
    error.value = err;
  } finally {
    saving.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

onMounted(() => {
  fetchSecuritySettings();
  fetchSecurityActivity();
});
</script>
