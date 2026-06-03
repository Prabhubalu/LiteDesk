import { nextTick } from 'vue';

/** Yield so Pinia/Vue can paint progress before more work. */
export async function yieldToUi() {
  await nextTick();
  await new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}
