import portalApiClient from '@/utils/portalApiClient';

export function usePortalCases() {
  async function listCases({ limit = 25, skip = 0 } = {}) {
    return portalApiClient.get('/portal/cases', {
      params: { limit: String(limit), skip: String(skip) }
    });
  }

  async function getCase(caseId) {
    return portalApiClient.get(`/portal/cases/${encodeURIComponent(caseId)}`);
  }

  async function createCase({ title, description, priority, attachments } = {}) {
    return portalApiClient.post('/portal/cases', {
      title,
      description,
      priority,
      attachments: Array.isArray(attachments) ? attachments : undefined
    });
  }

  async function replyToCase(caseId, { body, subject, attachments } = {}) {
    return portalApiClient.post(`/portal/cases/${encodeURIComponent(caseId)}/reply`, {
      message: {
        body,
        subject: subject || 'Reply',
        attachments: Array.isArray(attachments) ? attachments : undefined
      }
    });
  }

  async function markCaseRead(caseId) {
    return portalApiClient.post(`/portal/cases/${encodeURIComponent(caseId)}/read`);
  }

  async function submitCsat(caseId, { score, comment } = {}) {
    return portalApiClient.post(`/portal/cases/${encodeURIComponent(caseId)}/csat`, {
      score,
      comment
    });
  }

  return {
    listCases,
    getCase,
    createCase,
    replyToCase,
    markCaseRead,
    submitCsat
  };
}
