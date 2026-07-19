<template>
  <div class="arivu-canvas flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f4f6f9] dark:bg-neutral-950">
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="truncate text-[17px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {{ canvas?.title || t('liveChat.arivuCanvasTitle') }}
          </h1>
          <span
            class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            :class="modeBadgeClass"
          >
            {{ modeLabel }}
          </span>
        </div>
        <p
          v-if="canvas?.subtitle"
          class="mt-0.5 truncate text-[12px] text-neutral-500 dark:text-neutral-400"
        >
          {{ canvas.subtitle }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          v-if="canvas?.mode === 'presentation'"
          type="button"
          class="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          @click="void exportToContentStudio"
        >
          {{ t('liveChat.arivuCanvasExportStudio') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-violet-700"
          @click="goAstra"
        >
          {{ t('liveChat.arivuCanvasBackAstra') }}
        </button>
      </div>
    </header>

    <div
      v-if="!canvas"
      class="flex flex-1 items-center justify-center px-6"
    >
      <div class="max-w-md text-center">
        <p class="text-[15px] font-semibold text-neutral-800 dark:text-neutral-100">
          {{ t('liveChat.arivuCanvasEmptyTitle') }}
        </p>
        <p class="mt-2 text-[13px] text-neutral-500 dark:text-neutral-400">
          {{ t('liveChat.arivuCanvasEmptyBody') }}
        </p>
        <button
          type="button"
          class="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-violet-700"
          @click="goAstra"
        >
          {{ t('liveChat.arivuCanvasBackAstra') }}
        </button>
      </div>
    </div>

    <div
      v-else
      class="flex min-h-0 flex-1 flex-col"
    >
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div class="mx-auto w-full max-w-[72rem] space-y-5 px-4 py-5 pb-8 sm:px-6">
          <!-- Hero: summary + live KPIs only when present -->
          <section
            v-if="canvas.mode === 'crm'"
            class="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0 flex-1">
                <h2 class="text-[18px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                  {{ canvas.title }}
                </h2>
                <p
                  v-if="heroText"
                  class="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 dark:text-neutral-300"
                >
                  {{ heroText }}
                </p>
              </div>
              <div
                v-if="liveKpis.length"
                class="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[22rem]"
              >
                <div
                  v-for="kpi in liveKpis"
                  :key="kpi.label"
                  class="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    {{ kpi.label }}
                  </p>
                  <p class="mt-0.5 text-[15px] font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                    {{ kpi.value }}
                  </p>
                  <p
                    v-if="kpi.hint"
                    class="mt-0.5 truncate text-[10px] text-neutral-400"
                  >
                    {{ kpi.hint }}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- Dynamic widgets (server-ranked, data-backed) -->
          <section
            v-if="canvas.mode === 'crm' && displayWidgets.length"
            class="grid gap-4 md:grid-cols-2"
          >
            <article
              v-for="widget in displayWidgets"
              :key="widget.id"
              class="flex flex-col rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <button
                type="button"
                class="flex w-full items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 text-left dark:border-neutral-800"
                @click="toggleCard(widget.id)"
              >
                <span class="flex items-center gap-2 text-[13px] font-semibold text-neutral-900 dark:text-neutral-50">
                  <span
                    class="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white"
                    :class="widgetAccent(widget.type)"
                  >
                    {{ widgetInitial(widget.type) }}
                  </span>
                  {{ widget.title }}
                </span>
                <span class="text-[11px] text-neutral-400">
                  {{ collapsed[widget.id] ? '▸' : '▾' }}
                </span>
              </button>

              <div
                v-show="!collapsed[widget.id]"
                class="flex flex-1 flex-col gap-3 px-4 py-3"
              >
                <template v-if="widget.type === 'record_list'">
                  <ul class="space-y-2.5">
                    <li
                      v-for="rec in widget.records || []"
                      :key="rec.recordId || rec.label"
                      class="flex items-center gap-3"
                    >
                      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-800 dark:bg-violet-500/20 dark:text-violet-100">
                        {{ rec.initials || (rec.label || '?').slice(0, 1).toUpperCase() }}
                      </span>
                      <button
                        type="button"
                        class="min-w-0 flex-1 text-left"
                        @click="void openWidgetRecord(rec)"
                      >
                        <p class="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-50">
                          {{ rec.label }}
                        </p>
                        <p
                          v-if="rec.subtitle"
                          class="truncate text-[11px] text-neutral-500"
                        >
                          {{ rec.subtitle }}
                        </p>
                      </button>
                    </li>
                  </ul>
                </template>

                <template v-else-if="widget.type === 'detail'">
                  <p
                    v-if="widget.body"
                    class="text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-200"
                  >
                    {{ widget.body }}
                  </p>
                  <div
                    v-if="widget.headline || (widget.fields || []).length"
                    class="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <p
                      v-if="widget.headline"
                      class="text-[12px] font-semibold text-neutral-900 dark:text-neutral-50"
                    >
                      {{ widget.headline }}
                    </p>
                    <dl class="mt-2 space-y-2">
                      <div
                        v-for="field in widget.fields || []"
                        :key="field.label"
                      >
                        <dt class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                          {{ field.label }}
                        </dt>
                        <dd class="mt-0.5 text-[12.5px] leading-snug text-neutral-700 dark:text-neutral-300">
                          {{ field.value }}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div
                    v-if="(widget.links || []).length"
                    class="flex flex-wrap gap-2"
                  >
                    <button
                      v-for="link in widget.links"
                      :key="`${link.moduleKey}-${link.recordId}`"
                      type="button"
                      class="rounded-full border border-violet-200 px-2.5 py-1 text-[11px] font-medium text-violet-800 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-100"
                      @click="void openOpportunity({ id: link.recordId, moduleKey: link.moduleKey, recordId: link.recordId, label: link.label })"
                    >
                      {{ link.label }}
                    </button>
                  </div>
                </template>

                <template v-else-if="widget.type === 'notes'">
                  <div
                    v-for="section in widget.sections || []"
                    :key="section.label"
                  >
                    <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      {{ section.label }}
                    </p>
                    <ul class="mt-1.5 space-y-1">
                      <li
                        v-for="(item, idx) in section.items || []"
                        :key="`${section.label}-${idx}`"
                        class="flex gap-2 text-[13px] text-neutral-800 dark:text-neutral-200"
                      >
                        <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                        <span>{{ item }}</span>
                      </li>
                    </ul>
                  </div>
                </template>

                <template v-else-if="widget.type === 'timeline'">
                  <p
                    v-if="widget.body"
                    class="text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-200"
                  >
                    {{ widget.body }}
                  </p>
                  <ul class="space-y-2.5">
                    <li
                      v-for="(item, idx) in widget.items || []"
                      :key="`tl-${idx}`"
                      class="flex gap-2.5"
                    >
                      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[10px] font-semibold text-teal-800 dark:bg-teal-500/20 dark:text-teal-100">
                        {{ item.initials || '?' }}
                      </span>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-baseline justify-between gap-2">
                          <p class="truncate text-[12px] font-medium text-neutral-900 dark:text-neutral-50">
                            {{ item.who }}
                          </p>
                          <p class="shrink-0 text-[10px] text-neutral-400">
                            {{ item.when }}
                          </p>
                        </div>
                        <p class="text-[12px] text-neutral-600 dark:text-neutral-300">
                          {{ item.body }}
                        </p>
                      </div>
                    </li>
                  </ul>
                </template>

                <template v-else-if="widget.type === 'kpi_strip'">
                  <div class="grid grid-cols-2 gap-2">
                    <div
                      v-for="item in widget.items || []"
                      :key="String(item.label)"
                      class="rounded-lg border border-neutral-100 px-2.5 py-2 dark:border-neutral-800"
                    >
                      <p class="text-[10px] font-semibold uppercase text-neutral-500">{{ item.label }}</p>
                      <p class="text-[15px] font-semibold tabular-nums">{{ item.value }}</p>
                    </div>
                  </div>
                </template>

                <div
                  v-if="(widget.actions || []).length"
                  class="mt-auto flex flex-wrap gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800"
                >
                  <button
                    v-for="(action, aIdx) in widget.actions"
                    :key="`wa-${aIdx}`"
                    type="button"
                    class="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200"
                    @click="void onCardAction(action)"
                  >
                    {{ action.label }}
                  </button>
                </div>
              </div>
            </article>
          </section>

          <!-- Presentation slides -->
          <section
            v-if="canvas.mode === 'presentation'"
            class="space-y-3"
          >
            <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('liveChat.arivuCanvasSlides') }}
            </p>
            <article
              v-for="(slide, idx) in canvas.slides || []"
              :key="slide.id || idx"
              class="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div class="flex items-start gap-3">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[11px] font-semibold text-violet-800">
                  {{ idx + 1 }}
                </span>
                <div class="min-w-0 flex-1">
                  <h2 class="text-[15px] font-semibold text-neutral-900 dark:text-neutral-50">
                    {{ slide.title }}
                  </h2>
                  <ul
                    v-if="(slide.bullets || []).length"
                    class="mt-2 space-y-1.5"
                  >
                    <li
                      v-for="(bullet, bIdx) in slide.bullets"
                      :key="`${slide.id}-b-${bIdx}`"
                      class="flex gap-2 text-[13px] text-neutral-700 dark:text-neutral-300"
                    >
                      <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500/80" />
                      <span>{{ bullet }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </article>
          </section>

          <!-- Fallback legacy blocks -->
          <section
            v-if="canvas.mode === 'crm' && !(canvas.cards || []).length && visibleBlocks.length"
            class="space-y-3"
          >
            <AstraUiBlock
              v-for="block in visibleBlocks"
              :key="block.id || block.component"
              :visual="block"
            />
          </section>

          <section
            v-if="improviseLog.length"
            ref="improviseLogEl"
            class="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {{ t('liveChat.arivuCanvasImproviseLog') }}
            </p>
            <ul class="mt-3 space-y-2">
              <li
                v-for="(msg, idx) in improviseLog"
                :key="`im-${idx}`"
                class="rounded-lg px-3 py-2 text-[13px]"
                :class="msg.role === 'user'
                  ? 'bg-violet-50 text-violet-950 dark:bg-violet-500/10 dark:text-violet-100'
                  : 'bg-neutral-50 text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'"
              >
                <span class="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  {{ msg.role === 'user' ? 'You' : 'Astra' }}
                </span>
                <p class="mt-0.5 whitespace-pre-wrap">{{ msg.body }}</p>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <!-- Improvise / ask bar (pinned; shell viewport-locks /astra/canvas) -->
      <div class="shrink-0 z-20 border-t border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6">
        <form
          class="mx-auto w-full max-w-[42rem]"
          @submit.prevent="onImprovise"
        >
          <div class="canvas-board">
            <textarea
              v-model="draft"
              rows="2"
              class="min-h-[2.75rem] w-full resize-none border-0 bg-transparent text-[14px] leading-relaxed text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-0 dark:text-neutral-100"
              :placeholder="t('liveChat.arivuCanvasAskPlaceholder')"
              :disabled="asking"
              @keydown.enter.exact.prevent="onImprovise"
            />
            <div class="mt-1.5 flex items-center justify-end">
              <button
                type="submit"
                class="canvas-send flex h-8 w-8 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
                :disabled="asking || !draft.trim()"
                :aria-label="t('actions.send')"
              >
                <PaperAirplaneIcon
                  v-if="!asking"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                <span
                  v-else
                  class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </form>
        <p class="mx-auto mt-2 max-w-[42rem] text-center text-[10px] text-neutral-400">
          {{ t('liveChat.arivuCanvasAskDisclaimer') }}
        </p>
        <p
          v-if="askError"
          class="mx-auto mt-1 max-w-[42rem] text-center text-[11px] text-red-600"
        >
          {{ askError }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { PaperAirplaneIcon } from '@heroicons/vue/24/outline';
import AstraUiBlock from '@/components/support/AstraUiBlock.vue';
import {
  consumeArivuCanvasDocument,
  persistArivuCanvasDocument,
  type ArivuCanvasAction,
  type ArivuCanvasDocument,
  type ArivuCanvasKpi,
  type ArivuCanvasOpportunity,
  type ArivuCanvasWidget,
  type ArivuCanvasWidgetRecord,
} from '@/utils/arivuCanvasSession';
import type { InAppAiVisual } from '@/composables/useInProductAiAsk';
import { openContentStudioFromAstraAction } from '@/utils/openContentStudioFromAstra';
import { resolveModuleRecordRoute } from '@/utils/resolveModuleRecordRoute';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { activeTabId, updateTabTitle } = useTabs();
const canvas = ref<ArivuCanvasDocument | null>(null);
const canvasId = ref<string | null>(null);
const draft = ref('');
const asking = ref(false);
const askError = ref('');
const improviseLog = ref<Array<{ role: 'user' | 'assistant'; body: string }>>([]);
const collapsed = reactive<Record<string, boolean>>({});
const improviseLogEl = ref<HTMLElement | null>(null);

const modeLabel = computed(() => (
  canvas.value?.mode === 'presentation'
    ? t('liveChat.arivuCanvasModePresentation')
    : t('liveChat.arivuCanvasModeCrm')
));

const modeBadgeClass = computed(() => (
  canvas.value?.mode === 'presentation'
    ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100'
    : 'bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-100'
));

const META_BRIEF_RE = /\b(launching arivu|canvas will load|you'll see|workspace to help you prepare|use this to frame|open arivu canvas)\b/i;

const heroText = computed(() => {
  const text = String(canvas.value?.heroSummary || canvas.value?.summary || '').trim();
  if (!text || META_BRIEF_RE.test(text)) return '';
  return text;
});

const liveKpis = computed((): ArivuCanvasKpi[] => {
  const fromDoc = (canvas.value?.kpis || []).filter((k) => String(k?.value || '').trim());
  if (fromDoc.length) return fromDoc.slice(0, 6);
  const strip = (canvas.value?.widgets || []).find((w) => w.type === 'kpi_strip');
  return (strip?.items || [])
    .filter((i) => String(i?.label || '').trim() && String(i?.value ?? '').trim())
    .map((i) => ({
      label: String(i.label),
      value: String(i.value),
      hint: i.hint ? String(i.hint) : undefined,
    }))
    .slice(0, 6);
});

/** Legacy cards → widgets when older session docs lack widgets[] */
function cardsToWidgets(cards: NonNullable<ArivuCanvasDocument['cards']>): ArivuCanvasWidget[] {
  return cards.map((card) => {
    if (card.type === 'stakeholders') {
      return {
        id: card.id,
        type: 'record_list',
        title: card.title,
        records: (card.people || []).map((p) => ({
          recordId: p.recordId,
          moduleKey: p.moduleKey || 'people',
          label: p.name,
          subtitle: [p.title, p.company].filter(Boolean).join(' · '),
          initials: p.initials,
        })),
        actions: card.actions,
      };
    }
    if (card.type === 'opportunity_analysis') {
      return {
        id: card.id,
        type: 'detail',
        title: card.title,
        body: card.recap,
        headline: card.opportunityName,
        fields: card.fields,
        links: card.links,
        actions: card.actions,
      };
    }
    if (card.type === 'meeting_notes') {
      return {
        id: card.id,
        type: 'notes',
        title: card.title,
        sections: [
          ...(card.goals?.length ? [{ label: 'Goals', items: card.goals }] : []),
          ...(card.topics?.length ? [{ label: 'Topics', items: card.topics }] : []),
        ],
        actions: card.actions,
      };
    }
    if (card.type === 'conversation_recap') {
      return {
        id: card.id,
        type: 'timeline',
        title: card.title,
        body: card.recap,
        items: card.items,
        actions: card.actions,
      };
    }
    return {
      id: card.id,
      type: String(card.type || 'detail'),
      title: card.title,
      actions: card.actions,
    };
  });
}

const displayWidgets = computed((): ArivuCanvasWidget[] => {
  const widgets = canvas.value?.widgets?.length
    ? canvas.value.widgets
    : cardsToWidgets(canvas.value?.cards || []);
  // Hero already shows KPIs — skip duplicate kpi_strip in the grid
  return widgets.filter((w) => w.type !== 'kpi_strip');
});

const visibleBlocks = computed((): InAppAiVisual[] => {
  const allowed = new Set(['chart', 'kpi_strip', 'data_table', 'callout', 'progress_list']);
  const blocks = canvas.value?.blocks || [];
  return blocks
    .filter((b) => {
      if (!allowed.has(String(b.component || ''))) return false;
      if (b.component === 'callout' && b.body && META_BRIEF_RE.test(String(b.body))) return false;
      return true;
    })
    .map((b) => ({
      ...b,
      component: b.component as InAppAiVisual['component'],
      chartType: b.chartType === 'pie' || b.chartType === 'bar' || b.chartType === 'line'
        ? b.chartType
        : undefined,
      tone: b.tone === 'insight' || b.tone === 'success' || b.tone === 'warning' || b.tone === 'danger'
        ? b.tone
        : undefined,
      points: Array.isArray(b.points)
        ? b.points.map((p) => ({
          label: String(p?.label || ''),
          value: Number(p?.value) || 0,
        })).filter((p) => p.label)
        : undefined,
      items: Array.isArray(b.items)
        ? b.items.map((it) => ({
          label: String(it?.label || ''),
          value: it?.value ?? '',
          hint: it?.hint,
          max: it?.max,
        })).filter((it) => it.label)
        : undefined,
    }));
});

onMounted(() => {
  const id = typeof route.query.id === 'string' ? route.query.id : null;
  canvasId.value = id;
  canvas.value = consumeArivuCanvasDocument(id);
  if (canvas.value) {
    const next: ArivuCanvasDocument & { widgets: ArivuCanvasWidget[] } = {
      ...canvas.value,
      widgets: [...(canvas.value.widgets || [])],
    };
    scrubTimelineEchoes(next);
    const notes = next.widgets.find((w) => w.type === 'notes');
    if (notes?.sections) {
      notes.sections = notes.sections.map((s) => ({
        ...s,
        items: (s.items || []).filter((item) => !isNotesPollution(item)),
      })).filter((s) => (s.items || []).length);
    }
    canvas.value = next;
  }
  const title = canvas.value?.title?.trim() || t('liveChat.arivuCanvasTitle');
  if (activeTabId.value) {
    updateTabTitle(activeTabId.value, title.slice(0, 48));
  }
});

function toggleCard(id: string) {
  collapsed[id] = !collapsed[id];
}

function widgetAccent(type: string): string {
  if (type === 'record_list') return 'bg-violet-600';
  if (type === 'detail') return 'bg-fuchsia-600';
  if (type === 'notes') return 'bg-sky-600';
  if (type === 'timeline') return 'bg-teal-600';
  if (type === 'chart') return 'bg-amber-600';
  return 'bg-neutral-600';
}

function widgetInitial(type: string): string {
  if (type === 'record_list') return 'R';
  if (type === 'detail') return 'D';
  if (type === 'notes') return 'N';
  if (type === 'timeline') return 'T';
  if (type === 'chart') return 'C';
  return 'W';
}

function goAstra() {
  void router.push({ name: 'astra' });
}

async function openOpportunity(opp: ArivuCanvasOpportunity) {
  const dest = resolveModuleRecordRoute(opp.moduleKey, opp.recordId);
  if (!dest) return;
  if (dest.name) await router.push({ name: dest.name, params: dest.params });
  else if (dest.path) await router.push(dest.path);
}

async function openWidgetRecord(rec: ArivuCanvasWidgetRecord) {
  if (!rec.recordId || !rec.moduleKey) return;
  await openOpportunity({
    id: rec.recordId,
    moduleKey: rec.moduleKey,
    recordId: rec.recordId,
    label: rec.label,
  });
}

async function exportToContentStudio() {
  if (!canvas.value) return;
  const outline = (canvas.value.slides || [])
    .map((slide) => {
      const bullets = (slide.bullets || []).map((b) => `- ${b}`).join('\n');
      return `## ${slide.title}${bullets ? `\n${bullets}` : ''}`;
    })
    .join('\n\n');
  await openContentStudioFromAstraAction(router, {
    kind: 'open_content_studio',
    label: canvas.value.title,
    fields: {
      title: canvas.value.title,
      outline: outline || canvas.value.summary || '',
      mode: 'blog',
      summary: canvas.value.summary || '',
    },
  });
}

const META_ECHO_RE = /\b(launching arivu|canvas will load|you'll see|workspace to help you prepare|use this to frame|open arivu canvas)\b/i;

function isEchoAnswer(answer: string): boolean {
  const a = String(answer || '').trim();
  if (!a) return true;
  const hero = String(canvas.value?.heroSummary || canvas.value?.summary || '').trim();
  if (hero && a === hero) return true;
  if (hero && a.length < 200 && hero.startsWith(a.slice(0, Math.min(40, a.length)))) return true;
  if (META_ECHO_RE.test(a)) return true;
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\.\s+Meeting:/i.test(a) && a.length < 160) return true;
  return false;
}

function isNotesPollution(line: string): boolean {
  const t = String(line || '').trim();
  if (!t) return true;
  if (/^(Focus meeting|Open tasks|Pipeline value|Expired quotes|Open quotes|Last engagement)\b/i.test(t)) return true;
  if (/^Align .+ on decisions and owners$/i.test(t)) return true;
  if (/^Capture follow-ups with due dates$/i.test(t)) return true;
  if (isEchoAnswer(t)) return true;
  return false;
}

function canvasPersonHint(): string {
  const fromTitle = String(canvas.value?.title || '').match(/Prep for ([^—\-|]+)/i)?.[1]?.trim();
  if (fromTitle) return fromTitle;
  const stakeholder = (canvas.value?.widgets || [])
    .find((w) => w.type === 'record_list' && w.moduleKey === 'people');
  return String(stakeholder?.records?.[0]?.label || '').trim();
}

function detectCanvasAddIntent(text: string): 'organization' | 'stakeholder' | 'quote' | 'deal' | 'topic' | null {
  const q = String(text || '').toLowerCase();
  // Match organization / org / company / account (and common typos like "rganization")
  const orgHit = /\borgani[sz]ations?\b|\borgs?\b|\bcompany\b|\bcompanies\b|\baccounts?\b|\brgani[sz]ations?\b/.test(q);
  const actionHit = /\b(add|fetch|get|show|include|related|details?|bring|pull|load)\b/.test(q);
  if (orgHit && actionHit) return 'organization';
  if (/\b(stakeholder|contact|people|person)\b/.test(q) && actionHit) return 'stakeholder';
  if (/\bquotes?\b/.test(q) && actionHit) return 'quote';
  if (/\bdeals?\b/.test(q) && actionHit) return 'deal';
  if (/\b(topic|agenda|discussion)\b/.test(q) && /\b(add|include)\b/.test(q)) return 'topic';
  return null;
}

function upsertWidget(next: ArivuCanvasDocument, widget: ArivuCanvasWidget) {
  const widgets = next.widgets ?? (next.widgets = []);
  const idx = widgets.findIndex(
    (w) => w.id === widget.id || (w.type === widget.type && w.title === widget.title),
  );
  if (idx >= 0) widgets[idx] = { ...widgets[idx], ...widget };
  else widgets.push(widget);
}

async function searchCrmModule(
  query: string,
  moduleKey: 'organizations' | 'people' | 'quotes' | 'deals',
): Promise<Array<{ id: string; title: string; subtitle?: string; organizationId?: string; organizationName?: string }>> {
  if (!query || query.length < 2) return [];
  try {
    const response = await apiClient.get(`/search?q=${encodeURIComponent(query)}`) as Record<string, unknown>;
    const data = (response?.data && typeof response.data === 'object')
      ? response.data as Record<string, unknown>
      : response;
    const results = (data?.results && typeof data.results === 'object')
      ? data.results as Record<string, unknown>
      : data;
    const rows = Array.isArray(results?.[moduleKey])
      ? results[moduleKey] as Array<{
        id?: string;
        _id?: string;
        title?: string;
        subtitle?: string;
        name?: string;
        organizationId?: string;
        organizationName?: string;
      }>
      : [];
    return rows
      .map((r) => ({
        id: String(r.id || r._id || ''),
        title: String(r.title || r.name || '').trim(),
        subtitle: r.subtitle ? String(r.subtitle) : undefined,
        organizationId: r.organizationId ? String(r.organizationId) : undefined,
        organizationName: r.organizationName ? String(r.organizationName) : undefined,
      }))
      .filter((r) => r.id && r.title)
      .slice(0, 6);
  } catch {
    return [];
  }
}

async function findPersonByName(personName: string): Promise<{
  id: string;
  title: string;
  subtitle?: string;
  organizationId?: string;
  organizationName?: string;
} | null> {
  if (!personName || personName.length < 2) return null;
  const parts = personName.trim().split(/\s+/).filter(Boolean);

  const fromSearch = await searchCrmModule(personName, 'people');
  if (fromSearch[0]) {
    const raw = fromSearch[0] as {
      id: string;
      title: string;
      subtitle?: string;
      organizationId?: string;
      organizationName?: string;
    };
    // searchCrmModule strips extra fields — re-query full search payload below if needed
    return raw;
  }

  // Prefer last name / first name alone (global search ranks full-string poorly sometimes)
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const firstPart = parts[0];
    for (const part of [lastPart, firstPart]) {
      if (!part) continue;
      const hits = await searchCrmModule(part, 'people');
      const match = hits.find((h) => {
        const t = h.title.toLowerCase();
        return parts.every((p) => t.includes(p.toLowerCase()));
      });
      if (match) return match;
    }
  }

  const tryPeopleList = async (q: string) => {
    const res = await apiClient.get(
      `/people?search=${encodeURIComponent(q)}&limit=20&page=1`,
    ) as {
      success?: boolean;
      data?: Array<{
        _id?: string;
        id?: string;
        first_name?: string;
        last_name?: string;
        email?: string;
        organization?: { _id?: string; id?: string; name?: string } | string | null;
      }>;
    };
    const rows = Array.isArray(res?.data) ? res.data : [];
    const hit = rows.find((r) => {
      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim().toLowerCase();
      return parts.every((p) => name.includes(p.toLowerCase()));
    }) || rows[0];
    if (!hit) return null;
    const id = String(hit._id || hit.id || '');
    const title = `${hit.first_name || ''} ${hit.last_name || ''}`.trim() || String(hit.email || '');
    if (!id || !title) return null;
    const org = hit.organization && typeof hit.organization === 'object' ? hit.organization : null;
    return {
      id,
      title,
      subtitle: org?.name || hit.email || undefined,
      organizationId: org ? String(org._id || org.id || '') : (typeof hit.organization === 'string' ? hit.organization : undefined),
      organizationName: org?.name || undefined,
    };
  };

  try {
    const firstPart = parts[0];
    const lastPart = parts.length > 1 ? parts[parts.length - 1] : undefined;
    return await tryPeopleList(personName)
      || (firstPart ? await tryPeopleList(firstPart) : null)
      || (lastPart ? await tryPeopleList(lastPart) : null);
  } catch {
    return null;
  }
}

function personIdFromCanvas(): string {
  for (const o of canvas.value?.opportunities || []) {
    if (String(o.moduleKey || '').toLowerCase() === 'people' && o.recordId) {
      return String(o.recordId);
    }
  }
  for (const w of canvas.value?.widgets || []) {
    if (w.type === 'record_list') {
      for (const r of w.records || []) {
        if (r.recordId && (r.moduleKey === 'people' || w.moduleKey === 'people' || w.title === 'Stakeholders')) {
          return String(r.recordId);
        }
      }
    }
    for (const link of w.links || []) {
      if (link.moduleKey === 'people' && link.recordId) return String(link.recordId);
    }
  }
  return '';
}

function extractCompanyNameFromPrompt(userText: string): string {
  const cleaned = String(userText || '')
    .replace(/\b(add|fetch|get|show|include|related|details?|to the canvas|bring|pull|load|for|the|a|an|widget|card|panel)\b/gi, ' ')
    .replace(/\borgani[sz]ations?\b|\borgs?\b|\brgani[sz]ations?\b|\bcompany\b|\bcompanies\b|\baccounts?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const person = canvasPersonHint().toLowerCase();
  if (!cleaned || cleaned.toLowerCase() === person || cleaned.length < 2) return '';
  return cleaned;
}

function quoteIdsFromCanvas(): Array<{ id: string; title: string }> {
  const out: Array<{ id: string; title: string }> = [];
  for (const w of canvas.value?.widgets || []) {
    if (w.type === 'record_list' && w.moduleKey === 'quotes') {
      for (const r of w.records || []) {
        if (r.recordId) out.push({ id: String(r.recordId), title: r.label });
      }
    }
    if (w.type === 'detail') {
      for (const link of w.links || []) {
        if (link.moduleKey === 'quotes' && link.recordId) {
          out.push({ id: String(link.recordId), title: link.label });
        }
      }
    }
  }
  for (const o of canvas.value?.opportunities || []) {
    if (o.moduleKey === 'quotes' && o.recordId) {
      out.push({ id: String(o.recordId), title: o.label });
    }
  }
  const seen = new Set<string>();
  return out.filter((r) => {
    if (!r.id || seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }).slice(0, 4);
}

async function resolveOrganizationForCanvas(personName: string, userText: string): Promise<{
  id?: string;
  title: string;
  subtitle?: string;
  fields: Array<{ label: string; value: string }>;
  links: Array<{ moduleKey: string; recordId: string; label: string }>;
  personId?: string;
  personRecord?: {
    recordId: string;
    name: string;
    email?: string;
    title?: string;
    company?: string;
  };
} | null> {
  const companyFromPrompt = extractCompanyNameFromPrompt(userText);

  let personId = personIdFromCanvas();
  let peopleHit: Awaited<ReturnType<typeof findPersonByName>> = null;
  if (!personId && personName) {
    peopleHit = await findPersonByName(personName);
    personId = peopleHit?.id || '';
  }
  // Fast path: search hit already carried organization
  if (peopleHit?.organizationId && peopleHit.organizationName) {
    return {
      id: peopleHit.organizationId,
      title: peopleHit.organizationName,
      subtitle: 'Linked to contact',
      fields: [
        { label: 'Account name', value: peopleHit.organizationName },
        { label: 'Primary contact', value: personName || peopleHit.title },
      ],
      links: [
        { moduleKey: 'organizations', recordId: peopleHit.organizationId, label: peopleHit.organizationName },
        { moduleKey: 'people', recordId: peopleHit.id, label: personName || peopleHit.title },
      ],
      personId: peopleHit.id,
      personRecord: {
        recordId: peopleHit.id,
        name: personName || peopleHit.title,
        company: peopleHit.organizationName,
      },
    };
  }

  type PersonPayload = {
    _id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    job_title?: string;
    jobTitle?: string;
    organization?: {
      _id?: string;
      id?: string;
      name?: string;
      industry?: string;
      status?: string;
      email?: string;
      phone?: string;
      website?: string;
    } | string | null;
  };

  let personDoc: PersonPayload | null = null;
  if (personId) {
    try {
      const res = await apiClient.get(`/people/${personId}`) as { success?: boolean; data?: PersonPayload };
      personDoc = res?.data || null;
    } catch {
      personDoc = null;
    }
  }

  const displayName = personName
    || [personDoc?.first_name, personDoc?.last_name].filter(Boolean).join(' ')
    || 'Contact';
  const personRecord = personId
    ? {
      recordId: personId,
      name: displayName,
      email: personDoc?.email || '',
      title: personDoc?.job_title || personDoc?.jobTitle || '',
      company: (personDoc?.organization && typeof personDoc.organization === 'object'
        ? personDoc.organization.name
        : '') || '',
    }
    : undefined;

  const buildFromOrg = (
    org: { _id?: string; id?: string; name?: string; industry?: string; status?: string; email?: string; phone?: string; website?: string },
    source: string,
  ) => {
    const orgId = String(org._id || org.id || '');
    const title = String(org.name || '').trim();
    if (!title && !orgId) return null;
    return {
      id: orgId || undefined,
      title: title || 'Account',
      subtitle: [org.industry, org.status, source].filter(Boolean).join(' · ') || undefined,
      fields: [
        { label: 'Account name', value: title || '—' },
        ...(org.industry ? [{ label: 'Industry', value: String(org.industry) }] : []),
        ...(org.status ? [{ label: 'Status', value: String(org.status) }] : []),
        ...(org.website ? [{ label: 'Website', value: String(org.website) }] : []),
        ...(org.email ? [{ label: 'Account email', value: String(org.email) }] : []),
        ...(org.phone ? [{ label: 'Account phone', value: String(org.phone) }] : []),
        { label: 'Primary contact', value: displayName },
        ...(personDoc?.email ? [{ label: 'Contact email', value: String(personDoc.email) }] : []),
        ...(personDoc?.phone ? [{ label: 'Contact phone', value: String(personDoc.phone) }] : []),
        ...((personDoc?.job_title || personDoc?.jobTitle)
          ? [{ label: 'Contact title', value: String(personDoc.job_title || personDoc.jobTitle) }]
          : []),
      ],
      links: [
        ...(orgId ? [{ moduleKey: 'organizations', recordId: orgId, label: title || 'Open account' }] : []),
        ...(personId ? [{ moduleKey: 'people', recordId: personId, label: displayName }] : []),
      ],
      personId,
      personRecord,
    };
  };

  // 1) Explicit company name in the prompt
  if (companyFromPrompt) {
    const byName = await searchCrmModule(companyFromPrompt, 'organizations');
    if (byName[0]) {
      try {
        const orgRes = await apiClient.get(`/organizations/${byName[0].id}`) as {
          success?: boolean;
          data?: { _id?: string; name?: string; industry?: string; status?: string; email?: string; phone?: string; website?: string };
        };
        if (orgRes?.data?.name) {
          const built = buildFromOrg(orgRes.data, 'From your request');
          if (built) return built;
        }
      } catch { /* use search hit */ }
      return {
        id: byName[0].id,
        title: byName[0].title,
        subtitle: byName[0].subtitle,
        fields: [
          { label: 'Account name', value: byName[0].title },
          { label: 'Primary contact', value: displayName },
        ],
        links: [
          { moduleKey: 'organizations', recordId: byName[0].id, label: byName[0].title },
          ...(personId ? [{ moduleKey: 'people', recordId: personId, label: displayName }] : []),
        ],
        personId,
        personRecord,
      };
    }
  }

  // 2) Contact.organization
  const linked = personDoc?.organization && typeof personDoc.organization === 'object'
    ? personDoc.organization
    : null;
  if (linked?.name) {
    const built = buildFromOrg(linked, 'Linked to contact');
    if (built) return built;
  }
  if (typeof personDoc?.organization === 'string' && personDoc.organization) {
    try {
      const orgRes = await apiClient.get(`/organizations/${personDoc.organization}`) as {
        data?: { _id?: string; name?: string; industry?: string; status?: string; email?: string; phone?: string; website?: string };
      };
      if (orgRes?.data?.name) {
        const built = buildFromOrg(orgRes.data, 'Linked to contact');
        if (built) return built;
      }
    } catch { /* continue */ }
  }

  // 3) Account on related quotes (common when contact.organization is empty)
  const quoteHits = [
    ...quoteIdsFromCanvas(),
    ...(await searchCrmModule([personName, 'expired', 'quote'].filter(Boolean).join(' ') || 'quote', 'quotes')),
    ...(await searchCrmModule(personName || 'quote', 'quotes')),
  ].filter((r, idx, arr) => arr.findIndex((x) => x.id === r.id) === idx).slice(0, 5);
  for (const hit of quoteHits) {
    try {
      const qRes = await apiClient.get(`/quotes/${hit.id}`) as {
        data?: {
          organizationRefId?: { _id?: string; id?: string; name?: string; industry?: string; status?: string; email?: string; phone?: string; website?: string } | string | null;
          quoteTitle?: string;
          status?: string;
          grandTotal?: number;
          currency?: string;
        };
      };
      const ref = qRes?.data?.organizationRefId;
      if (ref && typeof ref === 'object' && ref.name) {
        const built = buildFromOrg(ref, `From quote: ${qRes.data?.quoteTitle || hit.title}`);
        if (built) {
          built.fields = [
            ...built.fields,
            ...(qRes.data?.quoteTitle ? [{ label: 'Related quote', value: String(qRes.data.quoteTitle) }] : []),
            ...(qRes.data?.status ? [{ label: 'Quote status', value: String(qRes.data.status) }] : []),
          ];
          built.links = [
            ...built.links,
            { moduleKey: 'quotes', recordId: hit.id, label: String(qRes.data?.quoteTitle || hit.title) },
          ];
          return built;
        }
      }
      if (typeof ref === 'string' && ref) {
        const orgRes = await apiClient.get(`/organizations/${ref}`) as {
          data?: { _id?: string; name?: string; industry?: string; status?: string; email?: string; phone?: string; website?: string };
        };
        if (orgRes?.data?.name) {
          const built = buildFromOrg(orgRes.data, `From quote: ${hit.title}`);
          if (built) return built;
        }
      }
    } catch { /* try next quote */ }
  }

  // 4) Always return a Salesforce-style account/contact snapshot when we have a name
  const quoteLabels = quoteHits.slice(0, 3).map((q) => q.title).filter(Boolean);
  return {
    title: displayName,
    subtitle: personId ? 'Contact account snapshot' : 'Meeting account snapshot',
    fields: [
      { label: 'Account focus', value: displayName },
      ...(personDoc?.email ? [{ label: 'Email', value: String(personDoc.email) }] : []),
      ...(personDoc?.phone ? [{ label: 'Phone', value: String(personDoc.phone) }] : []),
      ...((personDoc?.job_title || personDoc?.jobTitle)
        ? [{ label: 'Title', value: String(personDoc.job_title || personDoc.jobTitle) }]
        : []),
      ...quoteLabels.map((label, i) => ({ label: i === 0 ? 'Related quote' : `Quote ${i + 1}`, value: label })),
      ...(!personDoc?.email && !quoteLabels.length
        ? [{ label: 'Status', value: 'Open the contact to link a company, or chat the company name' }]
        : []),
    ],
    links: [
      ...(personId ? [{ moduleKey: 'people', recordId: personId, label: displayName }] : []),
      ...quoteHits.slice(0, 2).map((q) => ({ moduleKey: 'quotes', recordId: q.id, label: q.title })),
    ],
    personId: personId || undefined,
    personRecord: personRecord || (personId ? {
      recordId: personId,
      name: displayName,
      email: personDoc?.email || '',
      title: personDoc?.job_title || personDoc?.jobTitle || '',
      company: '',
    } : undefined),
  };
}

function scrubTimelineEchoes(next: ArivuCanvasDocument) {
  const widgets = next.widgets ?? (next.widgets = []);
  const timeline = widgets.find((w) => w.type === 'timeline');
  if (!timeline?.items?.length) return;
  timeline.items = timeline.items.filter((item) => {
    const body = String(item.body || '');
    if (isEchoAnswer(body)) return false;
    if (/Focus meeting:\s*Upcoming/i.test(body) && /Open tasks:/i.test(body)) return false;
    if (/Align .+ on decisions and owners/i.test(body) && body.length < 220) return false;
    return true;
  });
}

async function applyAddWidgetIntent(
  intent: 'organization' | 'stakeholder' | 'quote' | 'deal' | 'topic',
  userText: string,
): Promise<string> {
  if (!canvas.value) return '';
  type EditableCanvas = Omit<ArivuCanvasDocument, 'widgets' | 'cards'> & {
    widgets: ArivuCanvasWidget[];
    cards: NonNullable<ArivuCanvasDocument['cards']>;
  };

  const next: EditableCanvas = {
    ...canvas.value,
    widgets: [...(canvas.value.widgets || [])],
    cards: [...(canvas.value.cards || [])],
  };
  const person = canvasPersonHint();
  scrubTimelineEchoes(next);

  if (intent === 'topic') {
    const topic = userText
      .replace(/^(add|include)\s+(a\s+)?(discussion\s+)?topic\s*(to\s+(the\s+)?(meeting\s+)?notes)?\s*(for\s+.+?)?\s*:?\s*/i, '')
      .trim() || userText.trim();
    let notes = next.widgets.find((w) => w.type === 'notes');
    if (!notes) {
      notes = {
        id: `widget_notes_${Date.now()}`,
        type: 'notes',
        title: 'Meeting notes',
        sections: [{ label: 'Discussion topics', items: [topic] }],
      };
      next.widgets.push(notes);
    } else {
      const topics = notes.sections?.find((s) => /topic/i.test(s.label));
      if (topics) topics.items = [...(topics.items || []), topic].slice(0, 12);
      else notes.sections = [...(notes.sections || []), { label: 'Discussion topics', items: [topic] }];
    }
    canvas.value = next;
    if (canvasId.value) persistArivuCanvasDocument(canvasId.value, next);
    return `Added discussion topic: ${topic}`;
  }

  if (intent === 'organization') {
    const resolved = await resolveOrganizationForCanvas(person, userText);
    if (resolved?.personRecord?.recordId) {
      upsertWidget(next, {
        id: 'widget_stakeholders',
        type: 'record_list',
        title: 'Stakeholders',
        moduleKey: 'people',
        records: [{
          recordId: resolved.personRecord.recordId,
          moduleKey: 'people',
          label: resolved.personRecord.name,
          subtitle: [
            resolved.personRecord.title,
            resolved.personRecord.company || resolved.title,
            resolved.personRecord.email,
          ].filter(Boolean).join(' · '),
          initials: resolved.personRecord.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
        }],
        actions: [{
          label: '+ Add stakeholder',
          kind: 'improvise',
          prompt: `Add another stakeholder for the meeting with ${resolved.personRecord.name}`,
        }],
      });
    }
    if (resolved) {
      upsertWidget(next, {
        id: 'widget_organization',
        type: 'detail',
        title: 'Account',
        moduleKey: 'organizations',
        headline: resolved.title,
        body: resolved.subtitle || `Account context for ${person || 'this meeting'}.`,
        fields: resolved.fields,
        links: resolved.links,
        actions: [
          ...(resolved.id
            ? [{
              label: 'Open account',
              kind: 'review_record',
              moduleKey: 'organizations',
              recordId: resolved.id,
            }]
            : []),
          ...(resolved.personId
            ? [{
              label: 'Open contact',
              kind: 'review_record',
              moduleKey: 'people',
              recordId: resolved.personId,
            }]
            : []),
        ],
      });
      // Scrub KPI noise out of meeting notes
      const notes = next.widgets.find((w) => w.type === 'notes');
      if (notes?.sections) {
        notes.sections = notes.sections.map((s) => ({
          ...s,
          items: (s.items || []).filter((item) => !isNotesPollution(item)),
        })).filter((s) => (s.items || []).length);
      }
      canvas.value = next;
      if (canvasId.value) persistArivuCanvasDocument(canvasId.value, next);
      return `Added Account widget: ${resolved.title}`;
    }
    return 'Could not resolve account details. Try “Add Acme Corp organization”.';
  }

  const moduleKey = intent === 'stakeholder'
    ? 'people'
    : intent === 'quote'
      ? 'quotes'
      : 'deals';
  const companyHint = extractCompanyNameFromPrompt(userText);
  const query = companyHint || person || 'a';
  let hits = await searchCrmModule(query, moduleKey);
  if (!hits.length && person && query !== person) {
    hits = await searchCrmModule(person, moduleKey);
  }

  if (!hits.length) {
    return `No ${moduleKey} found for “${query || person}”. Try a more specific name.`;
  }

  const title = intent === 'stakeholder' ? 'Stakeholders' : intent === 'quote' ? 'Quotes' : 'Deals';
  upsertWidget(next, {
    id: `widget_${moduleKey}`,
    type: 'record_list',
    title,
    moduleKey,
    records: hits.map((h) => ({
      recordId: h.id,
      moduleKey,
      label: h.title,
      subtitle: h.subtitle,
      initials: h.title.slice(0, 1).toUpperCase(),
    })),
  });

  canvas.value = next;
  if (canvasId.value) persistArivuCanvasDocument(canvasId.value, next);
  return `Added ${hits.length} ${moduleKey} to the canvas`;
}

function applyImproviseToCanvas(answer: string, bullets: string[] = []) {
  if (!canvas.value) return;
  if (isEchoAnswer(answer) && !bullets.length) return;

  const next: Omit<ArivuCanvasDocument, 'widgets' | 'cards'> & {
    widgets: ArivuCanvasWidget[];
    cards: NonNullable<ArivuCanvasDocument['cards']>;
  } = {
    ...canvas.value,
    widgets: [...(canvas.value.widgets || [])],
    cards: [...(canvas.value.cards || [])],
  };
  const lines = [
    ...bullets.map((b) => String(b || '').trim()).filter(Boolean),
    ...String(answer || '').split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter((l) => l.length > 12 && l.length < 180),
  ].filter((l) => !isEchoAnswer(l) && !isNotesPollution(l)).slice(0, 4);

  let notes = next.widgets.find((w) => w.type === 'notes');
  if (notes && lines.length) {
    const topics = notes.sections?.find((s) => /topic/i.test(s.label));
    if (topics) {
      topics.items = [...(topics.items || []), ...lines].slice(0, 10);
    } else {
      notes.sections = [
        ...(notes.sections || []),
        { label: 'Topics', items: lines },
      ];
    }
  } else if (lines.length) {
    notes = {
      id: `widget_notes_${Date.now()}`,
      type: 'notes',
      title: 'Meeting notes',
      sections: [{ label: 'Topics', items: lines }],
    };
    next.widgets.push(notes);
  }

  const usable = String(answer || '').trim();
  if (usable && !isEchoAnswer(usable)) {
    let timeline = next.widgets.find((w) => w.type === 'timeline');
    const entry = {
      who: 'Astra',
      body: usable.slice(0, 240),
      when: 'Just now',
      initials: 'A',
    };
    if (timeline) {
      timeline.items = [entry, ...(timeline.items || [])].slice(0, 8);
    } else {
      next.widgets.push({
        id: `widget_timeline_${Date.now()}`,
        type: 'timeline',
        title: 'Conversation',
        items: [entry],
      });
    }
  }

  const legacyNotes = next.cards.find((c) => c.type === 'meeting_notes');
  if (legacyNotes && lines.length) {
    legacyNotes.topics = [...(legacyNotes.topics || []), ...lines].slice(0, 10);
  }

  canvas.value = next;
  if (canvasId.value) persistArivuCanvasDocument(canvasId.value, next);
}

async function onImprovise() {
  const text = draft.value.trim();
  if (!text || asking.value || !canvas.value) return;
  draft.value = '';
  askError.value = '';
  asking.value = true;
  improviseLog.value.push({ role: 'user', body: text });
  await nextTick();
  improviseLogEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  try {
    const addIntent = detectCanvasAddIntent(text);
    if (addIntent) {
      const confirmation = await applyAddWidgetIntent(addIntent, text);
      improviseLog.value.push({ role: 'assistant', body: confirmation });
      await nextTick();
      improviseLogEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const contextHint = [
      `Arivu Canvas: ${canvas.value.title}`,
      canvas.value.heroSummary || canvas.value.summary || '',
      ...(liveKpis.value || []).map((k) => `${k.label}: ${k.value}`),
      ...(displayWidgets.value || []).map((w) => {
        if (w.type === 'notes') {
          return `Notes: ${(w.sections || []).map((s) => `${s.label}: ${(s.items || []).join('; ')}`).join(' | ')}`;
        }
        if (w.type === 'detail') {
          return `Detail: ${w.headline || ''} — ${w.body || ''}`;
        }
        if (w.type === 'record_list') {
          return `Records: ${(w.records || []).map((r) => r.label).join(', ')}`;
        }
        return `${w.title}: ${w.type}`;
      }),
    ].filter(Boolean).join('\n').slice(0, 3000);

    const data = await apiClient.post('/ai/tenant-agents/ask', {
      question: `On Arivu Canvas "${canvas.value.title}", improvise/update the canvas: ${text}\n\nCurrent canvas context:\n${contextHint}`,
      appKey: 'SALES',
      moduleKey: '',
      recordId: '',
    }) as {
      matched?: boolean;
      answer?: string;
      structured?: { detail?: string; bullets?: string[]; headline?: string };
    };

    const answer = String(
      data?.structured?.detail
      || data?.answer
      || data?.structured?.headline
      || '',
    ).trim();
    const bullets = Array.isArray(data?.structured?.bullets)
      ? data.structured.bullets.map((b) => String(b))
      : [];
    const usable = isEchoAnswer(answer) ? '' : answer;
    const body = usable || (bullets.length ? bullets.join('\n') : t('liveChat.arivuCanvasAskEmpty'));
    improviseLog.value.push({ role: 'assistant', body: body.slice(0, 2000) });
    applyImproviseToCanvas(usable || bullets.join('\n'), bullets);
    await nextTick();
    improviseLogEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    askError.value = e?.response?.data?.message || e?.message || t('liveChat.arivuCanvasAskFailed');
  } finally {
    asking.value = false;
  }
}

async function onCardAction(action: ArivuCanvasAction) {
  if (action.kind === 'improvise' && action.prompt) {
    draft.value = String(action.prompt);
    await onImprovise();
    return;
  }
  if (action.kind === 'send_email' || action.email?.to) {
    window.dispatchEvent(new CustomEvent('arivu:open-email-compose', {
      detail: {
        to: String(action.email?.to || '').trim(),
        subject: String(action.email?.subject || action.label || '').trim(),
        body: String(action.email?.body || '').trim(),
        relatedModuleKey: action.moduleKey || '',
        relatedRecordId: action.recordId || '',
      },
    }));
    return;
  }
  if (action.moduleKey && action.recordId) {
    await openOpportunity({
      id: action.recordId,
      moduleKey: action.moduleKey,
      recordId: action.recordId,
      label: action.label,
    });
  }
}
</script>

<style scoped>
.canvas-board {
  position: relative;
  border-radius: 1.25rem;
  padding: 0.8rem 0.95rem 0.75rem;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(
      120deg,
      rgba(251, 182, 206, 0.85),
      rgba(196, 181, 253, 0.8),
      rgba(147, 197, 253, 0.85),
      rgba(251, 182, 206, 0.85)
    ) border-box;
  border: 1.5px solid transparent;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 16px 40px -28px rgba(88, 28, 135, 0.22);
}

:global(html.dark) .canvas-board {
  background:
    linear-gradient(#14161d, #14161d) padding-box,
    linear-gradient(
      120deg,
      rgba(255, 78, 102, 0.45),
      rgba(142, 46, 247, 0.5),
      rgba(50, 119, 254, 0.45)
    ) border-box;
  box-shadow: 0 16px 40px -24px rgba(0, 0, 0, 0.55);
}

.canvas-send {
  color: #fff;
  background: #171717;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.canvas-send:hover:not(:disabled) {
  transform: translateY(-1px);
}

:global(html.dark) .canvas-send {
  color: #111;
  background: #f5f5f5;
}
</style>
