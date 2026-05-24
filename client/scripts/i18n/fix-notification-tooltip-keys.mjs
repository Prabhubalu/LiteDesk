#!/usr/bin/env node
/** Fix bellTooltipUnreadOne/Many spacing after plural migration. */
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES_DIR, SUPPORTED_LANGUAGES } from './shared.mjs';

/** @type {Record<string, { one: string, many: string }>} */
const MESSAGES = {
  en: { one: '{count} unread notification', many: '{count} unread notifications' },
  es: { one: '{count} sin leer notificación', many: '{count} sin leer notificaciones' },
  fr: { one: '{count} notification non lue', many: '{count} notifications non lues' },
  de: { one: '{count} ungelesene Benachrichtigung', many: '{count} ungelesene Benachrichtigungen' },
  hi: { one: '{count} अपठित सूचना', many: '{count} अपठित सूचनाएँ' },
  ja: { one: '{count} 件の未読通知', many: '{count} 件の未読通知' },
  zh: { one: '{count} 条未读通知', many: '{count} 条未读通知' },
  ko: { one: '{count}개의 읽지 않은 알림', many: '{count}개의 읽지 않은 알림' },
  pt: { one: '{count} notificação não lida', many: '{count} notificações não lidas' },
  it: { one: '{count} notifica non letta', many: '{count} notifiche non lette' },
  nl: { one: '{count} ongelezen melding', many: '{count} ongelezen meldingen' },
  ru: { one: '{count} непрочитанное уведомление', many: '{count} непрочитанных уведомлений' },
  ar: { one: '{count} إشعار غير مقروء', many: '{count} إشعارات غير مقروءة' },
};

for (const lang of SUPPORTED_LANGUAGES) {
  const file = path.join(LOCALES_DIR, lang, 'notifications.json');
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const copy = MESSAGES[lang] || MESSAGES.en;
  data.bellTooltipUnreadOne = {
    message: copy.one,
    description: 'Notification bell tooltip when one unread item',
  };
  data.bellTooltipUnreadMany = {
    message: copy.many,
    description: 'Notification bell tooltip when multiple unread items',
  };
  delete data.bellTooltipUnread;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`  fixed notifications/${lang}`);
}
