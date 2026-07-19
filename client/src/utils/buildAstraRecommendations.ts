/**
 * Map Platform Home snapshot → Astra suggestion cards.
 * Productivity order mirrors server buildFocus: overdue → approvals → due today → mail → attention → resume.
 */

import type { Component } from 'vue';
import {
  BriefcaseIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  SparklesIcon,
} from '@heroicons/vue/24/outline';

export type AstraRecommendationCard = {
  id: string;
  title: string;
  hint: string;
  prompt: string;
  reason: string;
  icon: Component;
};

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

type AttentionItemLike = {
  id?: string;
  title?: string;
  attentionLabel?: string;
  isOverdue?: boolean;
  dueAt?: string | Date | null;
  sourceApp?: string;
};

type ResumeItemLike = {
  id?: string;
  title?: string;
  route?: string;
  moduleKey?: string;
  sourceApp?: string;
  updatedAt?: string | null;
};

type NextEventLike = {
  id?: string;
  title?: string;
  startAt?: string | null;
};

export type AstraRecommendationSnapshot = {
  attention?: {
    items?: AttentionItemLike[];
    total?: number;
    summary?: { total?: number; overdue?: number; dueToday?: number };
  };
  shell?: {
    approvalsPending?: number;
    nextEvent?: NextEventLike | null;
    mail?: { unread?: number };
    documents?: { pendingReview?: number; expiringSoon?: number };
  };
  resume?: ResumeItemLike[];
  focus?: {
    key?: string;
    overdue?: number;
    dueToday?: number;
    approvals?: number;
    unread?: number;
  } | null;
};

const MAX_CARDS = 4;

function trimTitle(value: unknown, fallback: string, maxLen = 42): string {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

function pluralCountLabel(
  t: TranslateFn,
  singularKey: string,
  pluralKey: string,
  count: number,
): string {
  return count === 1 ? t(singularKey, { count }) : t(pluralKey, { count });
}

function isDueToday(dueAt: string | Date | null | undefined): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return due >= today && due < tomorrow;
}

function resumeIcon(moduleKey: string): Component {
  switch (moduleKey) {
    case 'deals':
      return BriefcaseIcon;
    case 'tasks':
      return ClipboardDocumentListIcon;
    case 'cases':
      return ExclamationTriangleIcon;
    case 'documents':
      return DocumentTextIcon;
    default:
      return SparklesIcon;
  }
}

function resumePrompt(item: ResumeItemLike, t: TranslateFn): string {
  const title = trimTitle(item.title, t('liveChat.astraRecRecordFallback'));
  const moduleKey = String(item.moduleKey || '').toLowerCase();
  if (moduleKey === 'deals') {
    return t('liveChat.astraRecResumeDealPrompt', { title });
  }
  if (moduleKey === 'tasks') {
    return t('liveChat.astraRecResumeTaskPrompt', { title });
  }
  if (moduleKey === 'cases') {
    return t('liveChat.astraRecResumeCasePrompt', { title });
  }
  return t('liveChat.astraRecResumeGenericPrompt', { title });
}

function staticFallbackCards(t: TranslateFn): AstraRecommendationCard[] {
  return [
    {
      id: 'fallback-prioritize',
      title: t('liveChat.astraCardFindTitle'),
      hint: t('liveChat.astraCardFindHint'),
      prompt: t('liveChat.astraCardFindPrompt'),
      reason: t('liveChat.astraRecReasonFallback'),
      icon: MagnifyingGlassIcon,
    },
    {
      id: 'fallback-summarize',
      title: t('liveChat.astraCardSummarizeTitle'),
      hint: t('liveChat.astraCardSummarizeHint'),
      prompt: t('liveChat.astraCardSummarizePrompt'),
      reason: t('liveChat.astraRecReasonFallback'),
      icon: ClipboardDocumentListIcon,
    },
    {
      id: 'fallback-draft',
      title: t('liveChat.astraCardDraftTitle'),
      hint: t('liveChat.astraCardDraftHint'),
      prompt: t('liveChat.astraCardDraftPrompt'),
      reason: t('liveChat.astraRecReasonFallback'),
      icon: PencilSquareIcon,
    },
    {
      id: 'fallback-brainstorm',
      title: t('liveChat.astraCardBrainstormTitle'),
      hint: t('liveChat.astraCardBrainstormHint'),
      prompt: t('liveChat.astraCardBrainstormPrompt'),
      reason: t('liveChat.astraRecReasonFallback'),
      icon: SparklesIcon,
    },
  ];
}

/**
 * Build up to 4 productivity-first recommendation cards for the current user.
 */
export function buildAstraRecommendations(
  snapshot: AstraRecommendationSnapshot | null | undefined,
  t: TranslateFn,
): AstraRecommendationCard[] {
  const cards: AstraRecommendationCard[] = [];
  const seen = new Set<string>();

  const push = (card: AstraRecommendationCard | null) => {
    if (!card || cards.length >= MAX_CARDS) return;
    if (seen.has(card.id)) return;
    seen.add(card.id);
    cards.push(card);
  };

  const attentionItems = Array.isArray(snapshot?.attention?.items)
    ? snapshot.attention.items
    : [];
  const summary = snapshot?.attention?.summary || {};
  const overdueCount = Number(snapshot?.focus?.overdue ?? summary.overdue ?? 0);
  const dueTodayCount = Number(snapshot?.focus?.dueToday ?? summary.dueToday ?? 0);
  const approvalsPending = Number(
    snapshot?.focus?.approvals ?? snapshot?.shell?.approvalsPending ?? 0,
  );
  const unreadMail = Number(snapshot?.focus?.unread ?? snapshot?.shell?.mail?.unread ?? 0);
  const pendingReview = Number(snapshot?.shell?.documents?.pendingReview ?? 0);
  const expiringDocs = Number(snapshot?.shell?.documents?.expiringSoon ?? 0);
  const nextEvent = snapshot?.shell?.nextEvent || null;
  const resume = Array.isArray(snapshot?.resume) ? snapshot.resume : [];

  const overdueItems = attentionItems.filter((item) => item.isOverdue);
  const dueTodayItems = attentionItems.filter(
    (item) => !item.isOverdue && isDueToday(item.dueAt),
  );

  // 1) Unblock overdue work
  if (overdueCount > 0 || overdueItems.length > 0) {
    const first = overdueItems[0];
    const title = first
      ? trimTitle(first.title, t('liveChat.astraRecOverdueTitle'), 36)
      : t('liveChat.astraRecOverdueTitle');
    const count = Math.max(overdueCount, overdueItems.length, 1);
    push({
      id: first?.id ? `overdue:${first.id}` : 'overdue',
      title: t('liveChat.astraRecOverdueCardTitle'),
      hint: first
        ? t('liveChat.astraRecOverdueCardHintNamed', {
          title,
          countLabel: pluralCountLabel(
            t,
            'liveChat.astraRecOverdueCountOne',
            'liveChat.astraRecOverdueCountMany',
            count,
          ),
        })
        : pluralCountLabel(
          t,
          'liveChat.astraRecOverdueCardHintOne',
          'liveChat.astraRecOverdueCardHintMany',
          count,
        ),
      prompt: first
        ? t('liveChat.astraRecOverduePromptNamed', { title })
        : t('liveChat.astraRecOverduePrompt', { count }),
      reason: pluralCountLabel(
        t,
        'liveChat.astraRecReasonOverdueOne',
        'liveChat.astraRecReasonOverdueMany',
        count,
      ),
      icon: ExclamationTriangleIcon,
    });
  }

  // 2) Approvals waiting on you
  if (approvalsPending > 0) {
    push({
      id: 'approvals',
      title: t('liveChat.astraRecApprovalsTitle'),
      hint: pluralCountLabel(
        t,
        'liveChat.astraRecApprovalsHintOne',
        'liveChat.astraRecApprovalsHintMany',
        approvalsPending,
      ),
      prompt: t('liveChat.astraRecApprovalsPrompt', { count: approvalsPending }),
      reason: pluralCountLabel(
        t,
        'liveChat.astraRecReasonApprovalsOne',
        'liveChat.astraRecReasonApprovalsMany',
        approvalsPending,
      ),
      icon: CheckBadgeIcon,
    });
  }

  // 3) Due today
  if (dueTodayCount > 0 || dueTodayItems.length > 0) {
    const first = dueTodayItems[0];
    const title = first
      ? trimTitle(first.title, t('liveChat.astraRecDueTodayTitle'), 36)
      : t('liveChat.astraRecDueTodayTitle');
    const count = Math.max(dueTodayCount, dueTodayItems.length, 1);
    push({
      id: first?.id ? `due-today:${first.id}` : 'due-today',
      title: t('liveChat.astraRecDueTodayCardTitle'),
      hint: first
        ? t('liveChat.astraRecDueTodayCardHintNamed', { title })
        : pluralCountLabel(
          t,
          'liveChat.astraRecDueTodayCardHintOne',
          'liveChat.astraRecDueTodayCardHintMany',
          count,
        ),
      prompt: first
        ? t('liveChat.astraRecDueTodayPromptNamed', { title })
        : t('liveChat.astraRecDueTodayPrompt', { count }),
      reason: pluralCountLabel(
        t,
        'liveChat.astraRecReasonDueTodayOne',
        'liveChat.astraRecReasonDueTodayMany',
        count,
      ),
      icon: ClipboardDocumentListIcon,
    });
  }

  // 4) Unread mail
  if (unreadMail > 0) {
    push({
      id: 'unread-mail',
      title: t('liveChat.astraRecMailTitle'),
      hint: pluralCountLabel(
        t,
        'liveChat.astraRecMailHintOne',
        'liveChat.astraRecMailHintMany',
        unreadMail,
      ),
      prompt: t('liveChat.astraRecMailPrompt', { count: unreadMail }),
      reason: pluralCountLabel(
        t,
        'liveChat.astraRecReasonMailOne',
        'liveChat.astraRecReasonMailMany',
        unreadMail,
      ),
      icon: EnvelopeIcon,
    });
  }

  // 5) Next event
  if (nextEvent?.title) {
    const title = trimTitle(nextEvent.title, t('liveChat.astraRecEventFallback'), 40);
    push({
      id: nextEvent.id ? `event:${nextEvent.id}` : 'next-event',
      title: t('liveChat.astraRecEventTitle'),
      hint: t('liveChat.astraRecEventHint', { title }),
      prompt: t('liveChat.astraRecEventPrompt', { title }),
      reason: t('liveChat.astraRecReasonEvent'),
      icon: CalendarDaysIcon,
    });
  }

  // 6) Documents needing action
  if (pendingReview > 0 || expiringDocs > 0) {
    const count = Math.max(pendingReview, expiringDocs, 1);
    push({
      id: 'documents',
      title: t('liveChat.astraRecDocsTitle'),
      hint: pendingReview > 0
        ? pluralCountLabel(
          t,
          'liveChat.astraRecDocsHintReviewOne',
          'liveChat.astraRecDocsHintReviewMany',
          pendingReview,
        )
        : pluralCountLabel(
          t,
          'liveChat.astraRecDocsHintExpiringOne',
          'liveChat.astraRecDocsHintExpiringMany',
          expiringDocs,
        ),
      prompt: pendingReview > 0
        ? t('liveChat.astraRecDocsPromptReview', { count: pendingReview })
        : t('liveChat.astraRecDocsPromptExpiring', { count: expiringDocs }),
      reason: pluralCountLabel(
        t,
        'liveChat.astraRecReasonDocsOne',
        'liveChat.astraRecReasonDocsMany',
        count,
      ),
      icon: DocumentTextIcon,
    });
  }

  // 7) Resume recent work (continue + summarize top record)
  for (const item of resume) {
    if (cards.length >= MAX_CARDS) break;
    const title = trimTitle(item.title, t('liveChat.astraRecRecordFallback'), 40);
    const moduleKey = String(item.moduleKey || '').toLowerCase();
    push({
      id: item.id ? `resume:${item.id}` : `resume:${moduleKey}:${title}`,
      title: t('liveChat.astraRecResumeTitle'),
      hint: t('liveChat.astraRecResumeHint', { title }),
      prompt: resumePrompt(item, t),
      reason: t('liveChat.astraRecReasonResume', {
        module: item.sourceApp || moduleKey || t('liveChat.astraRecRecordFallback'),
      }),
      icon: resumeIcon(moduleKey),
    });
  }

  if (cards.length === 0) {
    return staticFallbackCards(t);
  }

  // Fill remaining slots with productivity fallbacks (not duplicate ids)
  for (const fallback of staticFallbackCards(t)) {
    if (cards.length >= MAX_CARDS) break;
    push(fallback);
  }

  return cards.slice(0, MAX_CARDS);
}
