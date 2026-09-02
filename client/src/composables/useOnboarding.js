import { ref, computed } from 'vue';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { trackOnboardingStateTransition } from '@/config/posthogOnboarding';

const emptyState = () => ({
  version: 1,
  origin: null,
  persona: null,
  context: null,
  goalKey: null,
  startedAt: null,
  completedAt: null,
  dismissedAt: null,
  redirectTo: null,
  showWelcome: false,
  showSetupProgress: false,
  progress: { completed: 0, total: 0 },
  steps: [],
  orgProgress: { completed: 0, total: 0 },
  orgSteps: [],
  welcome: null,
  trial: null,
  goalOptions: [],
  moduleVisits: [],
  pendingCoachmarks: [],
  verticalTemplate: null,
  sampleDataOffer: null
});

const loading = ref(false);
const error = ref(null);
const state = ref(emptyState());
/** Coalesce concurrent GET /onboarding/me (GlobalSurfacesProvider + OnboardingCoachmarks). */
let fetchOnboardingInflight = null;
let onboardingFetchedAt = 0;
const ONBOARDING_FETCH_TTL_MS = 10_000;

function resolveOrganizationId(authStore) {
  return authStore.user?.organizationId || authStore.user?.organization?._id || null;
}

/**
 * User onboarding state from GET/PATCH /api/onboarding/me
 */
export function useOnboarding() {
  const authStore = useAuthStore();

  const isFounder = computed(() => state.value.persona === 'founder');
  const isMember = computed(() => state.value.persona === 'member');
  const needsOnboardingRedirect = computed(() => state.value.redirectTo === '/onboarding');
  const isComplete = computed(() => Boolean(state.value.completedAt));
  const verticalEmptyStateCopyKey = computed(
    () => state.value.verticalTemplate?.emptyStateCopyKey || null
  );

  const fetchOnboarding = async (options = {}) => {
    const force = options.force === true;
    if (
      !force
      && onboardingFetchedAt
      && Date.now() - onboardingFetchedAt < ONBOARDING_FETCH_TTL_MS
    ) {
      return;
    }
    if (fetchOnboardingInflight) {
      return fetchOnboardingInflight;
    }

    const run = async () => {
      loading.value = true;
      error.value = null;
      try {
        const prev = { ...state.value };
        const response = await apiClient('/onboarding/me', { method: 'GET' });
        if (response.success && response.data) {
          const next = { ...emptyState(), ...response.data };
          trackOnboardingStateTransition(prev, next, resolveOrganizationId(authStore));
          state.value = next;
        } else {
          state.value = emptyState();
        }
        onboardingFetchedAt = Date.now();
      } catch (err) {
        console.error('[Onboarding] fetch error:', err);
        error.value = 'Unable to load onboarding';
        state.value = emptyState();
      } finally {
        loading.value = false;
      }
    };

    fetchOnboardingInflight = run().finally(() => {
      fetchOnboardingInflight = null;
    });
    return fetchOnboardingInflight;
  };

  const patchOnboarding = async (payload) => {
    loading.value = true;
    error.value = null;
    try {
      const prev = { ...state.value };
      const response = await apiClient('/onboarding/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      if (response.success && response.data) {
        const next = { ...emptyState(), ...response.data };
        trackOnboardingStateTransition(prev, next, resolveOrganizationId(authStore), payload);
        state.value = next;
        return true;
      }
      error.value = response.message || 'Update failed';
      return false;
    } catch (err) {
      console.error('[Onboarding] patch error:', err);
      error.value = 'Unable to update onboarding';
      return false;
    } finally {
      loading.value = false;
    }
  };

  const setGoal = (goalKey) => patchOnboarding({ action: 'set_goal', goalKey });
  const skipStep = (stepKey) => patchOnboarding({ action: 'skip_step', stepKey });
  const completeStep = (stepKey) => patchOnboarding({ action: 'complete_step', stepKey });
  const setPrimaryApp = (appKey) => patchOnboarding({ action: 'set_primary_app', appKey });
  const createFirstContact = (contact) => patchOnboarding({ action: 'create_first_contact', ...contact });
  const dismissWelcome = () => patchOnboarding({ action: 'dismiss' });
  const saveWorkspace = (workspace) => patchOnboarding({ action: 'save_workspace', ...workspace });
  const markCoachmark = (key) => patchOnboarding({ action: 'mark_coachmark', key });
  const recordModuleVisit = (moduleKey, appKey) =>
    patchOnboarding({ action: 'record_module_visit', moduleKey, appKey });
  const acceptSampleData = () => patchOnboarding({ action: 'accept_sample_data' });
  const declineSampleData = () => patchOnboarding({ action: 'decline_sample_data' });
  const recordSettingsVisit = () => patchOnboarding({ action: 'record_settings_visit' });

  const hasModuleVisit = (moduleKey, appKey = 'SALES') => {
    const visits = state.value.moduleVisits || [];
    const normalizedApp = String(appKey || 'SALES').toUpperCase();
    return visits.some(
      (visit) => visit.moduleKey === moduleKey && String(visit.appKey || 'SALES').toUpperCase() === normalizedApp
    );
  };

  const applyAuthSummary = (summary) => {
    if (!summary?.redirectTo) return;
    state.value = {
      ...state.value,
      redirectTo: summary.redirectTo,
      persona: summary.persona || state.value.persona,
      origin: summary.origin || state.value.origin,
      completedAt: summary.completed ? new Date().toISOString() : state.value.completedAt
    };
  };

  return {
    loading,
    error,
    state,
    isFounder,
    isMember,
    needsOnboardingRedirect,
    isComplete,
    fetchOnboarding,
    patchOnboarding,
    setGoal,
    skipStep,
    completeStep,
    dismissWelcome,
    saveWorkspace,
    setPrimaryApp,
    createFirstContact,
    markCoachmark,
    recordModuleVisit,
    recordSettingsVisit,
    acceptSampleData,
    declineSampleData,
    hasModuleVisit,
    applyAuthSummary,
    verticalEmptyStateCopyKey,
  };
}
