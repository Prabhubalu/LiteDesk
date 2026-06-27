import { ref, watch, onUnmounted, unref } from 'vue';

/**
 * Animate a numeric ref toward its target with ease-out cubic easing.
 * @param {import('vue').MaybeRefOrGetter<number>} source
 * @param {{ duration?: number }} [options]
 */
export function useAnimatedCount(source, { duration = 650 } = {}) {
  const display = ref(0);
  let frame = null;

  function cancel() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  function animateTo(target) {
    cancel();
    const to = Math.max(0, Math.round(Number(target) || 0));
    const from = display.value;
    if (from === to) return;

    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      display.value = Math.round(from + (to - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        frame = null;
      }
    };

    frame = requestAnimationFrame(step);
  }

  watch(
    () => unref(source),
    (value) => animateTo(value),
    { immediate: true }
  );

  onUnmounted(cancel);

  return display;
}
