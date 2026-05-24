#!/usr/bin/env node
/**
 * Hand-tuned cognate overrides per locale (navigation, records, deals, people, orgs, tasks, common).
 * Usage: node scripts/i18n/apply-cognate-patches.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES_DIR } from './shared.mjs';

/** @type {Record<string, Record<string, string>>} */
const PATCHES = {
  de: {
    'navigation.appHelpdesk': 'Kundendienst',
    'navigation.appPortal': 'Kundenportal',
    'navigation.portalAudits': 'Prüfungen',
    'navigation.moduleImports': 'Importe',
    'navigation.moduleAudits': 'Prüfungen',
    'navigation.tabAccount': 'Konto',
    'navigation.appDashboard': '{app}-Übersicht',
    'navigation.tabFormResponseDetail': '({id}) Details',
    'navigation.tabRecordDetail': '{module}-Detail',
    'records.activityEmoji': 'Emoji',
    'records.dealUnstarAria': 'Markierung entfernen',
    'records.taskUnstarAria': 'Markierung entfernen',
    'records.sectionGroupSystem': 'System',
    'deals.sysFieldPipeline': 'Vertriebspipeline',
    'deals.picklistUpsell': 'Upselling',
    'people.peopleDetailInfluencer': 'Influencer',
    'people.peopleDetailMobile': 'Mobiltelefon',
    'people.sysFieldMobile': 'Mobiltelefon',
    'people.sysFieldName': 'Name',
    'people.sysFieldStatus': 'Status',
    'organizations.organizationAuditWidgetTrend': 'Trend',
    'organizations.sysFieldName': 'Name',
    'tasks.sysFieldStatus': 'Status',
    'common.phraseHelpdesk': 'Kundendienst',
    'common.phrasePortal': 'Kundenportal',
    'common.phraseMobile': 'Mobiltelefon',
    'common.phraseInfluencer': 'Influencer',
    'common.phraseEmoji': 'Emoji',
    'common.phraseTrend': 'Trend',
    'common.phraseAccount': 'Konto',
  },
  es: {
    'navigation.appPortal': 'Portal',
    'records.tagsColor': 'Color',
    'people.peopleCreateError': 'Error',
    'people.peopleQuickCreateError': 'Error',
    'organizations.createOrganizationSurfaceError': 'Error',
    'common.phraseColor': 'Color',
  },
  fr: {
    'navigation.attention': "Points d'attention",
    'navigation.moduleContacts': 'Contacts',
    'records.sectionActionFallback': 'Action',
    'deals.sysFieldContactId': 'Contact',
    'deals.sysFieldDescription': 'Description',
    'people.sysFieldMobile': 'Mobile',
    'people.sysFieldDescription': 'Description',
    'people.sysFieldSource': 'Source',
    'navigation.appHelpdesk': 'Service client',
    'common.phraseHelpdesk': 'Service client',
  },
  it: {
    'navigation.tabAccount': 'Account',
    'navigation.appHelpdesk': 'Assistenza clienti',
    'records.activityEmoji': 'Emoji',
    'deals.dealFormModalUpsell': 'Upselling',
    'people.peopleDetailInfluencer': 'Influencer',
    'people.peopleDetailMobile': 'Cellulare',
    'people.sysFieldMobile': 'Cellulare',
    'common.phraseHelpdesk': 'Assistenza clienti',
    'common.phraseMobile': 'Cellulare',
    'common.phraseEmoji': 'Emoji',
    'common.phraseInfluencer': 'Influencer',
  },
  pt: {
    'navigation.appHelpdesk': 'Suporte ao cliente',
    'common.phraseHelpdesk': 'Suporte ao cliente',
  },
  nl: {
    'navigation.moduleDeals': 'Deals',
    'navigation.appHelpdesk': 'Klantenservice',
    'common.phraseHelpdesk': 'Klantenservice',
  },
  ru: {
    'navigation.appHelpdesk': 'Служба поддержки',
    'common.phraseHelpdesk': 'Служба поддержки',
  },
  ar: {
    'navigation.appHelpdesk': 'مكتب المساعدة',
    'common.phraseHelpdesk': 'مكتب المساعدة',
  },
  ja: {
    'navigation.appHelpdesk': 'ヘルプデスク',
    'navigation.tabAccount': 'アカウント',
    'common.phraseHelpdesk': 'ヘルプデスク',
    'common.phraseAccount': 'アカウント',
  },
  zh: {
    'navigation.appHelpdesk': '服务台',
    'common.phraseHelpdesk': '服务台',
  },
  ko: {
    'navigation.appHelpdesk': '헬프데스크',
    'common.phraseHelpdesk': '헬프데스크',
  },
  hi: {
    'navigation.appHelpdesk': 'सहायता केंद्र',
    'common.phraseHelpdesk': 'सहायता केंद्र',
  },
};

function setMessage(catalog, leaf, message) {
  if (!catalog[leaf]) {
    catalog[leaf] = { message, description: 'Hand-tuned cognate override' };
    return;
  }
  catalog[leaf] = { ...catalog[leaf], message };
}

let applied = 0;
for (const [lang, keys] of Object.entries(PATCHES)) {
  const byNs = {};
  for (const [compound, message] of Object.entries(keys)) {
    const dot = compound.indexOf('.');
    const ns = compound.slice(0, dot);
    const leaf = compound.slice(dot + 1);
    if (!byNs[ns]) byNs[ns] = {};
    byNs[ns][leaf] = message;
  }

  for (const [ns, entries] of Object.entries(byNs)) {
    const file = path.join(LOCALES_DIR, lang, `${ns}.json`);
    if (!fs.existsSync(file)) continue;
    const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [leaf, message] of Object.entries(entries)) {
      setMessage(catalog, leaf, message);
      applied += 1;
    }
    fs.writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`);
  }
  console.log(`✓ ${lang}: ${Object.keys(keys).length} patches`);
}

console.log(`Applied ${applied} cognate overrides.`);
