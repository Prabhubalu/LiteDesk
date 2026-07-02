<template>
  <section class="mb-8">
    <div class="mb-3">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ t('marketing.campaignsDeliverabilityTitle') }}
      </h2>
      <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
        {{ t('marketing.campaignsDeliverabilitySubtitle') }}
      </p>
    </div>

    <div v-if="loading" class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('states.loading') }}
    </div>

    <div v-else class="flex flex-col gap-4">
      <article
        class="rounded-xl border bg-white p-4 dark:bg-gray-900"
        :class="senderBorderClass"
      >
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('settings.emailPolicyReputationTitle') }}
        </h3>
        <p class="mt-2 text-3xl font-bold" :class="senderScoreClass">
          {{ senderScoreLabel }}
        </p>
        <p
          v-if="senderDelta != null && senderDelta !== 0"
          class="mt-1 text-sm"
          :class="senderDelta > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'"
        >
          {{ senderDelta > 0 ? '▲' : '▼' }}
          {{ t('settings.emailPolicyReputationDelta', { delta: Math.abs(Number(senderDelta)) }) }}
        </p>
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {{ t('marketing.campaignsDeliverabilitySenderHint') }}
        </p>
      </article>

      <article
        class="rounded-xl border bg-white p-4 dark:bg-gray-900"
        :class="healthBorderClass"
      >
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.campaignsHealthTitle') }}
        </h3>
        <p class="mt-2 text-3xl font-bold" :class="healthScoreClass">
          {{ healthScoreLabel }}
        </p>
        <ul v-if="healthFactors.length" class="mt-3 space-y-2">
          <li
            v-for="(factor, index) in healthFactors"
            :key="`${factor.signal || factor.message}-${index}`"
            class="text-sm text-gray-700 dark:text-gray-200"
          >
            <span>{{ factorImpactIcon(factor.impact) }}</span>
            {{ factor.message }}
          </li>
        </ul>
        <p v-else-if="health" class="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {{ t('marketing.campaignsHealthNoFactors') }}
        </p>
        <p v-else class="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {{ t('marketing.campaignsHealthUnavailable') }}
        </p>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { reputationScoreClass, reputationScoreBorderClass } from '@/utils/reputationScoreTone';

const props = defineProps({
  loading: { type: Boolean, default: false },
  senderReputation: { type: Number, default: null },
  senderDelta: { type: Number, default: null },
  /** @type {import('vue').PropType<Record<string, unknown>|null>} */
  health: { type: Object, default: null }
});

const { t } = useI18n();

const senderScoreLabel = computed(() =>
  props.senderReputation != null ? `${Number(props.senderReputation).toLocaleString()} / 100` : '—'
);

const healthScore = computed(() => {
  const score = props.health?.score;
  return score != null ? Number(score) : null;
});

const healthScoreLabel = computed(() =>
  healthScore.value != null ? `${healthScore.value.toLocaleString()} / 100` : '—'
);

const senderScoreClass = computed(() => reputationScoreClass(props.senderReputation));
const healthScoreClass = computed(() => reputationScoreClass(healthScore.value));
const senderBorderClass = computed(() => reputationScoreBorderClass(props.senderReputation));
const healthBorderClass = computed(() => reputationScoreBorderClass(healthScore.value));

const healthFactors = computed(() =>
  Array.isArray(props.health?.factors) ? props.health.factors : []
);

function factorImpactIcon(impact) {
  if (impact === 'positive') return '✓';
  if (impact === 'negative') return '✗';
  return '•';
}
</script>
