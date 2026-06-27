import { ref, watch, onMounted, onActivated, onUnmounted } from 'vue';
import { resolveRecordDetailRefreshOnActivate } from '@/utils/recordDetailRefreshPolicy';

const resolveValue = (value) => {
  if (typeof value === 'function') return value();
  if (value && typeof value === 'object' && 'value' in value) return value.value;
  return value;
};

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const hasItems = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  return !!value;
};

const runCallbacks = async (callbacks, payload) => {
  for (const callback of callbacks) {
    if (typeof callback !== 'function') continue;
    await callback(payload);
  }
};

export const useRecordPageLifecycle = (options = {}) => {
  const activationTick = ref(0);

  const route = options.route;
  const isEmbed = () => !!resolveValue(options.embed);
  const getRecordId = () => resolveValue(options.recordId);

  const isCurrentRecordRoute = (path) => {
    const matcher = options.routeRecordMatcher;
    if (typeof matcher === 'function') {
      return !!matcher({ path, route, recordId: getRecordId() });
    }

    const prefix = options.routePrefix;
    const recordId = getRecordId();
    if (!prefix || !recordId || !path) return false;
    return String(path).includes(`${prefix}/${recordId}`);
  };

  const onMountCallbacks = toArray(options.onMount);
  const onActivatedCallbacks = toArray(options.onActivated);
  const onUnmountedCallbacks = toArray(options.onUnmounted);

  if (typeof options.embedRecordIdSource === 'function' && typeof options.fetchRecord === 'function') {
    watch(options.embedRecordIdSource, async (id, previousId) => {
      const shouldFetch = typeof options.shouldRefetchOnEmbedIdChange === 'function'
        ? options.shouldRefetchOnEmbedIdChange({ id, previousId, embed: isEmbed() })
        : isEmbed() && !!id;

      if (!shouldFetch) return;
      await options.fetchRecord();
    }, { immediate: false });
  }

  const contentReadySources = Array.isArray(options.contentReadySources) ? options.contentReadySources : [];
  if (typeof options.onContentReady === 'function') {
    for (const source of contentReadySources) {
      if (typeof source !== 'function') continue;
      watch(source, (next, previous) => {
        const hadItems = hasItems(previous);
        const hasNextItems = hasItems(next);
        if (!hadItems && hasNextItems) {
          options.onContentReady({ next, previous });
        }
      }, { deep: true });
    }
  }

  watch(activationTick, (tick) => {
    if (tick === 0) return;
    if (typeof options.onReactivated === 'function') {
      options.onReactivated({ tick, route, recordId: getRecordId() });
    }
  });

  if (route && typeof options.onRouteChange === 'function') {
    watch(() => route.fullPath, (path, previousPath) => {
      options.onRouteChange({ path, previousPath, route, recordId: getRecordId() });
    });
  }

  if (route && typeof options.onRouteReturn === 'function') {
    watch(() => route.fullPath, (path) => {
      if (isEmbed()) return;
      if (!isCurrentRecordRoute(path)) return;
      options.onRouteReturn({ path, route, recordId: getRecordId() });
    });
  }

  onActivated(async () => {
    if (!isEmbed()) {
      activationTick.value += 1;
    }

    const freshness = options.freshness;
    const recordId = getRecordId();
    if (freshness && recordId && typeof options.fetchRecord === 'function') {
      const decision = await resolveRecordDetailRefreshOnActivate(freshness, recordId);
      if (decision === 'refresh') {
        await options.fetchRecord({ reason: decision });
      }
    }

    await runCallbacks(onActivatedCallbacks, { route, recordId: getRecordId(), activationTick: activationTick.value });
  });

  onMounted(async () => {
    if (typeof options.fetchRecord === 'function' && options.fetchOnMount !== false) {
      await options.fetchRecord();
    }
    await runCallbacks(onMountCallbacks, { route, recordId: getRecordId() });
  });

  onUnmounted(async () => {
    await runCallbacks(onUnmountedCallbacks, { route, recordId: getRecordId() });
  });

  return {
    activationTick
  };
};
