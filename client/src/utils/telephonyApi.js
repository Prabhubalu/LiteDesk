import apiClient from '@/utils/apiClient';

const BASE = '/telephony';

function params(query = {}) {
  const cleaned = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    cleaned[key] = value;
  }
  return cleaned;
}

export async function listCalls(query = {}) {
  const res = await apiClient.get(`${BASE}/calls`, { params: params(query) });
  return res.data;
}

export async function getCall(callId) {
  const res = await apiClient.get(`${BASE}/calls/${callId}`);
  return res.data;
}

export async function placeCall(body) {
  const res = await apiClient.post(`${BASE}/calls`, body);
  return res.data;
}

export async function hangUpCall(callId) {
  const res = await apiClient.post(`${BASE}/calls/${callId}/hangup`);
  return res.data;
}

export async function muteCall(callId) {
  const res = await apiClient.post(`${BASE}/calls/${callId}/mute`);
  return res.data;
}

export async function holdCall(callId) {
  const res = await apiClient.post(`${BASE}/calls/${callId}/hold`);
  return res.data;
}

export async function attachCallNotes(callId, body) {
  const res = await apiClient.post(`${BASE}/calls/${callId}/notes`, body);
  return res.data;
}

export async function createClientToken(body = {}) {
  const res = await apiClient.post(`${BASE}/client-token`, body);
  return res.data;
}

export async function listProviders() {
  const res = await apiClient.get(`${BASE}/providers`);
  return res.data;
}

export async function upsertProvider(body) {
  const res = await apiClient.put(`${BASE}/providers`, body);
  return res.data;
}

export async function providerHealthCheck(providerKey) {
  const res = await apiClient.get(`${BASE}/providers/${providerKey}/health`);
  return res.data;
}

export async function listPhoneNumbers() {
  const res = await apiClient.get(`${BASE}/phone-numbers`);
  return res.data;
}

export async function listQueues() {
  const res = await apiClient.get(`${BASE}/queues`);
  return res.data;
}

export async function createQueue(body) {
  const res = await apiClient.post(`${BASE}/queues`, body);
  return res.data;
}

export async function listQueueStrategies() {
  const res = await apiClient.get(`${BASE}/queues/strategies`);
  return res.data;
}

export async function listAgents(query = {}) {
  const res = await apiClient.get(`${BASE}/presence/agents`, { params: params(query) });
  return res.data;
}

export async function getMyPresence() {
  const res = await apiClient.get(`${BASE}/presence/me`);
  return res.data;
}

export async function setMyPresence(body) {
  const res = await apiClient.put(`${BASE}/presence/me`, body);
  return res.data;
}

export async function listPresenceStatuses() {
  const res = await apiClient.get(`${BASE}/presence/statuses`);
  return res.data;
}

export async function listIvrFlows() {
  const res = await apiClient.get(`${BASE}/ivr`);
  return res.data;
}

export async function createIvrFlow(body) {
  const res = await apiClient.post(`${BASE}/ivr`, body);
  return res.data;
}

export async function getIvrFlow(flowId) {
  const res = await apiClient.get(`${BASE}/ivr/${flowId}`);
  return res.data;
}

export async function updateIvrFlow(flowId, body) {
  const res = await apiClient.put(`${BASE}/ivr/${flowId}`, body);
  return res.data;
}

export async function publishIvrFlow(flowId) {
  const res = await apiClient.post(`${BASE}/ivr/${flowId}/publish`);
  return res.data;
}

export async function listCampaigns() {
  const res = await apiClient.get(`${BASE}/campaigns`);
  return res.data;
}

export async function startCampaign(campaignId) {
  const res = await apiClient.post(`${BASE}/campaigns/${campaignId}/start`);
  return res.data;
}

export async function pauseCampaign(campaignId) {
  const res = await apiClient.post(`${BASE}/campaigns/${campaignId}/pause`);
  return res.data;
}

export async function resumeCampaign(campaignId) {
  const res = await apiClient.post(`${BASE}/campaigns/${campaignId}/resume`);
  return res.data;
}

export async function dialNextCampaign(campaignId) {
  const res = await apiClient.post(`${BASE}/campaigns/${campaignId}/dial-next`);
  return res.data;
}

export async function getAnalyticsDashboard(query = {}) {
  const res = await apiClient.get(`${BASE}/analytics/dashboard`, { params: params(query) });
  return res.data;
}

export async function listRecordings(query = {}) {
  const res = await apiClient.get(`${BASE}/recordings`, { params: params(query) });
  return res.data;
}

export async function getRecording(recordingId) {
  const res = await apiClient.get(`${BASE}/recordings/${recordingId}`);
  return res.data;
}

export async function getCallTranscript(callId) {
  const res = await apiClient.get(`${BASE}/calls/${callId}/transcript`);
  return res.data;
}

export async function getCallSummary(callId) {
  const res = await apiClient.get(`${BASE}/calls/${callId}/summary`);
  return res.data;
}
