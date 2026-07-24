'use strict';

/**
 * Runtime learnedProfile updates — never mutates basePrompt.
 */

const AstraTenantAgent = require('../../../models/AstraTenantAgent');

const MAX_PROFILE_UPDATES_PER_DAY = 20;

async function countProfileUpdatesToday(organizationId, agentKey) {
  // Soft quota via learnedProfile._meta only
  const doc = await AstraTenantAgent.findOne({ organizationId, key: agentKey })
    .select('learnedProfile')
    .lean();
  const meta = doc?.learnedProfile?._meta || {};
  const day = new Date().toISOString().slice(0, 10);
  if (meta.day !== day) return 0;
  return Number(meta.updatesToday) || 0;
}

/**
 * @param {{ organizationId: string, agentKey: string, signal: 'accept'|'reject'|'correction', phrase?: string, toolChain?: string[] }} args
 */
async function applyLearnedProfileUpdate({
  organizationId,
  agentKey,
  signal,
  phrase = '',
  toolChain = [],
} = {}) {
  if (!organizationId || !agentKey) return null;
  const updatesToday = await countProfileUpdatesToday(organizationId, agentKey);
  if (updatesToday >= MAX_PROFILE_UPDATES_PER_DAY) {
    return { skipped: true, reason: 'quota' };
  }

  const doc = await AstraTenantAgent.findOne({ organizationId, key: agentKey });
  if (!doc) return null;

  const profile = {
    preferredTone: doc.learnedProfile?.preferredTone || '',
    topIntents: Array.isArray(doc.learnedProfile?.topIntents) ? [...doc.learnedProfile.topIntents] : [],
    acceptedPhrases: Array.isArray(doc.learnedProfile?.acceptedPhrases) ? [...doc.learnedProfile.acceptedPhrases] : [],
    disallowedBehaviors: Array.isArray(doc.learnedProfile?.disallowedBehaviors)
      ? [...doc.learnedProfile.disallowedBehaviors]
      : [],
    successfulToolChains: Array.isArray(doc.learnedProfile?.successfulToolChains)
      ? [...doc.learnedProfile.successfulToolChains]
      : [],
    _meta: doc.learnedProfile?._meta || {},
  };

  const day = new Date().toISOString().slice(0, 10);
  if (profile._meta.day !== day) {
    profile._meta = { day, updatesToday: 0 };
  }

  if (signal === 'accept' && phrase) {
    profile.acceptedPhrases = [...new Set([phrase.slice(0, 120), ...profile.acceptedPhrases])].slice(0, 40);
  }
  if (signal === 'reject' && phrase) {
    profile.disallowedBehaviors = [...new Set([phrase.slice(0, 120), ...profile.disallowedBehaviors])].slice(0, 40);
  }
  if (signal === 'accept' && toolChain?.length) {
    profile.successfulToolChains = [
      toolChain.slice(0, 8),
      ...profile.successfulToolChains,
    ].slice(0, 20);
  }

  profile._meta.updatesToday = (Number(profile._meta.updatesToday) || 0) + 1;
  profile._meta.day = day;
  doc.learnedProfile = profile;
  // Never touch basePrompt / systemHint here
  await doc.save();
  return { ok: true, learnedProfile: profile };
}

module.exports = {
  MAX_PROFILE_UPDATES_PER_DAY,
  applyLearnedProfileUpdate,
  countProfileUpdatesToday,
};
