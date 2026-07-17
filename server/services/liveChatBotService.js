const mongoose = require('mongoose');
const LiveChatBot = require('../models/LiveChatBot');

function normalizeBotKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function mapBotRow(row) {
  if (!row) return null;
  return {
    _id: row._id,
    botKey: row.botKey,
    name: row.name,
    description: row.description || '',
    enabled: row.enabled !== false,
    isDefault: row.isDefault === true,
    greetingMessage: row.greetingMessage || '',
    useKnowledgeBase: row.useKnowledgeBase !== false,
    useWebsiteContent: row.useWebsiteContent !== false,
    knowledgeDocumentIds: Array.isArray(row.knowledgeDocumentIds)
      ? row.knowledgeDocumentIds.map(String)
      : [],
    websiteContentPageIds: Array.isArray(row.websiteContentPageIds)
      ? row.websiteContentPageIds.map(String)
      : [],
    fallbackMessage: row.fallbackMessage || '',
    confidenceMinScore: Number(row.confidenceMinScore) > 0 ? Number(row.confidenceMinScore) : 2,
    aiAssist: row.aiAssist === true,
    processRecipeKey: row.processRecipeKey || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listBotsForOrganization(organizationId) {
  const rows = await LiveChatBot.find({ organizationId })
    .sort({ name: 1, createdAt: 1 })
    .lean();
  return rows.map(mapBotRow);
}

async function getBotById(organizationId, botId) {
  if (!mongoose.Types.ObjectId.isValid(botId)) return null;
  const row = await LiveChatBot.findOne({ _id: botId, organizationId }).lean();
  return mapBotRow(row);
}

async function createBot(organizationId, payload) {
  const botKey = normalizeBotKey(payload.botKey || payload.name);
  if (!botKey) {
    const err = new Error('botKey is required');
    err.statusCode = 400;
    throw err;
  }

  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }

  const existing = await LiveChatBot.findOne({ organizationId, botKey }).lean();
  if (existing) {
    const err = new Error('A bot with this key already exists');
    err.statusCode = 409;
    throw err;
  }

  const row = await LiveChatBot.create({
    organizationId,
    botKey,
    name,
    description: String(payload.description || '').trim(),
    enabled: payload.enabled !== false,
    isDefault: payload.isDefault === true,
    greetingMessage: String(payload.greetingMessage || '').trim(),
    useKnowledgeBase: payload.useKnowledgeBase !== false,
    useWebsiteContent: payload.useWebsiteContent !== false,
    knowledgeDocumentIds: Array.isArray(payload.knowledgeDocumentIds) ? payload.knowledgeDocumentIds : [],
    websiteContentPageIds: Array.isArray(payload.websiteContentPageIds) ? payload.websiteContentPageIds : [],
    fallbackMessage: String(payload.fallbackMessage || '').trim(),
    confidenceMinScore: Number(payload.confidenceMinScore) > 0 ? Number(payload.confidenceMinScore) : 2,
    aiAssist: payload.aiAssist === true,
    processRecipeKey: String(payload.processRecipeKey || '').trim(),
  });

  if (row.isDefault) {
    await LiveChatBot.updateMany(
      { organizationId, _id: { $ne: row._id } },
      { $set: { isDefault: false } },
    );
  }
  return mapBotRow(row.toObject ? row.toObject() : row);
}

async function updateBot(organizationId, botId, payload) {
  const row = await LiveChatBot.findOne({ _id: botId, organizationId });
  if (!row) {
    const err = new Error('Bot not found');
    err.statusCode = 404;
    throw err;
  }

  if (payload.name != null) {
    const name = String(payload.name || '').trim();
    if (!name) {
      const err = new Error('name is required');
      err.statusCode = 400;
      throw err;
    }
    row.name = name;
  }

  if (payload.description != null) row.description = String(payload.description || '').trim();
  if (payload.enabled != null) row.enabled = payload.enabled !== false;
  if (payload.isDefault != null) row.isDefault = payload.isDefault === true;
  if (payload.greetingMessage != null) row.greetingMessage = String(payload.greetingMessage || '').trim();
  if (payload.useKnowledgeBase != null) row.useKnowledgeBase = payload.useKnowledgeBase !== false;
  if (payload.useWebsiteContent != null) row.useWebsiteContent = payload.useWebsiteContent !== false;
  if (payload.knowledgeDocumentIds != null) {
    row.knowledgeDocumentIds = Array.isArray(payload.knowledgeDocumentIds) ? payload.knowledgeDocumentIds : [];
  }
  if (payload.websiteContentPageIds != null) {
    row.websiteContentPageIds = Array.isArray(payload.websiteContentPageIds) ? payload.websiteContentPageIds : [];
  }
  if (payload.fallbackMessage != null) row.fallbackMessage = String(payload.fallbackMessage || '').trim();
  if (payload.confidenceMinScore != null) {
    row.confidenceMinScore = Number(payload.confidenceMinScore) > 0 ? Number(payload.confidenceMinScore) : 2;
  }
  if (payload.aiAssist != null) row.aiAssist = payload.aiAssist === true;
  if (payload.processRecipeKey != null) row.processRecipeKey = String(payload.processRecipeKey || '').trim();

  if (payload.botKey != null) {
    const botKey = normalizeBotKey(payload.botKey);
    if (!botKey) {
      const err = new Error('botKey is required');
      err.statusCode = 400;
      throw err;
    }
    const duplicate = await LiveChatBot.findOne({
      organizationId,
      botKey,
      _id: { $ne: row._id },
    }).lean();
    if (duplicate) {
      const err = new Error('A bot with this key already exists');
      err.statusCode = 409;
      throw err;
    }
    row.botKey = botKey;
  }

  await row.save();

  if (row.isDefault) {
    await LiveChatBot.updateMany(
      { organizationId, _id: { $ne: row._id } },
      { $set: { isDefault: false } },
    );
  }

  return mapBotRow(row.toObject ? row.toObject() : row);
}

async function deleteBot(organizationId, botId) {
  const result = await LiveChatBot.deleteOne({ _id: botId, organizationId });
  if (!result.deletedCount) {
    const err = new Error('Bot not found');
    err.statusCode = 404;
    throw err;
  }
}

module.exports = {
  listBotsForOrganization,
  getBotById,
  createBot,
  updateBot,
  deleteBot,
};
