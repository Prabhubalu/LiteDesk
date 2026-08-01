<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { formatCurrencyValue } from '@/utils/currencyOptions';
import type { CanvasWidget } from '@/astraStudio/types';

const props = defineProps<{
  widget: CanvasWidget;
}>();

const { t } = useI18n();
const loading = ref(false);
const record = ref<Record<string, unknown> | null>(null);
const error = ref('');

const LEGACY_GET: Record<string, string> = {
  deals: '/deals',
  people: '/people',
  organizations: '/organizations',
  tasks: '/tasks',
  cases: '/cases',
  quotes: '/quotes',
};

function resolveBinding() {
  const raw = props.widget.bindings?.moduleKey || props.widget.type.replace('crm.', '');
  let moduleKey = String(raw || '').toLowerCase();
  if (moduleKey === 'organization' || moduleKey === 'org' || moduleKey === 'account') {
    moduleKey = 'organizations';
  } else if (moduleKey === 'deal') {
    moduleKey = 'deals';
  } else if (moduleKey === 'person' || moduleKey === 'contact') {
    moduleKey = 'people';
  } else if (moduleKey === 'case') {
    moduleKey = 'cases';
  } else if (moduleKey === 'quote') {
    moduleKey = 'quotes';
  } else if (moduleKey === 'task') {
    moduleKey = 'tasks';
  }
  const recordId =
    props.widget.bindings?.recordId
    || (Array.isArray(props.widget.bindings?.recordIds) ? props.widget.bindings.recordIds[0] : undefined);
  return { moduleKey, recordId: recordId ? String(recordId) : '' };
}

function unwrapRecord(payload: unknown, recordId: string): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const data = root.data !== undefined ? root.data : payload;
  if (Array.isArray(data)) {
    const hit = data.find((r) => {
      if (!r || typeof r !== 'object') return false;
      const id = String((r as { _id?: unknown; id?: unknown })._id
        ?? (r as { id?: unknown }).id
        ?? '');
      return id === recordId;
    });
    return hit && typeof hit === 'object' ? (hit as Record<string, unknown>) : null;
  }
  if (data && typeof data === 'object') {
    const row = data as Record<string, unknown>;
    const id = String(row._id ?? row.id ?? '');
    if (!id || id === recordId) return row;
  }
  return null;
}

const displayName = computed(() => {
  const row = record.value;
  if (!row) return '';
  const full = `${String(row.first_name || '')} ${String(row.last_name || '')}`.trim();
  return String(row.name || row.title || row.subject || full || '').trim();
});

const stage = computed(() => {
  const v = record.value?.stage;
  return v != null && String(v).trim() ? String(v) : '';
});

const status = computed(() => {
  const v = record.value?.status;
  return v != null && String(v).trim() ? String(v) : '';
});

const amountFormatted = computed(() => {
  const raw = record.value?.amount;
  if (raw == null || raw === '') return '';
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return String(raw);
  const currencyCode = record.value?.currency != null ? String(record.value.currency) : undefined;
  return formatCurrencyValue(n, { currencyCode }) ?? String(raw);
});

const statusTone = computed(() => {
  const s = status.value.toLowerCase();
  if (/\b(won|closed won|active|open)\b/.test(s)) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/40';
  }
  if (/\b(lost|closed lost|inactive|cancelled)\b/.test(s)) {
    return 'bg-rose-50 text-rose-700 ring-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/40';
  }
  return 'bg-amber-50 text-amber-800 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/40';
});

const extraFields = computed(() => {
  const row = record.value;
  if (!row) return [] as Array<{ label: string; value: string }>;
  const out: Array<{ label: string; value: string }> = [];
  const push = (label: string, key: string) => {
    const v = row[key];
    if (v == null || v === '') return;
    out.push({ label, value: String(v) });
  };
  push(t('astraStudio.fieldOwner'), 'owner_name');
  push(t('astraStudio.fieldEmail'), 'email');
  push(t('astraStudio.fieldPhone'), 'phone');
  push(t('astraStudio.fieldIndustry'), 'industry');
  return out.slice(0, 2);
});

async function loadViaLegacy(moduleKey: string, recordId: string): Promise<Record<string, unknown> | null> {
  const base = LEGACY_GET[moduleKey];
  if (!base) return null;
  try {
    const payload = await apiClient.getOptional(`${base}/${encodeURIComponent(recordId)}`);
    return unwrapRecord(payload, recordId);
  } catch {
    return null;
  }
}

async function loadRecord(): Promise<void> {
  const { moduleKey, recordId } = resolveBinding();
  if (!moduleKey || !recordId) {
    record.value = null;
    error.value = recordId ? t('astraStudio.recordUnavailable') : t('astraStudio.noLinkedRecord');
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const batchPayload = await apiClient.postOptional(
      `/modules/${encodeURIComponent(moduleKey)}/records/batch`,
      { ids: [recordId] },
    );
    let row = unwrapRecord(batchPayload, recordId);
    if (!row) row = await loadViaLegacy(moduleKey, recordId);
    record.value = row;
    if (!row) error.value = t('astraStudio.recordUnavailable');
  } catch {
    const row = await loadViaLegacy(moduleKey, recordId);
    record.value = row;
    if (!row) error.value = t('astraStudio.recordUnavailable');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadRecord();
});

watch(
  () => [
    props.widget.bindings?.moduleKey,
    props.widget.bindings?.recordId,
    props.widget.bindings?.recordIds?.[0],
  ],
  () => {
    void loadRecord();
  },
);
</script>

<template>
  <div class="space-y-3">
    <p v-if="loading" class="text-neutral-500">{{ t('astraStudio.loading') }}</p>
    <template v-else-if="displayName">
      <div class="flex items-start gap-3">
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-[12px] font-semibold tracking-wide text-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
        >
          {{ displayName.slice(0, 2).toUpperCase() }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-[15px] font-semibold tracking-[-0.02em] text-neutral-900 dark:text-white">
            {{ displayName }}
          </p>
          <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              v-if="stage"
              class="rounded-lg bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-white/10 dark:text-neutral-200"
            >
              {{ stage }}
            </span>
            <span
              v-if="status"
              class="rounded-lg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1"
              :class="statusTone"
            >
              {{ status }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="amountFormatted"
        class="rounded-2xl bg-gradient-to-br from-primary-50/90 to-violet-50/40 px-3.5 py-3 ring-1 ring-primary-100/70 dark:from-primary-950/30 dark:to-violet-950/20 dark:ring-primary-900/40"
      >
        <p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-500/80 dark:text-primary-300/70">
          {{ t('astraStudio.fieldAmount') }}
        </p>
        <p class="mt-0.5 text-2xl font-semibold tracking-[-0.03em] text-neutral-900 dark:text-white">
          {{ amountFormatted }}
        </p>
      </div>

      <dl v-if="extraFields.length" class="grid grid-cols-2 gap-2">
        <div
          v-for="f in extraFields"
          :key="f.label"
          class="rounded-xl bg-neutral-50/90 px-2.5 py-2 ring-1 ring-black/[0.03] dark:bg-white/[0.04] dark:ring-white/[0.06]"
        >
          <dt class="text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-400">{{ f.label }}</dt>
          <dd class="mt-0.5 truncate text-[13px] font-medium text-neutral-800 dark:text-neutral-100">{{ f.value }}</dd>
        </div>
      </dl>
    </template>
    <p v-else class="text-neutral-500">{{ error || t('astraStudio.recordUnavailable') }}</p>
  </div>
</template>
