import { ref, watch, onMounted, onUnmounted, nextTick, type Ref } from 'vue';

export function useTruncationObserver(
  targetRef: Ref<HTMLElement | null>,
  watchSources: Array<Ref<unknown> | (() => unknown)> = []
) {
  const isTruncated = ref(false);
  let resizeObserver: ResizeObserver | null = null;

  function measure() {
    const el = targetRef.value;
    if (!el) {
      isTruncated.value = false;
      return;
    }
    isTruncated.value = el.scrollWidth > el.clientWidth + 1;
  }

  function startObserving() {
    measure();
    resizeObserver?.disconnect();
    resizeObserver = null;

    const el = targetRef.value;
    if (!el || typeof ResizeObserver === 'undefined') return;

    resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(el);
  }

  function remeasure() {
    return nextTick(measure);
  }

  watch(
    watchSources,
    () => nextTick(startObserving),
    { flush: 'post' }
  );

  onMounted(() => nextTick(startObserving));
  onUnmounted(() => resizeObserver?.disconnect());

  return { isTruncated, remeasure };
}
