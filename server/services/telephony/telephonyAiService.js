'use strict';

const TelephonyCall = require('../../models/TelephonyCall');
const TelephonyRecording = require('../../models/TelephonyRecording');
const TelephonyTranscript = require('../../models/TelephonyTranscript');
const TelephonySummary = require('../../models/TelephonySummary');
const telephonySSEHub = require('./telephonySSEHub');
const telephonyEventService = require('./telephonyEventService');
const { enqueueTelephonyJob } = require('./telephonyQueueService');

/**
 * Persist recording metadata / storage pointer. Full media copy is optional.
 */
async function ingestRecording({ organizationId, callId, recordingId, recordingUrl } = {}) {
  if (!organizationId || !recordingId) return { ok: false };

  const recording = await TelephonyRecording.findOne({
    _id: recordingId,
    organizationId,
  });
  if (!recording) return { ok: false, reason: 'recording_not_found' };

  if (recordingUrl && !recording.storageKey) {
    recording.storageKey = recordingUrl;
  }
  recording.encryptionStatus = recording.encryptionStatus || 'pending';
  await recording.save();

  enqueueTelephonyJob('generateTranscript', {
    organizationId: String(organizationId),
    callId: String(callId || recording.callId),
    recordingId: String(recording._id),
  });

  return { ok: true, recordingId: String(recording._id) };
}

/**
 * Stub STT: stores placeholder transcript; Whisper not configured by default.
 * If OPENAI_API_KEY is present, notes that STT can be wired later.
 */
async function generateTranscript({ organizationId, callId, recordingId } = {}) {
  if (!organizationId || !callId) return { ok: false };

  const call = await TelephonyCall.findOne({ _id: callId, organizationId });
  if (!call) return { ok: false, reason: 'call_not_found' };

  const recording = recordingId
    ? await TelephonyRecording.findOne({ _id: recordingId, organizationId })
    : await TelephonyRecording.findOne({ organizationId, callId });

  const hasOpenAi = Boolean(String(process.env.OPENAI_API_KEY || '').trim());
  const placeholder = hasOpenAi
    ? '[Transcript pending — Whisper STT not yet wired; OpenAI key detected]'
    : '[Transcript unavailable — STT not configured]';

  let fullText = placeholder;
  if (recording?.storageKey && hasOpenAi) {
    try {
      // Best-effort fetch to confirm recording URL is reachable; no STT yet.
      const res = await fetch(recording.storageKey, { method: 'HEAD' }).catch(() => null);
      if (res && res.ok) {
        fullText = `${placeholder} (recording reachable)`;
      }
    } catch {
      /* ignore */
    }
  }

  const transcript = await TelephonyTranscript.findOneAndUpdate(
    { organizationId, callId },
    {
      $set: {
        providerKey: call.providerKey,
        language: 'en',
        segments: [{ speaker: 'system', text: fullText, startMs: 0, endMs: 0 }],
        fullText,
        storageKey: recording?.storageKey || null,
      },
    },
    { upsert: true, new: true }
  );

  call.transcriptId = transcript._id;
  await call.save();

  telephonySSEHub.publishToOrg(organizationId, {
    type: 'TranscriptReady',
    callId: String(callId),
    transcriptId: String(transcript._id),
  });
  telephonyEventService.emitTranscriptReady({
    organizationId,
    callId,
    metadata: { transcriptId: String(transcript._id) },
  });

  enqueueTelephonyJob('generateSummary', {
    organizationId: String(organizationId),
    callId: String(callId),
    transcriptId: String(transcript._id),
  });

  return { ok: true, transcript };
}

async function generateSummary({ organizationId, callId, transcriptId } = {}) {
  if (!organizationId || !callId) return { ok: false };

  const call = await TelephonyCall.findOne({ _id: callId, organizationId });
  if (!call) return { ok: false, reason: 'call_not_found' };

  const transcript = transcriptId
    ? await TelephonyTranscript.findOne({ _id: transcriptId, organizationId })
    : await TelephonyTranscript.findOne({ organizationId, callId });

  const text = transcript?.fullText || '';
  let summaryText = 'No transcript available to summarize.';
  let sentiment = null;
  let intent = null;
  let actionItems = [];

  if (text && !text.includes('[Transcript unavailable')) {
    summaryText = `Call between ${call.from || '?'} and ${call.to || '?'}. Status: ${call.status}. Duration: ${call.durationSeconds ?? 'n/a'}s.`;
    try {
      const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
      if (apiKey) {
        const { getLlmAdapter } = require('../ai/providerRegistry');
        const { AI_PROVIDERS } = require('../../constants/aiProviders');
        const adapter = getLlmAdapter(AI_PROVIDERS.OPENAI);
        const result = await adapter.complete({
          apiKey,
          model: process.env.OPENAI_TELEPHONY_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'Summarize this phone call in 2-3 sentences. Return JSON: {summary, intent, sentiment, actionItems:[]}',
            },
            { role: 'user', content: text.slice(0, 8000) },
          ],
          maxTokens: 400,
        });
        const content = result?.content || result?.text || '';
        try {
          const parsed = JSON.parse(content);
          summaryText = parsed.summary || summaryText;
          intent = parsed.intent || null;
          sentiment = parsed.sentiment || null;
          actionItems = Array.isArray(parsed.actionItems) ? parsed.actionItems : [];
        } catch {
          if (content) summaryText = String(content).slice(0, 2000);
        }
      }
    } catch (err) {
      console.warn('[telephonyAiService] summarize via LLM skipped:', err.message);
      summaryText = `Call summary (fallback): ${call.direction} ${call.status}, ${call.durationSeconds ?? 0}s.`;
    }
  }

  const summary = await TelephonySummary.findOneAndUpdate(
    { organizationId, callId },
    {
      $set: {
        summary: summaryText,
        intent,
        actionItems,
        sentiment,
        coachingScore: null,
        talkRatio: null,
        complianceFlags: [],
      },
    },
    { upsert: true, new: true }
  );

  call.summaryId = summary._id;
  if (sentiment) call.sentiment = sentiment;
  await call.save();

  telephonySSEHub.publishToOrg(organizationId, {
    type: 'SummaryReady',
    callId: String(callId),
    summaryId: String(summary._id),
  });
  telephonyEventService.emitSummaryReady({
    organizationId,
    callId,
    metadata: { summaryId: String(summary._id) },
  });

  return { ok: true, summary };
}

module.exports = {
  ingestRecording,
  generateTranscript,
  generateSummary,
};
