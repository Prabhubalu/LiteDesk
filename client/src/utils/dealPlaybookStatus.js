/**
 * Summarize deal playbookState for list/kanban badges.
 * @param {object|null|undefined} playbookState
 * @returns {null|{
 *   visible: boolean,
 *   variant: 'complete'|'in_progress'|'blocked',
 *   completed: number,
 *   total: number,
 *   pending: number,
 *   blocked: number
 * }}
 */
export function getDealPlaybookStatusSummary(playbookState) {
  const actions = Array.isArray(playbookState?.actions) ? playbookState.actions : [];
  if (!actions.length) {
    return null;
  }

  const requiredActions = actions.filter((action) => action.required !== false);
  const targetActions = requiredActions.length > 0 ? requiredActions : actions;

  const completed = targetActions.filter((action) => action.status === 'completed').length;
  const pending = targetActions.filter((action) => action.status === 'pending').length;
  const blocked = targetActions.filter((action) => action.status === 'blocked').length;
  const total = targetActions.length;

  if (playbookState.exitCriteriaMet === true || completed === total) {
    return {
      visible: true,
      variant: 'complete',
      completed: total,
      total,
      pending: 0,
      blocked: 0
    };
  }

  if (pending === 0 && blocked > 0) {
    return {
      visible: true,
      variant: 'blocked',
      completed,
      total,
      pending,
      blocked
    };
  }

  return {
    visible: true,
    variant: 'in_progress',
    completed,
    total,
    pending,
    blocked
  };
}
