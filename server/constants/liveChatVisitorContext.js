'use strict';

const LIVE_CHAT_DEVICE_TYPES = Object.freeze(['desktop', 'mobile', 'tablet']);

const LIVE_CHAT_JOURNEY_ACTIONS = Object.freeze({
  PAGE_VIEW: 'page_view',
  PAGE_CHANGE: 'page_change',
});

const LIVE_CHAT_JOURNEY_ACTION_VALUES = Object.freeze(Object.values(LIVE_CHAT_JOURNEY_ACTIONS));

function normalizeDeviceType(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return LIVE_CHAT_DEVICE_TYPES.includes(key) ? key : 'desktop';
}

function normalizeJourneyAction(raw) {
  const key = String(raw || '').trim().toLowerCase();
  return LIVE_CHAT_JOURNEY_ACTION_VALUES.includes(key) ? key : LIVE_CHAT_JOURNEY_ACTIONS.PAGE_VIEW;
}

function normalizePageUrl(raw) {
  return String(raw || '').trim().slice(0, 2048);
}

function normalizeReferrerUrl(raw) {
  return String(raw || '').trim().slice(0, 2048);
}

function normalizeLanguage(raw) {
  return String(raw || '').trim().slice(0, 32);
}

function normalizeCountry(raw) {
  const code = String(raw || '').trim().toUpperCase().slice(0, 2);
  return /^[A-Z]{2}$/.test(code) ? code : '';
}

module.exports = {
  LIVE_CHAT_DEVICE_TYPES,
  LIVE_CHAT_JOURNEY_ACTIONS,
  LIVE_CHAT_JOURNEY_ACTION_VALUES,
  normalizeDeviceType,
  normalizeJourneyAction,
  normalizePageUrl,
  normalizeReferrerUrl,
  normalizeLanguage,
  normalizeCountry,
};
