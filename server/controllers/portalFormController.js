'use strict';

const formController = require('./formController');
const { submitForm } = require('./formResponseController');
const {
  assertPortalFormAccessible,
  listPortalAccessibleForms
} = require('../services/portalFormAccessService');
const {
  getPortalFormResponseForFill,
  findPortalInProgressFormResponse
} = require('../services/portalResponseService');
const { resolvePortalPersonContext } = require('../services/portalUserScopeService');

async function listPortalFormsHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const limit = parseInt(req.query.limit, 10);
    const skip = parseInt(req.query.skip, 10);
    const { rows, total } = await listPortalAccessibleForms(organizationId, { limit, skip });

    return res.json({
      success: true,
      data: rows,
      total
    });
  } catch (error) {
    console.error('[portalFormController] listPortalForms', error);
    return res.status(500).json({ success: false, message: 'Failed to load forms' });
  }
}

async function getPortalFormHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const formId = req.params.formId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const accessible = await assertPortalFormAccessible(organizationId, formId);
    if (!accessible) {
      return res.status(404).json({ success: false, message: 'Form not found or not available in portal' });
    }

    const prevParams = req.params;
    req.params = { id: formId };
    try {
      return await formController.getFormById(req, res);
    } finally {
      req.params = prevParams;
    }
  } catch (error) {
    console.error('[portalFormController] getPortalForm', error);
    return res.status(500).json({ success: false, message: 'Failed to load form' });
  }
}

async function submitPortalFormHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const formId = req.params.formId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const accessible = await assertPortalFormAccessible(organizationId, formId);
    if (!accessible) {
      return res.status(404).json({ success: false, message: 'Form not found or not available in portal' });
    }

    const { contactIds, businessOrganizationId } = await resolvePortalPersonContext(
      organizationId,
      req.user
    );
    if (!req.body.linkedTo) {
      if (businessOrganizationId) {
        req.body.linkedTo = { type: 'Organization', id: businessOrganizationId };
      } else if (contactIds[0]) {
        req.body.linkedTo = { type: 'Contact', id: contactIds[0] };
      }
    }

    const prevParams = req.params;
    req.params = { id: formId };
    try {
      return await submitForm(req, res);
    } finally {
      req.params = prevParams;
    }
  } catch (error) {
    console.error('[portalFormController] submitPortalForm', error);
    return res.status(500).json({ success: false, message: 'Failed to submit form' });
  }
}

async function getPortalInProgressFormResponseHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const formId = req.params.formId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const accessible = await assertPortalFormAccessible(organizationId, formId);
    if (!accessible) {
      return res.status(404).json({ success: false, message: 'Form not found or not available in portal' });
    }

    const row = await findPortalInProgressFormResponse(organizationId, formId, req.user);
    return res.json({ success: true, data: row });
  } catch (error) {
    console.error('[portalFormController] getPortalInProgressFormResponse', error);
    return res.status(500).json({ success: false, message: 'Failed to load in-progress response' });
  }
}

async function getPortalFormResponseHandler(req, res) {
  try {
    const organizationId = req.user?.organizationId;
    const { formId, responseId } = req.params;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context missing' });
    }

    const accessible = await assertPortalFormAccessible(organizationId, formId);
    if (!accessible) {
      return res.status(404).json({ success: false, message: 'Form not found or not available in portal' });
    }

    const row = await getPortalFormResponseForFill(organizationId, formId, responseId, req.user);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Response not found or access denied' });
    }

    return res.json({ success: true, data: row });
  } catch (error) {
    console.error('[portalFormController] getPortalFormResponse', error);
    return res.status(500).json({ success: false, message: 'Failed to load response' });
  }
}

module.exports = {
  listPortalFormsHandler,
  getPortalFormHandler,
  submitPortalFormHandler,
  getPortalFormResponseHandler,
  getPortalInProgressFormResponseHandler
};
