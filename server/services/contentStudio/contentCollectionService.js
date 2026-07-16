'use strict';

const ContentCollection = require('../../models/ContentCollection');
const { normalizeAddonKey } = require('../../constants/addonKeys');
const {
  DEFAULT_HERO_ICON_COLOR,
  normalizeHeroIconKey,
  normalizeHeroIconColor,
} = require('../../constants/heroiconCatalog.generated');

class ContentCollectionError extends Error {
  constructor(message, { code = 'CONTENT_COLLECTION_ERROR', statusCode = 400 } = {}) {
    super(message);
    this.name = 'ContentCollectionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'collection';
}

function normalizeCollectionEmoji(value) {
  return String(value || '').trim().slice(0, 8);
}

function normalizeCollectionImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (
    raw.startsWith('/api/uploads/')
    || raw.startsWith('/api/files/download')
    || raw.startsWith('https://')
    || raw.startsWith('http://')
  ) {
    return raw.slice(0, 2048);
  }
  return '';
}

function applyCollectionIconFields(target, { heroIconKey, heroIconColor, emoji, imageUrl } = {}) {
  const hasImageUpdate = imageUrl !== undefined;
  const safeImageUrl = hasImageUpdate
    ? normalizeCollectionImageUrl(imageUrl)
    : normalizeCollectionImageUrl(target.imageUrl);

  if (safeImageUrl) {
    target.imageUrl = safeImageUrl;
    target.heroIconKey = '';
    target.heroIconColor = '';
    target.emoji = '';
    return target;
  }

  if (hasImageUpdate) {
    target.imageUrl = '';
  }

  const hasHeroIconUpdate = heroIconKey !== undefined;
  const safeHeroIconKey = hasHeroIconUpdate
    ? normalizeHeroIconKey(heroIconKey)
    : normalizeHeroIconKey(target.heroIconKey);

  if (safeHeroIconKey) {
    target.heroIconKey = safeHeroIconKey;
    target.heroIconColor = heroIconColor !== undefined
      ? (normalizeHeroIconColor(heroIconColor) || DEFAULT_HERO_ICON_COLOR)
      : (normalizeHeroIconColor(target.heroIconColor) || DEFAULT_HERO_ICON_COLOR);
    target.emoji = '';
    return target;
  }

  if (hasHeroIconUpdate) {
    target.heroIconKey = '';
  }

  if (heroIconColor !== undefined) {
    target.heroIconColor = normalizeHeroIconColor(heroIconColor);
  }

  if (emoji !== undefined) {
    target.emoji = normalizeCollectionEmoji(emoji);
  }

  return target;
}

function normalizeCategoryName(value) {
  return String(value || '').trim().toLowerCase();
}

async function assertUniqueCollectionFields({
  organizationId,
  addonKey,
  name,
  slug,
  parentId = null,
  excludeId = null,
}) {
  const safeAddonKey = normalizeAddonKey(addonKey);
  const normalizedParentId = parentId || null;
  const normalizedName = normalizeCategoryName(name);
  const candidateSlug = slugify(slug || name);

  const baseQuery = {
    organizationId,
    addonKey: safeAddonKey,
    deletedAt: null,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  };

  const siblings = await ContentCollection.find({
    ...baseQuery,
    parentId: normalizedParentId,
  })
    .select('name slug')
    .lean();

  const siblingNameMatch = siblings.find(
    (row) => normalizeCategoryName(row.name) === normalizedName,
  );
  if (siblingNameMatch) {
    throw new ContentCollectionError(
      'A category with this name already exists at this level.',
      { code: 'DUPLICATE_CATEGORY_NAME', statusCode: 409 },
    );
  }

  const slugRows = await ContentCollection.find({
    ...baseQuery,
    slug: candidateSlug,
  })
    .select('slug')
    .lean();
  if (slugRows.length) {
    throw new ContentCollectionError(
      'A category with this URL slug already exists. Choose a different name.',
      { code: 'DUPLICATE_CATEGORY_SLUG', statusCode: 409 },
    );
  }
}

async function listContentCollections({ organizationId, addonKey }) {
  const rows = await ContentCollection.find({
    organizationId,
    addonKey: normalizeAddonKey(addonKey),
    deletedAt: null,
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return rows;
}

async function createContentCollection({
  organizationId,
  addonKey,
  name,
  slug,
  description,
  emoji,
  heroIconKey,
  heroIconColor,
  imageUrl,
  parentId,
  sortOrder,
  userId,
}) {
  const safeName = String(name || '').trim();
  if (!safeName) {
    throw new ContentCollectionError('Name is required', { code: 'NAME_REQUIRED' });
  }

  const candidateSlug = slugify(slug || safeName);
  await assertUniqueCollectionFields({
    organizationId,
    addonKey,
    name: safeName,
    slug: candidateSlug,
    parentId: parentId || null,
  });

  const iconFields = applyCollectionIconFields({
    imageUrl: '',
    heroIconKey: '',
    heroIconColor: '',
    emoji: '',
  }, { heroIconKey, heroIconColor, emoji, imageUrl });

  return ContentCollection.create({
    organizationId,
    addonKey: normalizeAddonKey(addonKey),
    name: safeName,
    slug: candidateSlug,
    description: String(description || '').trim(),
    emoji: iconFields.emoji,
    heroIconKey: iconFields.heroIconKey,
    heroIconColor: iconFields.heroIconColor,
    imageUrl: iconFields.imageUrl,
    parentId: parentId || null,
    sortOrder: Number(sortOrder) || 0,
    createdBy: userId || null,
    updatedBy: userId || null,
  });
}

async function updateContentCollection({
  organizationId,
  id,
  name,
  slug,
  description,
  emoji,
  heroIconKey,
  heroIconColor,
  imageUrl,
  parentId,
  sortOrder,
  userId,
}) {
  const row = await ContentCollection.findOne({
    _id: id,
    organizationId,
    deletedAt: null,
  });

  if (!row) {
    throw new ContentCollectionError('Collection not found', { code: 'NOT_FOUND', statusCode: 404 });
  }

  const finalName = name !== undefined ? String(name).trim() : row.name;
  if (name !== undefined && !finalName) {
    throw new ContentCollectionError('Name is required', { code: 'NAME_REQUIRED' });
  }

  const finalParentId = parentId !== undefined ? (parentId || null) : (row.parentId || null);
  let finalSlug = row.slug;
  if (slug !== undefined) {
    finalSlug = slugify(slug);
  } else if (name !== undefined) {
    finalSlug = slugify(finalName);
  }

  const identityChanging = name !== undefined || parentId !== undefined || slug !== undefined;
  if (identityChanging) {
    await assertUniqueCollectionFields({
      organizationId,
      addonKey: row.addonKey,
      name: finalName,
      slug: finalSlug,
      parentId: finalParentId,
      excludeId: row._id,
    });
    if (name !== undefined) row.name = finalName;
    if (parentId !== undefined) row.parentId = finalParentId;
    row.slug = finalSlug;
  }

  if (description !== undefined) row.description = String(description || '').trim();
  if (heroIconKey !== undefined || heroIconColor !== undefined || emoji !== undefined || imageUrl !== undefined) {
    applyCollectionIconFields(row, { heroIconKey, heroIconColor, emoji, imageUrl });
  }
  if (sortOrder !== undefined) row.sortOrder = Number(sortOrder) || 0;

  row.updatedBy = userId || null;
  await row.save();
  return row.toObject();
}

async function deleteContentCollection({ organizationId, id, userId }) {
  const row = await ContentCollection.findOne({
    _id: id,
    organizationId,
    deletedAt: null,
  });

  if (!row) {
    throw new ContentCollectionError('Collection not found', { code: 'NOT_FOUND', statusCode: 404 });
  }

  row.deletedAt = new Date();
  row.updatedBy = userId || null;
  await row.save();
  return { _id: row._id, deleted: true };
}

module.exports = {
  ContentCollectionError,
  listContentCollections,
  createContentCollection,
  updateContentCollection,
  deleteContentCollection,
};
