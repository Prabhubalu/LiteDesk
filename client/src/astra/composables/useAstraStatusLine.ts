import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';

/** Behind-the-scenes lines while Astra is working (v1 ambient flip). */
const AMBIENT_STATUS_KEYS = [
  'liveChat.inAppAiStatusRouting',
  'liveChat.inAppAiStatusGatheringContext',
  'liveChat.inAppAiStatusSearchingWorkspace',
  'liveChat.inAppAiStatusExpandingRecords',
  'liveChat.inAppAiStatusThinking',
  'liveChat.inAppAiStatusDrafting',
  'liveChat.inAppAiStatusShaping',
  'liveChat.inAppAiStatusPolishing',
  'liveChat.inAppAiStatusAlmostDone',
] as const;

const FLIP_MS = 2200;

/**
 * Cycles i18n status copy while `active` is true — same UX as v1 streaming progress.
 */
export function useAstraStatusLine(active: Ref<boolean>) {
  const { t } = useI18n();
  const index = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  const statusLine = computed(() => {
    if (!active.value) return '';
    const key = AMBIENT_STATUS_KEYS[index.value] || AMBIENT_STATUS_KEYS[0];
    return t(key);
  });

  function stop() {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
    index.value = 0;
  }

  function start() {
    stop();
    index.value = 0;
    timer = setInterval(() => {
      if (!active.value) {
        stop();
        return;
      }
      index.value = (index.value + 1) % AMBIENT_STATUS_KEYS.length;
    }, FLIP_MS);
  }

  watch(
    active,
    (on) => {
      if (on) start();
      else stop();
    },
    { immediate: true },
  );

  onBeforeUnmount(stop);

  return { statusLine };
}
