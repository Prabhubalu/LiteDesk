/**
 * Maps notifications and toast options to structured presentation for NotificationContainer.
 */

const HELPDESK_EVENT_TYPES = new Set([
  'CASE_CREATED',
  'CASE_ASSIGNED',
  'CASE_EMAIL_RECEIVED',
  'CASE_CHAT_MESSAGE_RECEIVED',
  'CASE_REOPENED',
  'CASE_ESCALATED',
  'CASE_SLA_WARNING',
  'CASE_SLA_BREACHED',
  'CASE_STATUS_CHANGED'
]);

const HIGH_PRIORITY_EVENTS = new Set([
  'CASE_CREATED',
  'CASE_EMAIL_RECEIVED',
  'CASE_CHAT_MESSAGE_RECEIVED',
  'CASE_ESCALATED',
  'CASE_SLA_BREACHED'
]);

/**
 * @typedef {'success'|'error'|'warning'|'info'|'helpdesk'} ToastVariant
 * @typedef {'info'|'success'|'warning'|'danger'|'neutral'} ToastIconTone
 *
 * @typedef {object} ToastPresentation
 * @property {string} id
 * @property {ToastVariant} variant
 * @property {number} duration
 * @property {string} [appKey]
 * @property {object} [entity]
 * @property {string} [notificationId]
 * @property {string} [eventType]
 * @property {() => void} [onClick]
 * @property {string} iconKey
 * @property {ToastIconTone} iconTone
 * @property {string} category
 * @property {string} primary
 * @property {string|null} [secondary]
 * @property {string|null} [meta]
 * @property {string} ariaLabel
 */

function caseLabelFromEntity(entity) {
  if (!entity) return null;
  const label = String(entity.caseId || entity.title || '').trim();
  return label || null;
}

function parseChatBody(body) {
  const match = String(body || '').match(/^New chat on (.+?) from (.+?)(?::\s*(.+))?$/i);
  if (!match) return null;
  return {
    caseLabel: match[1]?.trim(),
    authorName: match[2]?.trim(),
    preview: match[3]?.trim() || ''
  };
}

function parseEmailBody(body) {
  const match = String(body || '').match(/^New email on (.+?) from (.+?)(?::\s*(.+))?$/i);
  if (!match) return null;
  const rest = match[3]?.trim() || '';
  const dashIdx = rest.indexOf(' — ');
  if (dashIdx >= 0) {
    return {
      caseLabel: match[1]?.trim(),
      fromAddress: match[2]?.trim(),
      subject: rest.slice(0, dashIdx).trim(),
      preview: rest.slice(dashIdx + 3).trim()
    };
  }
  return {
    caseLabel: match[1]?.trim(),
    fromAddress: match[2]?.trim(),
    subject: rest,
    preview: ''
  };
}

/**
 * @param {object} notification
 * @param {(key: string, params?: object) => string} t
 * @returns {ToastPresentation|null}
 */
export function buildHelpdeskToastPresentation(notification, t) {
  if (!notification) return null;

  const eventType = String(notification.eventType || '');
  if (!HELPDESK_EVENT_TYPES.has(eventType)) return null;

  const entity = notification.entity || {};
  const title = String(notification.title || '').trim();
  const body = String(notification.body || '').trim();
  const caseLabel = caseLabelFromEntity(entity);
  const isHighPriority = HIGH_PRIORITY_EVENTS.has(eventType);
  let iconTone = isHighPriority ? 'warning' : 'info';

  let iconKey = 'bell';
  let category = title || t('notifications.toastHelpdeskDefault');
  let primary = '';
  let secondary = null;
  let meta = caseLabel;

  if (eventType === 'CASE_CHAT_MESSAGE_RECEIVED') {
    iconKey = 'user';
    category = t('notifications.toastCategoryChat');
    const parsed = parseChatBody(body);
    primary =
      String(entity.authorName || parsed?.authorName || '').trim() ||
      t('notifications.toastVisitor');
    secondary =
      String(entity.preview || parsed?.preview || '').trim() ||
      body ||
      null;
    if (!meta && parsed?.caseLabel) meta = parsed.caseLabel;
  } else if (eventType === 'CASE_EMAIL_RECEIVED') {
    iconKey = 'envelope';
    category = t('notifications.toastCategoryEmail');
    const parsed = parseEmailBody(body);
    primary =
      String(entity.fromAddress || parsed?.fromAddress || '').trim() ||
      t('notifications.toastUnknownSender');
    const subject = String(entity.subject || parsed?.subject || '').trim();
    const preview = String(entity.preview || parsed?.preview || '').trim();
    secondary = preview || subject || body || null;
    if (!meta && parsed?.caseLabel) meta = parsed.caseLabel;
  } else if (eventType === 'CASE_CREATED') {
    iconKey = 'inbox';
    category = t('notifications.toastCategoryNewCase');
    primary = caseLabel || body.replace(/\s+was created\.?$/i, '').trim() || title;
    secondary = body && primary !== body ? body : null;
  } else if (eventType === 'CASE_ASSIGNED') {
    iconKey = 'userPlus';
    category = t('notifications.toastCategoryAssigned');
    primary = caseLabel || title;
    secondary = body || null;
  } else if (eventType === 'CASE_ESCALATED') {
    iconKey = 'escalation';
    category = t('notifications.toastCategoryEscalated');
    iconTone = 'danger';
    primary = caseLabel || title;
    secondary = body || null;
  } else if (eventType === 'CASE_SLA_WARNING') {
    iconKey = 'clock';
    category = t('notifications.toastCategorySlaWarning');
    primary = caseLabel || title;
    secondary = body || null;
  } else if (eventType === 'CASE_SLA_BREACHED') {
    iconKey = 'exclamation';
    category = t('notifications.toastCategorySlaBreached');
    iconTone = 'danger';
    primary = caseLabel || title;
    secondary = body || null;
  } else if (eventType === 'CASE_REOPENED') {
    iconKey = 'reopen';
    category = t('notifications.toastCategoryReopened');
    primary = caseLabel || title;
    secondary = body || null;
  } else {
    primary = title;
    secondary = body || null;
  }

  const ariaLabel = [category, primary, secondary, meta].filter(Boolean).join('. ');

  return {
    id: `${Date.now()}-${Math.random()}`,
    variant: 'helpdesk',
    duration: isHighPriority ? 6000 : 4500,
    appKey: notification.appKey || 'HELPDESK',
    entity: notification.entity,
    notificationId: notification.id ? String(notification.id) : undefined,
    eventType,
    iconKey,
    iconTone,
    category,
    primary,
    secondary,
    meta,
    ariaLabel
  };
}

/**
 * @param {string} message
 * @param {object} opts
 * @returns {ToastPresentation}
 */
export function buildSimpleToastPresentation(message, opts = {}) {
  const type = opts.type || 'info';
  const iconKeyByType = {
    success: 'check',
    error: 'x',
    warning: 'exclamation',
    info: 'info'
  };

  return {
    id: `${Date.now()}-${Math.random()}`,
    variant: type,
    duration: opts.duration ?? (type === 'error' ? 4000 : 3000),
    appKey: opts.appKey,
    entity: opts.entity,
    notificationId: opts.notificationId,
    eventType: opts.eventType,
    onClick: opts.onClick,
    iconKey: iconKeyByType[type] || 'info',
    iconTone: type === 'error' ? 'danger' : type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'info',
    category: opts.category || null,
    primary: String(message || '').trim(),
    secondary: opts.secondary || null,
    meta: opts.meta || null,
    ariaLabel: String(message || '').trim()
  };
}

/**
 * @param {string|object} messageOrPayload
 * @param {object} [opts]
 * @param {(key: string, params?: object) => string} [t]
 * @returns {ToastPresentation}
 */
export function buildToastPresentation(messageOrPayload, opts = {}, t) {
  if (messageOrPayload && typeof messageOrPayload === 'object' && !Array.isArray(messageOrPayload)) {
    const payload = messageOrPayload;
    if (payload.eventType && t) {
      const helpdesk = buildHelpdeskToastPresentation(payload, t);
      if (helpdesk) return helpdesk;
    }
    if (payload.primary != null) return payload;
    return buildSimpleToastPresentation(payload.message || '', payload);
  }

  if (opts.eventType && opts.appKey === 'HELPDESK' && t) {
    const helpdesk = buildHelpdeskToastPresentation(
      {
        eventType: opts.eventType,
        title: opts.title,
        body: opts.body || messageOrPayload,
        entity: opts.entity,
        id: opts.notificationId,
        appKey: opts.appKey
      },
      t
    );
    if (helpdesk) return helpdesk;
  }

  return buildSimpleToastPresentation(String(messageOrPayload || ''), opts);
}
