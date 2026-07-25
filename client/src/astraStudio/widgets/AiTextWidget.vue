<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CanvasWidget } from '@/astraStudio/types';
import {
  contentLayoutForWidget,
  parseWidgetContentRows,
  type ContentTone,
} from '@/astraStudio/widgets/widgetContent';

const props = defineProps<{
  widget: CanvasWidget;
  canEdit?: boolean;
}>();

const emit = defineEmits<{
  'update:config': [config: Record<string, unknown>];
}>();

const { t } = useI18n();
const editing = ref(false);
const draft = ref('');

const body = computed(() => {
  const cfg = props.widget.config || {};
  return String(
    (cfg.body as string)
    || (cfg.summary as string)
    || (props.widget.ai?.text as string)
    || '',
  ).trim();
});

const layout = computed(() => contentLayoutForWidget(props.widget));
const rows = computed(() => (body.value ? parseWidgetContentRows(props.widget, body.value) : []));

watch(body, (v) => {
  if (!editing.value) draft.value = v;
});

const toneBadge: Record<ContentTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300',
  danger: 'bg-danger-50 text-danger-700 dark:bg-danger-950/40 dark:text-danger-300',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300',
  info: 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300',
  success: 'bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300',
};

const toneDot: Record<ContentTone, string> = {
  neutral: 'bg-neutral-300',
  danger: 'bg-danger-500',
  warning: 'bg-warning-500',
  info: 'bg-primary-500',
  success: 'bg-success-500',
};

const toneBar: Record<ContentTone, string> = {
  neutral: 'bg-neutral-200 dark:bg-white/15',
  danger: 'bg-danger-300',
  warning: 'bg-warning-300',
  info: 'bg-primary-300',
  success: 'bg-success-300',
};

const avatarTone: Record<ContentTone, string> = {
  neutral: 'bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300',
  danger: 'bg-danger-50 text-danger-700 dark:bg-danger-950/40 dark:text-danger-300',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300',
  info: 'bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300',
  success: 'bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300',
};

function badgeLabel(badge?: string): string {
  if (!badge) return '';
  if (badge === 'high') return t('astraStudio.severityHigh');
  if (badge === 'med') return t('astraStudio.severityMed');
  if (badge === 'low') return t('astraStudio.severityLow');
  if (badge === 'risk') return t('astraStudio.severityRisk');
  if (badge === 'role') return t('astraStudio.badgeRole');
  return badge;
}

function startEdit(): void {
  if (!props.canEdit) return;
  draft.value = body.value;
  editing.value = true;
}

function commitEdit(): void {
  if (!editing.value) return;
  editing.value = false;
  const next = draft.value.trim();
  if (next === body.value) return;
  emit('update:config', {
    ...props.widget.config,
    body: next,
  });
}

function cancelEdit(): void {
  editing.value = false;
  draft.value = body.value;
}

/** 1-based index among agenda items only (headings/paragraphs don't count). */
function agendaIndex(rowIdx: number): number {
  let n = 0;
  for (let i = 0; i <= rowIdx; i += 1) {
    if (rows.value[i]?.kind === 'item') n += 1;
  }
  return Math.max(1, n);
}
</script>

<template>
  <div v-if="editing" class="space-y-2">
    <textarea
      v-model="draft"
      rows="6"
      class="w-full resize-y rounded-xl border border-primary-200 bg-white px-3 py-2 text-[13.5px] leading-relaxed text-neutral-800 outline-none ring-primary-500/30 focus:ring-2 dark:border-primary-500/30 dark:bg-neutral-950 dark:text-neutral-100"
      @keydown.meta.enter.prevent="commitEdit"
      @keydown.ctrl.enter.prevent="commitEdit"
      @keydown.esc.prevent="cancelEdit"
    />
    <div class="flex gap-2">
      <button
        type="button"
        class="rounded-lg bg-primary-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-primary-600"
        @click="commitEdit"
      >
        {{ t('astraStudio.saveWidgetContent') }}
      </button>
      <button
        type="button"
        class="rounded-lg px-2.5 py-1 text-[11px] font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5"
        @click="cancelEdit"
      >
        {{ t('astraStudio.cancelWidgetEdit') }}
      </button>
    </div>
  </div>

  <div
    v-else
    class="group/content relative"
    :class="canEdit ? 'cursor-text' : ''"
    @dblclick="startEdit"
  >
    <button
      v-if="canEdit"
      type="button"
      class="absolute -right-1 -top-1 z-10 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 opacity-0 shadow-sm ring-1 ring-primary-100 transition group-hover/content:opacity-100 dark:bg-neutral-900 dark:text-primary-300 dark:ring-primary-900"
      @click.stop="startEdit"
    >
      {{ t('astraStudio.editWidgetContent') }}
    </button>

    <div v-if="!rows.length" class="text-[13.5px] text-neutral-500">
      {{ t('astraStudio.aiEmpty') }}
    </div>

    <!-- Structured body: headings / paragraphs / typed items -->
    <div v-else class="space-y-1">
      <template v-for="(row, idx) in rows" :key="idx">
        <!-- Section heading — never a bullet -->
        <h4
          v-if="row.kind === 'heading'"
          class="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500 first:pt-0 dark:text-neutral-400"
        >
          {{ row.primary }}
        </h4>

        <!-- Prose block — no bullet -->
        <p
          v-else-if="row.kind === 'paragraph'"
          class="py-1.5 text-[13.5px] font-normal leading-relaxed text-neutral-700 dark:text-neutral-200"
        >
          {{ row.primary }}
        </p>

        <!-- Agenda step -->
        <div
          v-else-if="layout === 'agenda'"
          class="flex gap-3 border-b border-black/[0.04] py-2.5 last:border-0 dark:border-white/[0.06]"
        >
          <span
            class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-500 text-[11px] font-semibold text-white"
          >
            {{ agendaIndex(idx) }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-[13.5px] font-medium leading-snug tracking-[-0.01em] text-neutral-900 dark:text-neutral-50">
              {{ row.primary }}
            </p>
            <p v-if="row.secondary" class="mt-0.5 text-[12.5px] leading-snug text-neutral-500">
              {{ row.secondary }}
            </p>
          </div>
        </div>

        <!-- Stakeholder -->
        <div
          v-else-if="layout === 'stakeholder'"
          class="flex items-start gap-3 border-b border-black/[0.04] py-2.5 last:border-0 dark:border-white/[0.06]"
        >
          <span
            class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-[11px] font-semibold tracking-wide"
            :class="avatarTone[row.tone]"
          >
            {{ row.initials }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-[13.5px] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-50">
                {{ row.primary }}
              </p>
              <span
                v-if="row.badge"
                class="rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                :class="toneBadge[row.tone]"
              >
                {{ badgeLabel(row.badge) }}
              </span>
            </div>
            <p v-if="row.secondary" class="mt-0.5 text-[12.5px] leading-snug text-neutral-500">
              {{ row.secondary }}
            </p>
          </div>
        </div>

        <!-- Risk card -->
        <div
          v-else-if="layout === 'risk'"
          class="flex gap-2.5 rounded-xl bg-neutral-50/80 px-3 py-2.5 ring-1 ring-black/[0.03] dark:bg-white/[0.04] dark:ring-white/[0.06]"
        >
          <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" :class="toneDot[row.tone]" />
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p
                  v-if="row.secondary"
                  class="text-[11px] font-semibold uppercase tracking-[0.04em] text-neutral-500"
                >
                  {{ row.primary }}
                </p>
                <p
                  class="text-[13.5px] font-medium leading-snug text-neutral-900 dark:text-neutral-50"
                  :class="row.secondary ? 'mt-0.5' : ''"
                >
                  {{ row.secondary || row.primary }}
                </p>
              </div>
              <span
                v-if="row.badge"
                class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                :class="toneBadge[row.tone]"
              >
                {{ badgeLabel(row.badge) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Talking point -->
        <div
          v-else-if="layout === 'talking'"
          class="flex gap-3 py-1"
        >
          <span class="mt-1 w-0.5 shrink-0 self-stretch rounded-full" :class="toneBar[row.tone]" />
          <div class="min-w-0">
            <p
              v-if="row.secondary"
              class="text-[11px] font-semibold uppercase tracking-[0.04em] text-neutral-500"
            >
              {{ row.primary }}
            </p>
            <p
              class="text-[13.5px] font-medium leading-snug tracking-[-0.01em] text-neutral-900 dark:text-neutral-50"
              :class="row.secondary ? 'mt-0.5' : ''"
            >
              {{ row.secondary || row.primary }}
            </p>
          </div>
        </div>

        <!-- Default list item -->
        <div
          v-else
          class="flex gap-2.5 border-b border-black/[0.04] py-2.5 last:border-0 dark:border-white/[0.06]"
        >
          <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-400/80" aria-hidden="true" />
          <div class="min-w-0">
            <p
              v-if="row.secondary"
              class="text-[11px] font-semibold uppercase tracking-[0.04em] text-neutral-500"
            >
              {{ row.primary }}
            </p>
            <a
              v-if="row.href"
              :href="row.href"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[13.5px] leading-snug text-primary-700 underline-offset-2 hover:underline dark:text-primary-300"
              :class="row.secondary ? 'mt-0.5 font-normal' : 'font-medium'"
              @click.stop
            >
              {{ row.secondary || row.primary }}
            </a>
            <p
              v-else
              class="text-[13.5px] leading-snug text-neutral-800 dark:text-neutral-100"
              :class="row.secondary ? 'mt-0.5 font-normal' : 'font-medium'"
            >
              {{ row.secondary || row.primary }}
            </p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
