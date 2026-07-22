'use strict';

/**
 * Resolve conversation focus for anaphora ("the same meeting", "this event").
 */

const SAME_REF = /\b(the\s+)?(same|this|that|our)\s+(meeting|event|call|one)\b/i;

function refersToSameFocus(query) {
  return SAME_REF.test(String(query || ''));
}

/**
 * Pull last created/proposed event/deal/etc from assistant history text.
 */
function focusFromHistory(history = []) {
  const texts = [...(history || [])]
    .reverse()
    .map((h) => String(h?.content || ''));

  for (const text of texts) {
    const created = text.match(/\bI can create\s+"([^"]+)"/i)
      || text.match(/\bEvent created[.\s]*\(?\s*"?([^"\n)]+)/i)
      || text.match(/\bcreate(?:d)?\s+(?:a\s+)?(?:task|event|case)\s+(?:titled\s+)?["']([^"']+)["']/i);
    if (created?.[1]) {
      const name = created[1].trim();
      const isEvent = /event|meeting|calendar/i.test(text) || /event/i.test(created[0]);
      const isTask = /task/i.test(created[0]) || /task titled/i.test(text);
      if (isTask) {
        return { kind: 'tasks', moduleKey: 'tasks', name, id: undefined };
      }
      if (isEvent || /meeting/i.test(text)) {
        return { kind: 'events', moduleKey: 'events', name, id: undefined };
      }
      return { kind: 'events', moduleKey: 'events', name, id: undefined };
    }

    const prep = text.match(/\bprep(?:are)? for\s+([^\n.]+)/i);
    if (prep?.[1] && !/these events|your meeting/i.test(prep[1])) {
      return { kind: 'events', moduleKey: 'events', name: prep[1].trim().slice(0, 120), id: undefined };
    }
  }
  return null;
}

/**
 * @returns {{ kind: string, moduleKey?: string, id?: string, name?: string }|null}
 */
function resolveTurnFocus({ focus, history, query }) {
  if (focus?.name || focus?.id) return focus;
  if (refersToSameFocus(query)) {
    return focusFromHistory(history);
  }
  // Even without "same", prefer history focus for meeting_prep short follows
  return focusFromHistory(history);
}

module.exports = {
  SAME_REF,
  refersToSameFocus,
  focusFromHistory,
  resolveTurnFocus,
};
