import { ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import {
  captureAstraAskInvoked,
  type AstraSurface,
} from '@/config/posthogAi';
import type { AstraAskResult } from '@/astra/composables/useAstraAsk';
import { useAstraAsk } from '@/astra/composables/useAstraAsk';

const ASK_PATH = '/ai/v2/ask';
const STUDIO_SURFACE = 'astra-studio' as AstraSurface;

function toStringSafe(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function useStudioAsk(canvasId: Ref<string | undefined>) {
  const { t } = useI18n();
  const base = useAstraAsk(STUDIO_SURFACE);
  const asking = ref(false);
  const error = ref('');

  async function askStudio(
    prompt: string,
    extra: {
      conversationId?: string;
      history?: Array<{ role: string; content: string }>;
      targetWidgetId?: string;
      targetWidgetTitle?: string;
    } = {},
  ): Promise<AstraAskResult | null> {
    const text = String(prompt || '').trim();
    const id = canvasId.value;
    if (!text || asking.value || !id) return null;
    asking.value = true;
    error.value = '';
    captureAstraAskInvoked({
      surface: STUDIO_SURFACE,
      promptLength: text.length,
    });
    try {
      const targetWidgetId = extra.targetWidgetId ? String(extra.targetWidgetId) : undefined;
      const data = (await apiClient.post(ASK_PATH, {
        query: text,
        surface: STUDIO_SURFACE,
        canvasId: id,
        conversationId: extra.conversationId,
        history: Array.isArray(extra.history) ? extra.history : undefined,
        targetWidgetId,
        flags: targetWidgetId
          ? {
              targetWidgetId,
              targetWidgetTitle: extra.targetWidgetTitle || undefined,
            }
          : undefined,
      })) as Record<string, unknown>;
      return {
        answer: toStringSafe(data?.answer ?? data?.reply ?? data?.body),
        blocks: Array.isArray(data?.blocks)
          ? (data.blocks as AstraAskResult['blocks'])
          : [],
        proposals: [],
        suggestions: [],
        conversationId: toStringSafe(data?.conversationId) || extra.conversationId,
        conversationTitle: toStringSafe(data?.conversationTitle) || undefined,
        agentKey: toStringSafe(data?.agentKey) || undefined,
        agentName: toStringSafe(data?.agentName) || undefined,
        provider: toStringSafe(data?.provider) || undefined,
        model: toStringSafe(data?.model) || undefined,
        raw: data,
      };
    } catch (err: unknown) {
      const e = err as { message?: string };
      error.value = e?.message || t('astraStudio.askFailed');
      return null;
    } finally {
      asking.value = false;
    }
  }

  return {
    asking,
    confirming: base.confirming,
    error,
    askStudio,
    confirmProposal: base.confirmProposal,
  };
}
