'use strict';

const campaignService = require('../services/telephony/campaignService');

exports.listCampaigns = async (req, res) => {
  try {
    const data = await campaignService.listCampaigns(req.user.organizationId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyCampaignController] listCampaigns', err);
    return res.status(500).json({ success: false, message: 'Failed to list campaigns' });
  }
};

exports.getCampaign = async (req, res) => {
  try {
    const data = await campaignService.getCampaign(
      req.user.organizationId,
      req.params.campaignId
    );
    if (!data) return res.status(404).json({ success: false, message: 'Campaign not found' });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[telephonyCampaignController] getCampaign', err);
    return res.status(500).json({ success: false, message: 'Failed to load campaign' });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const data = await campaignService.createCampaign(req.user.organizationId, req.body || {});
    return res.status(201).json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCampaignController] createCampaign', err);
    return res.status(500).json({ success: false, message: 'Failed to create campaign' });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const data = await campaignService.updateCampaign(
      req.user.organizationId,
      req.params.campaignId,
      req.body || {}
    );
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCampaignController] updateCampaign', err);
    return res.status(500).json({ success: false, message: 'Failed to update campaign' });
  }
};

exports.startCampaign = async (req, res) => {
  try {
    const data = await campaignService.startCampaign(
      req.user.organizationId,
      req.params.campaignId
    );
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCampaignController] startCampaign', err);
    return res.status(500).json({ success: false, message: 'Failed to start campaign' });
  }
};

exports.pauseCampaign = async (req, res) => {
  try {
    const data = await campaignService.pauseCampaign(
      req.user.organizationId,
      req.params.campaignId
    );
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCampaignController] pauseCampaign', err);
    return res.status(500).json({ success: false, message: 'Failed to pause campaign' });
  }
};

exports.resumeCampaign = async (req, res) => {
  try {
    const data = await campaignService.resumeCampaign(
      req.user.organizationId,
      req.params.campaignId
    );
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCampaignController] resumeCampaign', err);
    return res.status(500).json({ success: false, message: 'Failed to resume campaign' });
  }
};

exports.dialNext = async (req, res) => {
  try {
    const data = await campaignService.dialNext(req.user.organizationId, req.params.campaignId, {
      agentUserId: req.user._id,
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[telephonyCampaignController] dialNext', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to dial next' });
  }
};
