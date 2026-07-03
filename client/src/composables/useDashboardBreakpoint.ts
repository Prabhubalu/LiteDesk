import { onBeforeUnmount, onMounted, ref } from 'vue';
import { adaptDashboardLayout, detectDashboardBreakpoint, type DashboardBreakpoint } from '@/utils/analyticsDashboardLayout';
import type { AnalyticsDashboardLayoutItem } from '@/types/analytics.types';

export function useDashboardBreakpoint(layout: () => AnalyticsDashboardLayoutItem[]) {
  const breakpoint = ref<DashboardBreakpoint>('desktop');
  const responsiveLayout = ref<AnalyticsDashboardLayoutItem[]>(layout());

  function syncLayout() {
    breakpoint.value = detectDashboardBreakpoint(window.innerWidth);
    responsiveLayout.value = adaptDashboardLayout(layout(), breakpoint.value);
  }

  onMounted(() => {
    syncLayout();
    window.addEventListener('resize', syncLayout);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', syncLayout);
  });

  return { breakpoint, responsiveLayout, syncLayout };
}
