import { onMounted, onUnmounted, ref } from 'vue';

export function usePortalCasePolling(pollFn, intervalMs = 30000) {
  const polling = ref(false);
  let timerId = null;

  async function tick() {
    if (polling.value || document.visibilityState === 'hidden') return;
    polling.value = true;
    try {
      await pollFn();
    } finally {
      polling.value = false;
    }
  }

  function start() {
    stop();
    timerId = window.setInterval(() => {
      void tick();
    }, intervalMs);
  }

  function stop() {
    if (timerId != null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function handleVisibility() {
    if (document.visibilityState === 'visible') {
      void tick();
    }
  }

  onMounted(() => {
    start();
    document.addEventListener('visibilitychange', handleVisibility);
  });

  onUnmounted(() => {
    stop();
    document.removeEventListener('visibilitychange', handleVisibility);
  });

  return { polling, refreshNow: tick };
}
