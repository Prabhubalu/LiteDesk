import { useRoute } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import { getRecordModuleListPath } from '@/utils/navigationLabels';

/** Navigate from a record detail route back to its module list (mobile back). */
export function useRecordModuleBack() {
  const route = useRoute();
  const { openTab } = useTabs();

  const goBackToModuleList = () => {
    const listPath = getRecordModuleListPath(route.path);
    if (!listPath) return;
    const context = route.query?.context;
    const target =
      context != null && String(context).trim()
        ? `${listPath}?context=${encodeURIComponent(String(context))}`
        : listPath;
    openTab(target);
  };

  return { goBackToModuleList };
}
