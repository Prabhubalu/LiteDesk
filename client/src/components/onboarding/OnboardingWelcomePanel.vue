<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  welcome: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['dismiss', 'primary']);

const { t } = useI18n();
const router = useRouter();

const entitledApps = computed(() => props.welcome?.entitledApps || []);

const handlePrimary = () => {
  const route = props.welcome?.primaryAction?.route;
  if (route) {
    router.push(route);
  }
  emit('primary');
};

const handleDismiss = () => {
  emit('dismiss');
};
</script>

<template>
  <section
    v-if="welcome"
    class="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 p-6"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('onboarding.welcomeTitle', {
            organization: welcome.orgName,
            name: welcome.firstName
          }) }}
        </h2>
        <p
          v-if="welcome.inviterName"
          class="mt-1 text-sm text-gray-700 dark:text-gray-300"
        >
          {{ t('onboarding.welcomeInvitedBy', {
            inviter: welcome.inviterName,
            role: welcome.roleName
          }) }}
        </p>
        <p
          v-if="welcome.welcomeNote"
          class="mt-3 rounded-lg bg-white/60 dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
        >
          <span class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            {{ t('onboarding.welcomeNoteLabel') }}
          </span>
          {{ welcome.welcomeNote }}
        </p>
        <p
          v-if="welcome.suggestedTask"
          class="mt-3 rounded-lg bg-white/60 dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
        >
          <span class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            {{ t('onboarding.welcomeSuggestedTaskLabel') }}
          </span>
          {{ welcome.suggestedTask }}
        </p>
        <div v-if="entitledApps.length" class="mt-3">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ t('onboarding.welcomeAppsLabel') }}
          </p>
          <div class="mt-1 flex flex-wrap gap-2">
            <span
              v-for="app in entitledApps"
              :key="app"
              class="inline-flex rounded-full bg-white dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-gray-700"
            >
              {{ app }}
            </span>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            :disabled="loading"
            @click="handlePrimary"
          >
            {{ t('onboarding.welcomePrimaryCta') }}
          </button>
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            :disabled="loading"
            @click="handleDismiss"
          >
            {{ t('onboarding.welcomeDismiss') }}
          </button>
        </div>
      </div>
      <button
        type="button"
        class="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        :aria-label="t('onboarding.welcomeDismiss')"
        @click="handleDismiss"
      >
        <XMarkIcon class="h-5 w-5" />
      </button>
    </div>
  </section>
</template>
