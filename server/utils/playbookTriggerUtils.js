'use strict';

function shouldAutoCreateImmediately(action) {
  if (!action || action.autoCreate === false) return false;
  const triggerType = action?.trigger?.type || 'stage_entry';
  return triggerType === 'stage_entry';
}

function shouldAutoCreateOnAfterAction(action) {
  if (!action || action.autoCreate === false) return false;
  return action?.trigger?.type === 'after_action';
}

function shouldAutoCreateWhenUnblocked(action) {
  return shouldAutoCreateImmediately(action) || shouldAutoCreateOnAfterAction(action);
}

function shouldAutoCreateOnDelay(action) {
  if (!action || action.autoCreate === false) return false;
  return action?.trigger?.type === 'time_delay';
}

function computeTriggerDelayRunAt(anchorDate, delay = {}) {
  const base = anchorDate instanceof Date ? new Date(anchorDate) : new Date(anchorDate || Date.now());
  const amount = Math.max(0, Number(delay.amount) || 0);
  const unit = delay.unit || 'hours';
  const runAt = new Date(base);

  if (unit === 'minutes') {
    runAt.setMinutes(runAt.getMinutes() + amount);
  } else if (unit === 'days') {
    runAt.setDate(runAt.getDate() + amount);
  } else {
    runAt.setHours(runAt.getHours() + amount);
  }

  return runAt;
}

module.exports = {
  shouldAutoCreateImmediately,
  shouldAutoCreateOnAfterAction,
  shouldAutoCreateWhenUnblocked,
  shouldAutoCreateOnDelay,
  computeTriggerDelayRunAt
};
