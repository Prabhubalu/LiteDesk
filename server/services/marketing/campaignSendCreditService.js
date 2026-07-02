'use strict';

const mongoose = require('mongoose');
const OrgEmailPolicy = require('../../models/org-email-policy');
const Campaign = require('../../models/Campaign');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {number} amount
 * @returns {Promise<{ reserved: number, creditsRemaining: number, creditsReserved: number }>}
 */
async function reserveCampaignSendCredits(organizationId, campaignId, amount) {
  const reservedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (reservedAmount === 0) {
    return { reserved: 0, creditsRemaining: 0, creditsReserved: 0 };
  }

  const orgObjectId = new mongoose.Types.ObjectId(String(organizationId));
  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));

  return runWithOrganizationTenantContext(organizationId, async () => {
    const existing = await Campaign.findOne({ _id: campaignObjectId, organizationId: orgObjectId })
      .select('sendState.creditsReserved')
      .lean();
    const alreadyReserved = existing?.sendState?.creditsReserved ?? 0;
    if (alreadyReserved > 0) {
      const policy = await OrgEmailPolicy.findOne({ organizationId: orgObjectId }).lean();
      return {
        reserved: alreadyReserved,
        creditsRemaining: policy?.creditsRemaining ?? 0,
        creditsReserved: policy?.creditsReserved ?? 0
      };
    }

    const policy = await OrgEmailPolicy.findOneAndUpdate(
      {
        organizationId: orgObjectId,
        status: 'active',
        creditsRemaining: { $gte: reservedAmount }
      },
      {
        $inc: {
          creditsRemaining: -reservedAmount,
          creditsReserved: reservedAmount
        }
      },
      { new: true }
    );

    if (!policy) {
      const current = await OrgEmailPolicy.findOne({ organizationId: orgObjectId }).lean();
      const remaining = current?.creditsRemaining ?? 0;
      throw new Error(
        `Insufficient email credits: need ${reservedAmount.toLocaleString()}, have ${remaining.toLocaleString()}`
      );
    }

    await Campaign.updateOne(
      { _id: campaignObjectId, organizationId: orgObjectId },
      { $set: { 'sendState.creditsReserved': reservedAmount } }
    );

    return {
      reserved: reservedAmount,
      creditsRemaining: policy.creditsRemaining ?? 0,
      creditsReserved: policy.creditsReserved ?? 0
    };
  });
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {number} amount
 */
async function releaseCampaignSendCredits(organizationId, campaignId, amount) {
  const reservedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (reservedAmount === 0) return;

  const orgObjectId = new mongoose.Types.ObjectId(String(organizationId));
  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));

  await runWithOrganizationTenantContext(organizationId, async () => {
    await OrgEmailPolicy.updateOne(
      { organizationId: orgObjectId },
      {
        $inc: {
          creditsRemaining: reservedAmount,
          creditsReserved: -reservedAmount
        }
      }
    );

    await Campaign.updateOne(
      { _id: campaignObjectId, organizationId: orgObjectId },
      { $set: { 'sendState.creditsReserved': 0 } }
    );
  });
}

/**
 * Clears the local reservation and returns unused credits to the pool.
 * AMDS webhooks decrement creditsRemaining when messages are consumed.
 *
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {{ reserved: number, accepted: number }} params
 */
async function finalizeCampaignSendCredits(organizationId, campaignId, params) {
  const reservedAmount = Math.max(0, Math.floor(Number(params.reserved) || 0));
  if (reservedAmount === 0) return;

  const accepted = Math.max(0, Math.floor(Number(params.accepted) || 0));
  const unused = Math.max(0, reservedAmount - accepted);

  const orgObjectId = new mongoose.Types.ObjectId(String(organizationId));
  const campaignObjectId = new mongoose.Types.ObjectId(String(campaignId));

  await runWithOrganizationTenantContext(organizationId, async () => {
    await OrgEmailPolicy.updateOne(
      { organizationId: orgObjectId },
      {
        $inc: {
          creditsReserved: -reservedAmount,
          creditsRemaining: unused
        }
      }
    );

    await Campaign.updateOne(
      { _id: campaignObjectId, organizationId: orgObjectId },
      { $set: { 'sendState.creditsReserved': 0 } }
    );
  });
}

module.exports = {
  reserveCampaignSendCredits,
  releaseCampaignSendCredits,
  finalizeCampaignSendCredits
};
