'use strict';

const {
  buildGoogleAuthorizeUrl,
  completeGoogleOAuthCallback,
  buildMicrosoftAuthorizeUrl,
  completeMicrosoftOAuthCallback,
  disconnectProvider,
  listConnectionStatus,
  isGoogleCalendarConfigured,
  isMicrosoftCalendarConfigured,
  redirectAfterOAuth
} = require('../services/userCalendarOAuthService');

const OAUTH_PROVIDERS = new Set(['google', 'microsoft']);

exports.listConnections = async (req, res) => {
  try {
    const data = await listConnectionStatus({
      organizationId: req.user.organizationId,
      userId: req.user._id
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.oauthStart = async (req, res) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!OAUTH_PROVIDERS.has(provider)) {
      return res.status(400).json({ success: false, message: 'Unsupported provider' });
    }

    if (provider === 'google') {
      const googleReady = await isGoogleCalendarConfigured(req.user.organizationId);
      if (!googleReady) {
        return res.status(400).json({
          success: false,
          message:
            'Google Calendar is not configured. Set GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, and GOOGLE_GMAIL_REDIRECT_URI on the API server (same OAuth app as Gmail), then add redirect URI /api/user/calendar-connections/google/callback.'
        });
      }
    }

    if (provider === 'microsoft' && !isMicrosoftCalendarConfigured()) {
      return res.status(400).json({
        success: false,
        message:
          'Microsoft Calendar is not configured. Set MICROSOFT_CALENDAR_CLIENT_ID and MICROSOFT_CALENDAR_CLIENT_SECRET on the API server.'
      });
    }

    const args = {
      userId: req.user._id,
      organizationId: req.user.organizationId
    };

    const result =
      provider === 'google'
        ? await buildGoogleAuthorizeUrl(args)
        : await buildMicrosoftAuthorizeUrl(args);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.status(200).json({
      success: true,
      data: { url: result.url, redirectUri: result.redirectUri }
    });
  } catch (error) {
    const message =
      error.code === 'GOOGLEAPIS_MISSING' || error.code === 'MODULE_NOT_FOUND'
        ? 'Google Calendar requires server dependencies. Run npm install in the server folder, then restart the API.'
        : error.message;
    res.status(500).json({ success: false, message });
  }
};

exports.googleOAuthCallback = async (req, res) => {
  try {
    const result = await completeGoogleOAuthCallback({
      code: req.query.code,
      state: req.query.state
    });
    return res.redirect(
      redirectAfterOAuth({
        provider: 'google',
        ok: result.ok,
        error: result.error
      })
    );
  } catch (err) {
    console.error('[userCalendar] google callback:', err);
    return res.redirect(
      redirectAfterOAuth({
        provider: 'google',
        ok: false,
        error: err.message || 'oauth_failed'
      })
    );
  }
};

exports.microsoftOAuthCallback = async (req, res) => {
  try {
    const result = await completeMicrosoftOAuthCallback({
      code: req.query.code,
      state: req.query.state
    });
    return res.redirect(
      redirectAfterOAuth({
        provider: 'microsoft',
        ok: result.ok,
        error: result.error
      })
    );
  } catch (err) {
    console.error('[userCalendar] microsoft callback:', err);
    return res.redirect(
      redirectAfterOAuth({
        provider: 'microsoft',
        ok: false,
        error: err.message || 'oauth_failed'
      })
    );
  }
};

exports.disconnect = async (req, res) => {
  try {
    const provider = String(req.params.provider || '').toLowerCase();
    if (!OAUTH_PROVIDERS.has(provider)) {
      return res.status(400).json({ success: false, message: 'Unsupported provider' });
    }

    await disconnectProvider({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      provider
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Google Calendar push notifications (events.watch).
 * Public endpoint — authenticated via X-Goog-Channel-Token.
 */
exports.googlePushNotification = async (req, res) => {
  try {
    const { handleGooglePushNotification } = require('../services/userCalendarInboundSyncService');
    const result = await handleGooglePushNotification(req.headers);
    return res.status(result.status || 200).end();
  } catch (err) {
    console.error('[userCalendar] google push:', err);
    // Still 200 to avoid Google retry storms on app bugs
    return res.status(200).end();
  }
};
