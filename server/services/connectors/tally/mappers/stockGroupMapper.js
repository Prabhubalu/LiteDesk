'use strict';

/**
 * CatalogCategory ↔ Tally Stock Group
 */

/**
 * @param {object} category - CatalogCategory
 * @param {object} [parentCategory]
 */
function toTally(category = {}, parentCategory = null) {
  const parentName =
    (parentCategory && parentCategory.name) ||
    (category.parentId ? String(category.parentId) : 'Primary');

  return {
    masterType: 'STOCKGROUP',
    name: category.name || null,
    parent: parentName,
    slug: category.slug || null,
    path: category.path || null,
    sortOrder: category.sortOrder != null ? Number(category.sortOrder) : 0,
    isActive: category.isActive !== false,
    arivuId: category._id ? String(category._id) : null,
    parentId: category.parentId ? String(category.parentId) : null,
  };
}

/**
 * @param {object} stockGroup - Tally stock group fields
 */
function fromTally(stockGroup = {}) {
  return {
    name: stockGroup.name || stockGroup.NAME || null,
    slug: stockGroup.slug || null,
    parentExternalName: stockGroup.parent || stockGroup.PARENT || null,
    externalReferenceId:
      stockGroup.masterId || stockGroup.MASTERID || stockGroup.guid || stockGroup.GUID || null,
  };
}

module.exports = {
  toTally,
  fromTally,
};
