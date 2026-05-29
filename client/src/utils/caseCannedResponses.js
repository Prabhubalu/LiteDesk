import { formatCaseContactDisplayName, resolveCaseContactProfile } from '@/utils/caseTimeline';

export function buildCaseCannedResponseContext({ caseRecord = null, agentUser = null, contactEmail = '' } = {}) {
  const profile = resolveCaseContactProfile(caseRecord, { fromAddress: contactEmail });
  const contactName = formatCaseContactDisplayName(profile, contactEmail?.split('@')[0] || 'Customer');
  const firstFromContact = String(profile?.firstName || '').trim();
  const agentName = agentUser
    ? [agentUser.firstName, agentUser.lastName].filter(Boolean).join(' ').trim()
      || String(agentUser.email || '').trim()
    : '';

  return {
    case: {
      id: String(caseRecord?._id || caseRecord?.id || ''),
      caseId: String(caseRecord?.caseId || ''),
      title: String(caseRecord?.title || ''),
      status: String(caseRecord?.status || ''),
      priority: String(caseRecord?.priority || ''),
      channel: String(caseRecord?.channel || '')
    },
    contact: {
      firstName: firstFromContact || contactName.split(/\s+/)[0] || 'there',
      name: contactName,
      email: String(profile?.email || contactEmail || '').trim()
    },
    agent: {
      name: agentName,
      email: String(agentUser?.email || '').trim()
    }
  };
}

export function applyCaseCannedResponseTokens(template, context) {
  const text = String(template || '');
  if (!text) return '';
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path) => {
    const parts = String(path).split('.');
    let cursor = context;
    for (const part of parts) {
      if (cursor == null || typeof cursor !== 'object') return match;
      cursor = cursor[part];
    }
    const value = cursor == null ? '' : String(cursor);
    return value || match;
  });
}

export function resolveCannedResponse(item, context) {
  if (!item) return { subject: '', body: '' };
  return {
    subject: applyCaseCannedResponseTokens(item.subject, context),
    body: applyCaseCannedResponseTokens(item.body, context)
  };
}
