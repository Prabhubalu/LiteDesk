#!/usr/bin/env node
/**
 * Fix known vue-i18n compile failures:
 * - notifications.bellTooltipUnread ICU plural → one/many keys
 * - inboxGetStartedTipMentions literal @ → {'@'}
 * - settings integrations email placeholders literal @ → {'@'}
 * - settings.secRequireSpecialDesc password charset literal @ → {'@'}
 */
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES_DIR, SUPPORTED_LANGUAGES } from './shared.mjs';

const PLURAL_RE =
  /^\{count\}\s+(.+?)\s+\{count,\s*plural,\s*one\s+\{(.+?)\}\s+other\s+\{(.+?)\}\}$/;

for (const lang of SUPPORTED_LANGUAGES) {
  const notifPath = path.join(LOCALES_DIR, lang, 'notifications.json');
  if (fs.existsSync(notifPath)) {
    const data = JSON.parse(fs.readFileSync(notifPath, 'utf8'));
  const old = data.bellTooltipUnread?.message;
  if (old) {
      const match = old.match(PLURAL_RE);
      if (match) {
        const [, middle, oneWord, manyWord] = match;
        data.bellTooltipUnreadOne = {
          message: `{count} ${middle} ${oneWord}`.replace(/\s+/g, ' ').trim(),
          description: 'Notification bell tooltip when one unread item',
        };
        data.bellTooltipUnreadMany = {
          message: `{count} ${middle} ${manyWord}`.replace(/\s+/g, ' ').trim(),
          description: 'Notification bell tooltip when multiple unread items',
        };
      } else if (!data.bellTooltipUnreadOne) {
        data.bellTooltipUnreadOne = {
          message: '{count} unread notification',
          description: 'Notification bell tooltip when one unread item',
        };
        data.bellTooltipUnreadMany = {
          message: '{count} unread notifications',
          description: 'Notification bell tooltip when multiple unread items',
        };
      }
      delete data.bellTooltipUnread;
      fs.writeFileSync(notifPath, `${JSON.stringify(data, null, 2)}\n`);
      console.log(`  notifications/${lang}: bellTooltipUnread → one/many`);
    }
  }

  const settingsPath = path.join(LOCALES_DIR, lang, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const placeholderKeys = [
      'integrationsPlaceholderFromEmail',
      'integrationsPlaceholderReplyTo',
      'integrationsPlaceholderSearchEmail',
    ];
    let settingsChanged = false;
    for (const key of placeholderKeys) {
      const msg = settings[key]?.message;
      if (msg && msg.includes('@') && !msg.includes("{'@'}")) {
        settings[key].message = msg.replace(/@/g, "{'@'}");
        settingsChanged = true;
      }
    }
    const secDesc = settings.secRequireSpecialDesc?.message;
    if (secDesc && secDesc.includes('@') && !secDesc.includes("{'@'}")) {
      settings.secRequireSpecialDesc.message = secDesc.replace(/@/g, "{'@'}");
      settingsChanged = true;
    }
    if (settingsChanged) {
      fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
      console.log(`  settings/${lang}: escaped @ in settings.json`);
    }
  }

  const inboxPath = path.join(LOCALES_DIR, lang, 'inbox.json');
  if (!fs.existsSync(inboxPath)) continue;
  const inbox = JSON.parse(fs.readFileSync(inboxPath, 'utf8'));
  const tip = inbox.inboxGetStartedTipMentions?.message;
  if (tip && tip.includes('<strong>@') && !tip.includes("<strong>{'@'}")) {
    inbox.inboxGetStartedTipMentions.message = tip.replace(/<strong>@/g, "<strong>{'@'}");
    fs.writeFileSync(inboxPath, `${JSON.stringify(inbox, null, 2)}\n`);
    console.log(`  inbox/${lang}: escaped @ in inboxGetStartedTipMentions`);
  }
}

console.log('Done.');
