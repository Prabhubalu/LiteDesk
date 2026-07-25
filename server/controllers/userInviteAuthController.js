'use strict';

const userInviteService = require('../services/userInviteService');

exports.validateInvite = async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const result = await userInviteService.validateInviteToken(token);

    if (!result.valid) {
      const messages = {
        INVITE_ALREADY_ACCEPTED: 'This invitation was already accepted. Sign in with your password.',
        TOKEN_EXPIRED: 'This invitation link has expired.',
        TOKEN_MISSING: 'Invitation link is missing a token.',
        TOKEN_INVALID: 'This invitation link is invalid or has expired.'
      };
      return res.status(400).json({
        success: false,
        code: result.code,
        message: messages[result.code] || messages.TOKEN_INVALID,
        data: result.email
          ? {
              email: result.email,
              organizationName: result.organizationName || null
            }
          : undefined
      });
    }

    return res.json({
      success: true,
      data: {
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        organizationName: result.organizationName,
        isWorkspaceActivation: result.isWorkspaceActivation === true,
        entitledApps: result.entitledApps || []
      }
    });
  } catch (error) {
    console.error('[userInviteAuth] validateInvite error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error validating invitation'
    });
  }
};

exports.acceptInvite = async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');
    const profile = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      timeZone: req.body.timeZone,
      language: req.body.language
    };

    const result = await userInviteService.acceptInvite({ rawToken: token, password, profile });
    if (!result.ok) {
      const status = result.code === 'VALIDATION_ERROR' ? 400 : 400;
      return res.status(status).json({
        success: false,
        code: result.code,
        message: result.message,
        data: result.email
          ? {
              email: result.email,
              organizationName: result.organizationName || null
            }
          : undefined
      });
    }

    return res.json({
      success: true,
      message: 'Invitation accepted successfully',
      data: {
        email: result.email,
        organizationName: result.organizationName,
        session: result.session
      }
    });
  } catch (error) {
    console.error('[userInviteAuth] acceptInvite error:', error?.message || error);
    if (error?.stack) {
      console.error('[userInviteAuth] acceptInvite stack:', error.stack);
    }
    return res.status(500).json({
      success: false,
      message: 'Server error accepting invitation',
      ...(process.env.NODE_ENV === 'development' && error?.message
        ? { error: error.message }
        : {})
    });
  }
};

exports.confirmEmailVerification = async (req, res) => {
  try {
    const token = String(req.query.token || req.body.token || '').trim();
    const result = await userInviteService.confirmEmailVerification(token);

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        code: result.code,
        message: result.message
      });
    }

    return res.json({
      success: true,
      message: result.alreadyVerified ? 'Email already verified' : 'Email verified successfully',
      data: {
        email: result.email,
        organizationName: result.organizationName,
        alreadyVerified: result.alreadyVerified === true
      }
    });
  } catch (error) {
    console.error('[userInviteAuth] confirmEmailVerification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error verifying email'
    });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const result = await userInviteService.resendVerificationForUser(
      req.user._id,
      req.user.organizationId
    );

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        code: result.code,
        message: result.message || 'Unable to resend verification email'
      });
    }

    if (result.alreadyVerified) {
      return res.json({
        success: true,
        message: 'Email is already verified',
        data: { sent: false, alreadyVerified: true }
      });
    }

    return res.json({
      success: true,
      message: result.sent ? 'Verification email sent' : 'Verification email could not be sent',
      data: {
        sent: result.sent === true,
        skipped: result.skipped === true,
        reason: result.reason || null
      }
    });
  } catch (error) {
    console.error('[userInviteAuth] resendVerification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error resending verification email'
    });
  }
};
