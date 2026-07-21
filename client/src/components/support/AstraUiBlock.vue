<template>
  <div class="relative mt-3">
    <div
      v-if="showPin"
      class="absolute right-2 top-2 z-[3]"
    >
      <AstraPinToDashboardButton :visual="visual" />
    </div>

    <!-- KPI strip -->
    <div
      v-if="visual.component === 'kpi_strip'"
      class="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm shadow-neutral-900/[0.03] dark:border-neutral-700 dark:bg-neutral-900/70 dark:shadow-none"
    >
      <div
        v-if="visual.title"
        class="border-b border-neutral-100 bg-gradient-to-r from-primary-50/80 via-white to-secondary-50/40 px-3.5 py-2 dark:border-neutral-800 dark:from-primary-500/10 dark:via-neutral-900 dark:to-secondary-500/5"
      >
        <p class="pr-28 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-800 dark:text-primary-200">
          {{ visual.title }}
        </p>
      </div>
      <div
        class="grid gap-px bg-neutral-100 dark:bg-neutral-800"
        :class="kpiGridClass"
      >
        <div
          v-for="(item, idx) in visual.items || []"
          :key="`${visual.id}-kpi-${idx}`"
          class="bg-white px-3 py-2.5 dark:bg-neutral-900/90"
        >
          <p class="text-[10px] font-semibold uppercase tracking-[0.07em] text-neutral-500 dark:text-neutral-400">
            {{ item.label }}
          </p>
          <p
            class="mt-1 break-words leading-snug tracking-tight text-neutral-900 dark:text-white"
            :class="kpiValueClass(item)"
          >
            {{ item.value }}
          </p>
          <p
            v-if="item.hint"
            class="mt-0.5 text-[11px] leading-snug text-neutral-400 dark:text-neutral-500"
          >
            {{ item.hint }}
          </p>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <AstraVisualChart
      v-else-if="visual.component === 'chart'"
      :visual="visual"
    />

    <!-- Progress list -->
    <div
      v-else-if="visual.component === 'progress_list'"
      class="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-sm shadow-neutral-900/[0.03] dark:border-neutral-700 dark:bg-neutral-900/70 dark:shadow-none"
    >
      <p
        v-if="visual.title"
        class="mb-3 pr-28 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-800 dark:text-primary-200"
      >
        {{ visual.title }}
      </p>
      <ul class="space-y-3">
        <li
          v-for="(item, idx) in visual.items || []"
          :key="`${visual.id}-p-${idx}`"
        >
          <div class="mb-1.5 flex items-center justify-between gap-2 text-[12.5px]">
            <span class="truncate font-medium text-neutral-800 dark:text-neutral-100">{{ item.label }}</span>
            <span class="shrink-0 rounded-md bg-primary-50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-primary-800 dark:bg-primary-500/15 dark:text-primary-200">
              {{ formatProgressValue(item) }} · {{ progressPct(item) }}%
            </span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              class="h-full rounded-full bg-gradient-to-r from-primary-600 to-secondary-500 transition-all duration-500 dark:from-primary-400 dark:to-secondary-400"
              :style="{ width: `${progressPct(item)}%` }"
            />
          </div>
        </li>
      </ul>
    </div>

    <!-- Data table -->
    <div
      v-else-if="visual.component === 'data_table'"
      class="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm shadow-neutral-900/[0.03] dark:border-neutral-700 dark:bg-neutral-900/70 dark:shadow-none"
    >
      <Disclosure
        v-slot="{ open }"
        :default-open="true"
      >
        <div class="flex items-center justify-between gap-2 border-b border-neutral-100 px-3.5 py-2.5 dark:border-neutral-800">
          <p
            v-if="visual.title"
            class="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-800 dark:text-primary-200"
          >
            {{ visual.title }}
          </p>
          <DisclosureButton
            class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-neutral-500 transition hover:bg-primary-50 hover:text-primary-800 dark:text-neutral-400 dark:hover:bg-primary-500/10 dark:hover:text-primary-200"
          >
            {{ open ? t('liveChat.astraCollapseTable') : t('liveChat.astraExpandTable') }}
            <ChevronDownIcon
              class="h-3.5 w-3.5 transition-transform"
              :class="open ? 'rotate-180' : ''"
              aria-hidden="true"
            />
          </DisclosureButton>
        </div>
        <DisclosurePanel>
          <div class="max-h-72 overflow-auto">
            <table class="w-full min-w-full text-left text-[12.5px]">
              <thead class="sticky top-0 z-[1] bg-neutral-50/95 backdrop-blur dark:bg-neutral-900/95">
                <tr>
                  <th
                    v-for="(col, cIdx) in visual.columns || []"
                    :key="`${visual.id}-c-${cIdx}`"
                    class="whitespace-nowrap px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-500 dark:text-neutral-400"
                  >
                    {{ col }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, rIdx) in visual.rows || []"
                  :key="`${visual.id}-r-${rIdx}`"
                  class="border-t border-neutral-100 transition hover:bg-primary-50/40 dark:border-neutral-800 dark:hover:bg-primary-500/5"
                >
                  <td
                    v-for="(cell, cellIdx) in row"
                    :key="`${visual.id}-r-${rIdx}-${cellIdx}`"
                    class="px-3.5 py-2 align-middle text-neutral-800 dark:text-neutral-100"
                    :class="cellIdx === 0 ? 'font-medium' : 'tabular-nums'"
                  >
                    <span
                      v-if="isStatusLike(visual.columns?.[cellIdx], cell)"
                      class="inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                      :class="statusBadgeClass(cell)"
                    >
                      {{ cell }}
                    </span>
                    <template v-else>
                      {{ cell }}
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </DisclosurePanel>
      </Disclosure>
    </div>

    <!-- Callout -->
    <div
      v-else-if="visual.component === 'callout'"
      class="flex gap-3 rounded-2xl border px-3.5 py-3 shadow-sm shadow-neutral-900/[0.02] dark:shadow-none"
      :class="calloutClass"
    >
      <span
        class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
        :class="calloutIconWrap"
        aria-hidden="true"
      >
        <SparklesIcon
          v-if="(visual.tone || 'insight') === 'insight'"
          class="h-4 w-4"
        />
        <CheckCircleIcon
          v-else-if="visual.tone === 'success'"
          class="h-4 w-4"
        />
        <ExclamationTriangleIcon
          v-else-if="visual.tone === 'warning'"
          class="h-4 w-4"
        />
        <ExclamationCircleIcon
          v-else
          class="h-4 w-4"
        />
      </span>
      <div class="min-w-0 flex-1">
        <p
          v-if="visual.title"
          class="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-80"
        >
          {{ visual.title }}
        </p>
        <p class="mt-1 text-[13px] leading-snug">
          {{ visual.body }}
        </p>
      </div>
    </div>

    <!-- Research brief (company / internet research) -->
    <div
      v-else-if="visual.component === 'research_brief'"
      class="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm shadow-neutral-900/[0.03] dark:border-neutral-700 dark:bg-neutral-900/70 dark:shadow-none"
    >
      <div class="border-b border-neutral-100 bg-gradient-to-r from-primary-50/90 via-white to-secondary-50/50 px-4 py-3.5 dark:border-neutral-800 dark:from-primary-500/10 dark:via-neutral-900 dark:to-secondary-500/5">
        <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-800 dark:text-primary-200">
          {{ visual.title || 'Company research' }}
        </p>
        <p
          v-if="visual.summary"
          class="mt-2 text-[13.5px] leading-relaxed text-neutral-700 dark:text-neutral-200"
        >
          {{ visual.summary }}
        </p>
      </div>

      <div
        v-if="(visual.facts || []).length"
        class="grid gap-px border-b border-neutral-100 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800"
        :class="(visual.facts || []).length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'"
      >
        <div
          v-for="(fact, fIdx) in visual.facts"
          :key="`${visual.id}-f-${fIdx}`"
          class="bg-white px-3.5 py-2.5 dark:bg-neutral-900/90"
        >
          <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-500 dark:text-neutral-400">
            {{ fact.label }}
          </p>
          <p class="mt-0.5 break-words text-[13px] font-medium leading-snug text-neutral-900 dark:text-white">
            {{ fact.value }}
          </p>
        </div>
      </div>

      <div class="divide-y divide-neutral-100 dark:divide-neutral-800">
        <section
          v-for="(section, sIdx) in visual.sections || []"
          :key="`${visual.id}-s-${sIdx}`"
          class="px-4 py-3.5"
        >
          <h4 class="text-[12px] font-semibold tracking-tight text-neutral-900 dark:text-white">
            {{ section.title }}
          </h4>
          <p
            v-if="section.body"
            class="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-200"
          >
            {{ section.body }}
          </p>
          <ul
            v-if="(section.bullets || []).length"
            class="mt-2 space-y-1.5"
          >
            <li
              v-for="(bullet, bIdx) in section.bullets"
              :key="`${visual.id}-s-${sIdx}-b-${bIdx}`"
              class="flex gap-2 text-[12.5px] leading-snug text-neutral-700 dark:text-neutral-200"
            >
              <span
                class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600 dark:bg-primary-300"
                aria-hidden="true"
              />
              <span>{{ bullet }}</span>
            </li>
          </ul>
        </section>
      </div>

      <div
        v-if="(visual.sources || []).length"
        class="border-t border-neutral-100 bg-neutral-50/80 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/50"
      >
        <p class="text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-500 dark:text-neutral-400">
          Sources
        </p>
        <ul class="mt-1 space-y-0.5">
          <li
            v-for="(src, srcIdx) in visual.sources"
            :key="`${visual.id}-src-${srcIdx}`"
            class="truncate text-[11px] text-primary-800 dark:text-primary-200"
          >
            {{ src }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/vue/24/outline';
import AstraVisualChart from '@/components/support/AstraVisualChart.vue';
import AstraPinToDashboardButton from '@/components/support/AstraPinToDashboardButton.vue';
import type { InAppAiVisual } from '@/composables/useInProductAiAsk';

const props = defineProps<{
  visual: InAppAiVisual;
}>();

const { t } = useI18n();

const showPin = computed(() => {
  const c = props.visual.component;
  return c === 'chart' || c === 'data_table' || c === 'progress_list' || c === 'kpi_strip';
});

const kpiGridClass = computed(() => {
  const n = (props.visual.items || []).length;
  if (n <= 2) return 'grid-cols-2';
  if (n === 3) return 'grid-cols-3';
  return 'grid-cols-2 sm:grid-cols-4';
});

/** Research key-facts use calm body type; numeric CRM KPIs stay slightly larger. */
function isMetricKpiValue(value: unknown): boolean {
  const v = String(value ?? '').trim();
  if (!v || v.length > 18) return false;
  if (/^https?:\/\//i.test(v)) return false;
  if (/\s/.test(v)) return false;
  return /^[$€£₹]?\s*[\d,.]+%?$/.test(v)
    || /^\d+(\.\d+)?\s*[KMBTkmbt]?$/.test(v)
    || /^\d{4}$/.test(v);
}

function kpiValueClass(item: { value?: string | number }): string {
  const title = String(props.visual.title || '');
  const factStrip = /\bkey facts?\b/i.test(title) || /\bresearch\b/i.test(title);
  if (factStrip || !isMetricKpiValue(item.value)) {
    return 'text-[13px] font-medium';
  }
  return 'text-[15px] font-semibold tabular-nums';
}

function progressPct(item: { value?: string | number; max?: number }) {
  const max = Number(item.max) > 0
    ? Number(item.max)
    : (props.visual.items || []).reduce((s, it) => s + (Number(it.value) || 0), 0) || 1;
  return Math.min(100, Math.round(((Number(item.value) || 0) / max) * 100));
}

function formatProgressValue(item: { value?: string | number }) {
  const n = Number(item.value);
  const title = String(props.visual.title || '');
  if (
    Number.isFinite(n)
    && /\b(value|amount|pipeline|revenue|\$)\b/i.test(title)
  ) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `$${Math.round(n).toLocaleString('en-US')}`;
    }
  }
  if (Number.isFinite(n)) return String(n);
  return String(item.value ?? '');
}

function isStatusLike(column: string | undefined, cell: string | number) {
  const col = String(column || '').toLowerCase();
  if (/\b(status|stage|state)\b/.test(col)) return true;
  const v = String(cell || '').toLowerCase();
  return ['open', 'won', 'lost', 'new', 'qualification', 'proposal', 'negotiation', 'closed won', 'closed lost'].includes(v);
}

function statusBadgeClass(cell: string | number) {
  const v = String(cell || '').toLowerCase();
  if (/\b(won|closed won|success|active)\b/.test(v)) {
    return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200';
  }
  if (/\b(lost|closed lost|danger|failed)\b/.test(v)) {
    return 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200';
  }
  if (/\b(negotiation|proposal|warning|partial)\b/.test(v)) {
    return 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100';
  }
  return 'bg-primary-50 text-primary-800 dark:bg-primary-500/15 dark:text-primary-200';
}

const calloutClass = computed(() => {
  const tone = props.visual.tone || 'insight';
  if (tone === 'success') {
    return 'border-emerald-200/80 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50';
  }
  if (tone === 'warning') {
    return 'border-amber-200/80 bg-amber-50/90 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50';
  }
  if (tone === 'danger') {
    return 'border-rose-200/80 bg-rose-50/90 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50';
  }
  return 'border-primary-200/80 bg-primary-50/70 text-primary-950 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-50';
});

const calloutIconWrap = computed(() => {
  const tone = props.visual.tone || 'insight';
  if (tone === 'success') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200';
  if (tone === 'warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200';
  if (tone === 'danger') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200';
  return 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200';
});
</script>
