/**
 * Dedup evaluation — uses configured signal weights; returns duplicate decision.
 */

function normalizeSubject(value) {
  return String(value || '')
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/gi, '')
    .trim()
    .toLowerCase();
}

function scoreDuplicate(message, candidates, dedupPolicy) {
  const signals = Array.isArray(dedupPolicy.signals) ? dedupPolicy.signals : [];
  let bestScore = 0;
  let bestSignal = null;

  const externalId = String(message.externalMessageId || '').trim();
  if (externalId) {
    const dup = (candidates.messages || []).some(
      (m) => String(m.externalMessageId || '') === externalId
    );
    if (dup) {
      return { isDuplicate: true, score: 100, signal: 'external_message_id' };
    }
  }

  for (const sig of signals) {
    if (sig.enabled === false) continue;
    const weight = Number(sig.weight) || 0;
    if (weight <= 0) continue;

    let matched = false;
    if (sig.signal === 'thread_id' && message.threadId) {
      matched = (candidates.conversations || []).some(
        (c) => String(c.externalThreadId || c.threadId || '') === String(message.threadId)
      );
    } else if (sig.signal === 'sender_subject') {
      const from = message.participants?.from;
      const addr = typeof from === 'string' ? from : from?.address || from?.email || '';
      const subject = normalizeSubject(message.subject);
      matched = (candidates.conversations || []).some((c) => {
        return (
          String(c.lastFromAddress || '').toLowerCase() === String(addr).toLowerCase()
          && normalizeSubject(c.lastSubject) === subject
        );
      });
    }

    if (matched && weight > bestScore) {
      bestScore = weight;
      bestSignal = sig.signal;
    }
  }

  const threshold = Number(dedupPolicy.matchThreshold) || 40;
  if (bestScore >= threshold) {
    return { isDuplicate: true, score: bestScore, signal: bestSignal };
  }
  return { isDuplicate: false, score: bestScore, signal: null };
}

function evaluateDedup(message, candidates, dedupPolicy) {
  const policy = dedupPolicy || {};
  const result = scoreDuplicate(message, candidates, policy);
  const behavior = result.isDuplicate
    ? policy.onDuplicate || 'append_to_existing_open_case'
    : policy.onNoDuplicate || 'continue';

  return {
    isDuplicate: result.isDuplicate,
    score: result.score,
    matchedSignal: result.signal,
    behavior,
    trace: result.isDuplicate
      ? [`duplicate detected via ${result.signal || 'unknown'} (score ${result.score})`]
      : ['no duplicate above threshold']
  };
}

module.exports = {
  evaluateDedup,
  scoreDuplicate
};
