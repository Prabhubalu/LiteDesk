'use strict';

const { normalizeDeviceType } = require('../constants/liveChatVisitorContext');

function parseUserAgent(userAgent) {
  const ua = String(userAgent || '');
  let deviceType = 'desktop';
  if (/ipad|tablet|kindle|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone|crios|fxios|edgios/i.test(ua)) {
    deviceType = 'mobile';
  }

  let browser = null;
  if (/edg(?:e|ios|a)?\//i.test(ua)) browser = 'Edge';
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = 'Opera';
  else if (/crios\//i.test(ua)) browser = 'Chrome';
  else if (/fxios\//i.test(ua)) browser = 'Firefox';
  else if (/chrome\//i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua) && !/crios\//i.test(ua)) browser = 'Safari';

  let operatingSystem = null;
  if (/iphone|ipad|ipod/i.test(ua)) operatingSystem = 'iOS';
  else if (/windows nt/i.test(ua)) operatingSystem = 'Windows';
  else if (/mac os x|macintosh/i.test(ua)) operatingSystem = 'macOS';
  else if (/android/i.test(ua)) operatingSystem = 'Android';
  else if (/cros/i.test(ua)) operatingSystem = 'ChromeOS';
  else if (/linux/i.test(ua)) operatingSystem = 'Linux';

  return {
    browser: browser || 'Unknown',
    operatingSystem: operatingSystem || 'Unknown',
    deviceType: normalizeDeviceType(deviceType),
    // Structured nulls for auth/session labeling (avoid storing "Unknown")
    browserLabel: browser,
    osLabel: operatingSystem,
  };
}

module.exports = {
  parseUserAgent,
};
