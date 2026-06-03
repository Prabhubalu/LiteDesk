import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useBulkDeleteProgressStore = defineStore('bulkDeleteProgress', () => {
  const active = ref(false);
  const moduleKey = ref('');
  const phase = ref('deleting');
  const processed = ref(0);
  const total = ref(0);
  const cancelRequested = ref(false);
  /** Shown in DeleteConfirmationModal; hidden from floating banner while true. */
  const modalPinned = ref(false);

  const isActive = computed(() => active.value);

  const showInBanner = computed(() => active.value && !modalPinned.value);

  const hasBannerDelete = computed(() => showInBanner.value);

  const progressPercent = computed(() => {
    const t = Number(total.value || 0);
    if (!t) return 0;
    return Math.min(100, Math.round((Number(processed.value || 0) / t) * 100));
  });

  const progressIndeterminate = computed(
    () => active.value && Number(total.value) > 0 && Number(processed.value) === 0
  );

  function start({ moduleKey: mk, total: initialTotal = 0, phase: initialPhase = 'deleting' }) {
    active.value = true;
    moduleKey.value = String(mk || '');
    phase.value = initialPhase;
    processed.value = 0;
    total.value = Number(initialTotal || 0);
    cancelRequested.value = false;
  }

  function updateProgress({ processed: p, total: t, phase: ph }) {
    if (p != null) processed.value = Number(p);
    if (t != null) total.value = Number(t);
    if (ph) phase.value = ph;
  }

  function requestCancel() {
    cancelRequested.value = true;
  }

  function pinToModal() {
    modalPinned.value = true;
  }

  function releaseToBanner() {
    modalPinned.value = false;
  }

  function finish() {
    active.value = false;
    moduleKey.value = '';
    phase.value = 'deleting';
    processed.value = 0;
    total.value = 0;
    cancelRequested.value = false;
    modalPinned.value = false;
  }

  return {
    active,
    moduleKey,
    phase,
    processed,
    total,
    cancelRequested,
    modalPinned,
    isActive,
    showInBanner,
    hasBannerDelete,
    progressPercent,
    progressIndeterminate,
    start,
    updateProgress,
    requestCancel,
    pinToModal,
    releaseToBanner,
    finish,
  };
});
