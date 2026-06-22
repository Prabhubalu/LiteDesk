import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import {
  isLiveChatClosedSessionsRoute,
  isLiveChatReportsRoute,
  isLiveChatSessionsRoute,
  LIVE_CHAT_CLOSED_TAB_PATH,
} from '@/utils/liveChatTabPaths';

export function useLiveChatTabNavigation() {
  const route = useRoute();
  const {
    navigateLiveChatSessions,
    navigateLiveChatClosedSessions,
    navigateLiveChatReports,
    openLiveChatSession,
    openLiveChatClosedSession,
  } = useTabs();

  const isSessionsActive = computed(() => isLiveChatSessionsRoute(route.path));
  const isClosedActive = computed(() => isLiveChatClosedSessionsRoute(route.path));
  const isReportsActive = computed(() => isLiveChatReportsRoute(route.path));

  return {
    goToSessions: () => navigateLiveChatSessions(),
    goToClosed: () => navigateLiveChatClosedSessions(LIVE_CHAT_CLOSED_TAB_PATH),
    goToReports: () => navigateLiveChatReports(),
    openSession: openLiveChatSession,
    openClosedSession: openLiveChatClosedSession,
    isSessionsActive,
    isClosedActive,
    isReportsActive,
  };
}
