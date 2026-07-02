'use strict';

const axios = require('axios');
const { AmdsApiError } = require('./amds-errors');

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const CAMPAIGN_BATCH_MAX = 500;

function getCampaignSubmitBatchSize() {
  const parsed = parseInt(String(process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_SIZE || CAMPAIGN_BATCH_MAX), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return CAMPAIGN_BATCH_MAX;
  }
  return Math.min(parsed, CAMPAIGN_BATCH_MAX);
}

function getCampaignSubmitBatchDelayMs() {
  const parsed = parseInt(String(process.env.AMDS_CAMPAIGN_SUBMIT_BATCH_DELAY_MS || '0'), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err) {
  if (err instanceof AmdsApiError) return err.isRetryable;
  if (!err || typeof err !== 'object') return false;
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return true;
  const status = err.response?.status;
  return typeof status === 'number' && (status >= 500 || status === 429);
}

class AmdsClient {
  /**
   * @param {string} baseUrl
   * @param {string} apiKey
   * @param {{ timeoutMs?: number }} [options]
   */
  constructor(baseUrl, apiKey, options = {}) {
    this.http = axios.create({
      baseURL: String(baseUrl || '').replace(/\/$/, ''),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    });
  }

  /**
   * Queue a transactional email. Retries 429 / 5xx / timeout up to 3 times.
   * @param {import('./amds-types').SendMessageRequest} params
   * @returns {Promise<import('./amds-types').SendMessageResponse>}
   */
  async sendMessage(params) {
    return this.requestWithRetry(() => this.http.post('/v1/messages', params));
  }

  /**
   * @param {string} messageId
   * @returns {Promise<import('./amds-types').MessageStatusResponse>}
   */
  async getMessageStatus(messageId) {
    try {
      const { data } = await this.http.get(`/v1/messages/${encodeURIComponent(messageId)}`);
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {import('./amds-types').RegisterDomainRequest} params
   * @returns {Promise<import('./amds-types').DomainResponse>}
   */
  async registerDomain(params) {
    try {
      const { data } = await this.http.post('/v1/domains', params);
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @param {string} domain
   * @returns {Promise<import('./amds-types').DomainResponse>}
   */
  async getDomain(tenantId, domain) {
    try {
      const { data } = await this.http.get(`/v1/domains/${encodeURIComponent(domain)}`, {
        params: { tenant_id: tenantId }
      });
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @param {string} domain
   * @returns {Promise<import('./amds-types').DomainResponse>}
   */
  async verifyDomain(tenantId, domain) {
    try {
      const { data } = await this.http.post(
        `/v1/domains/${encodeURIComponent(domain)}/verify`,
        { tenant_id: tenantId }
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @param {string} [email]
   * @returns {Promise<import('./amds-types').SuppressionListResponse>}
   */
  async listSuppressions(tenantId, email) {
    try {
      const { data } = await this.http.get('/v1/suppressions', {
        params: { tenant_id: tenantId, ...(email ? { email } : {}) }
      });
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {import('./amds-types').CreateSuppressionRequest} params
   * @returns {Promise<import('./amds-types').SuppressionEntry>}
   */
  async createSuppression(params) {
    try {
      const { data } = await this.http.post('/v1/suppressions', params);
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @param {string} email
   * @returns {Promise<void>}
   */
  async deleteSuppression(tenantId, email) {
    try {
      await this.http.delete(`/v1/suppressions/${encodeURIComponent(email)}`, {
        params: { tenant_id: tenantId }
      });
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * Send a campaign batch. Splits into chunks of 500 if needed.
   * @param {string} campaignId
   * @param {import('./amds-types').CampaignBatchRequest} params
   * @returns {Promise<import('./amds-types').CampaignBatchResponse[]>}
   */
  async sendCampaignBatch(campaignId, params) {
    const submitBatchSize =
      params.pacing?.submitBatchSize != null && params.pacing.submitBatchSize > 0
        ? Math.min(params.pacing.submitBatchSize, CAMPAIGN_BATCH_MAX)
        : getCampaignSubmitBatchSize();
    const submitBatchDelayMs =
      params.pacing?.submitBatchDelayMs != null && params.pacing.submitBatchDelayMs >= 0
        ? params.pacing.submitBatchDelayMs
        : getCampaignSubmitBatchDelayMs();
    const chunks = chunkArray(params.messages, CAMPAIGN_BATCH_MAX);
    /** @type {import('./amds-types').CampaignBatchResponse[]} */
    const results = [];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const subChunks = chunkArray(chunks[chunkIndex], submitBatchSize);
      for (let subIndex = 0; subIndex < subChunks.length; subIndex += 1) {
        const messages = subChunks[subIndex];
        const body = { ...params, messages };
        const data = await this.requestWithRetry(() =>
          this.http.post(
            `/v1/campaigns/${encodeURIComponent(campaignId)}/messages`,
            body
          )
        );
        results.push(data);

        const isLast =
          chunkIndex === chunks.length - 1 && subIndex === subChunks.length - 1;
        if (!isLast && submitBatchDelayMs > 0) {
          await sleep(submitBatchDelayMs);
        }
      }
    }

    return results;
  }

  /**
   * @param {import('./amds-types').AnalyticsSummaryQuery} query
   * @returns {Promise<import('./amds-types').AnalyticsSummaryResponse>}
   */
  async getAnalyticsSummary(query) {
    try {
      const { data } = await this.http.get('/v1/analytics/summary', { params: query });
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @param {import('./amds-types').TenantPolicyPayload} policy
   * @returns {Promise<import('./amds-types').TenantPolicyResponse>}
   */
  async upsertTenantPolicy(tenantId, policy) {
    try {
      const { data } = await this.http.put(
        `/v1/tenants/${encodeURIComponent(tenantId)}/policy`,
        policy
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @returns {Promise<import('./amds-types').TenantPolicyResponse>}
   */
  async getTenantPolicy(tenantId) {
    try {
      const { data } = await this.http.get(
        `/v1/tenants/${encodeURIComponent(tenantId)}/policy`
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @param {import('./amds-types').CreditAllocationRequest} body
   * @returns {Promise<import('./amds-types').TenantPolicyResponse>}
   */
  async allocateCredits(tenantId, body) {
    try {
      const { data } = await this.http.patch(
        `/v1/tenants/${encodeURIComponent(tenantId)}/credits`,
        body
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @returns {Promise<import('./amds-types').TenantPolicyResponse>}
   */
  async suspendTenant(tenantId) {
    try {
      const { data } = await this.http.post(
        `/v1/tenants/${encodeURIComponent(tenantId)}/suspend`,
        {}
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @returns {Promise<import('./amds-types').TenantPolicyResponse>}
   */
  async activateTenant(tenantId) {
    try {
      const { data } = await this.http.post(
        `/v1/tenants/${encodeURIComponent(tenantId)}/activate`,
        {}
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @returns {Promise<import('./amds-types').TenantReputationResponse>}
   */
  async getTenantReputation(tenantId) {
    try {
      const { data } = await this.http.get(
        `/v1/tenants/${encodeURIComponent(tenantId)}/reputation`
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @param {number} [limit]
   * @returns {Promise<import('./amds-types').ReputationHistoryResponse>}
   */
  async getReputationHistory(tenantId, limit = 30) {
    try {
      const { data } = await this.http.get(
        `/v1/tenants/${encodeURIComponent(tenantId)}/reputation/history`,
        { params: { limit } }
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @returns {Promise<import('./amds-types').TenantThroughputResponse>}
   */
  async getTenantThroughput(tenantId) {
    try {
      const { data } = await this.http.get(
        `/v1/tenants/${encodeURIComponent(tenantId)}/throughput`
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @param {string} campaignId
   * @param {number} recipientCount
   * @returns {Promise<import('./amds-types').CampaignEstimateResponse>}
   */
  async getCampaignEstimate(tenantId, campaignId, recipientCount) {
    try {
      const { data } = await this.http.get(
        `/v1/campaigns/${encodeURIComponent(campaignId)}/estimate`,
        {
          params: {
            tenant_id: tenantId,
            recipient_count: recipientCount
          }
        }
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} campaignId
   * @param {string} tenantId
   * @returns {Promise<import('./amds-types').CampaignHealthResponse>}
   */
  async getCampaignHealth(campaignId, tenantId) {
    try {
      const { data } = await this.http.get(
        `/v1/campaigns/${encodeURIComponent(campaignId)}/health`,
        { params: { tenant_id: tenantId } }
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @param {string} tenantId
   * @returns {Promise<import('./amds-types').ReputationGuidanceResponse>}
   */
  async getReputationGuidance(tenantId) {
    try {
      const { data } = await this.http.get(
        `/v1/tenants/${encodeURIComponent(tenantId)}/reputation/guidance`
      );
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  /**
   * @returns {Promise<import('./amds-types').InfraStatusResponse>}
   */
  async getInfraStatus() {
    try {
      const { data } = await this.http.get('/v1/admin/infra/status');
      return data;
    } catch (err) {
      throw this.wrapError(err);
    }
  }

  async requestWithRetry(requestFn) {
    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const { data } = await requestFn();
        return data;
      } catch (err) {
        lastErr = err;
        if (attempt >= MAX_RETRIES || !isRetryableError(err)) {
          throw this.wrapError(err);
        }
        await sleep(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
      }
    }
    throw this.wrapError(lastErr);
  }

  wrapError(err) {
    if (err instanceof AmdsApiError) return err;
    if (axios.isAxiosError(err) && err.response) {
      const body = err.response.data;
      const normalized =
        body && typeof body === 'object'
          ? /** @type {import('./amds-types').AmdsErrorBody} */ (body)
          : { error: err.message };
      return new AmdsApiError(err.response.status, normalized);
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * @template T
 * @param {T[]} arr
 * @param {number} size
 * @returns {T[][]}
 */
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

module.exports = {
  AmdsClient,
  isRetryableError,
  MAX_RETRIES,
  AmdsApiError,
  chunkArray,
  CAMPAIGN_BATCH_MAX
};
