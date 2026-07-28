import { confirmAction } from '@/composables/useConfirmAction';
import router from '@/router';
import { i18n } from '@/i18n';

let installCount = 0;
let beforeUnloadHandler = null;
let removeRouterGuard = null;

const t = i18n.global.t.bind(i18n.global);

function leaveConfirmMessage(activeSource) {
  const operation = activeSource?.operation?.value ?? activeSource?.operation;
  if (operation === 'update') return t('common.bulkUpdateLeaveConfirm');
  return t('common.bulkDeleteLeaveConfirm');
}

/**
 * @param {import('vue').Ref<boolean>|{ isActive: boolean }} activeSource
 */
export function installBulkDeleteGuard(activeSource) {
  installCount += 1;
  if (installCount > 1) return;

  beforeUnloadHandler = (event) => {
    const isActive = typeof activeSource?.value === 'boolean'
      ? activeSource.value
      : !!activeSource?.isActive;
    if (!isActive) return;
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', beforeUnloadHandler);

  removeRouterGuard = router.beforeEach(async (to, from) => {
    const isActive = typeof activeSource?.value === 'boolean'
      ? activeSource.value
      : !!activeSource?.isActive;
    if (!isActive) return true;
    if (await confirmAction(leaveConfirmMessage(activeSource))) {
      return true;
    }
    return false;
  });
}

export function uninstallBulkDeleteGuard() {
  installCount = Math.max(0, installCount - 1);
  if (installCount > 0) return;

  if (beforeUnloadHandler) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  }
  if (removeRouterGuard) {
    removeRouterGuard();
    removeRouterGuard = null;
  }
}

/**
 * @returns {Promise<boolean>} true if caller should abort the close/navigation
 */
export async function confirmBulkDeleteInterrupt(isActive, activeSource = null) {
  if (!isActive) return false;
  return !(await confirmAction(leaveConfirmMessage(activeSource)));
}
