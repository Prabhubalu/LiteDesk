<template>
  <section v-if="record?._id" class="space-y-3">
    <div
      v-if="isCreditNote && sourceInvoiceLink"
      class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm"
    >
      {{ t('records.invoiceCreditNoteSourceLabel') }}
      <router-link :to="sourceInvoiceLink" class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
        {{ sourceInvoiceLabel }}
      </router-link>
    </div>
    <div v-if="isDraftEditable" class="flex justify-end">
      <button
        type="button"
        class="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        :disabled="sectionBusy"
        @click="openAddSection"
      >
        {{ t('records.invoiceSectionAdd') }}
      </button>
    </div>

    <div
      v-for="block in sectionBlocks"
      :key="block.key"
      class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <div
        v-if="block.section"
        class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex flex-wrap items-center justify-between gap-2"
      >
        <div>
          <div class="font-medium text-gray-900 dark:text-gray-100">{{ block.section.sectionTitle }}</div>
          <div
            v-if="block.section.sectionAcceptanceType === 'partial'"
            class="text-[11px] text-violet-700 dark:text-violet-300 mt-0.5"
          >
            {{ t('records.invoicePartialSection') }}
          </div>
        </div>
        <div v-if="isDraftEditable && !block.section.lockedSnapshot" class="flex items-center gap-2 text-xs">
          <button
            type="button"
            class="text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            :disabled="sectionBusy"
            @click="openEditSection(block.section)"
          >
            {{ t('actions.edit') }}
          </button>
          <button
            v-if="!block.rows.length"
            type="button"
            class="text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            :disabled="sectionBusy"
            @click="deleteSection(block.section)"
          >
            {{ t('actions.delete') }}
          </button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="text-xs uppercase text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900">
            <tr>
              <th class="px-3 py-2 text-left">{{ t('records.linesName') }}</th>
              <th class="px-3 py-2 text-right">{{ t('records.linesQty') }}</th>
              <th class="px-3 py-2 text-right">{{ t('records.linesUnitPrice') }}</th>
              <th class="px-3 py-2 text-right">{{ t('records.linesTotal') }}</th>
              <th v-if="isDraftEditable" class="px-3 py-2 text-right">{{ t('records.linesActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="line in block.rows"
              :key="line._id || line.invoiceLineId"
              class="border-t border-gray-100 dark:border-gray-800"
            >
              <td class="px-3 py-2">
                <div class="font-medium text-gray-900 dark:text-gray-100">
                  {{ line.itemNameSnapshot || line.skuSnapshot || '—' }}
                </div>
                <div v-if="line.skuSnapshot" class="text-xs text-gray-500 dark:text-gray-400">
                  {{ line.skuSnapshot }}
                </div>
                <div
                  v-if="line.lineType === 'bundle_parent'"
                  class="text-[11px] text-indigo-600 dark:text-indigo-300 mt-0.5"
                >
                  {{ t('records.invoiceBundleParent') }}
                </div>
              </td>
              <td class="px-3 py-2 text-right tabular-nums">
                <input
                  v-if="isLineEditable(line)"
                  v-model.number="draftQty[line.invoiceLineId]"
                  type="number"
                  min="1"
                  class="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm text-right"
                  @change="saveQuantity(line)"
                />
                <span v-else>{{ formatQty(line.quantity) }}</span>
              </td>
              <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(line.unitPriceSnapshot) }}</td>
              <td class="px-3 py-2 text-right tabular-nums font-medium">{{ formatMoney(line.lineTotal) }}</td>
              <td v-if="isDraftEditable" class="px-3 py-2 text-right">
                <div v-if="isLineEditable(line)" class="flex flex-col items-end gap-1">
                  <select
                    v-if="sectionOptions.length > 1"
                    :value="line.invoiceSectionId ? String(line.invoiceSectionId) : ''"
                    class="max-w-[160px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs"
                    @change="moveToSection(line, $event.target.value)"
                  >
                    <option
                      v-for="section in sectionOptions"
                      :key="section._id"
                      :value="String(section._id)"
                    >
                      {{ section.sectionTitle }}
                    </option>
                  </select>
                  <button
                    type="button"
                    class="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                    :disabled="busyLineId === line.invoiceLineId"
                    @click="removeLine(line)"
                  >
                    {{ t('records.linesRemove') }}
                  </button>
                </div>
                <span v-else class="text-xs text-gray-400">{{ t('records.invoiceBundleComponentHint') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="record?.grandTotal != null"
      class="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700 text-sm"
    >
      <div class="text-gray-500 dark:text-gray-400 mr-3">{{ t('records.linesTotalsGrandTotal') }}</div>
      <div class="font-semibold tabular-nums">{{ formatMoney(record.grandTotal) }}</div>
    </div>

    <QuoteSectionFormModal
      :show="sectionModalOpen"
      :mode="sectionModalMode"
      :initial="sectionModalInitial"
      :saving="sectionBusy"
      @close="closeSectionModal"
      @submit="submitSectionModal"
    />
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { formatQuoteMoney } from '@/utils/quoteMoney';
import QuoteSectionFormModal from '@/components/record-page/sections/QuoteSectionFormModal.vue';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const notifications = useNotifications();
const busyLineId = ref('');
const sectionBusy = ref(false);
const sectionModalOpen = ref(false);
const sectionModalMode = ref('create');
const sectionModalInitial = ref(null);
const sectionModalEditingId = ref(null);
const draftQty = reactive({});

const isDraftEditable = computed(() => String(props.record?.status || '') === 'Draft');
const isCreditNote = computed(() => String(props.record?.invoiceType || 'standard') === 'credit_note');
const sourceInvoiceLabel = computed(() => {
  const src = props.record?.sourceInvoice;
  return src?.invoiceNumber || props.record?.sourceInvoiceId || '';
});
const sourceInvoiceLink = computed(() => {
  const src = props.record?.sourceInvoice;
  if (src?._id) return `/invoices/${src._id}`;
  return null;
});

const sectionOptions = computed(() => {
  const sections = Array.isArray(props.record?.sections) ? props.record.sections : [];
  return sections.filter((section) => section && section.hiddenSection !== true);
});

const sectionBlocks = computed(() => {
  const sections = Array.isArray(props.record?.sections) ? props.record.sections : [];
  const lines = Array.isArray(props.record?.lines) ? props.record.lines : [];
  const visibleLines = lines.filter((line) => line && line.hiddenLine !== true);

  const bySection = new Map();
  for (const line of visibleLines) {
    const key = line.invoiceSectionId ? String(line.invoiceSectionId) : '__none__';
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(line);
  }

  const blocks = sections
    .filter((section) => section && section.hiddenSection !== true)
    .sort((a, b) => (Number(a.sectionOrder) || 0) - (Number(b.sectionOrder) || 0))
    .map((section) => ({
      key: String(section._id),
      section,
      rows: (bySection.get(String(section._id)) || []).sort(
        (a, b) => (Number(a.lineOrder) || 0) - (Number(b.lineOrder) || 0)
      )
    }))
    .filter((block) => block.rows.length || isDraftEditable.value);

  const orphanRows = bySection.get('__none__') || [];
  if (orphanRows.length) {
    blocks.push({ key: '__none__', section: null, rows: orphanRows });
  }

  return blocks;
});

watch(
  () => props.record?.lines,
  (lines) => {
    for (const line of lines || []) {
      if (!line?.invoiceLineId) continue;
      draftQty[line.invoiceLineId] = Number(line.quantity) || 1;
    }
  },
  { immediate: true, deep: true }
);

function isLineEditable(line) {
  if (!isDraftEditable.value || !line) return false;
  const type = String(line.lineType || 'standard');
  return type === 'standard' || type === 'bundle_parent';
}

function emitSectionUpdate(payload) {
  if (typeof props.context?.onSectionUpdated === 'function') {
    props.context.onSectionUpdated({ sectionKey: 'lines', payload });
  }
}

function applyMutationToRecord({ line, totals, sections, deletedLine }) {
  if (totals && props.record) {
    Object.assign(props.record, totals);
  }
  if (Array.isArray(sections)) {
    props.record.sections = sections;
  }
  if (line && Array.isArray(props.record?.lines)) {
    const idx = props.record.lines.findIndex(
      (row) => String(row.invoiceLineId) === String(line.invoiceLineId)
    );
    if (idx >= 0) props.record.lines[idx] = line;
  }
  if (deletedLine && Array.isArray(props.record?.lines)) {
    const parentId = deletedLine._id ? String(deletedLine._id) : null;
    props.record.lines = props.record.lines.filter((row) => {
      if (String(row.invoiceLineId) === String(deletedLine.invoiceLineId)) return false;
      if (parentId && String(row.parentBundleLineId || '') === parentId) return false;
      return true;
    });
  }
}

async function saveQuantity(line) {
  const nextQty = Number(draftQty[line.invoiceLineId]);
  if (!Number.isFinite(nextQty) || nextQty <= 0) {
    draftQty[line.invoiceLineId] = Number(line.quantity) || 1;
    return;
  }
  if (nextQty === Number(line.quantity)) return;

  busyLineId.value = line.invoiceLineId;
  try {
    const res = await apiClient.patch(
      `/invoices/${props.record._id}/lines/${line.invoiceLineId}`,
      { quantity: nextQty }
    );
    if (!res?.success) {
      notifications.error(res?.message || t('records.invoiceLineUpdateFailed'));
      draftQty[line.invoiceLineId] = Number(line.quantity) || 1;
      return;
    }
    if (String(line.lineType || '') === 'bundle_parent') {
      emitSectionUpdate({ type: 'soft-refresh' });
    } else {
      applyMutationToRecord(res.data);
      emitSectionUpdate({ type: 'line-updated', ...res.data });
    }
    notifications.success(t('records.invoiceLineUpdated'));
  } catch (e) {
    notifications.error(e?.message || t('records.invoiceLineUpdateFailed'));
    draftQty[line.invoiceLineId] = Number(line.quantity) || 1;
  } finally {
    busyLineId.value = '';
  }
}

async function moveToSection(line, sectionId) {
  if (!sectionId || String(line.invoiceSectionId || '') === String(sectionId)) return;
  busyLineId.value = line.invoiceLineId;
  try {
    const res = await apiClient.patch(
      `/invoices/${props.record._id}/lines/${line.invoiceLineId}`,
      { invoiceSectionId: sectionId }
    );
    if (!res?.success) {
      notifications.error(res?.message || t('records.invoiceLineMoveFailed'));
      return;
    }
    emitSectionUpdate({ type: 'soft-refresh' });
    notifications.success(t('records.invoiceLineMoved'));
  } catch (e) {
    notifications.error(e?.message || t('records.invoiceLineMoveFailed'));
  } finally {
    busyLineId.value = '';
  }
}

async function removeLine(line) {
  if (!window.confirm(t('records.linesRemoveConfirm'))) return;
  busyLineId.value = line.invoiceLineId;
  try {
    const res = await apiClient.delete(
      `/invoices/${props.record._id}/lines/${line.invoiceLineId}`
    );
    if (!res?.success) {
      notifications.error(res?.message || t('records.invoiceLineDeleteFailed'));
      return;
    }
    applyMutationToRecord(res.data);
    emitSectionUpdate({ type: 'line-deleted', ...res.data });
    notifications.success(t('records.invoiceLineDeleted'));
  } catch (e) {
    notifications.error(e?.message || t('records.invoiceLineDeleteFailed'));
  } finally {
    busyLineId.value = '';
  }
}

function formatMoney(value) {
  return formatQuoteMoney(value, props.record?.currency || 'USD');
}

function formatQty(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : '—';
}

function openAddSection() {
  sectionModalMode.value = 'create';
  sectionModalInitial.value = null;
  sectionModalEditingId.value = null;
  sectionModalOpen.value = true;
}

function openEditSection(section) {
  sectionModalMode.value = 'edit';
  sectionModalInitial.value = {
    sectionTitle: section.sectionTitle,
    sectionType: section.sectionType || 'standard',
    includeInQuoteTotal: section.includeInInvoiceTotal !== false
  };
  sectionModalEditingId.value = section.invoiceSectionId || section._id;
  sectionModalOpen.value = true;
}

function closeSectionModal() {
  sectionModalOpen.value = false;
  sectionModalEditingId.value = null;
}

function applySectionMutation(data) {
  if (data?.totals && props.record) {
    Object.assign(props.record, data.totals);
  }
  if (Array.isArray(data?.sections)) {
    props.record.sections = data.sections;
  }
  emitSectionUpdate({ type: 'sections-updated', ...data });
}

async function submitSectionModal(form) {
  sectionBusy.value = true;
  try {
    const body = {
      sectionTitle: form.sectionTitle,
      sectionType: form.sectionType,
      includeInInvoiceTotal: form.includeInQuoteTotal
    };
    const res =
      sectionModalMode.value === 'edit' && sectionModalEditingId.value
        ? await apiClient.patch(
            `/invoices/${props.record._id}/sections/${sectionModalEditingId.value}`,
            body
          )
        : await apiClient.post(`/invoices/${props.record._id}/sections`, body);
    if (!res?.success) {
      notifications.error(res?.message || t('records.invoiceSectionSaveFailed'));
      return;
    }
    applySectionMutation(res.data);
    notifications.success(
      sectionModalMode.value === 'edit'
        ? t('records.invoiceSectionUpdated')
        : t('records.invoiceSectionCreated')
    );
    closeSectionModal();
  } catch (e) {
    notifications.error(e?.message || t('records.invoiceSectionSaveFailed'));
  } finally {
    sectionBusy.value = false;
  }
}

async function deleteSection(section) {
  if (!window.confirm(t('records.invoiceSectionDeleteConfirm'))) return;
  const sectionId = section.invoiceSectionId || section._id;
  sectionBusy.value = true;
  try {
    const res = await apiClient.delete(`/invoices/${props.record._id}/sections/${sectionId}`);
    if (!res?.success) {
      notifications.error(res?.message || t('records.invoiceSectionDeleteFailed'));
      return;
    }
    applySectionMutation(res.data);
    notifications.success(t('records.invoiceSectionDeleted'));
  } catch (e) {
    notifications.error(e?.message || t('records.invoiceSectionDeleteFailed'));
  } finally {
    sectionBusy.value = false;
  }
}
</script>
