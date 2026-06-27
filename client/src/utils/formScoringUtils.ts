export interface NormalizedSectionScore {
  sectionId: string;
  sectionName: string;
  percentage: number;
  passed: number;
  failed: number;
  total: number;
  score: number;
}

interface FormSectionRef {
  sectionId: string;
  name: string;
}

interface FormWithSections {
  sections?: FormSectionRef[];
}

function resolveSectionName(sectionId: string, form?: FormWithSections | null): string {
  if (!form?.sections) return sectionId;
  const section = form.sections.find((s) => s.sectionId === sectionId);
  return section?.name ?? sectionId;
}

function normalizeEntry(
  sectionId: string,
  value: unknown,
  form?: FormWithSections | null
): NormalizedSectionScore {
  if (typeof value === 'number') {
    return {
      sectionId,
      sectionName: resolveSectionName(sectionId, form),
      percentage: value,
      passed: 0,
      failed: 0,
      total: 0,
      score: value,
    };
  }

  const entry = (value ?? {}) as Record<string, unknown>;
  const id = String(entry.sectionId ?? sectionId);
  return {
    sectionId: id,
    sectionName: String(entry.sectionName ?? resolveSectionName(id, form)),
    percentage: Number(entry.percentage ?? entry.score ?? 0),
    passed: Number(entry.passed ?? 0),
    failed: Number(entry.failed ?? 0),
    total: Number(entry.total ?? 0),
    score: Number(entry.score ?? entry.percentage ?? 0),
  };
}

export function normalizeSectionScores(
  sectionScores: unknown,
  form?: FormWithSections | null
): NormalizedSectionScore[] {
  if (!sectionScores) return [];

  if (Array.isArray(sectionScores)) {
    return sectionScores.map((entry) => {
      const record = (entry ?? {}) as Record<string, unknown>;
      const sectionId = String(record.sectionId ?? '');
      return normalizeEntry(sectionId, entry, form);
    });
  }

  if (typeof sectionScores === 'object') {
    return Object.entries(sectionScores as Record<string, unknown>).map(([sectionId, value]) =>
      normalizeEntry(sectionId, value, form)
    );
  }

  return [];
}

export function calculateOverallScoreFromSections(
  sectionScores: unknown,
  form?: FormWithSections | null
): number {
  const normalized = normalizeSectionScores(sectionScores, form);
  if (normalized.length === 0) return 0;
  const sum = normalized.reduce((acc, section) => acc + section.percentage, 0);
  return Math.round((sum / normalized.length) * 10) / 10;
}

export function getScoreTextColorClass(percentage: number): string {
  if (percentage >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (percentage >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function getScoreBarColorClass(percentage: number): string {
  if (percentage >= 80) return 'bg-emerald-500';
  if (percentage >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export function getScoreRingColor(percentage: number): string {
  if (percentage >= 80) return '#10b981';
  if (percentage >= 60) return '#f59e0b';
  return '#ef4444';
}
