'use strict';

const passwordResetService = require('../services/passwordResetService');
const securityLogger = require('../middleware/securityLoggingMiddleware');

exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    const result = await passwordResetService.requestPasswordReset(email);

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        code: result.code,
        message: result.message
      });
    }

    if (result.sent) {
      securityLogger.logAuthEvent('PASSWORD_RESET_REQUESTED', {
        email: String(email).toLowerCase(),
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
    }

    return res.json({
      success: true,
      message: 'If an account exists for that email, a password reset link has been sent.',
      data: {
        sent: result.sent === true,
        skipped: result.skipped === true
      }
    });
  } catch (error) {
    console.error('[passwordResetAuth] forgotPassword error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error processing password reset request'
    });
  }
};

exports.validateResetPassword = async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const result = await passwordResetService.validateResetToken(token);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        code: result.code,
        message: 'Password reset link is invalid or expired'
      });
    }

    return res.json({
      success: true,
      data: {
        email: result.email
      }
    });
  } catch (error) {
    console.error('[passwordResetAuth] validateResetPassword error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error validating password reset link'
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');
    const result = await passwordResetService.resetPassword({ rawToken: token, password });

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        code: result.code,
        message: result.message
      });
    }

    securityLogger.logAuthEvent('PASSWORD_RESET_COMPLETED', {
      email: result.email,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        email: result.email,
        organizationName: result.organizationName
      }
    });
  } catch (error) {
    console.error('[passwordResetAuth] resetPassword error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error resetting password'
    });
  }
};
