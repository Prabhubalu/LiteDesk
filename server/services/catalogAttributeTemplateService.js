const CatalogAttributeTemplate = require('../models/CatalogAttributeTemplate');
const { isCatalogAttributeDataType, slugifyCatalogKey } = require('../constants/catalogAttributeTypes');

async function listAttributeTemplates(categoryId, organizationId, { includeInactive = false } = {}) {
  const query = { organizationId, categoryId };
  if (!includeInactive) query.isActive = true;

  return CatalogAttributeTemplate.find(query)
    .sort({ sortOrder: 1, label: 1 })
    .lean();
}

async function ensureUniqueAttributeKey(organizationId, categoryId, baseKey) {
  const root = slugifyCatalogKey(baseKey) || 'field';
  let candidate = root;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await CatalogAttributeTemplate.exists({ organizationId, categoryId, key: candidate })) {
    candidate = `${root}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function createAttributeTemplate({ organizationId, categoryId, userId, payload }) {
  const label = String(payload.label || '').trim();
  if (!label) throw new Error('Attribute label is required');

  const dataType = payload.dataType || 'text';
  if (!isCatalogAttributeDataType(dataType)) {
    throw new Error('Invalid attribute dataType');
  }

  const baseKey = payload.key ? slugifyCatalogKey(payload.key) : slugifyCatalogKey(label);
  const key = await ensureUniqueAttributeKey(organizationId, categoryId, baseKey);

  return CatalogAttributeTemplate.create({
    organizationId,
    categoryId,
    key,
    label,
    dataType,
    required: !!payload.required,
    options: Array.isArray(payload.options) ? payload.options.map(String) : [],
    unit: payload.unit || '',
    sortOrder: payload.sortOrder ?? 0,
    isActive: payload.isActive !== false,
    createdBy: userId,
    modifiedBy: userId
  });
}

async function updateAttributeTemplate({ templateId, organizationId, userId, payload }) {
  const template = await CatalogAttributeTemplate.findOne({ _id: templateId, organizationId });
  if (!template) return null;

  if (payload.label !== undefined) template.label = String(payload.label).trim();
  if (payload.key !== undefined) {
    const nextKey = slugifyCatalogKey(payload.key);
    const conflict = await CatalogAttributeTemplate.findOne({
      organizationId,
      categoryId: template.categoryId,
      key: nextKey,
      _id: { $ne: template._id }
    }).select('_id').lean();
    if (conflict) {
      const err = new Error('An attribute with this key already exists on this category');
      err.code = 'DUPLICATE_KEY';
      throw err;
    }
    template.key = nextKey;
  }
  if (payload.dataType !== undefined) {
    if (!isCatalogAttributeDataType(payload.dataType)) {
      throw new Error('Invalid attribute dataType');
    }
    template.dataType = payload.dataType;
  }
  if (payload.required !== undefined) template.required = !!payload.required;
  if (payload.options !== undefined) {
    template.options = Array.isArray(payload.options) ? payload.options.map(String) : [];
  }
  if (payload.unit !== undefined) template.unit = payload.unit;
  if (payload.sortOrder !== undefined) template.sortOrder = payload.sortOrder;
  if (payload.isActive !== undefined) template.isActive = !!payload.isActive;

  template.modifiedBy = userId;
  await template.save();
  return template;
}

async function deleteAttributeTemplate({ templateId, organizationId }) {
  const result = await CatalogAttributeTemplate.deleteOne({ _id: templateId, organizationId });
  return result.deletedCount > 0;
}

module.exports = {
  listAttributeTemplates,
  ensureUniqueAttributeKey,
  createAttributeTemplate,
  updateAttributeTemplate,
  deleteAttributeTemplate
};
