'use strict';

/**
 * Rule-based focus payload for platform home (no LLM — fast, deterministic).
 * Client localizes via platform.platformHomeFocus* keys.
 */

function getTimeOfDay(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function buildFocus({ attention, shell, appPulses }) {
  const overdue = attention?.summary?.overdue ?? 0;
  const dueToday = attention?.summary?.dueToday ?? 0;
  const attentionTotal = attention?.total ?? 0;
  const approvals = shell?.approvalsPending ?? 0;
  const unread = shell?.mail?.unread ?? 0;

  let dangerSignal = null;
  for (const pulse of appPulses || []) {
    for (const signal of pulse.signals || []) {
      if (signal.severity === 'danger' && signal.text !== 'No urgent items') {
        dangerSignal = signal.text;
        break;
      }
    }
    if (dangerSignal) break;
  }

  let key = 'quiet';
  if (overdue > 0) {
    key = 'overdue';
  } else if (dangerSignal) {
    key = 'app_danger';
  } else if (approvals > 0) {
    key = 'approvals';
  } else if (dueToday > 0) {
    key = 'due_today';
  } else if (unread > 0) {
    key = 'unread_mail';
  } else if (attentionTotal > 0) {
    key = 'attention';
  } else {
    const hasOnlyClearPulses = (appPulses || []).length > 0
      && (appPulses || []).every((p) =>
        (p.signals || []).every((s) => s.text === 'No urgent items' || s.severity === 'info')
      );
    key = hasOnlyClearPulses ? 'caught_up' : 'quiet';
  }

  return {
    key,
    overdue,
    dueToday,
    approvals,
    unread,
    attentionTotal,
    dangerSignal
  };
}

function buildGreetingPayload(user) {
  const firstName = (user?.firstName || '').trim();
  return {
    firstName,
    timeOfDay: getTimeOfDay()
  };
}

/** @deprecated Use buildFocus — kept for callers expecting English string during migration */
function buildFocusLine(payload) {
  const focus = buildFocus(payload);
  if (focus.key === 'overdue') {
    const extra = focus.dueToday > 0 ? ` and ${focus.dueToday} due today` : '';
    return `Start with ${focus.overdue} overdue item${focus.overdue !== 1 ? 's' : ''}${extra} — clear those first.`;
  }
  if (focus.key === 'app_danger') return `Priority: ${focus.dangerSignal}.`;
  if (focus.key === 'approvals') {
    return `${focus.approvals} approval${focus.approvals !== 1 ? 's' : ''} waiting for you.`;
  }
  if (focus.key === 'due_today') {
    return `You have ${focus.dueToday} item${focus.dueToday !== 1 ? 's' : ''} due today.`;
  }
  if (focus.key === 'unread_mail') {
    return `${focus.unread} unread email thread${focus.unread !== 1 ? 's' : ''} in your inbox.`;
  }
  if (focus.key === 'attention') {
    return `${focus.attentionTotal} thing${focus.attentionTotal !== 1 ? 's' : ''} need your attention across your apps.`;
  }
  if (focus.key === 'caught_up') {
    return "You're all caught up. Pick an app below or review what's new.";
  }
  return 'Your workspace is quiet. Open an app to get started.';
}

module.exports = {
  buildFocus,
  buildFocusLine,
  buildGreetingPayload,
  getTimeOfDay
};
