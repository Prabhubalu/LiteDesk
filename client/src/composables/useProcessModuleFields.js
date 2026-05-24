/**
 * Load module field metadata (picklist options, types) for process designer IF conditions.
 */

import { ref, watch, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import { ENTITY_TYPE_TO_MODULE_KEY } from '@/utils/processDesignerConstants';

function normalizeFieldOptions(field, moduleDoc) {
  const raw = field?.options;
  let options = [];

  if (Array.isArray(raw) && raw.length) {
    options = raw.map((opt) => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      const value = opt?.value ?? opt?.label ?? '';
      const label = opt?.label ?? opt?.value ?? value;
      return { value: String(value), label: String(label) };
    });
  }

  const key = String(field?.key || '').toLowerCase();
  if (!options.length && key === 'stage' && Array.isArray(moduleDoc?.pipelineSettings)) {
    const names = new Set();
    for (const pipeline of moduleDoc.pipelineSettings) {
      for (const stage of pipeline.stages || []) {
        const name = (stage?.name || '').trim();
        if (name) names.add(name);
      }
    }
    options = [...names].sort().map((name) => ({ value: name, label: name }));
  }

  return options;
}

function inferValueInputType(fieldMeta) {
  if (!fieldMeta) return 'text';
  if (fieldMeta.options?.length) return 'select';

  const t = String(fieldMeta.dataType || '').toLowerCase();
  if (t.includes('picklist') || t.includes('select') || t.includes('enum') || t.includes('dropdown')) {
    return fieldMeta.options?.length ? 'select' : 'text';
  }
  if (t.includes('number') || t.includes('currency') || t.includes('decimal') || t.includes('integer')) {
    return 'number';
  }
  if (t.includes('boolean') || t.includes('checkbox')) {
    return 'boolean';
  }
  return 'text';
}

/**
 * @param {import('vue').Ref<string>|import('vue').ComputedRef<string>} entityTypeRef
 */
export function useProcessModuleFields(entityTypeRef) {
  const loading = ref(false);
  const loadError = ref(null);
  /** @type {import('vue').Ref<Record<string, { key: string, label: string, dataType: string, options: Array<{value:string,label:string}>, valueInputType: string }>>} */
  const fieldMetaByKey = ref({});

  const moduleKey = computed(() => {
    const et = entityTypeRef?.value ?? entityTypeRef;
    return ENTITY_TYPE_TO_MODULE_KEY[et] || et || null;
  });

  async function load() {
    const key = moduleKey.value;
    if (!key) {
      fieldMetaByKey.value = {};
      return;
    }

    loading.value = true;
    loadError.value = null;
    try {
      const res = await apiClient.get('/modules', { params: { key } });
      if (!res?.success || !Array.isArray(res.data) || !res.data[0]) {
        fieldMetaByKey.value = {};
        return;
      }

      const mod = res.data[0];
      const map = {};
      for (const f of mod.fields || []) {
        const fieldKey = f?.key;
        if (!fieldKey) continue;
        const options = normalizeFieldOptions(f, mod);
        const entry = {
          key: fieldKey,
          label: f.label || fieldKey,
          dataType: f.dataType || f.type || 'Text',
          options,
          valueInputType: 'text'
        };
        entry.valueInputType = inferValueInputType(entry);
        map[fieldKey] = entry;
      }
      fieldMetaByKey.value = map;
    } catch (e) {
      loadError.value = e.message || 'Failed to load module fields';
      fieldMetaByKey.value = {};
    } finally {
      loading.value = false;
    }
  }

  watch(moduleKey, load, { immediate: true });

  function getFieldMeta(fieldKey) {
    if (!fieldKey) return null;
    return fieldMetaByKey.value[fieldKey] || null;
  }

  return {
    loading,
    loadError,
    fieldMetaByKey,
    moduleKey,
    load,
    getFieldMeta,
    inferValueInputType
  };
}
