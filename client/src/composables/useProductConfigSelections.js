import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

export function optionValues(opt) {
  if (!opt) return [];
  if (Array.isArray(opt.values) && opt.values.length) return opt.values;
  return [];
}

export function resetSelectionsForOptions(selections, options = []) {
  Object.keys(selections).forEach((key) => delete selections[key]);
  for (const opt of options) {
    if (!opt?.optionName) continue;
    if (opt.optionType === 'multi_select') selections[opt.optionName] = [];
    else if (opt.optionType === 'checkbox') selections[opt.optionName] = false;
    else selections[opt.optionName] = opt.defaultValue ?? '';
  }
}

export function toggleMultiSelection(selections, optionName, value, event) {
  const checked = event?.target?.checked;
  let arr = Array.isArray(selections[optionName]) ? [...selections[optionName]] : [];
  if (checked) {
    if (!arr.includes(value)) arr.push(value);
  } else {
    arr = arr.filter((v) => v !== value);
  }
  selections[optionName] = arr;
}

export function sortProductConfigOptions(options = []) {
  return [...options]
    .filter((o) => String(o?.optionName || '').trim())
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

export function useProductConfigValidationBadge(resultRef, hasOptionsRef) {
  const { t } = useI18n();

  const badgeClass = computed(() => {
    if (!hasOptionsRef.value) {
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    }
    if (resultRef.value?.valid) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
    }
    if (resultRef.value?.errors?.length) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
    }
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  });

  const badgeLabel = computed(() => {
    if (!hasOptionsRef.value) return t('platform.productConfigRuntimeBadgeEmpty');
    if (resultRef.value?.valid) return t('platform.productConfigRuntimeBadgeValid');
    if (resultRef.value?.errors?.length) {
      return t('platform.productConfigRuntimeBadgeInvalid', { count: resultRef.value.errors.length });
    }
    return t('platform.productConfigRuntimeBadgeIdle');
  });

  return { badgeClass, badgeLabel };
}

function unwrapValidatePayload(res) {
  if (res?.data != null && typeof res.data === 'object' && !Array.isArray(res.data) && res.success !== undefined) {
    return res.data;
  }
  return res?.data ?? res ?? null;
}

export function useProductConfigValidator({ selections, debounceMs = 280 } = {}) {
  const result = ref(null);
  const validating = ref(false);
  let timer = null;

  async function validate(getRequestBody) {
    validating.value = true;
    try {
      const body = typeof getRequestBody === 'function' ? getRequestBody() : getRequestBody;
      if (!body) {
        result.value = null;
        return null;
      }
      const res = await apiClient.post('/product-configurations/validate', body);
      result.value = unwrapValidatePayload(res) || null;
      if (result.value?.selections && selections) {
        for (const [key, value] of Object.entries(result.value.selections)) {
          selections[key] = value;
        }
      }
      return result.value;
    } catch (error) {
      result.value = {
        valid: false,
        errors: [{ message: error?.response?.data?.message || error.message }],
      };
      return result.value;
    } finally {
      validating.value = false;
    }
  }

  function scheduleValidate(getRequestBody) {
    clearTimeout(timer);
    timer = setTimeout(() => validate(getRequestBody), debounceMs);
  }

  function clearValidationTimer() {
    clearTimeout(timer);
  }

  return {
    result,
    validating,
    validate,
    scheduleValidate,
    clearValidationTimer,
  };
}
