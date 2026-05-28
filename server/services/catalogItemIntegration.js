const mongoose = require('mongoose');
const {
  getCategoryById,
  syncItemCategoryDenorm
} = require('./catalogCategoryService');
const { listAttributeTemplates } = require('./catalogAttributeTemplateService');
const { validateAttributeValues } = require('./catalogAttributeValidator');

async function applyCatalogFieldsToPayload(payload, organizationId) {
  const next = { ...payload };

  if (!Object.prototype.hasOwnProperty.call(next, 'categoryId')
    && !Object.prototype.hasOwnProperty.call(next, 'attributeValues')) {
    return { payload: next };
  }

  let category = null;
  if (next.categoryId) {
    if (!mongoose.Types.ObjectId.isValid(next.categoryId)) {
      return { error: { status: 400, message: 'Invalid categoryId' } };
    }
    category = await getCategoryById(next.categoryId, organizationId);
    if (!category) {
      return { error: { status: 400, message: 'Category not found' } };
    }
  }

  if (Object.prototype.hasOwnProperty.call(next, 'attributeValues') && category) {
    const templates = await listAttributeTemplates(category._id, organizationId);
    const validation = validateAttributeValues(templates, next.attributeValues);
    if (!validation.ok) {
      return {
        error: {
          status: 400,
          message: 'Invalid attribute values',
          details: validation.errors
        }
      };
    }
    next.attributeValues = validation.sanitized;
  } else if (Object.prototype.hasOwnProperty.call(next, 'attributeValues') && !category) {
    next.attributeValues = {};
  }

  if (category) {
    if (category.parentId) {
      const parent = await getCategoryById(category.parentId, organizationId);
      next.category = parent?.name || category.name;
      next.subcategory = category.name;
    } else {
      next.category = category.name;
    }
  }

  return { payload: next, category };
}

async function applyCatalogFieldsToItemDocument(item, organizationId, payload) {
  if (payload.categoryId !== undefined) {
    if (!payload.categoryId) {
      item.categoryId = null;
      return item;
    }
    const category = await getCategoryById(payload.categoryId, organizationId);
    if (!category) {
      throw new Error('Category not found');
    }
    await syncItemCategoryDenorm(item, category);
  }

  if (payload.attributeValues !== undefined) {
    item.attributeValues = payload.attributeValues;
  }

  return item;
}

module.exports = {
  applyCatalogFieldsToPayload,
  applyCatalogFieldsToItemDocument
};
