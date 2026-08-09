/**
 * Click-to-call helpers. Softphone methods are registered by useTelephonySoftphone.
 */

/** @type {null | ((number: string) => Promise<void>)} */
let dialHandler = null;
/** @type {null | (() => void)} */
let openHandler = null;

/**
 * @param {string} raw
 * @returns {string}
 */
export function formatPhoneForDial(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  // Keep leading +, strip other non-digits
  const hasPlus = value.startsWith('+');
  const digits = value.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * @param {{ dial?: (number: string) => Promise<void>, open?: () => void }} handlers
 */
export function registerClickToCallHandlers(handlers = {}) {
  dialHandler = typeof handlers.dial === 'function' ? handlers.dial : null;
  openHandler = typeof handlers.open === 'function' ? handlers.open : null;
}

export function unregisterClickToCallHandlers() {
  dialHandler = null;
  openHandler = null;
}

/**
 * Open softphone (if registered) and dial the number.
 * @param {string} number
 * @returns {Promise<boolean>} true if a dial handler ran
 */
export async function clickToCall(number) {
  const formatted = formatPhoneForDial(number);
  if (!formatted) return false;
  if (openHandler) openHandler();
  if (!dialHandler) return false;
  await dialHandler(formatted);
  return true;
}
