/**
 * @param {object} runA
 * @param {object} runB
 */
export function compareRuns(runA, runB) {
  const byA = new Map((runA.results || []).map((r) => [r.caseId, r]));
  const byB = new Map((runB.results || []).map((r) => [r.caseId, r]));
  const caseIds = [...new Set([...byA.keys(), ...byB.keys()])].sort();

  const changes = [];
  let same = 0;

  for (const caseId of caseIds) {
    const a = byA.get(caseId);
    const b = byB.get(caseId);
    const statusA = a?.status ?? null;
    const statusB = b?.status ?? null;
    if (statusA === statusB) {
      same += 1;
      continue;
    }
    changes.push({
      caseId,
      title: b?.title || a?.title,
      statusA,
      statusB,
      layer: b?.layer || a?.layer,
    });
  }

  return {
    runA: { runId: runA.runId, envKey: runA.envKey, suiteKey: runA.suiteKey, status: runA.status, stats: runA.stats },
    runB: { runId: runB.runId, envKey: runB.envKey, suiteKey: runB.suiteKey, status: runB.status, stats: runB.stats },
    summary: { totalCases: caseIds.length, unchanged: same, changed: changes.length },
    changes,
  };
}
