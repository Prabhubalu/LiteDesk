const Organization = require('../models/Organization');
const {
  fetchCustomerStatement,
  renderStatementCsv,
  renderStatementPdf,
  writeCustomerStatementActivity
} = require('../services/customerStatementService');
const {
  listCreditBalancesForAccount
} = require('../services/customerCreditBalanceService');
const {
  applyCustomerCredit,
  applyCustomerCreditAuto,
  reverseCustomerCreditApplication
} = require('../services/customerCreditApplicationService');

function handleControllerError(res, error) {
  const code = error?.code;
  const status =
    code === 'NOT_FOUND'
      ? 404
      : code === 'VALIDATION' ||
          code === 'INVOICE_NOT_PAYABLE' ||
          code === 'ACCOUNT_MISMATCH' ||
          code === 'CURRENCY_MISMATCH' ||
          code === 'NOTHING_TO_APPLY' ||
          code === 'NO_CREDIT_BALANCE'
        ? 400
        : code === 'EXCEEDS_CREDIT_BALANCE' || code === 'EXCEEDS_AMOUNT_DUE'
          ? 422
          : 500;

  return res.status(status).json({
    success: false,
    message: error?.message || 'Request failed',
    code: code || 'ERROR',
    details: error?.details || undefined
  });
}

async function getCustomerStatementHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const { organizationRefId, currency, fromDate, toDate } = req.query || {};

    if (!organizationRefId) {
      return res.status(400).json({
        success: false,
        message: 'organizationRefId is required',
        code: 'VALIDATION'
      });
    }

    const statement = await fetchCustomerStatement({
      organizationId,
      organizationRefId,
      currency: currency || 'USD',
      fromDate,
      toDate
    });

    return res.json({ success: true, data: statement });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function exportCustomerStatementCsvHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const { organizationRefId, currency, fromDate, toDate } = req.query || {};

    if (!organizationRefId) {
      return res.status(400).json({
        success: false,
        message: 'organizationRefId is required',
        code: 'VALIDATION'
      });
    }

    const statement = await fetchCustomerStatement({
      organizationId,
      organizationRefId,
      currency: currency || 'USD',
      fromDate,
      toDate
    });

    const csv = renderStatementCsv(statement);

    await writeCustomerStatementActivity({
      organizationId,
      organizationRefId,
      userId: req.user._id,
      format: 'csv',
      statement
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="customer-statement-${organizationRefId}.csv"`
    );
    return res.send(csv);
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function exportCustomerStatementPdfHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const { organizationRefId, currency, fromDate, toDate } = req.query || {};

    if (!organizationRefId) {
      return res.status(400).json({
        success: false,
        message: 'organizationRefId is required',
        code: 'VALIDATION'
      });
    }

    const statement = await fetchCustomerStatement({
      organizationId,
      organizationRefId,
      currency: currency || 'USD',
      fromDate,
      toDate
    });

    let accountName = 'Customer';
    try {
      const org = await Organization.findById(organizationRefId).select('name organizationName').lean();
      accountName = org?.name || org?.organizationName || accountName;
    } catch {
      /* ignore */
    }

    const pdf = await renderStatementPdf(statement, { accountName });

    await writeCustomerStatementActivity({
      organizationId,
      organizationRefId,
      userId: req.user._id,
      format: 'pdf',
      statement
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="customer-statement-${organizationRefId}.pdf"`
    );
    return res.send(pdf);
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function listCustomerCreditBalancesHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const { organizationRefId, currency } = req.query || {};

    if (!organizationRefId) {
      return res.status(400).json({
        success: false,
        message: 'organizationRefId is required',
        code: 'VALIDATION'
      });
    }

    const balances = await listCreditBalancesForAccount({
      organizationId,
      organizationRefId,
      currency: currency || null
    });

    return res.json({ success: true, data: balances });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function applyCustomerCreditHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const body = req.body || {};

    let result;
    if (body.autoApply && body.invoiceMongoId) {
      result = await applyCustomerCreditAuto({
        organizationId,
        userId: req.user._id,
        invoiceMongoId: body.invoiceMongoId,
        amountApplied: body.amountApplied || null
      });
    } else {
      result = await applyCustomerCredit({
        organizationId,
        userId: req.user._id,
        customerCreditBalanceMongoId: body.customerCreditBalanceMongoId,
        invoiceMongoId: body.invoiceMongoId,
        amountApplied: body.amountApplied
      });
    }

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

async function reverseCustomerCreditApplicationHandler(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const body = req.body || {};

    const result = await reverseCustomerCreditApplication({
      organizationId,
      userId: req.user._id,
      customerCreditApplicationId: req.params.id,
      reversalReason: body.reversalReason
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

module.exports = {
  getCustomerStatementHandler,
  exportCustomerStatementCsvHandler,
  exportCustomerStatementPdfHandler,
  listCustomerCreditBalancesHandler,
  applyCustomerCreditHandler,
  reverseCustomerCreditApplicationHandler
};
