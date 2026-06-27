import { ref } from 'vue';

export const useRecordLoading = () => {
  const loading = ref(false);
  const error = ref(null);

  const runWithLoading = async (loader, fallbackMessage = 'Failed to load record', options = {}) => {
    if (typeof loader !== 'function') return null;

    const silent = options.silent === true || options.soft === true;
    if (!silent) {
      loading.value = true;
      error.value = null;
    }
    try {
      return await loader();
    } catch (err) {
      console.error('Record loading error:', err);
      if (!silent) {
        error.value = err?.message || fallbackMessage;
      }
      return null;
    } finally {
      if (!silent) {
        loading.value = false;
      }
    }
  };

  const clearError = () => {
    error.value = null;
  };

  return {
    loading,
    error,
    runWithLoading,
    clearError
  };
};
