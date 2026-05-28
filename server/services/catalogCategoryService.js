const CatalogCategory = require('../models/CatalogCategory');
const Item = require('../models/Item');
const { slugifyCatalogKey } = require('../constants/catalogAttributeTypes');

function buildCategoryPath(parentPath, slug) {
  const segment = slug || 'category';
  if (!parentPath) return `/${segment}`;
  return `${parentPath.replace(/\/$/, '')}/${segment}`;
}

function buildCategoryTree(flatCategories) {
  const byId = new Map();
  const roots = [];

  for (const cat of flatCategories) {
    byId.set(String(cat._id), { ...cat, children: [] });
  }

  for (const cat of byId.values()) {
    if (cat.parentId) {
      const parent = byId.get(String(cat.parentId));
      if (parent) {
        parent.children.push(cat);
      } else {
        roots.push(cat);
      }
    } else {
      roots.push(cat);
    }
  }

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);
  return roots;
}

async function resolveCategoryPath(organizationId, parentId, slug) {
  if (!parentId) {
    return buildCategoryPath(null, slug);
  }
  const parent = await CatalogCategory.findOne({
    _id: parentId,
    organizationId
  }).lean();
  if (!parent) {
    throw new Error('Parent category not found');
  }
  return buildCategoryPath(parent.path, slug);
}

async function listCategoryTree(organizationId, { includeInactive = false } = {}) {
  const query = { organizationId };
  if (!includeInactive) query.isActive = true;

  const categories = await CatalogCategory.find(query)
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return buildCategoryTree(categories);
}

async function getCategoryById(categoryId, organizationId) {
  return CatalogCategory.findOne({ _id: categoryId, organizationId }).lean();
}

async function createCategory({ organizationId, userId, payload }) {
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Category name is required');

  const slug = payload.slug ? slugifyCatalogKey(payload.slug) : slugifyCatalogKey(name);
  const path = await resolveCategoryPath(organizationId, payload.parentId || null, slug);

  const duplicate = await CatalogCategory.findOne({ organizationId, path }).lean();
  if (duplicate) {
    throw new Error('A category with this path already exists');
  }

  return CatalogCategory.create({
    organizationId,
    name,
    slug,
    parentId: payload.parentId || null,
    path,
    sortOrder: payload.sortOrder ?? 0,
    isActive: payload.isActive !== false,
    createdBy: userId,
    modifiedBy: userId
  });
}

async function updateCategory({ categoryId, organizationId, userId, payload }) {
  const category = await CatalogCategory.findOne({ _id: categoryId, organizationId });
  if (!category) return null;

  if (payload.name !== undefined) category.name = String(payload.name).trim();
  if (payload.sortOrder !== undefined) category.sortOrder = payload.sortOrder;
  if (payload.isActive !== undefined) category.isActive = !!payload.isActive;

  const slug = payload.slug
    ? slugifyCatalogKey(payload.slug)
    : (payload.name ? slugifyCatalogKey(category.name) : category.slug);

  const parentId = payload.parentId !== undefined ? (payload.parentId || null) : category.parentId;

  if (payload.parentId !== undefined && String(parentId) === String(category._id)) {
    throw new Error('Category cannot be its own parent');
  }

  if (payload.name !== undefined || payload.slug !== undefined || payload.parentId !== undefined) {
    category.slug = slug;
    category.parentId = parentId;
    category.path = await resolveCategoryPath(organizationId, parentId, slug);
  }

  category.modifiedBy = userId;
  await category.save();
  return category;
}

async function deleteCategory({ categoryId, organizationId }) {
  const category = await CatalogCategory.findOne({ _id: categoryId, organizationId });
  if (!category) return null;

  const childCount = await CatalogCategory.countDocuments({
    organizationId,
    parentId: categoryId
  });
  if (childCount > 0) {
    const err = new Error('Cannot delete category with child categories');
    err.code = 'HAS_CHILDREN';
    throw err;
  }

  const itemCount = await Item.countDocuments({
    organizationId,
    categoryId: categoryId,
    deletedAt: null
  });
  if (itemCount > 0) {
    const err = new Error('Cannot delete category assigned to items');
    err.code = 'IN_USE';
    throw err;
  }

  await CatalogCategory.deleteOne({ _id: categoryId, organizationId });
  return category;
}

async function syncItemCategoryDenorm(item, category) {
  if (!category) {
    return item;
  }

  item.categoryId = category._id;

  if (category.parentId) {
    const parent = await CatalogCategory.findById(category.parentId).lean();
    item.category = parent?.name || category.name;
    item.subcategory = category.name;
  } else {
    item.category = category.name;
    item.subcategory = item.subcategory || '';
  }

  return item;
}

module.exports = {
  buildCategoryPath,
  buildCategoryTree,
  listCategoryTree,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  syncItemCategoryDenorm
};
