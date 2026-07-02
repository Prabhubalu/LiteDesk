'use strict';

/**
 * AMDS API contract types (Phase 0a + Track 3 + Track 4).
 * @see docs/LITEDESK-INTEGRATION.md
 * @see docs/LITEDESK-TRACK-3-DRAFT.md
 * @see docs/LITEDESK-TRACK-4-DRAFT.md
 */

/**
 * @typedef {{ email: string, name?: string }} AmdsAddress
 */

/**
 * @typedef {Object} SendMessageRequest
 * @property {string} idempotency_key
 * @property {string} tenant_id
 * @property {AmdsAddress} from
 * @property {AmdsAddress[]} to
 * @property {AmdsAddress[]} [cc]
 * @property {AmdsAddress[]} [bcc]
 * @property {string} subject
 * @property {{ html?: string, text?: string }} content
 * @property {Record<string, unknown>} [metadata]
 * @property {string[]} [tags]
 * @property {string} [scheduled_at]
 * @property {{ opens: boolean, clicks: boolean }} [tracking]
 */

/**
 * @typedef {Object} SendMessageResponse
 * @property {string} message_id
 * @property {'queued'} status
 * @property {string} queue
 * @property {string} created_at
 */

/**
 * @typedef {'queued'|'scheduled'|'processing'|'delivered'|'failed'|'dead_letter'|'bounced'} AmdsMessageStatus
 */

/**
 * @typedef {Object} MessageEvent
 * @property {string} event_type
 * @property {Record<string, unknown>|null} detail
 * @property {string} created_at
 */

/**
 * @typedef {Object} MessageStatusResponse
 * @property {string} message_id
 * @property {string} tenant_id
 * @property {AmdsMessageStatus} status
 * @property {string} queue
 * @property {string} subject
 * @property {AmdsAddress[]} to
 * @property {string|null} smtp_response
 * @property {string|null} error_message
 * @property {number} attempt_count
 * @property {Record<string, unknown>|null} metadata
 * @property {string|null} [scheduled_at]
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string|null} delivered_at
 * @property {MessageEvent[]} [events]
 * @property {{ failure_reason: string, attempt_count: number, moved_at: string }|null} [dead_letter]
 */

/**
 * @typedef {Object} DnsRecord
 * @property {'TXT'|'CNAME'} type
 * @property {string} name
 * @property {string} value
 * @property {'spf'|'dkim'|'dmarc'} purpose
 */

/**
 * @typedef {Object} DomainResponse
 * @property {string} domain
 * @property {string} tenant_id
 * @property {'pending'|'verified'} status
 * @property {string} dkim_selector
 * @property {DnsRecord[]} dns_records
 * @property {boolean} spf_verified
 * @property {boolean} dkim_verified
 * @property {boolean} dmarc_verified
 * @property {string|null} verified_at
 * @property {string} created_at
 * @property {{ spf: boolean, dkim: boolean, dmarc: boolean }} [verification]
 */

/**
 * @typedef {Object} RegisterDomainRequest
 * @property {string} tenant_id
 * @property {string} domain
 */

/**
 * @typedef {Object} VerifyDomainRequest
 * @property {string} tenant_id
 */

/**
 * @typedef {'hard_bounce'|'complaint'|'manual'} SuppressionReason
 */

/**
 * @typedef {Object} SuppressionEntry
 * @property {string} email
 * @property {SuppressionReason} reason
 * @property {string|null} source_message_id
 * @property {string} created_at
 */

/**
 * @typedef {Object} SuppressionListResponse
 * @property {string} tenant_id
 * @property {SuppressionEntry[]} suppressions
 */

/**
 * @typedef {Object} CreateSuppressionRequest
 * @property {string} tenant_id
 * @property {string} email
 * @property {SuppressionReason} [reason]
 */

/**
 * @typedef {'queued'|'scheduled'|'processing'|'delivered'|'failed'|'dead_letter'|'bounced'} AmdsQueue
 */

/**
 * @typedef {{ opens: boolean, clicks: boolean }} TrackingOptions
 */

/**
 * @typedef {Object} CampaignBatchMessage
 * @property {string} idempotency_key
 * @property {AmdsAddress[]} to
 * @property {string} subject
 * @property {{ html?: string, text?: string }} content
 * @property {Record<string, unknown>} [metadata]
 * @property {string[]} [tags]
 */

/**
 * @typedef {Object} CampaignBatchRequest
 * @property {string} tenant_id
 * @property {AmdsAddress} from
 * @property {CampaignBatchMessage[]} messages
 * @property {TrackingOptions} [tracking]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} CampaignBatchMessageResult
 * @property {string} message_id
 * @property {string} status
 * @property {string} idempotency_key
 */

/**
 * @typedef {Object} CampaignBatchRejected
 * @property {string} idempotency_key
 * @property {string} reason
 * @property {unknown} [detail]
 */

/**
 * @typedef {Object} CampaignBatchResponse
 * @property {string} campaign_id
 * @property {string} campaign_uuid
 * @property {number} accepted
 * @property {number} rejected
 * @property {CampaignBatchMessageResult[]} messages
 * @property {CampaignBatchRejected[]} errors
 */

/**
 * @typedef {Object} AnalyticsSummaryQuery
 * @property {string} tenant_id
 * @property {string} [campaign_id]
 * @property {string} [from]
 * @property {string} [to]
 */

/**
 * @typedef {Object} AnalyticsSummaryResponse
 * @property {string} tenant_id
 * @property {string|null} campaign_id
 * @property {{ from: string|null, to: string|null }} period
 * @property {Object} counts
 * @property {number} counts.total
 * @property {number} counts.queued
 * @property {number} counts.scheduled
 * @property {number} counts.processing
 * @property {number} counts.delivered
 * @property {number} counts.failed
 * @property {number} counts.bounced
 * @property {number} counts.dead_letter
 * @property {number} counts.unique_opens
 * @property {number} counts.unique_clicks
 * @property {number} counts.total_opens
 * @property {number} counts.total_clicks
 * @property {number} [counts.complaints]
 * @property {number} [counts.hard_bounced]
 * @property {number} [counts.soft_bounced]
 * @property {{ delivery_rate: number, open_rate: number, click_rate: number, complaint_rate?: number, hard_bounce_rate?: number, soft_bounce_rate?: number }} rates
 * @property {{ score: number, previous_score?: number, delta?: number }} [reputation]
 * @property {{ score: number, factors?: Array<{ signal: string, impact: string, message: string }> }} [campaign_health]
 */

/**
 * @typedef {Object} TenantPolicyPayload
 * @property {'active'|'suspended'} status
 * @property {number} monthly_credits
 * @property {number} credits_remaining
 * @property {number} daily_send_limit
 * @property {number} max_hourly_rate
 * @property {number} burst_rate_per_min
 * @property {number} max_campaign_size
 * @property {boolean} warmup_enabled
 * @property {boolean} reputation_enabled
 */

/**
 * @typedef {TenantPolicyPayload & {
 *   tenant_id: string,
 *   credits_reserved: number,
 *   first_send_at: string|null,
 *   synced_at: string,
 *   created_at: string,
 *   updated_at: string
 * }} TenantPolicyResponse
 */

/**
 * @typedef {Object} CreditAllocationRequest
 * @property {number} amount
 * @property {string} [reason]
 */

/**
 * @typedef {'credit.reserved'|'credit.consumed'|'credit.released'|'policy.limit_exceeded'|'reputation.updated'|'throughput.updated'} AmdsTenantEventType
 */

/**
 * @typedef {Object} AmdsTenantWebhookEvent
 * @property {string} event_id
 * @property {string} timestamp
 * @property {AmdsTenantEventType} event_type
 * @property {string} tenant_id
 * @property {string} [message_id]
 * @property {{ amount: number, balance_after: number, reserved_after: number }} [credit]
 * @property {{ reason: string, limit?: number, remaining?: number }} [policy]
 * @property {{ score: number, previous_score: number, delta: number, factors?: Array<{ signal: string, impact: string, message: string }>, trigger_signal?: string }} [reputation]
 * @property {{ effective_hourly_rate: number, effective_burst_rate: number, multipliers?: { warmup_stage?: string, infra?: number } }} [throughput]
 */

/**
 * @typedef {Object} TenantReputationResponse
 * @property {string} tenant_id
 * @property {number} score
 * @property {number} previous_score
 * @property {number} delta
 * @property {Record<string, { rate: number|null, score: number, weight: number }>} [breakdown]
 * @property {Record<string, number>} [metrics]
 * @property {boolean} [admin_override]
 * @property {string|null} [override_reason]
 * @property {Array<{ signal: string, impact: string, message: string }>} [factors]
 * @property {{ day_start_score?: number, remaining_gain_today?: number }} [recovery]
 * @property {string} updated_at
 */

/**
 * @typedef {Object} ReputationHistoryEntry
 * @property {number} score
 * @property {number} previous_score
 * @property {number} delta
 * @property {string} updated_at
 */

/**
 * @typedef {Object} ReputationHistoryResponse
 * @property {string} tenant_id
 * @property {ReputationHistoryEntry[]} history
 */

/**
 * @typedef {Object} TenantThroughputResponse
 * @property {string} tenant_id
 * @property {number} max_hourly_rate
 * @property {number} max_burst_rate
 * @property {number} effective_hourly_rate
 * @property {number} effective_burst_rate
 * @property {{ reputation: number, warmup: number, infra: number, combined: number, warmup_stage: string }} multipliers
 * @property {number} reputation_score
 * @property {string} updated_at
 */

/**
 * @typedef {Object} InfraStatusResponse
 * @property {number} [infra_multiplier]
 * @property {number} [queue_depth]
 * @property {string} [load_level]
 * @property {string} [updated_at]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} CampaignHealthResponse
 * @property {string} tenant_id
 * @property {string} campaign_id
 * @property {number} message_count
 * @property {number} score
 * @property {Record<string, { rate: number|null, score: number, weight: number }>} [breakdown]
 * @property {{ total: number, delivered: number, hardBounced: number, softBounced: number, complaints: number, uniqueOpens: number, uniqueClicks: number }} [metrics]
 * @property {Array<{ signal: string, impact: 'positive'|'negative'|'neutral', message: string }>} [factors]
 */

/**
 * @typedef {Object} ReputationGuidanceResponse
 * @property {string} tenant_id
 * @property {number} score
 * @property {number} previous_score
 * @property {number} delta
 * @property {Record<string, unknown>} [breakdown]
 * @property {Array<{ signal: string, status: 'passed'|'warning'|'failed', message: string, score: number, previous_score?: number, delta?: number }>} [reasons]
 * @property {Array<{ priority: 'high'|'medium'|'low', category: string, message: string }>} [recommendations]
 * @property {string} updated_at
 */

/**
 * @typedef {Object} CampaignEstimateResponse
 * @property {string} campaign_id
 * @property {string} tenant_id
 * @property {number} recipient_count
 * @property {TenantThroughputResponse} throughput
 * @property {number|null} estimated_seconds
 * @property {string|null} estimated_completion
 */

/**
 * @typedef {'message.delivered'|'message.failed'|'message.bounced'|'message.complained'|'message.opened'|'message.clicked'|AmdsTenantEventType} AmdsWebhookEventType
 */

/**
 * @typedef {Object} AmdsWebhookEvent
 * @property {string} event_id
 * @property {AmdsWebhookEventType} event_type
 * @property {string} timestamp
 * @property {string} tenant_id
 * @property {string} message_id
 * @property {Object} [metadata]
 * @property {string} [metadata.litedesk_module]
 * @property {string} [metadata.litedesk_entity_id]
 * @property {string} [metadata.litedesk_communication_id]
 * @property {string} [metadata.litedesk_org_id]
 * @property {string} [metadata.litedesk_case_id]
 * @property {string} [metadata.litedesk_reply_id]
 * @property {string} [metadata.litedesk_recipient_id]
 * @property {string} [metadata.campaign_external_id]
 * @property {Object} [delivery]
 * @property {string} [delivery.recipient]
 * @property {string} [delivery.smtp_response]
 * @property {number} [delivery.attempt]
 * @property {string} [delivery.error]
 * @property {Object} [bounce]
 * @property {string} [bounce.recipient]
 * @property {'hard'|'soft'} [bounce.classification]
 * @property {string} [bounce.diagnostic]
 * @property {string|null} [bounce.status_code]
 * @property {Object} [engagement]
 * @property {string} [engagement.recipient]
 * @property {string} [engagement.url]
 * @property {number} [engagement.hit_count]
 * @property {{ amount: number, balance_after: number, reserved_after: number }} [credit]
 * @property {{ reason: string, limit?: number, remaining?: number }} [policy]
 */

/**
 * @typedef {Object} AmdsErrorBody
 * @property {string} error
 * @property {unknown} [details]
 * @property {string[]} [suppressed]
 * @property {string} [domain]
 * @property {number} [remaining]
 * @property {number} [limit]
 */

module.exports = {};
