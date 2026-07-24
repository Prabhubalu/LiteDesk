'use strict';

/**
 * Proactive case draft — grounded reply ready when a case is created.
 */

const Case = require('../../../models/Case');
const { groundedRetrieve } = require('../retrieval/groundedRetriever');
const modelRouter = require('../models/modelRouter');

async function draftCaseReply({ organizationId, caseRecord } = {}) {
  if (!organizationId || !caseRecord) return null;
  const title = String(caseRecord.title || '').trim();
  const description = String(caseRecord.description || caseRecord.details || '').trim();
  const query = [title, description].filter(Boolean).join('\n').slice(0, 2000);
  if (!query) return null;

  const retrieval = await groundedRetrieve({
    organizationId,
    query,
    audience: 'internal',
    topK: 5,
  });

  if (retrieval.refuse || (retrieval.weak && !(retrieval.hits || []).length)) {
    return {
      status: 'no_confident_answer',
      draft: null,
      citations: retrieval.citations || [],
      guidance: retrieval.guidance,
      suggestedArticles: (retrieval.hits || []).slice(0, 3),
    };
  }

  const snippets = (retrieval.hits || [])
    .map((h, i) => `[${i + 1}] ${h.title || 'Source'}: ${String(h.text || '').slice(0, 400)}`)
    .join('\n');

  let draftBody = `Based on our knowledge base:\n\n${(retrieval.hits[0]?.text || '').slice(0, 800)}`;
  try {
    const llm = modelRouter.getChatAdapter?.();
    if (llm && typeof llm.complete === 'function') {
      const out = await llm.complete({
        messages: [
          {
            role: 'system',
            content:
              'Draft a short support reply for this case using ONLY the knowledge snippets. Cite sources as [n]. If snippets are insufficient, say you need more info. Never invent policy.',
          },
          {
            role: 'user',
            content: `Case: ${title}\n\n${description}\n\nKnowledge:\n${snippets}`,
          },
        ],
        maxTokens: 500,
      });
      const text = String(out?.text || out?.content || '').trim();
      if (text) draftBody = text;
    }
  } catch {
    /* keep snippet draft */
  }

  return {
    status: 'ready',
    draft: draftBody,
    citations: retrieval.citations || [],
    guidance: retrieval.guidance,
    suggestedArticles: (retrieval.hits || []).slice(0, 5),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Fire-and-forget after case create.
 */
async function enqueueCaseDraftJob({ caseRecord, organizationId }) {
  const orgId = organizationId || caseRecord?.organizationId;
  const caseId = caseRecord?._id || caseRecord?.id;
  if (!orgId || !caseId) return;

  setImmediate(async () => {
    try {
      const artifact = await draftCaseReply({ organizationId: orgId, caseRecord });
      if (!artifact) return;
      await Case.updateOne(
        { _id: caseId, organizationId: orgId },
        {
          $set: {
            'aiAssist.suggestedReply': artifact,
            'aiAssist.suggestedReplyAt': new Date(),
          },
        },
      );
    } catch (err) {
      console.warn('[caseDraftJob] failed:', err?.message || err);
    }
  });
}

module.exports = {
  draftCaseReply,
  enqueueCaseDraftJob,
};
