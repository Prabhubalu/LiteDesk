'use strict';

const { normalizeDeviceType } = require('../constants/liveChatVisitorContext');

function parseUserAgent(userAgent) {
  const ua = String(userAgent || '');
  let deviceType = 'desktop';
  if (/ipad|tablet|kindle|playbook/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua)) {
    deviceType = 'mobile';
  }

  let browser = 'Unknown';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = 'Opera';
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = 'Safari';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';

  let operatingSystem = 'Unknown';
  if (/iphone|ipad|ipod/i.test(ua)) operatingSystem = 'iOS';
  else if (/windows nt/i.test(ua)) operatingSystem = 'Windows';
  else if (/mac os x/i.test(ua)) operatingSystem = 'macOS';
  else if (/android/i.test(ua)) operatingSystem = 'Android';
  else if (/cros/i.test(ua)) operatingSystem = 'ChromeOS';
  else if (/linux/i.test(ua)) operatingSystem = 'Linux';

  return {
    browser,
    operatingSystem,
    deviceType: normalizeDeviceType(deviceType),
  };
}

module.exports = {
  parseUserAgent,
};
