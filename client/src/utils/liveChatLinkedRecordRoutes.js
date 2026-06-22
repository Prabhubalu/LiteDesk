import { MODULE_LABEL_KEYS } from '@/utils/navigationLabels';

const MODULE_DETAIL_ROUTES = Object.freeze({
  cases: 'helpdesk-cases-detail',
  people: 'person-detail',
  deals: 'deal-detail',
  organizations: 'organization-detail',
  tasks: 'task-detail',
  events: 'event-detail',
  quotes: 'quote-detail',
  documents: 'document-detail',
  items: 'item-detail',
  forms: 'form-detail',
  sales_orders: 'sales-order-detail',
  invoices: 'invoice-detail',
  payments: 'payment-detail',
});

const MODULE_FALLBACK_LABEL_KEYS = Object.freeze({
  cases: 'liveChat.linkedCaseLabel',
  people: 'liveChat.linkedPersonLabel',
  deals: 'liveChat.linkedDealLabel',
  organizations: 'liveChat.linkedOrganizationLabel',
  tasks: 'liveChat.linkedTaskLabel',
  events: 'liveChat.linkedEventLabel',
  quotes: 'liveChat.linkedQuoteLabel',
  documents: 'liveChat.linkedDocumentLabel',
  items: 'liveChat.linkedItemLabel',
  forms: 'liveChat.linkedFormLabel',
  sales_orders: 'liveChat.linkedSalesOrderLabel',
  invoices: 'liveChat.linkedInvoiceLabel',
  payments: 'liveChat.linkedPaymentLabel',
});

export function normalizeLiveChatModuleKey(moduleKey) {
  return String(moduleKey || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function liveChatLinkedRecordRoute(moduleKey, recordId) {
  const key = normalizeLiveChatModuleKey(moduleKey);
  const routeName = MODULE_DETAIL_ROUTES[key];
  const id = String(recordId || '').trim();
  if (!routeName || !id) return null;
  return { name: routeName, params: { id } };
}

export function liveChatLinkedRecordModuleLabelKey(moduleKey) {
  const key = normalizeLiveChatModuleKey(moduleKey);
  return MODULE_LABEL_KEYS[key] || null;
}

export function liveChatLinkedRecordFallbackLabelKey(moduleKey) {
  const key = normalizeLiveChatModuleKey(moduleKey);
  return MODULE_FALLBACK_LABEL_KEYS[key] || 'liveChat.linkedRecordFallback';
}

const MODULE_GROUP_ORDER = Object.freeze([
  'people',
  'organizations',
  'cases',
  'deals',
  'tasks',
  'events',
  'quotes',
  'documents',
  'items',
  'forms',
  'sales_orders',
  'invoices',
  'payments',
]);

export function compareLiveChatModuleKeys(a, b) {
  const aKey = normalizeLiveChatModuleKey(a);
  const bKey = normalizeLiveChatModuleKey(b);
  const aRank = MODULE_GROUP_ORDER.indexOf(aKey);
  const bRank = MODULE_GROUP_ORDER.indexOf(bKey);
  const aScore = aRank === -1 ? 999 : aRank;
  const bScore = bRank === -1 ? 999 : bRank;
  if (aScore !== bScore) return aScore - bScore;
  return aKey.localeCompare(bKey);
}

export function liveChatLinkedRecordSourceLabelKey(source) {
  if (source === 'crm') return 'liveChat.linkedRecordSourceCrm';
  if (source === 'visitor' || source === 'visitor_session') {
    return 'liveChat.linkedRecordSourceVisitor';
  }
  return '';
}
