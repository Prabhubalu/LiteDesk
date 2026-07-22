import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import {
  captureAstraAskInvoked,
  captureAstraActionCompleted,
  captureAstraActionRejected,
  type AstraSurface,
} from '@/config/posthogAi';

export interface AstraProposalDetail {
  label: string;
  value: string;
}

export interface AstraProposal {
  id: string;
  kind: string;
  label: string;
  rationale?: string;
  details?: AstraProposalDetail[];
  moduleKey?: string;
  recordId?: string;
  fields?: Record<string, unknown>;
  status?: 'pending' | 'completed' | 'dismissed';
  href?: string;
  navigateLabel?: string;
}

export interface AstraAskResult {
  answer: string;
  blocks: import('@/astra/blocks/types').AstraUiBlock[];
  proposals: AstraProposal[];
  suggestions: string[];
  conversationId?: string;
  conversationTitle?: string;
  provider?: string;
  model?: string;
  raw?: Record<string, unknown>;
}

export interface AstraNbaItem {
  id: string;
  kind: string;
  label: string;
  rationale?: string;
  moduleKey?: string;
  recordId?: string;
}

export interface AstraAskContext {
  moduleKey?: string;
  recordId?: string;
  conversationId?: string;
  history?: Array<{ role: string; content: string }>;
  surface?: string;
}

export interface AstraConfirmResult {
  ok: boolean;
  message?: string;
  recordId?: string;
  moduleKey?: string;
  href?: string;
  navigateLabel?: string;
  raw?: Record<string, unknown>;
}

const ASK_PATH = '/ai/v2/ask';
const CONFIRM_PATH = '/ai/v2/actions/confirm';
const NBA_PATH = '/ai/v2/next-best-actions';

function toStringSafe(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function normalizeProposalDetails(source: unknown): AstraProposalDetail[] | undefined {
  if (!Array.isArray(source) || !source.length) return undefined;
  const rows = source
    .map((raw): AstraProposalDetail | null => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, unknown>;
      const label = toStringSafe(item.label).trim();
      const value = toStringSafe(item.value).trim();
      if (!label || !value) return null;
      return { label, value };
    })
    .filter((row): row is AstraProposalDetail => row !== null);
  return rows.length ? rows : undefined;
}

function detailsFromFields(kind: string, fields?: Record<string, unknown>): AstraProposalDetail[] | undefined {
  if (!fields || typeof fields !== 'object') return undefined;
  const rows: AstraProposalDetail[] = [];
  const push = (label: string, value: unknown) => {
    const v = toStringSafe(value).trim();
    if (v) rows.push({ label, value: v });
  };
  const related = fields.relatedTo as Record<string, unknown> | undefined;
  const contact = fields.relatedContact as Record<string, unknown> | undefined;
  const orgRef = fields.organizationRef as Record<string, unknown> | undefined;
  push('Title', fields.title || fields.name);
  if (fields.startDateTime) push('When', fields.startDateTime);
  if (fields.durationMinutes) push('Duration', `${fields.durationMinutes} min`);
  if (fields.dueDate) push('Due', fields.dueDate);
  if (fields.priority) push('Priority', fields.priority);
  if (fields.amount != null && fields.amount !== '') push('Amount', `$${fields.amount}`);
  if (fields.stage) push('Stage', fields.stage);
  push('Related', related?.name || related?.title || orgRef?.name);
  push('Contact', contact?.name || contact?.title);
  if (fields.description) push('Notes', fields.description);
  if (fields.to) push('To', fields.to);
  if (fields.subject) push('Subject', fields.subject);
  if (kind.includes('email') && !rows.length) return undefined;
  return rows.length ? rows : undefined;
}

function normalizeProposals(source: unknown): AstraProposal[] {
  if (!Array.isArray(source)) return [];
  return source
    .map((raw, index): AstraProposal | null => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, unknown>;
      const label = toStringSafe(item.label || item.summary).trim();
      if (!label) return null;
      const fields =
        item.fields && typeof item.fields === 'object'
          ? (item.fields as Record<string, unknown>)
          : item.payload && typeof item.payload === 'object'
            ? (item.payload as Record<string, unknown>)
            : undefined;
      const kind = toStringSafe(item.kind || item.toolName) || 'generic';
      return {
        id: toStringSafe(item.id) || `proposal-${index}`,
        kind,
        label,
        rationale: toStringSafe(item.rationale || item.guidance) || undefined,
        details: normalizeProposalDetails(item.details) || detailsFromFields(kind, fields),
        moduleKey: toStringSafe(item.moduleKey) || undefined,
        recordId: toStringSafe(item.recordId) || undefined,
        fields,
        status: toStringSafe(item.status) === 'completed'
          ? 'completed'
          : toStringSafe(item.status) === 'dismissed'
            ? 'dismissed'
            : 'pending',
        href: toStringSafe(item.href) || undefined,
        navigateLabel: toStringSafe(item.navigateLabel) || undefined,
      };
    })
    .filter((p): p is AstraProposal => p !== null);
}

function proposalsFromAskPayload(data: Record<string, unknown>): AstraProposal[] {
  const direct = normalizeProposals(data?.proposals ?? data?.actions);
  if (direct.length) return direct;

  const toolResult = data?.toolResult as Record<string, unknown> | undefined;
  if (toolResult?.type === 'confirm_action') {
    return normalizeProposals([toolResult]);
  }

  const workflow = data?.workflow as { steps?: Array<{ result?: unknown }> } | undefined;
  if (Array.isArray(workflow?.steps)) {
    return normalizeProposals(
      workflow.steps
        .map((step) => step?.result)
        .filter((result) => result && typeof result === 'object' && (result as { type?: string }).type === 'confirm_action'),
    );
  }

  return [];
}

function suggestionsFromAskPayload(data: Record<string, unknown>): string[] {
  return normalizeSuggestions(data?.suggestions);
}

function normalizeSuggestions(source: unknown): string[] {
  if (!Array.isArray(source)) return [];
  return source.map((s) => toStringSafe(s).trim()).filter(Boolean);
}

function normalizeNba(source: unknown): AstraNbaItem[] {
  if (!Array.isArray(source)) return [];
  return source
    .map((raw, index): AstraNbaItem | null => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, unknown>;
      const label = toStringSafe(item.label || item.title).trim();
      if (!label) return null;
      return {
        id: toStringSafe(item.id) || `nba-${index}`,
        kind: toStringSafe(item.kind || item.tool) || 'generic',
        label,
        rationale: toStringSafe(item.rationale) || undefined,
        moduleKey: toStringSafe(item.moduleKey) || undefined,
        recordId: toStringSafe(item.recordId) || undefined,
      };
    })
    .filter((n): n is AstraNbaItem => n !== null);
}

export function useAstraAsk(surface: AstraSurface = 'copilot') {
  const { t } = useI18n();

  const asking = ref(false);
  const confirming = ref(false);
  const error = ref('');

  async function askSync(prompt: string, context: AstraAskContext = {}): Promise<AstraAskResult | null> {
    const text = String(prompt || '').trim();
    if (!text || asking.value) return null;
    asking.value = true;
    error.value = '';
    captureAstraAskInvoked({
      surface,
      moduleKey: context.moduleKey,
      recordId: context.recordId,
      promptLength: text.length,
    });
    try {
      const data = (await apiClient.post(ASK_PATH, {
        query: text,
        surface,
        moduleKey: context.moduleKey,
        recordId: context.recordId,
        conversationId: context.conversationId,
        history: Array.isArray(context.history) ? context.history : undefined,
        entity: context.moduleKey
          ? context.moduleKey === 'deals'
            ? 'deals'
            : context.moduleKey === 'cases'
              ? 'cases'
              : context.moduleKey === 'people'
                ? 'people'
                : undefined
          : undefined,
        focus: context.recordId
          ? { moduleKey: context.moduleKey, recordId: context.recordId }
          : undefined,
      })) as Record<string, unknown>;
      return {
        answer: toStringSafe(data?.answer ?? data?.reply ?? data?.body),
        blocks: Array.isArray(data?.blocks) ? (data.blocks as import('@/astra/blocks/types').AstraUiBlock[]) : [],
        proposals: proposalsFromAskPayload(data),
        suggestions: suggestionsFromAskPayload(data),
        conversationId: toStringSafe(data?.conversationId) || context.conversationId,
        conversationTitle: toStringSafe(data?.conversationTitle) || undefined,
        provider: toStringSafe(data?.provider) || undefined,
        model: toStringSafe(data?.model) || undefined,
        raw: data,
      };
    } catch (err: unknown) {
      const e = err as { message?: string };
      error.value = e?.message || t('astra.failGeneric');
      return null;
    } finally {
      asking.value = false;
    }
  }

  async function confirmProposal(
    proposal: AstraProposal,
    context: { conversationId?: string } = {},
  ): Promise<AstraConfirmResult> {
    if (!proposal || confirming.value) return { ok: false };
    confirming.value = true;
    error.value = '';
    try {
      const data = (await apiClient.post(CONFIRM_PATH, {
        toolName: proposal.kind,
        proposalId: proposal.id,
        kind: proposal.kind,
        moduleKey: proposal.moduleKey,
        recordId: proposal.recordId,
        payload: proposal.fields,
        fields: proposal.fields,
        conversationId: context.conversationId,
        confirmed: true,
      })) as Record<string, unknown>;
      captureAstraActionCompleted({
        surface,
        actionKind: proposal.kind,
        actionId: proposal.id,
        moduleKey: proposal.moduleKey,
        recordId: toStringSafe(data?.recordId) || proposal.recordId,
      });
      return {
        ok: true,
        message: toStringSafe(data?.message) || undefined,
        recordId: toStringSafe(data?.recordId) || undefined,
        moduleKey: toStringSafe(data?.moduleKey) || proposal.moduleKey,
        href: toStringSafe(data?.href) || undefined,
        navigateLabel: toStringSafe(data?.navigateLabel) || undefined,
        raw: data,
      };
    } catch (err: unknown) {
      const e = err as { message?: string };
      error.value = e?.message || t('astra.failGeneric');
      captureAstraActionRejected({
        surface,
        actionKind: proposal.kind,
        actionId: proposal.id,
        reason: error.value,
      });
      return { ok: false, message: error.value };
    } finally {
      confirming.value = false;
    }
  }

  async function fetchNba(context: AstraAskContext = {}): Promise<AstraNbaItem[]> {
    try {
      const data = (await apiClient.get(NBA_PATH, {
        params: {
          moduleKey: context.moduleKey,
          recordId: context.recordId,
          surface: context.surface || 'home',
        },
      })) as Record<string, unknown>;
      return normalizeNba(data?.items ?? data?.cards ?? data?.nba ?? data);
    } catch {
      return [];
    }
  }

  return {
    asking,
    confirming,
    error,
    askSync,
    confirmProposal,
    fetchNba,
  };
}
