const {
  listCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryById
} = require('../services/catalogCategoryService');
const {
  listAttributeTemplates,
  createAttributeTemplate,
  updateAttributeTemplate,
  deleteAttributeTemplate
} = require('../services/catalogAttributeTemplateService');
const { getVariantById } = require('../services/itemVariantService');
const Item = require('../models/Item');
const { setCatalogApiVersionHeader } = require('../services/catalogVariantWriteService');

// GET /api/catalog/categories/tree
exports.getCategoryTree = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const tree = await listCategoryTree(req.user.organizationId, { includeInactive });
    res.json({ success: true, data: tree });
  } catch (err) {
    console.error('getCategoryTree error:', err);
    res.status(500).json({ success: false, message: 'Error fetching category tree', error: err.message });
  }
};

// POST /api/catalog/categories
exports.createCategory = async (req, res) => {
  try {
    const category = await createCategory({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    console.error('createCategory error:', err);
    res.status(400).json({ success: false, message: err.message || 'Error creating category' });
  }
};

// PUT /api/catalog/categories/:id
exports.updateCategory = async (req, res) => {
  try {
    const category = await updateCategory({
      categoryId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, data: category });
  } catch (err) {
    console.error('updateCategory error:', err);
    res.status(400).json({ success: false, message: err.message || 'Error updating category' });
  }
};

// DELETE /api/catalog/categories/:id
exports.deleteCategory = async (req, res) => {
  try {
    const removed = await deleteCategory({
      categoryId: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    if (err.code === 'HAS_CHILDREN' || err.code === 'IN_USE') {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('deleteCategory error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error deleting category' });
  }
};

// GET /api/catalog/categories/:id/attributes
exports.getCategoryAttributes = async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id, req.user.organizationId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    const includeInactive = req.query.includeInactive === 'true';
    const templates = await listAttributeTemplates(req.params.id, req.user.organizationId, { includeInactive });
    res.json({ success: true, data: templates, category });
  } catch (err) {
    console.error('getCategoryAttributes error:', err);
    res.status(500).json({ success: false, message: 'Error fetching attribute templates', error: err.message });
  }
};

// POST /api/catalog/categories/:id/attributes
exports.createCategoryAttribute = async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id, req.user.organizationId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    const template = await createAttributeTemplate({
      organizationId: req.user.organizationId,
      categoryId: req.params.id,
      userId: req.user._id,
      payload: req.body || {}
    });
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    console.error('createCategoryAttribute error:', err);
    res.status(400).json({ success: false, message: err.message || 'Error creating attribute template' });
  }
};

// PUT /api/catalog/categories/:id/attributes/:attrId
exports.updateCategoryAttribute = async (req, res) => {
  try {
    const template = await updateAttributeTemplate({
      templateId: req.params.attrId,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    if (!template || String(template.categoryId) !== String(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Attribute template not found' });
    }
    res.json({ success: true, data: template });
  } catch (err) {
    console.error('updateCategoryAttribute error:', err);
    res.status(400).json({ success: false, message: err.message || 'Error updating attribute template' });
  }
};

// DELETE /api/catalog/categories/:id/attributes/:attrId
exports.deleteCategoryAttribute = async (req, res) => {
  try {
    const CatalogAttributeTemplate = require('../models/CatalogAttributeTemplate');
    const existing = await CatalogAttributeTemplate.findOne({
      _id: req.params.attrId,
      organizationId: req.user.organizationId
    }).lean();
    if (!existing || String(existing.categoryId) !== String(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Attribute template not found' });
    }
    const deleted = await deleteAttributeTemplate({
      templateId: req.params.attrId,
      organizationId: req.user.organizationId
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Attribute template not found' });
    }
    res.json({ success: true, message: 'Attribute template deleted' });
  } catch (err) {
    console.error('deleteCategoryAttribute error:', err);
    res.status(500).json({ success: false, message: 'Error deleting attribute template', error: err.message });
  }
};

// GET /api/catalog/variants/:variantId — canonical sellable read (Quotes/Orders)
exports.getCatalogVariantById = async (req, res) => {
  try {
    const variant = await getVariantById(req.params.variantId, req.user.organizationId);
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }

    const item = await Item.findOne({
      _id: variant.itemId,
      organizationId: req.user.organizationId,
      deletedAt: null
    })
      .select('item_name item_type lifecycle_state categoryId category hasVariants defaultVariantId')
      .lean();

    if (!item) {
      return res.status(404).json({ success: false, message: 'Parent item not found' });
    }

    setCatalogApiVersionHeader(res);
    res.json({
      success: true,
      data: {
        ...variant,
        item
      }
    });
  } catch (err) {
    console.error('getCatalogVariantById error:', err);
    res.status(500).json({ success: false, message: 'Error fetching variant', error: err.message });
  }
};
