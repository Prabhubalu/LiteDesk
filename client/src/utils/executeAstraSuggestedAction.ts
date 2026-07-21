import type { Router, RouteLocationNormalizedLoaded } from 'vue-router';
import type { InAppAiAction, InAppAiMessage } from '@/composables/useInProductAiAsk';
import { resolvePageAiContext } from '@/utils/resolvePageAiContext';
import { resolveModuleRecordRoute } from '@/utils/resolveModuleRecordRoute';
import { openContentStudioFromAstraAction } from '@/utils/openContentStudioFromAstra';
import { openArivuCanvasFromAstraAction } from '@/utils/openArivuCanvasFromAstra';
import {
  openReportBuilderFromAstraAction,
  openReportFromAstraAction,
  publishReportFromAstraAction,
  exportReportFromAstraAction,
  pinReportFromAstraAction,
  openWidgetFromAstraAction,
  openDashboardFromAstraAction,
} from '@/utils/openReportFromAstra';
import apiClient from '@/utils/apiClient';

export type AstraActionTranslate = (key: string, params?: Record<string, string>) => string;

export type AstraActionDeps = {
  router: Router;
  route: RouteLocationNormalizedLoaded;
  t: AstraActionTranslate;
  askAssistant: (question: string) => Promise<void>;
  openEmailCompose: (action: InAppAiAction, msg?: InAppAiMessage) => void;
  openTalkToAgent: () => Promise<void>;
  pushAssistantNote: (body: string, structured?: InAppAiMessage['structured']) => void | Promise<void>;
  setError: (message: string) => void;
  isAskBusy: () => boolean;
  /** Optional: disable concurrent CRM mutations */
  beginMutation?: () => boolean;
  endMutation?: () => void;
  /** Optional: last user message body (for force-create phrases). */
  getLastUserBody?: () => string;
};

const NAVIGABLE_KINDS = new Set([
  'complete_task',
  'review_record',
  'follow_up',
  'update_status',
  'open_record',
]);

const CRM_NAV_MODULES = new Set([
  'people', 'deals', 'tasks', 'events', 'quotes', 'organizations', 'cases', 'items',
]);

function resolveRecordRefs(action: InAppAiAction, msg?: InAppAiMessage): {
  moduleKey: string;
  recordId: string;
} {
  let moduleKey = String(action.moduleKey || '').trim().toLowerCase();
  let recordId = String(action.recordId || '').trim();

  // Never navigate CRM review/follow-up using report/widget citations — those open empty pages.
  if (recordId && moduleKey && CRM_NAV_MODULES.has(moduleKey)) {
    return { moduleKey, recordId };
  }
  if (moduleKey && !CRM_NAV_MODULES.has(moduleKey)) {
    moduleKey = '';
  }
  if (!CRM_NAV_MODULES.has(moduleKey)) {
    recordId = '';
  }

  const citations = Array.isArray(msg?.citations) ? msg.citations : [];
  const preferred = citations.find((c) => {
    const st = String(c?.sourceType || '').toLowerCase();
    if (!st || !c?.sourceId) return false;
    if (!CRM_NAV_MODULES.has(st)) return false;
    if (moduleKey && st !== moduleKey) return false;
    return true;
  });

  if (preferred?.sourceId) {
    if (!recordId) recordId = String(preferred.sourceId);
    if (!moduleKey) moduleKey = String(preferred.sourceType || '').toLowerCase();
  }
  return { moduleKey, recordId };
}

async function navigateToRecord(
  router: Router,
  moduleKey: string,
  recordId: string,
): Promise<boolean> {
  const dest = resolveModuleRecordRoute(moduleKey, recordId);
  if (!dest) return false;
  if (dest.name) {
    await router.push({ name: dest.name, params: dest.params });
    return true;
  }
  if (dest.path) {
    await router.push(dest.path);
    return true;
  }
  return false;
}

/**
 * Run any Astra suggested-next-action. Shared by full-page Astra and the hub
 * so every kind (email, CRM, reports, canvas, follow-ups) behaves the same.
 */
export async function executeAstraSuggestedAction(
  action: InAppAiAction,
  msg: InAppAiMessage | undefined,
  deps: AstraActionDeps,
): Promise<void> {
  if (!action) return;
  const kind = String(action.kind || '').trim() || 'manual';

  if (kind === 'talk_to_agent') {
    await deps.openTalkToAgent();
    return;
  }

  if (kind === 'open_canvas') {
    const result = await openArivuCanvasFromAstraAction(deps.router, action, {
      fallbackDetail: String(msg?.structured?.detail || ''),
      fallbackHeadline: String(msg?.structured?.headline || ''),
    });
    if (!result.ok) {
      deps.setError(result.error || deps.t('liveChat.inAppAiCanvasOpenFailed'));
      return;
    }
    await deps.pushAssistantNote(deps.t('liveChat.inAppAiCanvasOpened'));
    return;
  }

  if (kind === 'open_content_studio' || kind === 'draft_deck') {
    const result = await openContentStudioFromAstraAction(deps.router, action, {
      fallbackDetail: String(msg?.structured?.detail || ''),
    });
    if (!result.ok) {
      deps.setError(result.error || deps.t('liveChat.inAppAiContentStudioOpenFailed'));
      return;
    }
    await deps.pushAssistantNote(deps.t('liveChat.inAppAiContentStudioOpened'));
    return;
  }

  if (kind === 'open_report_builder') {
    const result = await openReportBuilderFromAstraAction(deps.router, action);
    if (!result.ok) {
      deps.setError(result.error || deps.t('liveChat.inAppAiReportOpenFailed'));
      return;
    }
    await deps.pushAssistantNote(deps.t('liveChat.inAppAiReportBuilderOpened'));
    return;
  }

  if (kind === 'open_report') {
    const result = await openReportFromAstraAction(deps.router, action);
    if (!result.ok) {
      deps.setError(result.error || deps.t('liveChat.inAppAiReportOpenFailed'));
    }
    return;
  }

  if (kind === 'publish_report') {
    const result = await publishReportFromAstraAction(deps.router, action);
    if (!result.ok) {
      deps.setError(result.error || deps.t('liveChat.inAppAiReportPublishFailed'));
      return;
    }
    await deps.pushAssistantNote(deps.t('liveChat.inAppAiReportPublished'));
    return;
  }

  if (kind === 'export_report') {
    const result = await exportReportFromAstraAction(action);
    if (!result.ok) {
      deps.setError(result.error || deps.t('liveChat.inAppAiReportExportFailed'));
      return;
    }
    await deps.pushAssistantNote(deps.t('liveChat.inAppAiReportExported'));
    return;
  }

  if (kind === 'pin_report_to_dashboard') {
    const result = await pinReportFromAstraAction(deps.router, action);
    if (!result.ok) {
      deps.setError(result.error || deps.t('liveChat.inAppAiReportPinFailed'));
      return;
    }
    await deps.pushAssistantNote(
      deps.t('liveChat.inAppAiReportPinned', { name: result.dashboardName || 'dashboard' }),
    );
    return;
  }

  if (kind === 'open_widget') {
    const result = await openWidgetFromAstraAction(deps.router, action);
    if (!result.ok) {
      deps.setError(result.error || deps.t('liveChat.inAppAiWidgetOpenFailed'));
    }
    return;
  }

  if (kind === 'open_dashboard') {
    const result = await openDashboardFromAstraAction(deps.router, action);
    if (!result.ok) {
      deps.setError(result.error || deps.t('liveChat.inAppAiDashboardOpenFailed'));
    }
    return;
  }

  if (kind === 'complete_task') {
    const { moduleKey, recordId } = resolveRecordRefs(action, msg);
    const taskId = recordId || String(action.recordId || '').trim();
    if (!taskId) {
      deps.setError(deps.t('liveChat.inAppAiActionUnavailable'));
      return;
    }
    if (deps.beginMutation && !deps.beginMutation()) return;
    try {
      await apiClient.post(`/tasks/${encodeURIComponent(taskId)}/complete`, {});
      const data = await apiClient.post('/ai/astra/mutations/verify', {
        moduleKey: 'tasks',
        recordId: taskId,
        op: 'update',
        fields: { status: 'completed' },
      }) as {
        verify?: { verified?: boolean; summary?: string; nextHint?: string };
        outcomeNote?: string;
      };
      const verify = data?.verify || {
        verified: true,
        summary: deps.t('liveChat.inAppAiTaskCompletedVerify', { id: taskId }),
        nextHint: deps.t('liveChat.inAppAiTaskCompletedNext'),
      };
      await deps.pushAssistantNote(
        String(data?.outcomeNote || verify.summary),
        {
          headline: verify.verified
            ? deps.t('liveChat.inAppAiOutcomeVerified')
            : deps.t('liveChat.inAppAiOutcomePartial'),
          bullets: [verify.summary, verify.nextHint].filter(Boolean) as string[],
          detail: '',
        },
      );
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { data?: { message?: string } } };
      deps.setError(String(e?.response?.data?.message || e?.message || deps.t('liveChat.inAppAiMutationFailed')));
      await navigateToRecord(deps.router, moduleKey || 'tasks', taskId);
    } finally {
      deps.endMutation?.();
    }
    return;
  }

  if (kind === 'create_record' || kind === 'update_record') {
    if (deps.beginMutation && !deps.beginMutation()) return;
    const moduleKey = String(action.moduleKey || '').trim().toLowerCase();
    const fields: Record<string, string | number | boolean> = (
      action.fields && typeof action.fields === 'object' ? { ...action.fields } : {}
    );
    if (!moduleKey || !Object.keys(fields).length) {
      deps.setError(deps.t('liveChat.inAppAiMutationIncomplete'));
      deps.endMutation?.();
      return;
    }
    const page = resolvePageAiContext(deps.route);
    const lastUserBody = String(deps.getLastUserBody?.() || '');
    if (/\b(force\s+create|create\s+anyway|create\s+a\s+new\s+one|duplicate\s+ok|new\s+meeting\s+anyway)\b/i
      .test(lastUserBody)) {
      fields.forceCreate = true;
      fields.forceCreateReason = lastUserBody || 'create anyway';
    }
    try {
      const data = await apiClient.post('/ai/astra/mutations/apply', {
        op: kind === 'create_record' ? 'create' : 'update',
        moduleKey,
        recordId: action.recordId || '',
        fields,
        appKey: page?.appKey || 'SALES',
        pageModuleKey: page?.moduleKey || '',
        pageRecordId: page?.kind === 'record' ? (page.recordId || '') : '',
      }) as {
        recordId?: string;
        outcomeNote?: string;
        verify?: { verified?: boolean; summary?: string; nextHint?: string };
        recordLabel?: string;
      };
      const rid = data?.recordId ? String(data.recordId) : '';
      const outcome = String(data?.outcomeNote || '').trim()
        || (kind === 'create_record'
          ? deps.t('liveChat.inAppAiMutationCreated', { module: moduleKey, id: rid })
          : deps.t('liveChat.inAppAiMutationUpdated', {
            module: moduleKey,
            id: rid || String(action.recordId || ''),
          }));
      const verified = data?.verify?.verified !== false;
      await deps.pushAssistantNote(
        outcome,
        {
          headline: verified
            ? deps.t('liveChat.inAppAiOutcomeVerified')
            : deps.t('liveChat.inAppAiOutcomePartial'),
          bullets: [
            data?.verify?.summary || outcome,
            data?.verify?.nextHint || '',
          ].filter(Boolean),
          detail: '',
          nbaMode: false,
        },
      );
      if (kind === 'create_record' && rid) {
        await navigateToRecord(deps.router, moduleKey, rid);
      }
    } catch (err: unknown) {
      const e = err as {
        response?: {
          data?: {
            code?: string;
            message?: string;
            details?: { duplicates?: Array<{ moduleKey?: string; recordId?: string; label?: string }> };
          };
        };
        message?: string;
      };
      const code = e?.response?.data?.code || '';
      deps.setError(String(e?.response?.data?.message || e?.message || deps.t('liveChat.inAppAiMutationFailed')));
      if (code === 'AI_ASTRA_DUPLICATE') {
        const dup = e?.response?.data?.details?.duplicates?.[0];
        if (dup?.moduleKey && dup?.recordId) {
          await deps.pushAssistantNote(
            deps.t('liveChat.inAppAiDuplicateBlocked', { label: dup.label || 'existing record' }),
            {
              headline: deps.t('liveChat.inAppAiDuplicateHeadline'),
              bullets: [
                deps.t('liveChat.inAppAiDuplicateBlocked', { label: dup.label || 'existing record' }),
                deps.t('liveChat.inAppAiDuplicateCreateAnyway'),
              ],
              actions: [{
                label: deps.t('liveChat.inAppAiDuplicateOpenExisting', { label: dup.label || 'record' }),
                kind: 'review_record',
                moduleKey: dup.moduleKey,
                recordId: dup.recordId,
                priority: 'high',
              }],
              detail: '',
            },
          );
        }
      }
    } finally {
      deps.endMutation?.();
    }
    return;
  }

  if (
    kind === 'send_email'
    || action.email?.subject
    || action.email?.body
    || action.email?.to
    || (/\bemail\b/i.test(String(action.label || ''))
      && kind !== 'follow_up'
      && kind !== 'manual')
  ) {
    deps.openEmailCompose(action, msg);
    return;
  }

  const { moduleKey, recordId } = resolveRecordRefs(action, msg);
  const page = resolvePageAiContext(deps.route);
  const isSameRecord = Boolean(
    page?.kind === 'record'
    && page.moduleKey === moduleKey
    && page.recordId === recordId,
  );

  if (moduleKey && recordId && NAVIGABLE_KINDS.has(kind) && !isSameRecord) {
    const ok = await navigateToRecord(deps.router, moduleKey, recordId);
    if (ok) return;
    deps.setError(deps.t('liveChat.inAppAiActionNavigateFailed'));
  }

  // Same-record navigable, manual, or unresolved: continue the chat with the action intent.
  // Use the label only — never re-ask with meta rationales ("concrete example…").
  let followUp = String(action.label || '').trim();
  if (!followUp) {
    deps.setError(deps.t('liveChat.inAppAiActionUnavailable'));
    return;
  }
  // Vague "Reach out to X" / "Follow up on X" chips loop into the same coaching + same CTA.
  // Expand into a deliverable ask so Astra drafts email (or a concrete next step) instead.
  const rationale = String(action.rationale || '').trim();
  const reachOut = followUp.match(
    /^(?:reach out to|follow up (?:on|with)|check in on|advance|email(?:\s+to)?(?:\s+advance)?|email check-in on)\s+(.+?)(?:\s+with one clear ask)?$/i,
  );
  const prepAssist = followUp.match(
    /^(?:prep|draft|write)\s+(.+)$/i,
  );
  if (prepAssist && /\b(question|talking|opener|script|objection|pitch|points)\b/i.test(followUp)) {
    followUp = [
      `${followUp}.`,
      'Give usable wording staff can say or send now (numbered questions or a short script).',
      'Also include one send_email action if a contact email exists.',
      'Do not only restate CRM fields.',
    ].join(' ');
  } else if (
    kind === 'follow_up'
    || kind === 'manual'
    || reachOut
    || /keep the relationship warm|warm follow-up|open compose when ready/i.test(rationale)
  ) {
    const who = String(reachOut?.[1] || action.targetLabel || followUp)
      .replace(/\s+with one clear ask\s*$/i, '')
      .replace(/\s*[.…]+\s*$/, '')
      .trim();
    if (
      who
      && /^(reach out to|follow up (?:on|with)|check in on|advance|email)\b/i.test(followUp)
    ) {
      followUp = [
        `Draft a short follow-up email for ${who} with one clear ask.`,
        'Put To/Subject/Body in a send_email action staff can open.',
        `Do not suggest "Reach out to ${who}" or the same vague follow-up again.`,
      ].join(' ');
    }
  }
  if (deps.isAskBusy()) return;
  await deps.askAssistant(followUp);
}
