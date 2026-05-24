#!/usr/bin/env node
/** Add useI18n import + const { t } to Vue SFCs that lack it. */
import fs from 'node:fs';
import path from 'node:path';
import { CLIENT_ROOT } from './shared.mjs';

const skip = /HelloWorld|WelcomeItem|\/icons\/|\.legacy\.|EmailSmokeTest|Demo\.vue$|RecordPageExample/;

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith('.vue')) acc.push(full);
  }
  return acc;
}

let n = 0;
for (const file of walk(path.join(CLIENT_ROOT, 'src'))) {
  const rel = path.relative(CLIENT_ROOT, file);
  if (skip.test(rel)) continue;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('useI18n')) continue;

  const scriptMatch = content.match(/<script setup[^>]*>/);
  if (!scriptMatch) continue;

  content = content.replace(
    scriptMatch[0],
    `${scriptMatch[0]}\nimport { useI18n } from 'vue-i18n';`
  );

  const emitMatch = content.match(/const emit = defineEmits\([^)]*\);/);
  const propsMatch = content.match(/const props = defineProps\([\s\S]*?\);/);
  const insertAfter = emitMatch || propsMatch;
  if (insertAfter) {
    const idx = content.indexOf(insertAfter[0]) + insertAfter[0].length;
    content = `${content.slice(0, idx)}\n\nconst { t } = useI18n();${content.slice(idx)}`;
  } else {
    content = content.replace(
      /import \{ useI18n \} from 'vue-i18n';\n/,
      "import { useI18n } from 'vue-i18n';\n\nconst { t } = useI18n();\n"
    );
  }

  fs.writeFileSync(file, content);
  console.log('✓', rel);
  n += 1;
}
console.log(`Added useI18n to ${n} files`);
