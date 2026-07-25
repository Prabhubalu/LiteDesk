<template>
  <div class="line-tax-cell">
    <button
      type="button"
      class="line-tax-cell__btn"
      :disabled="disabled"
      @click="open = true"
    >
      <span class="tabular-nums">{{ summaryLabel }}</span>
      <span class="line-tax-cell__edit">{{ t('actions.edit') }}</span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4" @click.self="open = false">
        <div class="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-800">
          <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('records.linesTaxPickerTitle') }}</h3>
            <p class="mt-0.5 text-xs text-gray-500">{{ t('records.linesTaxPickerDesc') }}</p>
          </div>
          <div class="max-h-72 space-y-2 overflow-y-auto px-4 py-3">
            <div v-if="loading" class="flex justify-center py-6">
              <div class="h-6 w-6 animate-spin rounded-full border-b-2 border-indigo-600" />
            </div>
            <p v-else-if="!options.length" class="text-sm text-gray-500">{{ t('records.linesTaxPickerEmpty') }}</p>
            <label
              v-for="opt in options"
              :key="opt.id"
              class="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
            >
              <HeadlessCheckbox
                :model-value="selectedIds.includes(opt.id)"
                @update:model-value="(checked) => toggle(opt.id, checked)"
              />
              <span>{{ opt.label }}</span>
            </label>
          </div>
          <div class="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
            <button type="button" class="px-3 py-1.5 text-sm text-gray-600" @click="open = false">{{ t('actions.cancel') }}</button>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="saving"
              @click="save"
            >
              {{ saving ? t('states.saving') : t('actions.save') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Teleport } from 'vue';
import apiClient from '@/utils/apiClient';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';

const props = defineProps({
  taxSnapshot: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
  lineTaxTotal: { type: Number, default: 0 }
});

const emit = defineEmits(['save']);

const { t } = useI18n();
const open = ref(false);
const loading = ref(false);
const saving = ref(false);
const options = ref([]);
const selectedIds = ref([]);

const summaryLabel = computed(() => {
  const taxes = props.taxSnapshot?.taxes;
  if (Array.isArray(taxes) && taxes.length) {
    const names = taxes.map((x) => x.name || `${x.taxValue}%`).join(', ');
    return names.length > 28 ? `${names.slice(0, 28)}…` : names;
  }
  if (Number(props.lineTaxTotal) > 0) return String(props.lineTaxTotal);
  return t('records.linesTaxNone');
});

function syncSelectedFromSnapshot() {
  const taxes = props.taxSnapshot?.taxes;
  selectedIds.value = Array.isArray(taxes)
    ? taxes.map((x) => String(x.taxId || x._id || '')).filter(Boolean)
    : [];
}

async function loadOptions() {
  loading.value = true;
  try {
    const res = await apiClient.get('/taxes', { params: { scope: 'ITEM', applicableOn: 'SALES' } });
    const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    options.value = rows.map((r) => ({
      id: String(r._id),
      label: `${r.name} (${r.taxValue}%)`
    }));
  } catch {
    options.value = [];
  } finally {
    loading.value = false;
  }
}

function toggle(id, checked) {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id];
  } else {
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
  }
}

async function save() {
  saving.value = true;
  try {
    emit('save', [...selectedIds.value]);
    open.value = false;
  } finally {
    saving.value = false;
  }
}

watch(open, (v) => {
  if (v) {
    syncSelectedFromSnapshot();
    if (!options.value.length) loadOptions();
  }
});

onMounted(syncSelectedFromSnapshot);
</script>

<style scoped>
.line-tax-cell__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 9rem;
  border-radius: 0.375rem;
  border: 1px solid rgb(209 213 219);
  background: white;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: rgb(55 65 81);
}
.dark .line-tax-cell__btn {
  border-color: rgb(75 85 99);
  background: rgb(31 41 55);
  color: rgb(229 231 235);
}
.line-tax-cell__edit {
  color: rgb(79 70 229);
  font-weight: 500;
}
.line-tax-cell__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
