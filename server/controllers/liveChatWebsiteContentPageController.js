const {
  listWebsiteContentPages,
  getWebsiteContentPageById,
  createWebsiteContentPage,
  updateWebsiteContentPage,
  deleteWebsiteContentPage,
} = require('../services/liveChatWebsiteContentPageService');

exports.listPages = async (req, res) => {
  try {
    const rows = await listWebsiteContentPages(req.user.organizationId);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[liveChatWebsiteContentPageController] listPages', err);
    return res.status(500).json({ success: false, message: 'Failed to list website content pages' });
  }
};

exports.getPage = async (req, res) => {
  try {
    const row = await getWebsiteContentPageById(req.user.organizationId, req.params.pageId);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Website content page not found' });
    }
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[liveChatWebsiteContentPageController] getPage', err);
    return res.status(500).json({ success: false, message: 'Failed to load website content page' });
  }
};

exports.createPage = async (req, res) => {
  try {
    const row = await createWebsiteContentPage(req.user.organizationId, req.body || {});
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatWebsiteContentPageController] createPage', err);
    return res.status(500).json({ success: false, message: 'Failed to create website content page' });
  }
};

exports.updatePage = async (req, res) => {
  try {
    const row = await updateWebsiteContentPage(req.user.organizationId, req.params.pageId, req.body || {});
    return res.json({ success: true, data: row });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatWebsiteContentPageController] updatePage', err);
    return res.status(500).json({ success: false, message: 'Failed to update website content page' });
  }
};

exports.deletePage = async (req, res) => {
  try {
    await deleteWebsiteContentPage(req.user.organizationId, req.params.pageId);
    return res.json({ success: true, message: 'Website content page deleted' });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 500) return res.status(status).json({ success: false, message: err.message });
    console.error('[liveChatWebsiteContentPageController] deletePage', err);
    return res.status(500).json({ success: false, message: 'Failed to delete website content page' });
  }
};
